const loadDeviceIdentityModule = () => {
	let deviceIdentityModule = null;
	jest.isolateModules(() => {
		// eslint-disable-next-line global-require
		deviceIdentityModule = require('../deviceIdentity');
	});
	return deviceIdentityModule;
};

describe('deviceIdentity', () => {
	beforeEach(() => {
		jest.resetModules();
		localStorage.clear();
	});

	it('returns persisted device id when present', () => {
		localStorage.setItem('breezyfin_device_id', 'bf-persisted-id');
		const {getDeviceId} = loadDeviceIdentityModule();

		expect(getDeviceId()).toBe('bf-persisted-id');
		expect(localStorage.getItem('breezyfin_device_id')).toBe('bf-persisted-id');
	});

	it('generates and persists a device id when missing', () => {
		const {getDeviceId} = loadDeviceIdentityModule();
		const resolvedDeviceId = getDeviceId();

		expect(resolvedDeviceId).toMatch(/^breezyfin-webos-/);
		expect(localStorage.getItem('breezyfin_device_id')).toBe(resolvedDeviceId);
	});
});

