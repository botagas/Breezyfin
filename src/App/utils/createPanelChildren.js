import LoginPanel from '../../views/LoginPanel';
import HomePanel from '../../views/HomePanel';
import HomeSectionPanel from '../../views/HomeSectionPanel';
import LibraryPanel from '../../views/LibraryPanel';
import SearchPanel from '../../views/SearchPanel';
import FavoritesPanel from '../../views/FavoritesPanel';
import SettingsPanel from '../../views/SettingsPanel';
import PlayerPanel from '../../views/PlayerPanel';
import MediaDetailsPanel from '../../views/MediaDetailsPanel';
import WatchlistPanel from '../../views/WatchlistPanel';
import CalendarPanel from '../../views/CalendarPanel';
import SyncPlayPanel from '../../views/SyncPlayPanel';
import WatchPartyPanel from '../../views/WatchPartyPanel';

export const createPanelChildren = ({
	currentView,
	sessionRestorePending = false,
	inputMode,
	screensaverActive = false,
	diagnosticsEnabled = false,
	selection,
	notices,
	cacheState,
	actions,
	cacheActions,
	backHandlers,
	playerControls
}) => {
	const {
		item,
		library,
		homeSection,
		playbackOptions
	} = selection;
	const {
		login: loginNotice,
		loginNonce: loginNoticeNonce
	} = notices;
	const {
		home: homePanelState,
		homeSectionsById,
		librariesById,
		search: searchPanelState,
		favorites: favoritesPanelState,
		settings: settingsPanelState,
		watchlist: watchlistPanelState,
		calendar: calendarPanelState,
		syncPlay: syncPlayPanelState,
		watchParty: watchPartyPanelState,
		detailsByItemId
	} = cacheState;
	const {
		login: handleLogin,
		itemSelect: handleItemSelect,
		navigate: handleNavigate,
		switchUser: handleSwitchUser,
		logout: handleLogout,
		signOut: handleSignOut,
		exit: handleExit,
		play: handlePlay,
		backFromDetails,
		backToDetails
	} = actions;
	const {
		home: handleHomePanelStateChange,
		homeSection: handleHomeSectionPanelStateChange,
		library: handleLibraryPanelStateChange,
		search: handleSearchPanelStateChange,
		favorites: handleFavoritesPanelStateChange,
		settings: handleSettingsPanelStateChange,
		watchlist: handleWatchlistPanelStateChange,
		calendar: handleCalendarPanelStateChange,
		syncPlay: handleSyncPlayPanelStateChange,
		watchParty: handleWatchPartyPanelStateChange,
		details: handleDetailsPanelStateChange
	} = cacheActions;
	const {
		home: registerHomeBackHandler,
		homeSection: registerHomeSectionBackHandler,
		library: registerLibraryBackHandler,
		search: registerSearchBackHandler,
		favorites: registerFavoritesBackHandler,
		settings: registerSettingsBackHandler,
		watchlist: registerWatchlistBackHandler,
		calendar: registerCalendarBackHandler,
		syncPlay: registerSyncPlayBackHandler,
		watchParty: registerWatchPartyBackHandler,
		details: registerDetailsBackHandler,
		player: registerPlayerBackHandler
	} = backHandlers;
	const {
		visible: playerControlsVisible,
		setVisible: setPlayerControlsVisible
	} = playerControls;

	const panelChildren = [
		<LoginPanel
			key="login"
			onLogin={handleLogin}
			onNavigate={handleNavigate}
			isActive={currentView === 'login'}
			deferBackdrops={sessionRestorePending}
			sessionNotice={loginNotice}
			sessionNoticeNonce={loginNoticeNonce}
		/>,
		<HomePanel
			key="home"
			isActive={currentView === 'home'}
			screensaverActive={screensaverActive}
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
			section={homeSection}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={homeSection?.id ? homeSectionsById[String(homeSection.id)] || null : null}
			onCacheState={handleHomeSectionPanelStateChange}
			registerBackHandler={registerHomeSectionBackHandler}
			noCloseButton
		/>,
		<LibraryPanel
			key="library"
			isActive={currentView === 'library'}
			inputMode={inputMode}
			library={library}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={library?.Id ? librariesById[String(library.Id)] || null : null}
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
		/>,
		<WatchlistPanel
			key="watchlist"
			isActive={currentView === 'watchlist'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={watchlistPanelState}
			onCacheState={handleWatchlistPanelStateChange}
			registerBackHandler={registerWatchlistBackHandler}
			noCloseButton
		/>,
		<CalendarPanel
			key="calendar"
			isActive={currentView === 'calendar'}
			onItemSelect={handleItemSelect}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={calendarPanelState}
			onCacheState={handleCalendarPanelStateChange}
			registerBackHandler={registerCalendarBackHandler}
			noCloseButton
		/>,
		<SyncPlayPanel
			key="syncPlay"
			isActive={currentView === 'syncPlay'}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			cachedState={syncPlayPanelState}
			onCacheState={handleSyncPlayPanelStateChange}
			registerBackHandler={registerSyncPlayBackHandler}
			noCloseButton
		/>,
		<WatchPartyPanel
			key="watchParty"
			isActive={currentView === 'watchParty'}
			onNavigate={handleNavigate}
			onSwitchUser={handleSwitchUser}
			onLogout={handleLogout}
			onExit={handleExit}
			onPlay={handlePlay}
			cachedState={watchPartyPanelState}
			onCacheState={handleWatchPartyPanelStateChange}
			registerBackHandler={registerWatchPartyBackHandler}
			noCloseButton
		/>
	];

	panelChildren.push(
		<MediaDetailsPanel
			key={`details-${item?.Id || 'none'}`}
			isActive={currentView === 'details'}
			item={item}
			onBack={backFromDetails}
			onPlay={handlePlay}
			onItemSelect={handleItemSelect}
			cachedState={item?.Id ? detailsByItemId[String(item.Id)] || null : null}
			onCacheState={handleDetailsPanelStateChange}
			registerBackHandler={registerDetailsBackHandler}
			noCloseButton
		/>
	);

	panelChildren.push(
		<PlayerPanel
			key="player"
			isActive={currentView === 'player'}
			diagnosticsEnabled={diagnosticsEnabled}
			item={item}
			playbackOptions={playbackOptions}
			onBack={backToDetails}
			onPlay={handlePlay}
			requestedControlsVisible={playerControlsVisible}
			onControlsVisibilityChange={setPlayerControlsVisible}
			registerBackHandler={registerPlayerBackHandler}
		/>
	);

	return panelChildren;
};
