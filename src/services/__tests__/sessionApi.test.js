jest.mock('../serverManager', () => ({
	__esModule: true,
	default: {
		addServer: jest.fn(),
		clearActive: jest.fn(),
		getActiveServer: jest.fn(),
		listServers: jest.fn(),
		removeUser: jest.fn(),
		setActiveServer: jest.fn(),
		updateUser: jest.fn()
	}
}));

jest.mock('../../utils/appInfo', () => ({
	getAppVersion: jest.fn(() => '1.2.3')
}));

jest.mock('../../utils/deviceIdentity', () => ({
	getDeviceId: jest.fn(() => 'device-from-util')
}));

import serverManager from '../serverManager';
import {
	applySessionFromStore,
	authenticateWithServer,
	connectToServer,
	forgetServiceServer,
	getCurrentServiceUser,
	restoreServiceSession,
	setActiveServiceServer
} from '../jellyfin/sessionApi';

const jsonResponse = (data, ok = true, status = 200) => {
	const bodyText = JSON.stringify(data);
	return {
		ok,
		status,
		json: async () => data,
		text: async () => bodyText
	};
};

const textResponse = (bodyText, ok = false, status = 400) => ({
	ok,
	status,
	text: async () => bodyText
});

const createService = () => ({
	jellyfin: {
		createApi: jest.fn((url, accessToken) => ({url, accessToken}))
	},
	api: null,
	userId: null,
	serverUrl: null,
	accessToken: null,
	serverName: null,
	username: null,
	sessionExpiredNotified: true,
	_request: jest.fn()
});

