jest.mock('@jellyfin/sdk', () => ({
	Jellyfin: jest.fn().mockImplementation(() => ({
		createApi: jest.fn((url, accessToken) => ({url, accessToken}))
	}))
}));

jest.mock('@jellyfin/sdk/lib/utils/api/playstate-api', () => ({
	getPlaystateApi: jest.fn()
}));

jest.mock('../serverManager', () => ({
	__esModule: true,
	default: {
		addServer: jest.fn(),
		setActiveServer: jest.fn(),
		getActiveServer: jest.fn(),
		removeUser: jest.fn(),
		clearActive: jest.fn(),
		listServers: jest.fn()
	}
}));

import jellyfinService from '../jellyfinService';
import serverManager from '../serverManager';

const jsonResponse = (data, ok = true, status = 200) => ({
	ok,
	status,
	json: async () => data
});

const resetServiceState = () => {
	jellyfinService.api = null;
	jellyfinService.userId = null;
	jellyfinService.serverUrl = null;
	jellyfinService.accessToken = null;
	jellyfinService.serverName = null;
	jellyfinService.username = null;
};

describe('jellyfinService', () => {
	let errorSpy;

	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.clear();
		resetServiceState();
		global.fetch = jest.fn();
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
	});

	it('connects to server and stores server metadata', async () => {
		global.fetch.mockResolvedValue(jsonResponse({ServerName: 'My Jellyfin'}));

		const info = await jellyfinService.connect('http://media.local:8096');

		expect(global.fetch).toHaveBeenCalledWith('http://media.local:8096/System/Info/Public');
		expect(info).toEqual({ServerName: 'My Jellyfin'});
		expect(jellyfinService.serverUrl).toBe('http://media.local:8096');
		expect(jellyfinService.serverName).toBe('My Jellyfin');
		expect(jellyfinService.jellyfin.createApi).toHaveBeenCalledWith('http://media.local:8096');
	});

	it('throws when server is not reachable during connect', async () => {
		global.fetch.mockResolvedValue(jsonResponse({}, false, 500));

		await expect(jellyfinService.connect('http://bad-host')).rejects.toThrow('Server not reachable');
	});

	it('authenticates and persists active session', async () => {
		jellyfinService.serverUrl = 'http://media.local';
		jellyfinService.api = {};
		serverManager.addServer.mockReturnValue({serverId: 'srv1', userId: 'user1'});
		global.fetch.mockResolvedValue(
			jsonResponse({
				AccessToken: 'token-123',
				User: {Id: 'user1', Name: 'Alice'},
				ServerName: 'Living Room'
			})
		);

		const user = await jellyfinService.authenticate('Alice', 'secret');

		expect(global.fetch).toHaveBeenCalledWith(
			'http://media.local/Users/AuthenticateByName',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({Username: 'Alice', Pw: 'secret'})
			})
		);
		expect(user).toEqual({Id: 'user1', Name: 'Alice'});
		expect(jellyfinService.accessToken).toBe('token-123');
		expect(jellyfinService.userId).toBe('user1');
		expect(jellyfinService.username).toBe('Alice');
		expect(jellyfinService.serverName).toBe('Living Room');
		expect(jellyfinService.api.accessToken).toBe('token-123');
		expect(serverManager.addServer).toHaveBeenCalledWith(
			expect.objectContaining({
				serverUrl: 'http://media.local',
				serverName: 'Living Room',
				userId: 'user1',
				username: 'Alice',
				accessToken: 'token-123'
			})
		);
		expect(serverManager.setActiveServer).toHaveBeenCalledWith('srv1', 'user1');

		const savedAuth = JSON.parse(localStorage.getItem('jellyfinAuth'));
		expect(savedAuth).toEqual({
			serverUrl: 'http://media.local',
			accessToken: 'token-123',
			userId: 'user1'
		});
	});

	it('restores active session from serverManager state', () => {
		serverManager.getActiveServer.mockReturnValue({
			url: 'http://primary.local',
			name: 'Primary',
			activeUser: {
				userId: 'u-1',
				username: 'Bob',
				accessToken: 'active-token'
			}
		});

		const restored = jellyfinService.restoreSession();

		expect(restored).toBe(true);
		expect(jellyfinService.serverUrl).toBe('http://primary.local');
		expect(jellyfinService.accessToken).toBe('active-token');
		expect(jellyfinService.userId).toBe('u-1');
		expect(jellyfinService.serverName).toBe('Primary');
		expect(jellyfinService.username).toBe('Bob');
		expect(jellyfinService.jellyfin.createApi).toHaveBeenCalledWith('http://primary.local', 'active-token');
	});

	it('falls back to legacy jellyfinAuth storage when no active managed session exists', () => {
		serverManager.getActiveServer.mockReturnValue(null);
		serverManager.addServer.mockReturnValue({serverId: 'legacy-srv', userId: 'legacy-user'});
		localStorage.setItem(
			'jellyfinAuth',
			JSON.stringify({
				serverUrl: 'http://legacy.local',
				accessToken: 'legacy-token',
				userId: 'legacy-user'
			})
		);

		const restored = jellyfinService.restoreSession();

		expect(restored).toBe(true);
		expect(jellyfinService.serverUrl).toBe('http://legacy.local');
		expect(jellyfinService.accessToken).toBe('legacy-token');
		expect(jellyfinService.userId).toBe('legacy-user');
		expect(serverManager.addServer).toHaveBeenCalledWith(
			expect.objectContaining({
				serverUrl: 'http://legacy.local',
				userId: 'legacy-user',
				username: 'User',
				accessToken: 'legacy-token'
			})
		);
		expect(serverManager.setActiveServer).toHaveBeenCalledWith('legacy-srv', 'legacy-user');
	});
});
