export const getPanelIndexForView = (currentView) => {
	if (currentView === 'login') return 0;
	if (currentView === 'home') return 1;
	if (currentView === 'library') return 2;
	if (currentView === 'search') return 3;
	if (currentView === 'favorites') return 4;
	if (currentView === 'settings') return 5;
	if (currentView === 'details') return 6;
	if (currentView === 'player') return 7;
	return 0;
};
