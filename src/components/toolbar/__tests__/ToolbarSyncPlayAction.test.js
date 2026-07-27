/* eslint-disable react/prop-types */
import {fireEvent, render, screen} from '@testing-library/react';
import ToolbarClassicLayout from '../ToolbarClassicLayout';
import ToolbarElegantLayout from '../ToolbarElegantLayout';

jest.mock('@enact/sandstone/Icon', () => function TestIcon({children}) {
	return <span data-testid={`icon-${children}`}>{children}</span>;
});

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <span {...rest}>{children}</span>;
});

jest.mock('../../BreezyButton', () => function TestButton({children, spotlightId, ...rest}) {
	return <button type="button" data-spotlight-id={spotlightId} {...rest}>{children}</button>;
});

jest.mock('../ToolbarUserMenu', () => function TestToolbarUserMenu() {
	return null;
});

jest.mock('../ToolbarLibraryPicker', () => function TestToolbarLibraryPicker() {
	return null;
});

const TestSpottable = ({children, spotlightId, ...rest}) => (
	<button type="button" data-spotlight-id={spotlightId} {...rest}>{children}</button>
);

const noop = jest.fn;

const buildElegantProps = (overrides = {}) => ({
	SpottableDiv: TestSpottable,
	glassFilterId: 'test-filter',
	shouldRenderElegantDistortion: false,
	isHomeSection: true,
	elegantPanelTitle: '',
	handleElegantBack: noop(),
	handleNavigateHome: noop(),
	handleNavigateFavorites: noop(),
	handleNavigateSearch: noop(),
	handleNavigateSettings: noop(),
	handleNavigateWatchlist: noop(),
	handleNavigateCalendar: noop(),
	handleNavigateSyncPlay: noop(),
	handleNavigateWatchParty: noop(),
	showWatchlist: true,
	showCalendar: false,
	showSyncPlay: true,
	showWatchParty: false,
	activeSection: 'home',
	libraryMenuScopeRef: {current: null},
	handleOpenLibrariesPopup: noop(),
	showLibrariesPopup: false,
	libraries: [],
	activeLibraryId: null,
	handleLibraryPopupSelect: noop(),
	librariesPopupContentRef: {current: null},
	userMenuScopeRef: {current: null},
	elegantUserContainerProps: {},
	handleUserButtonClick: noop(),
	userName: 'User',
	userAvatarUrl: '',
	handleUserAvatarError: noop(),
	showUserMenu: false,
	handleLogoutClick: noop(),
	handleSwitchUserClick: noop(),
	handleExitClick: noop(),
	...overrides
});

const buildClassicProps = (overrides = {}) => ({
	SpottableDiv: TestSpottable,
	userMenuScopeRef: {current: null},
	classicUserContainerProps: {},
	handleUserButtonClick: noop(),
	userName: 'User',
	showUserMenu: false,
	handleLogoutClick: noop(),
	handleSwitchUserClick: noop(),
	handleExitClick: noop(),
	handleNavigateHome: noop(),
	activeSection: 'home',
	handleNavigateSearch: noop(),
	handleClassicBack: noop(),
	handleNavigateFavorites: noop(),
	centerRef: {current: null},
	handleCenterFocus: noop(),
	libraries: [],
	activeLibraryId: null,
	handleLibraryNavigate: noop(),
	handleNavigateSettings: noop(),
	handleNavigateWatchlist: noop(),
	handleNavigateCalendar: noop(),
	handleNavigateSyncPlay: noop(),
	handleNavigateWatchParty: noop(),
	showWatchlist: true,
	showCalendar: false,
	showSyncPlay: true,
	showWatchParty: false,
	formatTime: () => '12:00 PM',
	...overrides
});

describe('Toolbar SyncPlay navigation placement', () => {
	it('uses the Elegant right-side Search slot for a Cast action', () => {
		const handleNavigateSyncPlay = jest.fn();
		render(<ToolbarElegantLayout {...buildElegantProps({handleNavigateSyncPlay})} />);

		expect(screen.getByText('Search')).toBeTruthy();
		expect(screen.getByText('Watchlist')).toBeTruthy();
		expect(document.querySelector('[data-spotlight-id="toolbar-search-icon"]')).toBeNull();
		const syncPlayAction = screen.getByRole('button', {name: 'SyncPlay'});
		expect(syncPlayAction.dataset.spotlightId).toBe('toolbar-sync-play');
		expect(screen.getByTestId('icon-dlna')).toBeTruthy();
		expect(screen.queryByText('SyncPlay')).toBeNull();

		fireEvent.click(syncPlayAction);
		expect(handleNavigateSyncPlay).toHaveBeenCalledTimes(1);
	});

	it('retains the right-side Search icon when SyncPlay is unavailable', () => {
		render(<ToolbarElegantLayout {...buildElegantProps({showSyncPlay: false})} />);

		expect(document.querySelector('[data-spotlight-id="toolbar-search-icon"]')).toBeTruthy();
		expect(screen.queryByRole('button', {name: 'SyncPlay'})).toBeNull();
	});

	it('keeps Classic Search and moves SyncPlay out of the scrolling tab group', () => {
		const handleNavigateSyncPlay = jest.fn();
		render(<ToolbarClassicLayout {...buildClassicProps({handleNavigateSyncPlay})} />);

		expect(screen.getByRole('button', {name: 'Search'})).toBeTruthy();
		expect(screen.getByText('Watchlist')).toBeTruthy();
		expect(screen.queryByText('SyncPlay')).toBeNull();
		const syncPlayAction = screen.getByRole('button', {name: 'SyncPlay'});
		expect(screen.getByTestId('icon-dlna')).toBeTruthy();

		fireEvent.click(syncPlayAction);
		expect(handleNavigateSyncPlay).toHaveBeenCalledTimes(1);
	});
});
