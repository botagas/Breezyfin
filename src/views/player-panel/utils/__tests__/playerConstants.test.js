import {createHlsPlayerConfig, HLS_PLAYER_CONFIG} from '../../constants';

describe('player runtime constants', () => {
	it('gives each HLS instance an extensible copy for normalized policy fields', () => {
		const instanceConfig = createHlsPlayerConfig();
		expect(Object.isFrozen(HLS_PLAYER_CONFIG)).toBe(true);
		expect(Object.isExtensible(instanceConfig)).toBe(true);
		instanceConfig.playlistLoadPolicy = {maxTimeToFirstByteMs: 1000};
		expect(instanceConfig.playlistLoadPolicy).toEqual({maxTimeToFirstByteMs: 1000});
		expect(HLS_PLAYER_CONFIG).not.toHaveProperty('playlistLoadPolicy');
	});
});
