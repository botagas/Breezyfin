import {
	captureRuntimeSessionIdentity,
	getSavedSessionKey,
	isRuntimeSessionIdentityCurrent,
	resolveExpiredSavedSessionKey
} from '../savedSessionIdentity';

describe('savedSessionIdentity', () => {
	it('builds a stable saved-session key without retaining credentials', () => {
		const entry = {
			serverId: 'server-1',
			userId: 'user-1',
			accessToken: 'secret-token'
		};

		expect(getSavedSessionKey(entry)).toBe('server-1:user-1');
	});

	it('prefers the active saved session', () => {
		expect(resolveExpiredSavedSessionKey([
			{serverId: 'server-1', userId: 'user-1', url: 'http://one.local'},
			{serverId: 'server-2', userId: 'user-2', url: 'http://two.local', isActive: true}
		], {
			serverUrl: 'http://one.local',
			userId: 'user-1'
		})).toBe('server-2:user-2');
	});

	it('falls back to the matching runtime session', () => {
		expect(resolveExpiredSavedSessionKey([
			{serverId: 'server-1', userId: 'user-1', url: 'http://one.local/'}
		], {
			serverUrl: 'http://one.local',
			userId: 'user-1'
		})).toBe('server-1:user-1');
	});

	it('returns null when no saved session matches', () => {
		expect(resolveExpiredSavedSessionKey([], {
			serverUrl: 'http://one.local',
			userId: 'user-1'
		})).toBe(null);
	});

	it('rejects an old saved-session lookup after Quick Connect replaces its credentials', () => {
		const restoredIdentity = captureRuntimeSessionIdentity({
			sessionGeneration: 4,
			serverUrl: 'http://media.local/',
			userId: 'user-1',
			accessToken: 'expired-token'
		});
		const quickConnectSession = {
			sessionGeneration: 5,
			serverUrl: 'http://media.local',
			userId: 'user-1',
			accessToken: 'fresh-token'
		};

		expect(isRuntimeSessionIdentityCurrent(restoredIdentity, quickConnectSession)).toBe(false);
		expect(isRuntimeSessionIdentityCurrent(
			captureRuntimeSessionIdentity(quickConnectSession),
			quickConnectSession
		)).toBe(true);
	});
});
