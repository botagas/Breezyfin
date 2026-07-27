import {useCallback} from 'react';
import {useAppSyncPlayCoordinator} from './useAppSyncPlayCoordinator';

export const useAppSyncPlayNavigation = ({
	authenticated,
	currentView,
	selectedItem,
	pushPanelHistory,
	navigateBackInHistory,
	syncPlayerBackTargetDetailsItem,
	fallbackToDetailsFromPlayer,
	setSelectedItem,
	setPlaybackOptions,
	setPlayerControlsVisible,
	setCurrentView
}) => {
	const openRemoteItem = useCallback((item, metadata) => {
		if (currentView !== 'player') pushPanelHistory();
		setSelectedItem(item);
		setPlaybackOptions({
			startTimeTicks: metadata.startPositionTicks,
			syncPlay: metadata
		});
		setPlayerControlsVisible(true);
		setCurrentView('player');
	}, [currentView, pushPanelHistory, setCurrentView, setPlaybackOptions, setPlayerControlsVisible, setSelectedItem]);
	const coordinator = useAppSyncPlayCoordinator({
		authenticated,
		currentView,
		selectedItemId: selectedItem?.Id,
		onOpenRemoteItem: openRemoteItem
	});
	const handlePlay = useCallback(async (item, options = null) => {
		try {
			if (await coordinator.requestPlay(item)) return;
		} catch (error) {
			console.warn('Could not start SyncPlay group playback:', error);
			return;
		}
		if (currentView !== 'player') pushPanelHistory();
		setSelectedItem(item);
		setPlaybackOptions(options);
		setPlayerControlsVisible(true);
		setCurrentView('player');
	}, [coordinator, currentView, pushPanelHistory, setCurrentView, setPlaybackOptions, setPlayerControlsVisible, setSelectedItem]);
	const handleBackToDetails = useCallback(() => {
		if (coordinator.group) coordinator.suspend();
		syncPlayerBackTargetDetailsItem();
		if (!navigateBackInHistory()) fallbackToDetailsFromPlayer();
	}, [coordinator, fallbackToDetailsFromPlayer, navigateBackInHistory, syncPlayerBackTargetDetailsItem]);

	return {coordinator, handlePlay, handleBackToDetails};
};
