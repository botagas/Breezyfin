import {render, waitFor} from '@testing-library/react';
import Toolbar from '../Toolbar';
import jellyfinService from '../../services/jellyfinService';

jest.mock('@enact/spotlight/Spottable', () => ({
	Spottable: (component) => component
}));

jest.mock('@enact/sandstone/Popup', () => function TestPopup({children}) {
	return <div>{children}</div>;
});

jest.mock('../../hooks/useBreezyfinSettingsSync', () => ({
	useBreezyfinSettingsSync: jest.fn()
}));

jest.mock('../../hooks/usePanelBackHandler', () => ({
	usePanelBackHandler: jest.fn()
}));

jest.mock('../../hooks/useDismissOnOutsideInteraction', () => ({
	useDismissOnOutsideInteraction: jest.fn()
}));

jest.mock('../../hooks/useDisclosureMap', () => ({
	useDisclosureMap: () => ({
		disclosures: {},
		openDisclosure: jest.fn(),
		closeDisclosure: jest.fn(),
		setDisclosure: jest.fn()
	})
}));

jest.mock('../../hooks/useMapById', () => ({
	useMapById: () => new Map()
}));

jest.mock('../../hooks/usePopupInitialFocus', () => ({
	usePopupInitialFocus: jest.fn()
}));

jest.mock('../../hooks/useRuntimeSuspension', () => ({
	useRuntimeSuspended: () => false
}));

jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: () => ({supportsBackdropFilter: false, webosV6Compat: false})
}));

jest.mock('../toolbar/ToolbarElegantLayout', () => function TestToolbarElegantLayout() {
	return <div />;
});

jest.mock('../toolbar/ToolbarClassicLayout', () => function TestToolbarClassicLayout() {
	return <div />;
});

jest.mock('../toolbar/ToolbarLibraryPicker', () => function TestToolbarLibraryPicker() {
	return <div />;
});

jest.mock('../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		serverUrl: 'http://media.local',
		userId: 'user-1',
		accessToken: 'token-1',
		getLibraryViews: jest.fn(),
		getCurrentUser: jest.fn(),
		getBreezyfinCapabilities: jest.fn(),
		detectJellyWatchParty: jest.fn()
	}
}));

const toolbarProps = {
	onNavigate: jest.fn(),
	onSwitchUser: jest.fn(),
	onLogout: jest.fn(),
	onExit: jest.fn()
};

describe('Toolbar session probes', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jellyfinService.getLibraryViews.mockResolvedValue([]);
		jellyfinService.getCurrentUser.mockResolvedValue({Name: 'Viewer', Policy: {}});
		jellyfinService.getBreezyfinCapabilities.mockResolvedValue({available: false});
		jellyfinService.detectJellyWatchParty.mockResolvedValue({
			available: false,
			hideNativeSyncButton: false
		});
	});

	it('does not issue authenticated requests while its panel is inactive', () => {
		render(<Toolbar {...toolbarProps} isActive={false} />);

		expect(jellyfinService.getLibraryViews).not.toHaveBeenCalled();
		expect(jellyfinService.getCurrentUser).not.toHaveBeenCalled();
		expect(jellyfinService.getBreezyfinCapabilities).not.toHaveBeenCalled();
		expect(jellyfinService.detectJellyWatchParty).not.toHaveBeenCalled();
	});

	it('loads authenticated toolbar data when its panel becomes active', async () => {
		render(<Toolbar {...toolbarProps} isActive />);

		await waitFor(() => {
			expect(jellyfinService.getLibraryViews).toHaveBeenCalledTimes(1);
			expect(jellyfinService.getCurrentUser).toHaveBeenCalledTimes(1);
			expect(jellyfinService.getBreezyfinCapabilities).toHaveBeenCalledTimes(1);
			expect(jellyfinService.detectJellyWatchParty).toHaveBeenCalledTimes(1);
		});
	});
});
