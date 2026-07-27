import {
	BREEZYFIN_INTEGRATION_PREFERENCES_KEY,
	readIntegrationPreferences,
	writeIntegrationPreferences
} from '../integrationPreferences';

const service = {serverUrl: 'https://server.test/', userId: 'user-1'};

describe('integration preferences', () => {
	beforeEach(() => window.localStorage.clear());

	it('enables Watchlist for missing and legacy preference records', () => {
		expect(readIntegrationPreferences(service).watchlistEnabled).toBe(true);
		window.localStorage.setItem(BREEZYFIN_INTEGRATION_PREFERENCES_KEY, JSON.stringify({
			'["https://server.test","user-1"]': {homeSource: 'server'}
		}));
		expect(readIntegrationPreferences(service).watchlistEnabled).toBe(true);
	});

	it('preserves an explicit Watchlist opt-out', () => {
		expect(writeIntegrationPreferences(service, {watchlistEnabled: false})).toBe(true);
		expect(readIntegrationPreferences(service).watchlistEnabled).toBe(false);
	});
});
