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
	buildSafeSubtitleBurnInTranscodingProfiles,
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

	it('advertises image subtitles as external by default for client rendering', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: false,
			forceSubtitleBurnIn: false
		});

		expect(hasProfile(profiles, 'pgs', 'External')).toBe(true);
		expect(hasProfile(profiles, 'pgssub', 'External')).toBe(true);
		expect(hasProfile(profiles, 'dvdsub', 'External')).toBe(true);
		expect(hasProfile(profiles, 'dvbsub', 'External')).toBe(true);
		expect(hasProfile(profiles, 'pgs', 'Encode')).toBe(false);
	});

	it('forces encode-only profiles when subtitle burn-in is requested', () => {
		const profiles = buildSubtitleProfiles({
			relaxedPlaybackProfile: false,
			forceSubtitleBurnIn: true
		});

		expect(hasProfile(profiles, 'ass', 'Encode')).toBe(true);
		expect(hasProfile(profiles, 'pgs', 'Encode')).toBe(true);
		expect(hasProfile(profiles, 'pgssub', 'Encode')).toBe(true);
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

	it('sets Jellyfin burn-in payload flags when subtitle burn-in is forced', () => {
		const context = buildPlaybackRequestContext({
			subtitleStreamIndex: 4,
			forceSubtitleBurnIn: true
		});

		expect(context.payload).toEqual(expect.objectContaining({
			SubtitleStreamIndex: 4,
			AlwaysBurnInSubtitleWhenTranscoding: true,
			EnableDirectPlay: false,
			EnableDirectStream: false,
			AllowVideoStreamCopy: false,
			AllowAudioStreamCopy: false
		}));
		expect(context.payload.SubtitleMethod).toBeUndefined();
		expect(context.payload.DeviceProfile.SubtitleProfiles.every((profile) => (
			profile.Method === 'Encode'
		))).toBe(true);
		expect(context.payload.DeviceProfile.TranscodingProfiles).toEqual([
			expect.objectContaining({
				Container: 'ts',
				VideoCodec: 'h264',
				AudioCodec: 'aac',
				MaxAudioChannels: '6'
			})
		]);
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

	it('builds a conservative subtitle burn-in HLS profile without changing the general profile', () => {
		const safeProfiles = buildSafeSubtitleBurnInTranscodingProfiles();
		const safeHlsProfile = safeProfiles.find((profile) => profile?.Protocol === 'hls' && profile?.Type === 'Video');

		expect(safeHlsProfile).toEqual(expect.objectContaining({
			Container: 'ts',
			VideoCodec: 'h264',
			AudioCodec: 'aac',
			MaxAudioChannels: '6',
			MinSegments: '1',
			BreakOnNonKeyFrames: false
		}));

		const generalProfiles = buildTranscodingProfiles(false, {
			...baseCapabilities,
			maxAudioChannels: 8
		}, {preferFmp4Mp4: true});
		const generalHlsProfile = generalProfiles.find((profile) => profile?.Protocol === 'hls' && profile?.Type === 'Video');
		expect(generalHlsProfile).toEqual(expect.objectContaining({
			Container: 'mp4',
			MaxAudioChannels: '8'
		}));
	});
});
