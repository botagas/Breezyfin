import {useCallback} from 'react';
import {useNativeSyncPlay} from './useNativeSyncPlay';
import {useJellyWatchParty} from './useJellyWatchParty';

export const usePlayerGroupSessions = ({
	isActive,
	item,
	playbackGeneration,
	videoRef,
	playing,
	handleLocalPause,
	handleLocalPlay,
	handleLocalSeek,
	handleLocalSurfaceClick,
	syncPlayStartupBridge,
	setToastMessage,
	blocked = false
}) => {
	const syncPlay = useNativeSyncPlay({
		isActive,
		item,
		playbackGeneration,
		videoRef,
		handleLocalPause,
		handleLocalPlay,
		handleLocalSeek,
		syncPlayStartupBridge,
		setToastMessage,
		blocked
	});
	const watchParty = useJellyWatchParty({
		isActive,
		item,
		videoRef,
		handleLocalPause: syncPlay.handlePause,
		handleLocalPlay: syncPlay.handlePlay,
		handleLocalSeek: syncPlay.handleSeek,
		setToastMessage
	});
	const handleSyncPlaySurfaceClick = useCallback(() => {
		if (blocked) return;
		if (!syncPlay.group) return handleLocalSurfaceClick();
		return playing ? syncPlay.handlePause() : syncPlay.handlePlay();
	}, [blocked, handleLocalSurfaceClick, playing, syncPlay]);
	const handleSurfaceClick = useCallback(() => {
		if (blocked) return;
		if (!watchParty.state.room) return handleSyncPlaySurfaceClick();
		return playing ? watchParty.handlePause() : watchParty.handlePlay();
	}, [blocked, handleSyncPlaySurfaceClick, playing, watchParty]);
	const handleBack = useCallback(() => (
		watchParty.handleBack() || syncPlay.handleBack()
	), [syncPlay, watchParty]);
	const handlePause = useCallback((...args) => (
		blocked ? undefined : watchParty.handlePause(...args)
	), [blocked, watchParty]);
	const handlePlay = useCallback((...args) => (
		blocked ? undefined : watchParty.handlePlay(...args)
	), [blocked, watchParty]);
	const handleSeek = useCallback((...args) => (
		blocked ? undefined : watchParty.handleSeek(...args)
	), [blocked, watchParty]);

	return {
		popupOpen: syncPlay.popupOpen || watchParty.popupOpen,
		handleBack,
		handlePause,
		handlePlay,
		handleSeek,
		handleNext: syncPlay.group && syncPlay.followMode === 'following' ? syncPlay.next : null,
		handlePrevious: syncPlay.group && syncPlay.followMode === 'following' ? syncPlay.previous : null,
		handleSurfaceClick,
		controlsState: {
			syncPlayGroup: watchParty.availability.hideNativeSyncButton ? null : syncPlay.group,
			watchPartyAvailable: watchParty.availability.available === true,
			watchPartyRoom: watchParty.state.room
		},
		controlActions: {
			openSyncPlayPopup: syncPlay.openPopup,
			openWatchPartyPopup: watchParty.openPopup
		},
		syncPlayPopup: {
			open: syncPlay.popupOpen,
			group: syncPlay.group,
			groupState: syncPlay.groupState,
			onClose: syncPlay.closePopup,
			onLeave: syncPlay.leaveGroup,
			onStart: syncPlay.startGroupPlayback
		},
		watchPartyPopup: {
			open: watchParty.popupOpen,
			availability: watchParty.availability,
			state: watchParty.state,
			item,
			onClose: watchParty.closePopup,
			onCreate: watchParty.createRoom,
			onJoin: watchParty.joinRoom,
			onLeave: watchParty.leaveRoom,
			onSendChat: watchParty.sendChat
		}
	};
};
