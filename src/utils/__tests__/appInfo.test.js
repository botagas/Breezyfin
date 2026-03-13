const ORIGINAL_ENV = process.env;

const createJsonResponse = (payload, ok = true) => ({
	ok,
	json: async () => payload
});

const loadAppInfoModule = () => {
	let appInfoModule = null;
	jest.isolateModules(() => {
		// eslint-disable-next-line global-require
		appInfoModule = require('../appInfo');
	});
	return appInfoModule;
};

describe('appInfo', () => {
	let originalFetch;

	beforeEach(() => {
		jest.resetModules();
		process.env = {...ORIGINAL_ENV};
		originalFetch = global.fetch;
	});

	afterEach(() => {
		process.env = ORIGINAL_ENV;
		if (typeof originalFetch === 'undefined') {
			delete global.fetch;
		} else {
			global.fetch = originalFetch;
		}
	});

	it('returns build metadata synchronously when available', async () => {
		process.env.REACT_APP_VERSION = '2.3.4';
		delete process.env.npm_package_version;

		const {getAppVersion, loadAppVersion} = loadAppInfoModule();

		expect(getAppVersion()).toBe('2.3.4');
		await expect(loadAppVersion()).resolves.toBe('2.3.4');
	});

	it('prefers appinfo.json version over build metadata', async () => {
		process.env.REACT_APP_VERSION = '1.0.0';
		global.fetch = jest.fn().mockResolvedValue(createJsonResponse({version: '9.8.7'}));

		const {getAppVersion, loadAppVersion} = loadAppInfoModule();

		await expect(loadAppVersion()).resolves.toBe('9.8.7');
		expect(getAppVersion()).toBe('9.8.7');
		expect(global.fetch).toHaveBeenCalledWith('appinfo.json', {cache: 'no-store'});
	});

	it('does not permanently cache fallback version after a failed file lookup', async () => {
		delete process.env.REACT_APP_VERSION;
		delete process.env.npm_package_version;
		global.fetch = jest.fn()
			.mockRejectedValueOnce(new Error('temporary failure'))
			.mockResolvedValueOnce(createJsonResponse({version: '4.5.6'}));

		const {getAppVersion, loadAppVersion} = loadAppInfoModule();

		await expect(loadAppVersion()).resolves.toBe('0.0.0');
		expect(getAppVersion()).toBe('0.0.0');
		await expect(loadAppVersion()).resolves.toBe('4.5.6');
		expect(getAppVersion()).toBe('4.5.6');
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});
});
