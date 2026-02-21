export const getPanelIndexForView = (currentView, styleDebugEnabled) => {
	const detailsPanelIndex = styleDebugEnabled ? 7 : 6;
	const playerPanelIndex = styleDebugEnabled ? 8 : 7;
	if (currentView === 'login') return 0;
	if (currentView === 'home') return 1;
	if (currentView === 'library') return 2;
	if (currentView === 'search') return 3;
	if (currentView === 'favorites') return 4;
	if (currentView === 'settings') return 5;
	if (currentView === 'styleDebug' && styleDebugEnabled) return 6;
	if (currentView === 'details') return detailsPanelIndex;
	if (currentView === 'player') return playerPanelIndex;
	return 0;
};
