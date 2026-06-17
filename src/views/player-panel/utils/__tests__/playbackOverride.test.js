import {
	buildPlaybackOverride,
	resolveVideoSeekSeconds
} from '../playbackOverride';

describe('playbackOverride', () => {
	it('builds a restart override preserving source, tracks, seek, and new-session flag', () => {
		expect(buildPlaybackOverride({
			baseOptions: {dynamicRangeCap: 'auto'},
			mediaSourceId: 'source-1',
			audioStreamIndex: 3,
			subtitleStreamIndex: -1,
			seekSeconds: 42.5
		})).toEqual({
			dynamicRangeCap: 'auto',
			mediaSourceId: 'source-1',
			audioStreamIndex: 3,
			subtitleStreamIndex: -1,
			seekSeconds: 42.5,
			forceNewSession: true
		});
	});

	it('preserves optional playback flags through extra values', () => {
		expect(buildPlaybackOverride({
			baseOptions: {mediaSourceId: 'source-base'},
			audioStreamIndex: 1,
			subtitleStreamIndex: 2,
			seekSeconds: 10,
			extra: {
				forceSubtitleBurnIn: true,
				avoidDolbyVision: true,
				dynamicRangeCap: 'hdr10'
			}
		})).toEqual({
			mediaSourceId: 'source-base',
			audioStreamIndex: 1,
			subtitleStreamIndex: 2,
			seekSeconds: 10,
			forceNewSession: true,
			forceSubtitleBurnIn: true,
			avoidDolbyVision: true,
			dynamicRangeCap: 'hdr10'
		});
	});

	it('normalizes negative seek positions to zero', () => {
		expect(buildPlaybackOverride({seekSeconds: -12})).toEqual({
			seekSeconds: 0,
			forceNewSession: true
		});
	});

	it('resolves current video position with optional seek offset', () => {
		expect(resolveVideoSeekSeconds({currentTime: 12.25}, 3)).toBe(15.25);
		expect(resolveVideoSeekSeconds({currentTime: -2}, -4)).toBe(0);
		expect(resolveVideoSeekSeconds(null, 5)).toBe(5);
	});
});
