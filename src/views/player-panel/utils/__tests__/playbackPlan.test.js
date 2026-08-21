import {buildPlaybackPlan, isPlaybackPlan} from '../playbackPlan';

const pickAudio = (streams, requested, defaultStream) => (
	Number.isInteger(requested) ? requested : defaultStream?.Index ?? streams[0]?.Index ?? null
);

const pickSubtitle = (streams, requested, defaultStream) => (
	requested === -1 || Number.isInteger(requested)
		? requested
		: defaultStream?.Index ?? streams[0]?.Index ?? -1
);

const createService = () => ({
	serverUrl: 'https://example.test',
	getPlaybackUrl: jest.fn((itemId, mediaSourceId, playSessionId, tag, container) => (
		`https://example.test/Videos/${itemId}/stream?mediaSourceId=${mediaSourceId}&playSessionId=${playSessionId}&tag=${tag}&container=${container}`
	))
});

const createInfo = (overrides = {}) => ({
	PlaySessionId: 'session-1',
	MediaSources: [{
		Id: 'source-1',
		Container: 'mkv',
		RunTimeTicks: 120000000,
		SupportsDirectPlay: true,
		SupportsDirectStream: true,
		SupportsTranscoding: true,
		MediaStreams: [
			{Type: 'Video', Index: 0, Codec: 'hevc', VideoRangeType: 'HDR10'},
			{Type: 'Audio', Index: 1, Codec: 'aac', Language: 'eng', IsDefault: true},
			{Type: 'Audio', Index: 2, Codec: 'eac3', Language: 'jpn'},
			{Type: 'Subtitle', Index: 4, Codec: 'ass', IsDefault: true}
		]
	}],
	__breezyfin: {
		playMethod: 'DirectPlay',
		selectedAudioStreamIndex: 2,
		selectedSubtitleStreamIndex: 4,
		dynamicRange: {id: 'HDR10', displayLabel: 'HDR10'},
		subtitlePolicy: {clientRender: true, renderer: 'client-ass-lightweight'},
		adjustments: [{type: 'audioFallback'}],
		diagnostics: [{scope: 'source-selection', status: 'applied'}]
	},
	...overrides
});

const build = ({playbackInfo = createInfo(), playbackOptions = {}, playbackOverride = null} = {}) => (
	buildPlaybackPlan({
		item: {Id: 'item-1', RunTimeTicks: 60000000},
		playbackInfo,
		playbackOptions,
		playbackOverride,
		playbackSettingsSnapshot: {
			dynamicRangeCap: 'auto',
			enableDiagnostics: true
		},
		service: createService(),
		pickPreferredAudio: pickAudio,
		pickPreferredSubtitle: pickSubtitle
	})
);

const expectDeeplyFrozen = (value, seen = new WeakSet()) => {
	if (!value || typeof value !== 'object' || seen.has(value)) return;
	seen.add(value);
	expect(Object.isFrozen(value)).toBe(true);
	Object.values(value).forEach((child) => expectDeeplyFrozen(child, seen));
};

const containsFunction = (value, seen = new WeakSet()) => {
	if (typeof value === 'function') return true;
	if (!value || typeof value !== 'object' || seen.has(value)) return false;
	seen.add(value);
	return Object.values(value).some((child) => containsFunction(child, seen));
};

