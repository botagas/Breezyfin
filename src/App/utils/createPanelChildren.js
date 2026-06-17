import LoginPanel from '../../views/LoginPanel';
import HomePanel from '../../views/HomePanel';
import HomeSectionPanel from '../../views/HomeSectionPanel';
import LibraryPanel from '../../views/LibraryPanel';
import SearchPanel from '../../views/SearchPanel';
import FavoritesPanel from '../../views/FavoritesPanel';
import SettingsPanel from '../../views/SettingsPanel';
import PlayerPanel from '../../views/PlayerPanel';
import MediaDetailsPanel from '../../views/MediaDetailsPanel';

export const createPanelChildren = ({
	currentView,
	selectedItem,
	selectedLibrary,
	selectedHomeSection,
	playbackOptions,
	loginNotice,
	loginNoticeNonce,
	homePanelState,
	homeSectionPanelStateById,
	libraryPanelStateById,
	searchPanelState,
	favoritesPanelState,
	settingsPanelState,
	detailsPanelStateByItemId,
	handleLogin,
	handleItemSelect,
	handleNavigate,
	handleSwitchUser,
	handleLogout,
	handleSignOut,
	handleExit,
	handlePlay,
	navigateBackFromDetails,
	handleBackToDetails,
	setPlayerControlsVisible,
	playerControlsVisible,
	handleSearchPanelStateChange,
	handleHomePanelStateChange,
	handleHomeSectionPanelStateChange,
	handleLibraryPanelStateChange,
	handleFavoritesPanelStateChange,
	handleSettingsPanelStateChange,
	handleDetailsPanelStateChange,
	registerHomeBackHandler,
	registerHomeSectionBackHandler,
	registerLibraryBackHandler,
	registerSearchBackHandler,
	registerFavoritesBackHandler,
	registerSettingsBackHandler,
	registerDetailsBackHandler,
	registerPlayerBackHandler,
	inputMode
}) => {
	const panelChildren = [
		<LoginPanel
			key="login"
			onLogin={handleLogin}
			onNavigate={handleNavigate}
			isActive={currentView === 'login'}
			sessionNotice={loginNotice}
			sessionNoticeNonce={loginNoticeNonce}
		/>,
		<HomePanel
			key="home"
			isActive={currentView === 'home'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={homePanelState}
			onCacheState={handleHomePanelStateChange}
			registerBackHandler={registerHomeBackHandler}
			noCloseButton
		/>,
		<HomeSectionPanel
			key="homeSection"
			isActive={currentView === 'homeSection'}
			inputMode={inputMode}
			section={selectedHomeSection}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={selectedHomeSection?.id ? homeSectionPanelStateById[String(selectedHomeSection.id)] || null : null}
			onCacheState={handleHomeSectionPanelStateChange}
			registerBackHandler={registerHomeSectionBackHandler}
			noCloseButton
		/>,
		<LibraryPanel
			key="library"
			isActive={currentView === 'library'}
			inputMode={inputMode}
			library={selectedLibrary}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={selectedLibrary?.Id ? libraryPanelStateById[String(selectedLibrary.Id)] || null : null}
			onCacheState={handleLibraryPanelStateChange}
			registerBackHandler={registerLibraryBackHandler}
			noCloseButton
		/>,
		<SearchPanel
			key="search"
			isActive={currentView === 'search'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={searchPanelState}
			onCacheState={handleSearchPanelStateChange}
			registerBackHandler={registerSearchBackHandler}
			noCloseButton
		/>,
		<FavoritesPanel
			key="favorites"
			isActive={currentView === 'favorites'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={favoritesPanelState}
			onCacheState={handleFavoritesPanelStateChange}
			registerBackHandler={registerFavoritesBackHandler}
			noCloseButton
		/>,
		<SettingsPanel
			key="settings"
			isActive={currentView === 'settings'}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onSignOut={handleSignOut}
			onExit={handleExit}
			cachedState={settingsPanelState}
			onCacheState={handleSettingsPanelStateChange}
			registerBackHandler={registerSettingsBackHandler}
			noCloseButton
		/>
	];

	panelChildren.push(
		<MediaDetailsPanel
			key={`details-${selectedItem?.Id || 'none'}`}
			isActive={currentView === 'details'}
			item={selectedItem}
			onBack={navigateBackFromDetails}
			onPlay={handlePlay}
			onItemSelect={handleItemSelect}
			cachedState={selectedItem?.Id ? detailsPanelStateByItemId[String(selectedItem.Id)] || null : null}
			onCacheState={handleDetailsPanelStateChange}
			registerBackHandler={registerDetailsBackHandler}
			noCloseButton
		/>
	);

	panelChildren.push(
		<PlayerPanel
			key="player"
			isActive={currentView === 'player'}
			item={selectedItem}
			playbackOptions={playbackOptions}
			onBack={handleBackToDetails}
			onPlay={handlePlay}
			requestedControlsVisible={playerControlsVisible}
			onControlsVisibilityChange={setPlayerControlsVisible}
			registerBackHandler={registerPlayerBackHandler}
		/>
	);

	return panelChildren;
};
