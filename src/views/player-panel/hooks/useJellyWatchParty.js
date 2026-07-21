import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {getSyncPlayDriftCorrection} from '../../../utils/syncTiming';

const SYNC_SUPPRESSION_MS = 2000;

export const useJellyWatchParty = ({
	isActive,
	item,
	videoRef,
	handleLocalPause,
	handleLocalPlay,
	handleLocalSeek,
	setToastMessage
}) => {
	const [availability, setAvailability] = useState({available: false, hideNativeSyncButton: false});
	const [state, setState] = useState(() => jellyfinService.getWatchPartyState());
	const [popupOpen, setPopupOpen] = useState(false);
	const targetRef = useRef(null);
	const scheduledActionRef = useRef(null);
	const suppressUntilRef = useRef(0);
	const forceNextSeekRef = useRef(true);

	const resetRate = useCallback(() => {
		if (videoRef.current) videoRef.current.playbackRate = 1;
	}, [videoRef]);

	const isCurrentRoomMedia = useCallback((room = state.room) => (
		!room?.mediaId || !item?.Id || String(room.mediaId) === String(item.Id)
	), [item?.Id, state.room]);

	const beginProgrammaticSync = useCallback(() => {
		suppressUntilRef.current = Date.now() + SYNC_SUPPRESSION_MS;
	}, []);

	const applyDriftCorrection = useCallback((forceSeek = false) => {
		const video = videoRef.current;
		const target = targetRef.current;
		if (!video || !target || video.paused || state.room?.isHost || !isCurrentRoomMedia()) {
			resetRate();
			return;
		}
		const serverNow = jellyfinService.getWatchPartyServerNow();
		const expectedPosition = target.position + Math.max(0, (serverNow - target.serverTimestamp) / 1000);
		const driftMs = (expectedPosition - video.currentTime) * 1000;
		const correction = getSyncPlayDriftCorrection(driftMs, {forceSeek});
		if (correction.action === 'seek') {
			beginProgrammaticSync();
			video.currentTime = Math.max(0, expectedPosition);
		}
		video.playbackRate = correction.playbackRate;
	}, [beginProgrammaticSync, isCurrentRoomMedia, resetRate, state.room?.isHost, videoRef]);

	const applyRoomState = useCallback((message) => {
		const roomState = message?.payload?.state;
		const video = videoRef.current;
		const localClientId = state.clientId || message?.client;
		const isHost = Boolean(localClientId && message?.payload?.host_id === localClientId);
		if (!video || isHost || state.room?.isHost || !roomState || !isCurrentRoomMedia()) return;
		const position = Number(roomState.position);
		if (!Number.isFinite(position)) return;
		beginProgrammaticSync();
		video.currentTime = Math.max(0, position);
		targetRef.current = {
			position: Math.max(0, position),
			serverTimestamp: Number(message.server_ts) || jellyfinService.getWatchPartyServerNow()
		};
		if (roomState.play_state === 'playing') video.play().catch(() => {});
		else video.pause();
		forceNextSeekRef.current = true;
	}, [beginProgrammaticSync, isCurrentRoomMedia, state.clientId, state.room?.isHost, videoRef]);

	const applyPlayerEvent = useCallback((message) => {
		const video = videoRef.current;
		const payload = message?.payload;
		if (!video || state.room?.isHost || !payload || !isCurrentRoomMedia()) return;
		const position = Number(payload.position);
		if (!Number.isFinite(position)) return;
		const targetServerTimestamp = Number(payload.target_server_ts) || Number(message.server_ts) || jellyfinService.getWatchPartyServerNow();
		const run = () => {
			beginProgrammaticSync();
			resetRate();
			const lateBySeconds = Math.max(0, jellyfinService.getWatchPartyServerNow() - targetServerTimestamp) / 1000;
			const adjustedPosition = payload.action === 'play' ? position + lateBySeconds : position;
			if (Math.abs(video.currentTime - adjustedPosition) > 0.25 || payload.action !== 'play') {
				video.currentTime = Math.max(0, adjustedPosition);
			}
			switch (payload.action) {
				case 'play':
					targetRef.current = {position, serverTimestamp: targetServerTimestamp};
					video.play().catch(() => {});
					break;
				case 'pause':
				case 'buffering':
					targetRef.current = null;
					video.pause();
					break;
				case 'seek':
					targetRef.current = video.paused ? null : {
						position,
						serverTimestamp: targetServerTimestamp
					};
					break;
				default:
					break;
			}
		};
		clearTimeout(scheduledActionRef.current);
		const delay = Math.max(0, targetServerTimestamp - jellyfinService.getWatchPartyServerNow());
		scheduledActionRef.current = setTimeout(run, delay);
	}, [beginProgrammaticSync, isCurrentRoomMedia, resetRate, state.room?.isHost, videoRef]);

	const applyStateUpdate = useCallback((message) => {
		const video = videoRef.current;
		const payload = message?.payload;
		if (!video || state.room?.isHost || !payload || !isCurrentRoomMedia()) return;
		const position = Number(payload.position);
		if (!Number.isFinite(position)) return;
		const playing = payload.play_state === 'playing';
		targetRef.current = playing ? {
			position,
			serverTimestamp: Number(message.server_ts) || jellyfinService.getWatchPartyServerNow()
		} : null;
		if (playing && video.paused) {
			beginProgrammaticSync();
			video.play().catch(() => {});
		} else if (!playing && !video.paused) {
			beginProgrammaticSync();
			video.pause();
			resetRate();
		}
		applyDriftCorrection(forceNextSeekRef.current);
		forceNextSeekRef.current = false;
	}, [applyDriftCorrection, beginProgrammaticSync, isCurrentRoomMedia, resetRate, state.room?.isHost, videoRef]);

	useEffect(() => {
		if (!isActive) return undefined;
		let cancelled = false;
		jellyfinService.detectJellyWatchParty().then((result) => {
			if (!cancelled) setAvailability(result);
		}).catch(() => {
			if (!cancelled) setAvailability({available: false, hideNativeSyncButton: false});
		});
		const unsubscribeState = jellyfinService.subscribeWatchPartyState((nextState) => {
			setState(nextState);
			if (!nextState.room || nextState.connectionState !== 'open') {
				targetRef.current = null;
				forceNextSeekRef.current = true;
				resetRate();
			}
		});
		const unsubscribeRoom = jellyfinService.onWatchPartyMessage('room_state', (message) => {
			if (message?.payload?.media_id && item?.Id && String(message.payload.media_id) !== String(item.Id)) {
				setToastMessage('This watch party is playing a different item. Open it from the room browser.');
				return;
			}
			applyRoomState(message);
		});
		const unsubscribePlayer = jellyfinService.onWatchPartyMessage('player_event', applyPlayerEvent);
		const unsubscribeStateUpdate = jellyfinService.onWatchPartyMessage('state_update', applyStateUpdate);
		return () => {
			cancelled = true;
			unsubscribeState();
			unsubscribeRoom();
			unsubscribePlayer();
			unsubscribeStateUpdate();
			clearTimeout(scheduledActionRef.current);
			resetRate();
		};
	}, [applyPlayerEvent, applyRoomState, applyStateUpdate, isActive, item?.Id, resetRate, setToastMessage]);

	useEffect(() => {
		targetRef.current = null;
		forceNextSeekRef.current = true;
		resetRate();
	}, [item?.Id, resetRate]);

	useEffect(() => {
		if (!isActive || !state.room || state.room.isHost) return undefined;
		const interval = setInterval(() => applyDriftCorrection(false), 500);
		return () => clearInterval(interval);
	}, [applyDriftCorrection, isActive, state.room]);

	useEffect(() => {
		const video = videoRef.current;
		if (!isActive || !state.room || !video || !isCurrentRoomMedia()) return undefined;
		const onWaiting = () => {
			forceNextSeekRef.current = true;
			resetRate();
			if (state.room?.isHost && Date.now() >= suppressUntilRef.current) {
				jellyfinService.sendWatchPartyPlayerEvent('buffering', video.currentTime);
			}
		};
		const onCanPlay = () => jellyfinService.sendWatchPartyReady(item?.Id);
		video.addEventListener('waiting', onWaiting);
		video.addEventListener('canplay', onCanPlay);
		onCanPlay();
		return () => {
			video.removeEventListener('waiting', onWaiting);
			video.removeEventListener('canplay', onCanPlay);
		};
	}, [isActive, isCurrentRoomMedia, item?.Id, resetRate, state.room, videoRef]);

	useEffect(() => {
		const video = videoRef.current;
		if (!isActive || !state.room?.isHost || !video) return undefined;
		const interval = setInterval(() => {
			if (Date.now() < suppressUntilRef.current) return;
			jellyfinService.sendWatchPartyStateUpdate(video.currentTime, !video.paused);
		}, 1000);
		return () => clearInterval(interval);
	}, [isActive, state.room?.isHost, videoRef]);

	const rejectGuestControl = useCallback(() => {
		setToastMessage('Only the watch party host can control playback.');
	}, [setToastMessage]);

	const handlePause = useCallback(() => {
		if (!state.room) return handleLocalPause();
		if (!state.room.isHost) return rejectGuestControl();
		const video = videoRef.current;
		jellyfinService.sendWatchPartyPlayerEvent('pause', video?.currentTime || 0);
		resetRate();
		return handleLocalPause();
	}, [handleLocalPause, rejectGuestControl, resetRate, state.room, videoRef]);

	const handlePlay = useCallback(() => {
		if (!state.room) return handleLocalPlay();
		if (!state.room.isHost) return rejectGuestControl();
		const video = videoRef.current;
		jellyfinService.sendWatchPartyPlayerEvent('play', video?.currentTime || 0);
		return handleLocalPlay();
	}, [handleLocalPlay, rejectGuestControl, state.room, videoRef]);

	const handleSeek = useCallback((event) => {
		if (!state.room) return handleLocalSeek(event);
		if (!state.room.isHost) return rejectGuestControl();
		const position = Number(event?.value);
		if (!Number.isFinite(position)) return undefined;
		jellyfinService.sendWatchPartyPlayerEvent('seek', position);
		resetRate();
		return handleLocalSeek(event);
	}, [handleLocalSeek, rejectGuestControl, resetRate, state.room]);

	const createRoom = useCallback((options = {}) => jellyfinService.createWatchPartyRoom({
		name: options.name || `${jellyfinService.username || 'Breezyfin'} Watch Party`,
		startPosition: videoRef.current?.currentTime || 0,
		mediaId: item?.Id || '',
		password: options.password || ''
	}), [item?.Id, videoRef]);

	const joinRoom = useCallback((roomId, password = '') => (
		jellyfinService.joinWatchPartyRoom(roomId, password)
	), []);
	const leaveRoom = useCallback(() => {
		jellyfinService.leaveWatchPartyRoom();
		setPopupOpen(false);
		targetRef.current = null;
		resetRate();
	}, [resetRate]);
	const sendChat = useCallback((text) => jellyfinService.sendWatchPartyChat(text), []);
	const openPopup = useCallback(() => setPopupOpen(true), []);
	const closePopup = useCallback(() => setPopupOpen(false), []);
	const handleBack = useCallback(() => {
		if (!popupOpen) return false;
		setPopupOpen(false);
		return true;
	}, [popupOpen]);

	return {
		availability,
		state,
		popupOpen,
		openPopup,
		closePopup,
		handleBack,
		handlePause,
		handlePlay,
		handleSeek,
		createRoom,
		joinRoom,
		leaveRoom,
		sendChat
	};
};

export default useJellyWatchParty;
