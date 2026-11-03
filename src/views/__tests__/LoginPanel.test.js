import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import LoginPanel from '../LoginPanel';
import jellyfinService from '../../services/jellyfinService';

jest.mock('../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		getSavedServers: jest.fn(),
		setActiveServer: jest.fn(),
		getCurrentUser: jest.fn(),
		connect: jest.fn(),
		getQuickConnectEnabled: jest.fn(),
		initiateQuickConnect: jest.fn(),
		getQuickConnectState: jest.fn(),
		authenticateWithQuickConnect: jest.fn(),
		authenticate: jest.fn()
	}
}));

jest.mock('../../components/BreezyPanels', () => ({
	Panel: ({children}) => <div>{children}</div>
}));
jest.mock('../../components/AppScroller', () => function TestScroller({children}) {
	return <div>{children}</div>;
});
jest.mock('@enact/sandstone/Heading', () => function TestHeading({children}) {
	return <h1>{children}</h1>;
});
jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children}) {
	return <div>{children}</div>;
});
jest.mock('@enact/sandstone/Spinner', () => function TestSpinner() {
	return <span />;
});
jest.mock('@enact/spotlight/Spottable', () => () => 'div');
jest.mock('../login-panel/hooks/useLoginBackdrops', () => ({
	useLoginBackdrops: () => ({
		currentBackdropUrl: null,
		previousBackdropUrl: null,
		isBackdropTransitioning: false,
		backdropImageErrors: {},
		currentBackdropLoaded: false,
		previousBackdropLoaded: false,
		handleBackdropLoad: jest.fn(),
		handleBackdropError: jest.fn()
	})
}));
jest.mock('../login-panel/components/LoginBackdropLayer', () => function TestBackdrop() {
	return null;
});
jest.mock('../login-panel/components/LoginServerSelectStep', () => function TestServerSelect() {
	return null;
});
jest.mock('../login-panel/components/LoginServerConnectStep', () => function TestServerConnect() {
	return null;
});
jest.mock('../login-panel/components/LoginQuickConnectStep', () => function TestQuickConnect() {
	return null;
});
jest.mock('../login-panel/components/LoginSavedAccountsStep', () => function TestSavedAccounts(props) {
	const entry = props.savedServers[0];
	return entry ? (
		<button data-resume-key={`${entry.serverId}:${entry.userId}`} onClick={props.onResumeClick}>
			{props.resumingKey === `${entry.serverId}:${entry.userId}` ? 'Opening...' : 'Saved account'}
		</button>
	) : null;
});
jest.mock('../login-panel/components/LoginCredentialsStep', () => function TestCredentials(props) {
	return <><div data-testid="credentials">{props.username}</div><button onClick={props.onBack}>Back</button></>;
});

describe('LoginPanel saved-session recovery', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jellyfinService.serverUrl = 'http://media.local';
		jellyfinService.userId = 'user-1';
		jellyfinService.accessToken = 'expired-token';
		jellyfinService.sessionGeneration = 4;
		jellyfinService.getSavedServers.mockReturnValue([{
			serverId: 'server-1',
			userId: 'user-1',
			url: 'http://media.local',
			serverName: 'Media',
			username: 'Alice',
			accessToken: 'expired-token'
		}]);
		jellyfinService.getCurrentUser.mockResolvedValue(null);
		jellyfinService.connect.mockResolvedValue({ServerName: 'Media'});
		jellyfinService.getQuickConnectEnabled.mockResolvedValue(false);
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		console.error.mockRestore();
	});

	it('opens credentials when a saved token cannot restore its user', async () => {
		render(<LoginPanel isActive onLogin={jest.fn()} />);
		fireEvent.click(await screen.findByText('Saved account'));

		await waitFor(() => expect(screen.getByTestId('credentials').textContent).toBe('Alice'));
		expect(jellyfinService.setActiveServer).toHaveBeenCalledWith('server-1', 'user-1');
		expect(jellyfinService.connect).toHaveBeenCalledWith('http://media.local');
	});

	it('clears the saved-account opening state after expired-token reconnect', async () => {
		jellyfinService.connect.mockImplementation(async () => {
			jellyfinService.accessToken = null;
			jellyfinService.userId = null;
			jellyfinService.sessionGeneration += 1;
			return {ServerName: 'Media'};
		});
		render(<LoginPanel isActive onLogin={jest.fn()} />);
		fireEvent.click(await screen.findByText('Saved account'));
		await screen.findByTestId('credentials');
		fireEvent.click(screen.getByText('Back'));
		expect(await screen.findByText('Saved account')).toBeTruthy();
		expect(screen.queryByText('Opening...')).toBeNull();
	});

	it('does not let an older resume attempt clear or reconnect a newer attempt', async () => {
		let resolveFirst;
		let resolveSecond;
		jellyfinService.getCurrentUser
			.mockImplementationOnce(() => new Promise((resolve) => {resolveFirst = resolve;}))
			.mockImplementationOnce(() => new Promise((resolve) => {resolveSecond = resolve;}));
		const onLogin = jest.fn();
		render(<LoginPanel isActive onLogin={onLogin} />);
		fireEvent.click(await screen.findByText('Saved account'));
		fireEvent.click(await screen.findByText('Opening...'));
		await act(async () => {
			resolveFirst(null);
		});
		expect(jellyfinService.connect).not.toHaveBeenCalled();
		expect(screen.getByText('Opening...')).toBeTruthy();
		await act(async () => {
			resolveSecond({Id: 'user-1'});
		});
		expect(onLogin).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('Opening...')).toBeNull();
	});

	it('does not reconnect an old saved session after Quick Connect replaces it', async () => {
		let resolveCurrentUser;
		jellyfinService.serverUrl = 'http://media.local';
		jellyfinService.userId = 'user-1';
		jellyfinService.accessToken = 'expired-token';
		jellyfinService.sessionGeneration = 4;
		jellyfinService.getCurrentUser.mockImplementation(() => new Promise((resolve) => {
			resolveCurrentUser = resolve;
		}));
		render(<LoginPanel isActive onLogin={jest.fn()} />);
		fireEvent.click(await screen.findByText('Saved account'));

		await waitFor(() => expect(jellyfinService.getCurrentUser).toHaveBeenCalledTimes(1));
		jellyfinService.userId = 'user-2';
		jellyfinService.accessToken = 'fresh-token';
		jellyfinService.sessionGeneration = 5;
		await act(async () => {
			resolveCurrentUser(null);
			await Promise.resolve();
		});

		expect(jellyfinService.connect).not.toHaveBeenCalled();
	});
});
