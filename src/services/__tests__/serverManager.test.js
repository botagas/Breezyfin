import serverManager from '../serverManager';

describe('serverManager identifiers', () => {
	const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		if (originalCryptoDescriptor) {
			Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
		} else {
			delete globalThis.crypto;
		}
		jest.restoreAllMocks();
	});

	it('uses Web Crypto when generating a server storage identifier', () => {
		const getRandomValues = jest.fn((values) => {
			values[0] = 123;
			values[1] = 456;
			return values;
		});
		Object.defineProperty(globalThis, 'crypto', {
			configurable: true,
			value: {getRandomValues}
		});

		const saved = serverManager.addServer({
			serverUrl: 'https://media.example.test',
			serverName: 'Media',
			userId: 'user-1',
			username: 'Viewer',
			accessToken: 'token'
		});

		expect(getRandomValues).toHaveBeenCalledTimes(1);
		expect(saved).toEqual({
			serverId: expect.stringMatching(/^srv_[a-z0-9]+_3fco$/),
			userId: 'user-1'
		});
	});

	it('uses a collision-resistant local fallback when Web Crypto is unavailable', () => {
		Object.defineProperty(globalThis, 'crypto', {
			configurable: true,
			value: undefined
		});
		jest.spyOn(Date, 'now').mockReturnValue(123456789);

		const first = serverManager.addServer({
			serverUrl: 'http://first.example.test',
			serverName: 'First',
			userId: 'user-1',
			username: 'Viewer',
			accessToken: 'token-1'
		});
		const second = serverManager.addServer({
			serverUrl: 'http://second.example.test',
			serverName: 'Second',
			userId: 'user-2',
			username: 'Viewer',
			accessToken: 'token-2'
		});

		expect(first.serverId).toMatch(/^srv_21i3v9_[a-z0-9]+$/);
		expect(second.serverId).toMatch(/^srv_21i3v9_[a-z0-9]+$/);
		expect(second.serverId).not.toBe(first.serverId);
	});
});
