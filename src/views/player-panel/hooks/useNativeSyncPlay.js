import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {
	getBoundedSyncPlayDriftCorrection,
	ServerClockOffsetEstimator
} from '../../../utils/syncTiming';
import {useSyncPlay} from '../../../contexts/SyncPlayContext';
import {
	getSyncPlayCommandTargetSeconds,
	isSyncPlayVideoReady
} from '../../../utils/syncPlayState';

const TICKS_PER_SECOND = 10000000;
const BUFFERING_REPORT_DELAY_MS = 3000;

export const useNativeSyncPlay = ({
	isActive,
	item,
	playbackGeneration,
	videoRef,
	handleLocalPause,
	handleLocalPlay,
	handleLocalSeek,
	syncPlayStartupBridge,
	setToastMessage,
	blocked = false
}) => {
	const syncPlay = useSyncPlay();
	const group = syncPlay.group;
	const [popupOpen, setPopupOpen] = useState(false);
	const [connectionGeneration, setConnectionGeneration] = useState(0);
	const estimatorRef = useRef(new ServerClockOffsetEstimator());
	const targetRef = useRef(null);
	const forceNextSeekRef = useRef(true);
	const scheduledCommandRef = useRef(null);
	const lastCommandKeyRef = useRef('');
	const lastReadyKeyRef = useRef('');
	const clockReadyRef = useRef(false);
	const queuedCommandRef = useRef(null);
	const initialReadySentRef = useRef(false);
	const readyPendingRef = useRef(false);
	const bufferingTimerRef = useRef(null);
	const bufferingReportedRef = useRef(false);
	const seekReadyPendingRef = useRef(false);
	const readyGenerationRef = useRef(0);
	const reportReadyRef = useRef(() => Promise.resolve(false));
	const flushQueuedCommandRef = useRef(() => {});
	const blockedRef = useRef(blocked);
	blockedRef.current = blocked;

	const resetRate = useCallback(() => {
		if (videoRef.current) videoRef.current.playbackRate = 1;
	}, [videoRef]);

	const makeStateRequest = useCallback(() => {
		const video = videoRef.current;
		return {
			When: new Date(Date.now() + estimatorRef.current.offsetMs).toISOString(),
			PositionTicks: Math.floor((video?.currentTime || 0) * TICKS_PER_SECOND),
			IsPlaying: Boolean(video && !video.paused),
			PlaylistItemId: syncPlay.queue?.activePlaylistItemId || undefined
		};
	}, [syncPlay.queue?.activePlaylistItemId, videoRef]);

	const applyTargetCorrection = useCallback((forceSeek = false) => {
		const video = videoRef.current;
		const target = targetRef.current;
		if (!video || !target || (video.paused && !forceSeek)) {
			resetRate();
			return;
		}
		const serverNow = Date.now() + estimatorRef.current.offsetMs;
		const targetSeconds = getSyncPlayCommandTargetSeconds({
			positionTicks: target.positionTicks,
			when: target.when,
			serverNowMs: serverNow
		});
		if (!Number.isFinite(targetSeconds)) {
			targetRef.current = null;
			resetRate();
			return;
		}
		const driftMs = (targetSeconds - video.currentTime) * 1000;
		const correction = getBoundedSyncPlayDriftCorrection(driftMs, {
			forceSeek,
			hardSeekApplied: target.hardSeekApplied === true
		});
		if (correction.action === 'seek') {
			video.currentTime = Math.max(0, targetSeconds);
			target.hardSeekApplied = true;
		}
		video.playbackRate = correction.playbackRate;
	}, [resetRate, videoRef]);

	const getAuthoritativePosition = useCallback(() => {
		const video = videoRef.current;
		const target = targetRef.current;
		if (!target) return Number(video?.currentTime) || 0;
		const targetSeconds = getSyncPlayCommandTargetSeconds({
			positionTicks: target.positionTicks,
			when: target.when,
			serverNowMs: Date.now() + estimatorRef.current.offsetMs
		});
		return Number.isFinite(targetSeconds)
			? Math.max(0, targetSeconds)
			: (Number(video?.currentTime) || 0);
	}, [videoRef]);

	const executeCommand = useCallback((command) => {
		const video = videoRef.current;
		if (!video || !command?.Command || syncPlay.followMode !== 'following') return;
		if (command.PlaylistItemId && command.PlaylistItemId !== syncPlay.queue?.activePlaylistItemId) return;
		const commandKey = [command.Command, command.When, command.PositionTicks, command.PlaylistItemId].join('|');
		if (commandKey === lastCommandKeyRef.current) return;
		lastCommandKeyRef.current = commandKey;
		const whenMs = Date.parse(command.When);
		const positionTicks = Number(command.PositionTicks);
		const run = () => {
			if (blockedRef.current) {
				lastCommandKeyRef.current = '';
				queuedCommandRef.current = command;
				return;
			}
			switch (command.Command) {
				case 'Pause':
					video.pause();
					targetRef.current = null;
					resetRate();
					break;
				case 'Unpause':
					if (Number.isFinite(positionTicks)) {
						targetRef.current = {
							positionTicks,
							when: Number.isFinite(whenMs)
								? command.When
								: new Date(Date.now() + estimatorRef.current.offsetMs).toISOString(),
							hardSeekApplied: false
						};
						applyTargetCorrection(forceNextSeekRef.current);
						forceNextSeekRef.current = false;
					}
					Promise.resolve(
						syncPlayStartupBridge?.startAuthoritativePlayback()
					)
						.then(async (startedByCoordinator) => {
							if (startedByCoordinator === true) {
								return;
							}

							if (video.paused) {
								await video.play();
							}
						})
						.then(() => applyTargetCorrection(false))
						.catch(() => setToastMessage({
							message: 'SyncPlay could not start local playback.',
							severity: 'warning'
						}));
					break;
				case 'Seek':
					if (Number.isFinite(positionTicks)) {
						seekReadyPendingRef.current = true;
						lastReadyKeyRef.current = '';

						video.currentTime = Math.max(
							0,
							positionTicks / TICKS_PER_SECOND
						);
					}

					targetRef.current = null;
					resetRate();
					break;
				case 'Stop':
					video.pause();
					video.currentTime = 0;
					targetRef.current = null;
					seekReadyPendingRef.current = false;
					resetRate();
					break;
				default:
					break;
			}
		};
		clearTimeout(scheduledCommandRef.current);
		const localWhen = Number.isFinite(whenMs)
			? whenMs - estimatorRef.current.offsetMs
			: Date.now();
		scheduledCommandRef.current = setTimeout(run, Math.max(0, localWhen - Date.now()));
	}, [
		applyTargetCorrection,
		resetRate,
		setToastMessage,
		syncPlay.followMode,
		syncPlay.queue?.activePlaylistItemId,
		syncPlayStartupBridge,
		videoRef
	]);

	const flushQueuedCommand = useCallback(() => {
		const queuedCommand = queuedCommandRef.current;
		if (!queuedCommand) return;
		if (
			queuedCommand.Command === 'Unpause' &&
			!initialReadySentRef.current
		) {
			return;
		}
		queuedCommandRef.current = null;
		executeCommand(queuedCommand);
	}, [executeCommand]);

	const reportReady = useCallback(async () => {
		const video = videoRef.current;
		if (
			!clockReadyRef.current ||
			!video ||
			!isSyncPlayVideoReady(video) ||
			syncPlay.followMode !== 'following'
		) {
			readyPendingRef.current = true;
			return false;
		}
		const readyKey = [
			item?.Id || '',
			syncPlay.queue?.activePlaylistItemId || '',
			video.currentSrc || video.src
		].join('|');
		if (
			readyKey === lastReadyKeyRef.current &&
			initialReadySentRef.current &&
			!bufferingReportedRef.current
		) {
			readyPendingRef.current = false;
			flushQueuedCommand();
			return true;
		}
		readyPendingRef.current = false;
		const readyGeneration = readyGenerationRef.current;
		try {
			await jellyfinService.syncPlayReady(makeStateRequest());
			if (readyGeneration !== readyGenerationRef.current) return false;
			initialReadySentRef.current = true;
			bufferingReportedRef.current = false;
			lastReadyKeyRef.current = readyKey;
			flushQueuedCommand();
			return true;
		} catch (_) {
			readyPendingRef.current = true;
			lastReadyKeyRef.current = '';
			return false;
		}
	}, [
		flushQueuedCommand,
		item?.Id,
		makeStateRequest,
		syncPlay.followMode,
		syncPlay.queue?.activePlaylistItemId,
		videoRef
	]);

	const processCommand = useCallback((command) => {
		const video = videoRef.current;
		if (!command?.Command || syncPlay.followMode !== 'following') return;
		if (
			blocked ||
			!clockReadyRef.current ||
			!video ||
			!isSyncPlayVideoReady(video) ||
			(command.Command === 'Unpause' && !initialReadySentRef.current)
		) {
			queuedCommandRef.current = command;
			return;
		}
		executeCommand(command);
	}, [blocked, executeCommand, syncPlay.followMode, videoRef]);

	useEffect(() => {
		if (!blocked) flushQueuedCommand();
	}, [blocked, flushQueuedCommand]);

	useEffect(() => {
		reportReadyRef.current = reportReady;
		flushQueuedCommandRef.current = flushQueuedCommand;
	}, [flushQueuedCommand, reportReady]);

	useLayoutEffect(() => {
		if (!syncPlayStartupBridge) return undefined;
		const shouldBlockAutomaticStart = () => (
			isActive &&
			Boolean(group?.GroupId) &&
			syncPlay.followMode === 'following'
		);
		return syncPlayStartupBridge.registerSyncPlayHandlers({
			shouldBlockAutomaticStart,
			reportVideoReady: reportReady,
			getAuthoritativePosition
		});
	}, [
		group?.GroupId,
		getAuthoritativePosition,
		isActive,
		reportReady,
		syncPlay.followMode,
		syncPlayStartupBridge
	]);

	useEffect(() => {
		if (!isActive) return undefined;
		const unsubscribeCommand = jellyfinService.onWebSocketMessage('SyncPlayCommand', (message) => {
			processCommand(message?.Data);
		});
		const unsubscribeConnection = jellyfinService.onWebSocketMessage('ConnectionStateChanged', ({state}) => {
			if (state !== 'open') {
				clockReadyRef.current = false;
				resetRate();
			} else {
				setConnectionGeneration((generation) => generation + 1);
			}
		});
		return () => {
			unsubscribeCommand();
			unsubscribeConnection();
			clearTimeout(scheduledCommandRef.current);
			clearTimeout(bufferingTimerRef.current);
			resetRate();
		};
	}, [isActive, processCommand, resetRate]);

	useEffect(() => {
		if (group?.GroupId) {
			forceNextSeekRef.current = true;
			return;
		}
		setPopupOpen(false);
		targetRef.current = null;
		clockReadyRef.current = false;
		readyGenerationRef.current += 1;
		queuedCommandRef.current = null;
		initialReadySentRef.current = false;
		readyPendingRef.current = false;
		bufferingReportedRef.current = false;
		seekReadyPendingRef.current = false;
		clearTimeout(bufferingTimerRef.current);
		resetRate();
	}, [group?.GroupId, resetRate]);

	useEffect(() => {
		queuedCommandRef.current = null;
	}, [item?.Id]);

	useEffect(() => {
		clearTimeout(scheduledCommandRef.current);
		clearTimeout(bufferingTimerRef.current);
		readyGenerationRef.current += 1;
		scheduledCommandRef.current = null;
		bufferingTimerRef.current = null;
		targetRef.current = null;
		forceNextSeekRef.current = true;
		lastCommandKeyRef.current = '';
		lastReadyKeyRef.current = '';
		initialReadySentRef.current = false;
		readyPendingRef.current = false;
		bufferingReportedRef.current = false;
		seekReadyPendingRef.current = false;
		resetRate();
	}, [item?.Id, playbackGeneration, resetRate]);

	useEffect(() => {
		if (syncPlay.followMode === 'following') return;
		clearTimeout(scheduledCommandRef.current);
		scheduledCommandRef.current = null;
		clearTimeout(bufferingTimerRef.current);
		readyGenerationRef.current += 1;
		bufferingTimerRef.current = null;
		targetRef.current = null;
		queuedCommandRef.current = null;
		lastReadyKeyRef.current = '';
		initialReadySentRef.current = false;
		readyPendingRef.current = false;
		bufferingReportedRef.current = false;
		seekReadyPendingRef.current = false;
		resetRate();
	}, [resetRate, syncPlay.followMode]);

	useEffect(() => {
		if (!isActive || !group?.GroupId) return undefined;
		let cancelled = false;
		let timer = null;
		let sampleCount = 0;
		estimatorRef.current.reset();
		clockReadyRef.current = false;
		const sampleClock = async () => {
			try {
				const sample = await jellyfinService.sampleSyncPlayClock();
				if (cancelled) return;
				const {pingMs} = estimatorRef.current.recordTimeSync(sample);
				clockReadyRef.current = true;
				jellyfinService.syncPlayPing({Ping: Math.max(0, Math.round(pingMs))}).catch(() => {});
				if (readyPendingRef.current) {
					reportReadyRef.current();
				} else {
					flushQueuedCommandRef.current();
				}
			} catch (_) {
				// Keep commands queued until a valid server clock sample is available.
			}
			if (cancelled) return;
			sampleCount += 1;
			timer = setTimeout(sampleClock, sampleCount < 3 ? 1000 : 60000);
		};
		sampleClock();
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [connectionGeneration, group?.GroupId, isActive]);

	useEffect(() => {
		if (!isActive || !group?.GroupId || syncPlay.followMode !== 'following') return undefined;
		const interval = setInterval(() => applyTargetCorrection(false), 500);
		return () => clearInterval(interval);
	}, [applyTargetCorrection, group?.GroupId, isActive, syncPlay.followMode]);

	useEffect(() => {
		const video = videoRef.current;
		if (!isActive || !group?.GroupId || syncPlay.followMode !== 'following' || !video) return undefined;
		const clearBufferingTimer = () => {
			clearTimeout(bufferingTimerRef.current);
			bufferingTimerRef.current = null;
		};
		const onWaiting = () => {
			if (!initialReadySentRef.current) return;
			clearBufferingTimer();
			resetRate();
			bufferingTimerRef.current = setTimeout(() => {
				bufferingTimerRef.current = null;
				if (video.paused || syncPlay.followMode !== 'following') return;
				forceNextSeekRef.current = true;
				lastReadyKeyRef.current = '';
				bufferingReportedRef.current = true;
				jellyfinService.syncPlayBuffering(makeStateRequest()).catch(() => {
					bufferingReportedRef.current = false;
				});
			}, BUFFERING_REPORT_DELAY_MS);
		};
		const onSeeked = () => {
			if (!seekReadyPendingRef.current) {
				return;
			}

			reportReadyRef.current().then((reported) => {
				if (reported) {
					seekReadyPendingRef.current = false;
				}
			});
		};
		const onPlaying = () => {
			clearBufferingTimer();
			if (bufferingReportedRef.current) {
				readyPendingRef.current = true;
				reportReadyRef.current();
			}
		};
		video.addEventListener('waiting', onWaiting);
		video.addEventListener('playing', onPlaying);
		video.addEventListener('seeked', onSeeked);
		if (!video.paused) onPlaying();
		return () => {
			clearBufferingTimer();
			video.removeEventListener('waiting', onWaiting);
			video.removeEventListener('playing', onPlaying);
			video.removeEventListener('seeked', onSeeked);
		};
	}, [
		group?.GroupId,
		isActive,
		makeStateRequest,
		resetRate,
		syncPlay.followMode,
		videoRef
	]);

	const handlePause = useCallback(() => {
		if (blocked) return;
		if (!group) return handleLocalPause();
		resetRate();
		return jellyfinService.syncPlayPause().catch(() => setToastMessage('SyncPlay pause failed'));
	}, [blocked, group, handleLocalPause, resetRate, setToastMessage]);
	const handlePlay = useCallback(() => {
		if (blocked) return;
		if (!group) return handleLocalPlay();
		return jellyfinService.syncPlayPlay().catch(() => setToastMessage('SyncPlay play failed'));
	}, [blocked, group, handleLocalPlay, setToastMessage]);
	const handleSeek = useCallback((event) => {
		if (blocked) return;
		if (!group) return handleLocalSeek(event);
		const position = Number(event?.value);
		if (!Number.isFinite(position)) return undefined;
		resetRate();
		return jellyfinService.syncPlaySeek({
			PositionTicks: Math.floor(position * TICKS_PER_SECOND)
		}).catch(() => setToastMessage('SyncPlay seek failed'));
	}, [blocked, group, handleLocalSeek, resetRate, setToastMessage]);
	const leaveGroup = useCallback(async () => {
		await syncPlay.leaveGroup();
		setPopupOpen(false);
	}, [syncPlay]);
	const openPopup = useCallback(() => setPopupOpen(true), []);
	const closePopup = useCallback(() => setPopupOpen(false), []);
	const handleBack = useCallback(() => {
		if (!popupOpen) return false;
		setPopupOpen(false);
		return true;
	}, [popupOpen]);

	return {
		group,
		popupOpen,
		openPopup,
		closePopup,
		leaveGroup,
		handleBack,
		handlePause,
		handlePlay,
		handleSeek,
		next: syncPlay.next,
		previous: syncPlay.previous,
		startGroupPlayback: syncPlay.startGroupPlayback,
		followMode: syncPlay.followMode,
		groupState: syncPlay.groupState
	};
};