describe('sessionApi', () => {
	let errorSpy;
	let warnSpy;

	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.clear();
		global.fetch = jest.fn();
		serverManager.setActiveServer.mockReturnValue({id: 'srv-1'});
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
		warnSpy.mockRestore();
	});

	it('applies stored session onto service runtime state', () => {
		const service = createService();

		const applied = applySessionFromStore(service, {
			url: 'http://server.local',
			accessToken: 'token-1',
			userId: 'user-1',
			serverName: 'My Server',
			username: 'Alice'
		});

		expect(applied).toBe(true);
		expect(service.serverUrl).toBe('http://server.local');
		expect(service.accessToken).toBe('token-1');
		expect(service.userId).toBe('user-1');
		expect(service.serverName).toBe('My Server');
		expect(service.username).toBe('Alice');
		expect(service.sessionExpiredNotified).toBe(false);
		expect(service.jellyfin.createApi).toHaveBeenCalledWith('http://server.local', 'token-1');
	});

	it('connects to server and stores resolved metadata', async () => {
		const service = createService();
		global.fetch.mockResolvedValue(jsonResponse({Name: 'Server Public Name'}));

		await expect(connectToServer(service, 'http://server.local')).resolves.toEqual({Name: 'Server Public Name'});
		expect(service.jellyfin.createApi).toHaveBeenCalledWith('http://server.local');
		expect(service.serverName).toBe('Server Public Name');
		expect(global.fetch).toHaveBeenCalledWith('http://server.local/System/Info/Public');
	});

	it('authenticates with resolved version/device metadata without retaining legacy storage', async () => {
		const service = createService();
		service.serverUrl = 'http://server.local';
		service.api = {};
		service.resolveClientVersion = jest.fn().mockResolvedValue('3.4.5');
		service.getClientVersion = jest.fn().mockReturnValue('3.4.5');
		service.getDeviceId = jest.fn().mockReturnValue('service-device-id');
		serverManager.addServer.mockReturnValue({serverId: 'srv-1', userId: 'user-1'});
		global.fetch.mockResolvedValue(
			jsonResponse({
				AccessToken: 'token-1',
				User: {
					Id: 'user-1',
					Name: 'Alice',
					PrimaryImageTag: 'avatar-1'
				},
				ServerName: 'Living Room'
			})
		);
		localStorage.setItem('jellyfinAuth', JSON.stringify({
			serverUrl: 'http://legacy.local',
			accessToken: 'legacy-token',
			userId: 'legacy-user'
		}));

		await expect(authenticateWithServer(service, 'Alice', 'secret')).resolves.toEqual({
			Id: 'user-1',
			Name: 'Alice',
			PrimaryImageTag: 'avatar-1'
		});

		const authHeader = global.fetch.mock.calls[0]?.[1]?.headers?.Authorization || '';
		expect(authHeader).toContain('Version="3.4.5"');
		expect(authHeader).toContain('DeviceId="service-device-id"');
		expect(service.resolveClientVersion).toHaveBeenCalledTimes(1);
		expect(service.getDeviceId).toHaveBeenCalledTimes(1);
		expect(service.api.accessToken).toBe('token-1');
		expect(serverManager.addServer).toHaveBeenCalledWith(expect.objectContaining({
			serverUrl: 'http://server.local',
			serverName: 'Living Room',
			userId: 'user-1',
			username: 'Alice',
			accessToken: 'token-1',
			avatarTag: 'avatar-1'
		}));
		expect(serverManager.setActiveServer).toHaveBeenCalledWith('srv-1', 'user-1');
		expect(localStorage.getItem('jellyfinAuth')).toBe(null);
	});

	it('submits an empty password when authenticating a passwordless user', async () => {
		const service = createService();
		service.serverUrl = 'http://server.local';
		service.api = {};
		serverManager.addServer.mockReturnValue({serverId: 'srv-1', userId: 'user-1'});
		global.fetch.mockResolvedValue(
			jsonResponse({
				AccessToken: 'token-1',
				User: {
					Id: 'user-1',
					Name: 'Alice'
				}
			})
		);

		await expect(authenticateWithServer(service, 'Alice', undefined)).resolves.toEqual({
			Id: 'user-1',
			Name: 'Alice'
		});

		const requestBody = JSON.parse(global.fetch.mock.calls[0]?.[1]?.body || '{}');
		expect(requestBody).toEqual({
			Username: 'Alice',
			Pw: ''
		});
	});

	it('reports a status-aware error for a non-JSON authentication failure', async () => {
		const service = createService();
		service.serverUrl = 'http://server.local';
		service.api = {};
		global.fetch.mockResolvedValue(textResponse('<html>Bad request</html>', false, 400));

		await expect(authenticateWithServer(service, 'Alice', 'secret')).rejects.toMatchObject({
			name: 'JellyfinRequestError',
			status: 400,
			message: 'Authentication failed with status 400'
		});
		expect(service.accessToken).toBe(null);
	});

	it('reports malformed JSON in an otherwise successful authentication response', async () => {
		const service = createService();
		service.serverUrl = 'http://server.local';
		service.api = {};
		global.fetch.mockResolvedValue(textResponse('<html>Unexpected response</html>', true, 200));

		await expect(authenticateWithServer(service, 'Alice', 'secret')).rejects.toThrow(
			'Authentication response was not valid JSON'
		);
		expect(service.accessToken).toBe(null);
	});

	it('restores active session from server manager before legacy storage', () => {
		const service = createService();
		localStorage.setItem('jellyfinAuth', JSON.stringify({
			serverUrl: 'http://legacy.local',
			accessToken: 'legacy-token',
			userId: 'legacy-user'
		}));
		serverManager.getActiveServer.mockReturnValue({
			url: 'http://active.local',
			name: 'Active',
			activeUser: {
				userId: 'user-1',
				username: 'Alice',
				accessToken: 'token-1'
			}
		});

		const restored = restoreServiceSession(service);

		expect(restored).toBe(true);
		expect(service.serverUrl).toBe('http://active.local');
		expect(service.userId).toBe('user-1');
		expect(service.jellyfin.createApi).toHaveBeenCalledWith('http://active.local', 'token-1');
		expect(localStorage.getItem('jellyfinAuth')).toBe(null);
	});

	it('retains a valid legacy session when managed migration cannot be confirmed', () => {
		const service = createService();
		const legacySession = JSON.stringify({
			serverUrl: 'http://legacy.local',
			accessToken: 'legacy-token',
			userId: 'legacy-user'
		});
		serverManager.getActiveServer.mockReturnValue(null);
		serverManager.addServer.mockReturnValue(null);
		localStorage.setItem('jellyfinAuth', legacySession);

		expect(restoreServiceSession(service)).toBe(true);
		expect(localStorage.getItem('jellyfinAuth')).toBe(legacySession);
		expect(serverManager.setActiveServer).not.toHaveBeenCalled();
		expect(service.jellyfin.createApi).toHaveBeenCalledWith('http://legacy.local', 'legacy-token');
	});

	it('removes malformed legacy payload when active session is unavailable', () => {
		const service = createService();
		serverManager.getActiveServer.mockReturnValue(null);
		localStorage.setItem('jellyfinAuth', '{"serverUrl":"http://broken.local"');

		expect(restoreServiceSession(service)).toBe(false);
		expect(localStorage.getItem('jellyfinAuth')).toBe(null);
	});

	it('updates active saved user metadata when current profile loads', async () => {
		const service = createService();
		service.userId = 'user-1';
		service._request.mockResolvedValue({
			Name: 'Alice Updated',
			PrimaryImageTag: 'avatar-2'
		});
		serverManager.getActiveServer.mockReturnValue({
			id: 'srv-1',
			activeUser: {
				userId: 'user-1',
				username: 'Alice'
			}
		});

		await expect(getCurrentServiceUser(service)).resolves.toEqual({
			Name: 'Alice Updated',
			PrimaryImageTag: 'avatar-2'
		});
		expect(serverManager.updateUser).toHaveBeenCalledWith('srv-1', 'user-1', {
			username: 'Alice Updated',
			avatarTag: 'avatar-2'
		});
	});

	it('clears runtime session after forgetting user when no active server remains', () => {
		const service = createService();
		service.api = {accessToken: 'token-1'};
		service.serverUrl = 'http://server.local';
		service.accessToken = 'token-1';
		service.userId = 'user-1';
		service.serverName = 'Server';
		service.username = 'Alice';
		service.sessionExpiredNotified = true;
		serverManager.getActiveServer.mockReturnValue(null);

		forgetServiceServer(service, 'srv-1', 'user-1');

		expect(serverManager.removeUser).toHaveBeenCalledWith('srv-1', 'user-1');
		expect(service.api).toBe(null);
		expect(service.serverUrl).toBe(null);
		expect(service.accessToken).toBe(null);
		expect(service.userId).toBe(null);
		expect(service.serverName).toBe(null);
		expect(service.username).toBe(null);
		expect(service.sessionExpiredNotified).toBe(false);
	});

	it('applies selected active server and throws when selection is missing', () => {
		const service = createService();
		serverManager.setActiveServer.mockReturnValue({
			url: 'http://server.local',
			name: 'Main',
			activeUser: {
				userId: 'user-1',
				username: 'Alice',
				accessToken: 'token-1'
			}
		});

		expect(setActiveServiceServer(service, 'srv-1', 'user-1')).toBe(true);
		expect(service.serverUrl).toBe('http://server.local');
		expect(service.jellyfin.createApi).toHaveBeenCalledWith('http://server.local', 'token-1');

		serverManager.setActiveServer.mockReturnValueOnce(null);
		expect(() => setActiveServiceServer(service, 'missing', 'missing')).toThrow('Server selection failed: not found');
	});
});