describe('playbackPlan', () => {
	it('builds an immutable DirectPlay plan with tracks, runtime inputs, and diagnostics', () => {
		const response = createInfo();
		const plan = build({
			playbackOptions: {audioStreamIndex: 2, subtitleStreamIndex: 4}
		});

		expect(isPlaybackPlan(plan)).toBe(true);
		expect(plan).toEqual(expect.objectContaining({
			itemId: 'item-1',
			durationSeconds: 12,
			dynamicRangeLabel: 'HDR10',
			adjustments: [{type: 'audioFallback'}],
			diagnostics: [{scope: 'source-selection', status: 'applied'}]
		}));
		expect(plan.session).toEqual(expect.objectContaining({
			playSessionId: 'session-1',
			mediaSourceId: 'source-1',
			playMethod: 'DirectPlay'
		}));
		expect(plan.tracks).toEqual(expect.objectContaining({
			selectedAudioStreamIndex: 2,
			selectedSubtitleStreamIndex: 4
		}));
		expect(plan.source).toEqual(expect.objectContaining({
			transport: 'file',
			isHls: false,
			isHdrLikeStream: true,
			serverBurnIn: false
		}));
		expect(plan.runtimeInput.requiresInitialNativeAudioSelection).toBe(true);
		expectDeeplyFrozen(plan);
		expect(containsFunction(plan)).toBe(false);

		response.MediaSources[0].Id = 'changed';
		response.__breezyfin.adjustments.push({type: 'changed'});
		expect(plan.mediaSource.Id).toBe('source-1');
		expect(plan.adjustments).toEqual([{type: 'audioFallback'}]);
	});

	it('builds a DirectStream HLS plan from a transcoding URL without selecting an engine', () => {
		const plan = build({
			playbackInfo: createInfo({
				MediaSources: [{
					...createInfo().MediaSources[0],
					SupportsDirectPlay: false,
					SupportsDirectStream: true,
					TranscodingUrl: '/Videos/item-1/master.m3u8'
				}],
				__breezyfin: {
					playMethod: 'DirectStream',
					dynamicRange: {id: 'SDR', displayLabel: 'SDR'},
					subtitlePolicy: {requiresBurnIn: false}
				}
			})
		});

		expect(plan.session.playMethod).toBe('DirectStream');
		expect(plan.source).toEqual(expect.objectContaining({
			transport: 'hls',
			isHls: true,
			isHdrLikeStream: false,
			serverBurnIn: false
		}));
		expect(plan.source.url).toBe('https://example.test/Videos/item-1/master.m3u8');
		expect(plan).not.toHaveProperty('hls');
		expect(plan).not.toHaveProperty('engine');
	});

	it('gates a non-default intent-resolved DirectPlay audio track', () => {
		const playbackInfo = createInfo();
		delete playbackInfo.__breezyfin.selectedAudioStreamIndex;
		const plan = build({
			playbackInfo,
			playbackOptions: {
				audioTrackIntent: {language: 'jpn', languageOrdinal: 0}
			}
		});

		expect(plan.tracks.selectedAudioStreamIndex).toBe(2);
		expect(plan.runtimeInput.requiresInitialNativeAudioSelection).toBe(true);
	});

	it('preserves DirectPlay and native audio gating for a runtime audio transition', () => {
		const plan = build({
			playbackOverride: {
				audioStreamIndex: 2,
				audioTransition: {id: 'audio-1', startPaused: true, seekSeconds: 42}
			}
		});

		expect(plan.playMethod).toBe('DirectPlay');
		expect(plan.session.playMethod).toBe('DirectPlay');
		expect(plan.tracks.selectedAudioStreamIndex).toBe(2);
		expect(plan.runtimeInput.requiresInitialNativeAudioSelection).toBe(true);
		expect(plan.runtimeInput.audioTransition).toEqual({
			id: 'audio-1',
			startPaused: true,
			seekSeconds: 42
		});
	});

	it('does not gate the IsDefault track when DefaultAudioStreamIndex is absent', () => {
		const playbackInfo = createInfo();
		delete playbackInfo.__breezyfin.selectedAudioStreamIndex;
		const plan = build({playbackInfo});

		expect(plan.tracks.selectedAudioStreamIndex).toBe(1);
		expect(plan.runtimeInput.requiresInitialNativeAudioSelection).toBe(false);
	});

	it('preserves transcode subtitle policy and required consent as data-only decisions', () => {
		const requiredDecision = {
			type: 'dynamic-range-fallback',
			proposedRange: 'hdr10',
			resumeTicks: 42000000
		};
		const plan = build({
			playbackInfo: createInfo({
				MediaSources: [{
					...createInfo().MediaSources[0],
					Container: 'ts',
					SupportsDirectPlay: false,
					SupportsDirectStream: false,
					TranscodingUrl: '/Videos/item-1/master.m3u8?SubtitleMethod=Encode'
				}],
				__breezyfin: {
					playMethod: 'Transcode',
					dynamicRange: {id: 'DV', displayLabel: 'Dolby Vision'},
					subtitlePolicy: {requiresBurnIn: true, forceBurnIn: true},
					requiredDecision,
					selectedAudioStreamIndex: 1,
					selectedSubtitleStreamIndex: 4
				}
			}),
			playbackOverride: {audioTransition: {id: 'audio-1', seekSeconds: 8}}
		});

		expect(plan.source).toEqual(expect.objectContaining({
			transport: 'hls',
			serverBurnIn: true
		}));
		expect(plan.subtitlePolicy).toEqual(expect.objectContaining({
			requiresBurnIn: true,
			forceBurnIn: true
		}));
		expect(plan.decision).toEqual({required: requiredDecision, resumeTicks: 42000000});
		expect(plan.runtimeInput.audioTransition).toEqual({id: 'audio-1', seekSeconds: 8});
		expect(plan.runtimeInput.requiresInitialNativeAudioSelection).toBe(false);
	});

	it('rejects responses that cannot produce an attachable source', () => {
		expect(() => build({playbackInfo: {MediaSources: []}})).toThrow('No media source available');
		expect(() => build({
			playbackInfo: createInfo({
				MediaSources: [{
					...createInfo().MediaSources[0],
					SupportsDirectPlay: false,
					SupportsDirectStream: false,
					TranscodingUrl: null
				}],
				__breezyfin: {playMethod: 'Transcode'}
			})
		})).toThrow('Transcoding selected, but no transcoding URL was returned.');
	});
});
