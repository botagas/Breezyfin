jest.mock('../../serverManager', () => ({
	__esModule: true,
	default: {
		addServer: jest.fn(),
		setActiveServer: jest.fn()
	}
}));

import serverManager from '../../serverManager';
import {
	authenticateWithQuickConnect,
	getQuickConnectEnabled,
	getQuickConnectState,
	initiateQuickConnect
} from '../quickConnectApi';
import {createJsonResponse, createTextResponse} from '../../../testUtils/fetchResponse';

const createService = () => ({
	serverUrl: 'http://media.local',
	serverName: 'Media',
	accessToken: null,
	userId: null,
	username: null,
	sessionExpiredNotified: true,
	sessionGeneration: 2,
	api: {},
	getClientVersion: jest.fn(() => '0.2.1'),
	getDeviceId: jest.fn(() => 'device-1'),
	jellyfin: {createApi: jest.fn()}
});

describe('quickConnectApi', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
		serverManager.addServer.mockReturnValue({serverId: 'server-1', userId: 'user-1'});
	});

	it('checks availability without authenticated session handling', async () => {
		global.fetch.mockResolvedValue(createJsonResponse(true));
		const service = createService();

		await expect(getQuickConnectEnabled(service)).resolves.toBe(true);
		expect(global.fetch).toHaveBeenCalledWith(
			'http://media.local/QuickConnect/Enabled',
			expect.objectContaining({
				headers: expect.objectContaining({Authorization: expect.stringContaining('MediaBrowser')})
			})
		);
	});

	it('treats an unavailable endpoint as disabled', async () => {
		global.fetch.mockResolvedValue(createTextResponse('', false, 404));
		await expect(getQuickConnectEnabled(createService())).resolves.toBe(false);
	});

	it('initiates and polls with the returned secret', async () => {
		global.fetch
			.mockResolvedValueOnce(createJsonResponse({Code: 'ABC123', Secret: 'private-secret'}))
			.mockResolvedValueOnce(createJsonResponse({Authenticated: false}));
		const service = createService();

		await expect(initiateQuickConnect(service)).resolves.toEqual({
			Code: 'ABC123',
			Secret: 'private-secret'
		});
		await expect(getQuickConnectState(service, 'private-secret')).resolves.toEqual({Authenticated: false});
		expect(global.fetch.mock.calls[1][0]).toBe(
			'http://media.local/QuickConnect/Connect?Secret=private-secret'
		);
	});

	it('commits an approved user through the shared saved-session path', async () => {
		global.fetch.mockResolvedValue(createJsonResponse({
			AccessToken: 'token-1',
			User: {Id: 'user-1', Name: 'Alice', PrimaryImageTag: 'avatar-1'},
			ServerName: 'Living Room'
		}));
		const service = createService();

		await expect(authenticateWithQuickConnect(service, 'private-secret')).resolves.toEqual(
			expect.objectContaining({Id: 'user-1', Name: 'Alice'})
		);
		expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({Secret: 'private-secret'});
		expect(service.accessToken).toBe('token-1');
		expect(service.userId).toBe('user-1');
		expect(service.sessionGeneration).toBe(3);
		expect(serverManager.addServer).toHaveBeenCalledWith(expect.objectContaining({
			userId: 'user-1',
			accessToken: 'token-1'
		}));
		expect(serverManager.setActiveServer).toHaveBeenCalledWith('server-1', 'user-1');
	});
});
