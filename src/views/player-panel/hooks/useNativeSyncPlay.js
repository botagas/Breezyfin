import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {
	getSyncPlayDriftCorrection,
	ServerClockOffsetEstimator
} from '../../../utils/syncTiming';

const TICKS_PER_SECOND = 10000000;

export const useNativeSyncPlay = ({
	isActive,
	item,
	videoRef,
	handleLocalPause,
	handleLocalPlay,
	handleLocalSeek,
	setToastMessage
}) => {
	const [group, setGroup] = useState(() => jellyfinService.getSyncPlayState());
	const [popupOpen, setPopupOpen] = useState(false);
	const [connectionGeneration, setConnectionGeneration] = useState(0);
	const estimatorRef = useRef(new ServerClockOffsetEstimator());
	const targetRef = useRef(null);
	const forceNextSeekRef = useRef(true);
	const scheduledCommandRef = useRef(null);

	const resetRate = useCallback(() => {
		if (videoRef.current) videoRef.current.playbackRate = 1;
	}, [videoRef]);

	const applyTargetCorrection = useCallback((forceSeek = false) => {
		const video = videoRef.current;
		const target = targetRef.current;
		if (!video || !target || video.paused) {
			resetRate();
			return;
		}
		const serverNow = Date.now() + estimatorRef.current.offsetMs;
		const targetSeconds = target.positionSeconds + Math.max(0, (serverNow - target.whenMs) / 1000);
		const driftMs = (targetSeconds - video.currentTime) * 1000;
		const correction = getSyncPlayDriftCorrection(driftMs, {forceSeek});
		if (correction.action === 'seek') video.currentTime = Math.max(0, targetSeconds);
		video.playbackRate = correction.playbackRate;
	}, [resetRate, videoRef]);

	const executeCommand = useCallback((command) => {
		const video = videoRef.current;
		if (!video || !command?.Command) return;
		const whenMs = Date.parse(command.When);
		const positionSeconds = Number(command.PositionTicks) / TICKS_PER_SECOND;
		const run = () => {
			switch (command.Command) {
				case 'Pause':
					video.pause();
					targetRef.current = null;
					resetRate();
					break;
				case 'Unpause':
					if (Number.isFinite(positionSeconds)) {
						targetRef.current = {
							positionSeconds,
							whenMs: Number.isFinite(whenMs) ? whenMs : Date.now() + estimatorRef.current.offsetMs
						};
						applyTargetCorrection(forceNextSeekRef.current);
						forceNextSeekRef.current = false;
					}
					video.play().catch(() => {});
					break;
				case 'Seek':
					if (Number.isFinite(positionSeconds)) video.currentTime = Math.max(0, positionSeconds);
					targetRef.current = null;
					resetRate();
					break;
				case 'Stop':
					video.pause();
					video.currentTime = 0;
					targetRef.current = null;
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
	}, [applyTargetCorrection, resetRate, videoRef]);

	useEffect(() => {
		if (!isActive) return undefined;
		const unsubscribeState = jellyfinService.subscribeSyncPlayState((nextGroup) => {
			setGroup(nextGroup);
			if (!nextGroup) {
				setPopupOpen(false);
				targetRef.current = null;
				resetRate();
			} else {
				forceNextSeekRef.current = true;
			}
		});
		const unsubscribeCommand = jellyfinService.onWebSocketMessage('SyncPlayCommand', (message) => {
			executeCommand(message?.Data);
		});
		const unsubscribeConnection = jellyfinService.onWebSocketMessage('ConnectionStateChanged', ({state}) => {
			if (state !== 'open') {
				resetRate();
			} else {
				setConnectionGeneration((generation) => generation + 1);
			}
		});
		return () => {
			unsubscribeState();
			unsubscribeCommand();
			unsubscribeConnection();
			clearTimeout(scheduledCommandRef.current);
			resetRate();
		};
	}, [executeCommand, isActive, resetRate]);

	useEffect(() => {
		targetRef.current = null;
		forceNextSeekRef.current = true;
		resetRate();
	}, [item?.Id, resetRate]);

	useEffect(() => {
		if (!isActive || !group?.GroupId) return undefined;
		let cancelled = false;
		let timer = null;
		let sampleCount = 0;
		estimatorRef.current.reset();
		const sampleClock = async () => {
			try {
				const sample = await jellyfinService.sampleSyncPlayClock();
				if (cancelled) return;
				const {pingMs} = estimatorRef.current.recordTimeSync(sample);
				await jellyfinService.syncPlayPing({Ping: Math.max(0, Math.round(pingMs))});
			} catch (_) {
				// Playback commands still work with a zero offset while the next sample retries.
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
		if (!isActive || !group) return undefined;
		const interval = setInterval(() => applyTargetCorrection(false), 500);
		return () => clearInterval(interval);
	}, [applyTargetCorrection, group, isActive]);

	useEffect(() => {
		const video = videoRef.current;
		if (!isActive || !group || !video) return undefined;
		const makeStateRequest = () => ({
			When: new Date().toISOString(),
			PositionTicks: Math.floor((video.currentTime || 0) * TICKS_PER_SECOND),
			IsPlaying: !video.paused
		});
		const onWaiting = () => {
			forceNextSeekRef.current = true;
			resetRate();
			jellyfinService.syncPlayBuffering(makeStateRequest()).catch(() => {});
		};
		const onReady = () => jellyfinService.syncPlayReady(makeStateRequest()).catch(() => {});
		video.addEventListener('waiting', onWaiting);
		video.addEventListener('canplay', onReady);
		return () => {
			video.removeEventListener('waiting', onWaiting);
			video.removeEventListener('canplay', onReady);
		};
	}, [group, isActive, resetRate, videoRef]);

	const handlePause = useCallback(() => {
		if (!group) return handleLocalPause();
		resetRate();
		return jellyfinService.syncPlayPause().catch(() => setToastMessage('SyncPlay pause failed'));
	}, [group, handleLocalPause, resetRate, setToastMessage]);
	const handlePlay = useCallback(() => {
		if (!group) return handleLocalPlay();
		return jellyfinService.syncPlayPlay().catch(() => setToastMessage('SyncPlay play failed'));
	}, [group, handleLocalPlay, setToastMessage]);
	const handleSeek = useCallback((event) => {
		if (!group) return handleLocalSeek(event);
		const position = Number(event?.value);
		if (!Number.isFinite(position)) return undefined;
		resetRate();
		return jellyfinService.syncPlaySeek({
			PositionTicks: Math.floor(position * TICKS_PER_SECOND)
		}).catch(() => setToastMessage('SyncPlay seek failed'));
	}, [group, handleLocalSeek, resetRate, setToastMessage]);
	const leaveGroup = useCallback(async () => {
		try {
			await jellyfinService.leaveSyncPlayGroup();
		} finally {
			jellyfinService.setSyncPlayGroup(null);
			setPopupOpen(false);
		}
	}, []);
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
		handleSeek
	};
};
