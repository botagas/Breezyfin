import {useCallback} from 'react';
import {useNativeSyncPlay} from './useNativeSyncPlay';
import {useJellyWatchParty} from './useJellyWatchParty';

export const usePlayerGroupSessions = ({
	isActive,
	item,
	videoRef,
	playing,
	handleLocalPause,
	handleLocalPlay,
	handleLocalSeek,
	handleLocalSurfaceClick,
	setToastMessage
}) => {
	const syncPlay = useNativeSyncPlay({
		isActive,
		item,
		videoRef,
		handleLocalPause,
		handleLocalPlay,
		handleLocalSeek,
		setToastMessage
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
		if (!syncPlay.group) return handleLocalSurfaceClick();
		return playing ? syncPlay.handlePause() : syncPlay.handlePlay();
	}, [handleLocalSurfaceClick, playing, syncPlay]);
	const handleSurfaceClick = useCallback(() => {
		if (!watchParty.state.room) return handleSyncPlaySurfaceClick();
		return playing ? watchParty.handlePause() : watchParty.handlePlay();
	}, [handleSyncPlaySurfaceClick, playing, watchParty]);
	const handleBack = useCallback(() => (
		watchParty.handleBack() || syncPlay.handleBack()
	), [syncPlay, watchParty]);

	return {
		popupOpen: syncPlay.popupOpen || watchParty.popupOpen,
		handleBack,
		handlePause: watchParty.handlePause,
		handlePlay: watchParty.handlePlay,
		handleSeek: watchParty.handleSeek,
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
			onClose: syncPlay.closePopup,
			onLeave: syncPlay.leaveGroup
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
