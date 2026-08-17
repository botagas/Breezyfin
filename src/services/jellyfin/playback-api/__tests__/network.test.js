import {fetchPlaybackInfo} from '../network';
import {createJsonResponse} from '../../../../testUtils/fetchResponse';

describe('playback-api network ownership', () => {
	let errorSpy;
	beforeEach(() => {
		global.fetch = jest.fn();
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => errorSpy.mockRestore());

	it('attributes an authentication failure to the server and token used by the request', async () => {
		const service = {
			serverUrl: 'http://old.local',
			accessToken: 'old-token',
			sessionGeneration: 4,
			userId: 'old-user',
			_handleAuthFailureStatus: jest.fn()
		};
		let resolveRequest;
		global.fetch.mockImplementation(() => new Promise((resolve) => {
			resolveRequest = resolve;
		}));
		const request = fetchPlaybackInfo(service, 'item-1', {});
		service.serverUrl = 'http://new.local';
		service.accessToken = 'new-token';

		resolveRequest(createJsonResponse({}, false, 401));
		await expect(request).rejects.toThrow('HTTP 401');
		expect(service._handleAuthFailureStatus).toHaveBeenCalledWith(401, {
			accessToken: 'old-token',
			serverUrl: 'http://old.local',
			sessionGeneration: 4
		});
	});
});
