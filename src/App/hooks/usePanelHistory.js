import { useRef, useCallback } from 'react';

export const usePanelHistory = ({
	currentView,
	selectedItem,
	selectedLibrary,
	playbackOptions,
	previousItem,
	detailsReturnView,
	playerControlsVisible,
	setCurrentView,
	setSelectedItem,
	setSelectedLibrary,
	setPlaybackOptions,
	setPreviousItem,
	setDetailsReturnView,
	setPlayerControlsVisible
}) => {
	const panelHistoryRef = useRef([]);

	const createPanelSnapshot = useCallback(() => ({
		view: currentView,
		selectedItem,
		selectedLibrary,
		playbackOptions,
		previousItem,
		detailsReturnView,
		playerControlsVisible
	}), [
		currentView,
		detailsReturnView,
		playbackOptions,
		playerControlsVisible,
		previousItem,
		selectedItem,
		selectedLibrary
	]);

	const pushPanelHistory = useCallback(() => {
		panelHistoryRef.current = [...panelHistoryRef.current, createPanelSnapshot()];
	}, [createPanelSnapshot]);

	const clearPanelHistory = useCallback(() => {
		panelHistoryRef.current = [];
	}, []);

	const restorePanelSnapshot = useCallback((snapshot) => {
		if (!snapshot) return false;
		setCurrentView(snapshot.view || 'home');
		setSelectedItem(snapshot.selectedItem || null);
		setSelectedLibrary(snapshot.selectedLibrary || null);
		setPlaybackOptions(snapshot.playbackOptions || null);
		setPreviousItem(snapshot.previousItem || null);
		setDetailsReturnView(snapshot.detailsReturnView || 'home');
		setPlayerControlsVisible(snapshot.playerControlsVisible !== false);
		return true;
	}, [
		setCurrentView,
		setDetailsReturnView,
		setPlaybackOptions,
		setPlayerControlsVisible,
		setPreviousItem,
		setSelectedItem,
		setSelectedLibrary
	]);

	const navigateBackInHistory = useCallback(() => {
		const history = panelHistoryRef.current;
		if (!history.length) return false;
		const previousSnapshot = history[history.length - 1];
		panelHistoryRef.current = history.slice(0, -1);
		return restorePanelSnapshot(previousSnapshot);
	}, [restorePanelSnapshot]);

	const getHistoryFallbackItem = useCallback(() => {
		for (let index = panelHistoryRef.current.length - 1; index >= 0; index -= 1) {
			const snapshotItem = panelHistoryRef.current[index]?.selectedItem;
			if (snapshotItem) {
				return snapshotItem;
			}
		}
		return null;
	}, []);

	const updateLatestHistorySnapshot = useCallback((updater) => {
		if (typeof updater !== 'function') return false;
		const history = panelHistoryRef.current;
		if (!history.length) return false;
		const currentSnapshot = history[history.length - 1];
		const nextSnapshot = updater(currentSnapshot);
		if (!nextSnapshot || nextSnapshot === currentSnapshot) return false;
		panelHistoryRef.current = [...history.slice(0, -1), nextSnapshot];
		return true;
	}, []);

	return {
		pushPanelHistory,
		clearPanelHistory,
		navigateBackInHistory,
		getHistoryFallbackItem,
		updateLatestHistorySnapshot
	};
};

export default usePanelHistory;
