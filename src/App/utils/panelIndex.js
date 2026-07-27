export const getPanelIndexForView = (currentView) => {
	if (currentView === 'login') return 0;
	if (currentView === 'home') return 1;
	if (currentView === 'homeSection') return 2;
	if (currentView === 'library') return 3;
	if (currentView === 'search') return 4;
	if (currentView === 'favorites') return 5;
	if (currentView === 'settings') return 6;
	if (currentView === 'watchlist') return 7;
	if (currentView === 'calendar') return 8;
	if (currentView === 'syncPlay') return 9;
	if (currentView === 'watchParty') return 10;
	if (currentView === 'details') return 11;
	if (currentView === 'player') return 12;
	return 0;
};
