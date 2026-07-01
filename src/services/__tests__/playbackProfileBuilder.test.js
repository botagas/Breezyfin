jest.mock('../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn(() => ({
		playback: {
			supportsDolbyVision: true,
			supportsDolbyVisionInMkv: true,
			supportsHevc: true,
			nativeHlsFmp4: true,
			maxAudioChannels: 6,
			audioCodecsByContainer: {
				hls: ['aac', 'ac3', 'eac3']
			}
		}
	}))
}));

import {
	buildPlaybackRequestContext,
	buildSubtitleProfiles,
	buildTranscodingProfiles
} from '../jellyfin/playbackProfileBuilder';

const hasProfile = (profiles, format, method) => {
	return profiles.some((profile) => profile.Format === format && profile.Method === method);
};

describe('playbackProfileBuilder subtitle profiles', () => {
	it('keeps text subtitles external by default', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: false,
			forceSubtitleBurnIn: false
		});

		expect(hasProfile(profiles, 'ass', 'External')).toBe(true);
		expect(hasProfile(profiles, 'ass', 'Encode')).toBe(false);
		expect(hasProfile(profiles, 'ssa', 'External')).toBe(true);
		expect(hasProfile(profiles, 'ssa', 'Encode')).toBe(false);
		expect(hasProfile(profiles, 'srt', 'Encode')).toBe(false);
	});

	it('adds encode support for user-selected burn-in formats', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: false,
			forceSubtitleBurnIn: false,
			subtitleBurnInTextCodecs: ['ass', 'ssa']
		});

		expect(hasProfile(profiles, 'ass', 'Encode')).toBe(true);
		expect(hasProfile(profiles, 'ssa', 'Encode')).toBe(true);
		expect(hasProfile(profiles, 'srt', 'Encode')).toBe(false);
	});

	it('adds encode support for all text formats in relaxed profile mode', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: true,
			forceSubtitleBurnIn: false
		});

		expect(hasProfile(profiles, 'srt', 'Encode')).toBe(true);
		expect(hasProfile(profiles, 'webvtt', 'Encode')).toBe(true);
	});

	it('keeps smart subtitle mode external until burn-in is explicitly requested', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: false,
			forceSubtitleBurnIn: false,
			subtitleBurnInTextCodecs: []
		});

		expect(hasProfile(profiles, 'srt', 'External')).toBe(true);
		expect(hasProfile(profiles, 'srt', 'Encode')).toBe(false);
		expect(hasProfile(profiles, 'ass', 'External')).toBe(true);
		expect(hasProfile(profiles, 'ass', 'Encode')).toBe(false);
	});

	it('forces encode-only profiles when subtitle burn-in is requested', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: false,
			forceSubtitleBurnIn: true
		});

		expect(hasProfile(profiles, 'ass', 'Encode')).toBe(true);
		expect(hasProfile(profiles, 'pgs', 'Encode')).toBe(true);
		expect(profiles.some((profile) => profile.Method !== 'Encode')).toBe(false);
	});

	it('ignores manual subtitle format list in smart request context', () => {
		const context = buildPlaybackRequestContext({
			smartSubtitleTranscoding: true,
			subtitleBurnInTextCodecs: ['ass']
		});

		expect(context.smartSubtitleTranscoding).toBe(true);
		expect(context.subtitleBurnInTextCodecs).toEqual([]);
		expect(
			context.payload.DeviceProfile.SubtitleProfiles.some((profile) => (
				profile.Format === 'srt' && profile.Method === 'Encode'
			))
		).toBe(false);
	});
});

describe('playbackProfileBuilder transcoding profiles', () => {
	const baseCapabilities = {
		maxAudioChannels: 6,
		supportsHevc: true,
		nativeHlsFmp4: true,
		audioCodecsByContainer: {
			hls: ['aac', 'ac3', 'eac3']
		}
	};

	it('prefers fMP4 HLS when preference is enabled', () => {
		const profiles = buildTranscodingProfiles(false, baseCapabilities, {preferFmp4Mp4: true});
		const hlsProfile = profiles.find((profile) => profile?.Protocol === 'hls' && profile?.Type === 'Video');
		expect(hlsProfile?.Container).toBe('mp4');
	});

	it('falls back to TS HLS when preference is disabled', () => {
		const profiles = buildTranscodingProfiles(false, baseCapabilities, {preferFmp4Mp4: false});
		const hlsProfile = profiles.find((profile) => profile?.Protocol === 'hls' && profile?.Type === 'Video');
		expect(hlsProfile?.Container).toBe('ts');
	});
});
