import {
	createNativePlaybackSourceToken,
	createPlaybackRuntimeContext,
	isNativePlaybackSourceTokenCurrent,
	isPlaybackSourceMediaEventCurrent,
	isPlaybackRuntimeContextCurrent
} from '../playbackRuntimeContext';

describe('playback runtime context', () => {
	it('captures an immutable source and track snapshot', () => {
		const source = {Id: 'source-1', __selectedPlayMethod: 'Transcode'};
		const context = createPlaybackRuntimeContext({
			generation: 3,
			itemId: 'item-1',
			mediaSourceData: source,
			playMethod: 'Transcode',
			dynamicRange: {id: 'HDR10'},
			subtitlePolicy: {renderer: 'client-ass-lightweight'},
			selectedAudioTrack: 1,
			selectedSubtitleTrack: 4,
			playbackOptions: {forceTranscoding: true}
		});

		source.Id = 'changed';
		expect(context).toEqual(expect.objectContaining({
			generation: 3,
			itemId: 'item-1',
			mediaSourceId: 'source-1',
			playMethod: 'Transcode',
			selectedAudioTrack: 1,
			selectedSubtitleTrack: 4
		}));
		expect(context.mediaSourceData.Id).toBe('source-1');
		expect(Object.isFrozen(context)).toBe(true);
	});

	it('rejects stale HLS instances, generations, contexts, and teardown', () => {
		const hls = {};
		const context = createPlaybackRuntimeContext({
			generation: 2,
			itemId: 'item-1',
			mediaSourceData: {Id: 'source-1'}
		});
		const base = {
			runtimeContext: context,
			activeRuntimeContext: context,
			hls,
			activeHls: hls,
			generation: 2,
			exitInProgress: false
		};

		expect(isPlaybackRuntimeContextCurrent(base)).toBe(true);
		expect(isPlaybackRuntimeContextCurrent({
			...base,
			hls: null,
			activeHls: null
		})).toBe(true);
		expect(isPlaybackRuntimeContextCurrent({...base, activeHls: {}})).toBe(false);
		expect(isPlaybackRuntimeContextCurrent({...base, activeRuntimeContext: {}})).toBe(false);
		expect(isPlaybackRuntimeContextCurrent({...base, generation: 3})).toBe(false);
		expect(isPlaybackRuntimeContextCurrent({...base, exitInProgress: true})).toBe(false);
	});

	it('binds native events to one video, source context, and generation', () => {
		const video = {};
		const context = createPlaybackRuntimeContext({
			generation: 4,
			itemId: 'item-1',
			mediaSourceData: {Id: 'source-1'},
			playMethod: 'DirectPlay'
		});
		const sourceToken = createNativePlaybackSourceToken({
			runtimeContext: context,
			video,
			sourceUrl: 'video.mkv',
			sourceGeneration: 7,
			serverBurnIn: true,
			attachedAtEpochMs: 2000000000000,
			attachedAtEventTime: 200
		});
		const current = {
			sourceToken,
			activeSourceToken: sourceToken,
			activeRuntimeContext: context,
			generation: 4,
			eventTarget: video,
			exitInProgress: false
		};

		expect(isNativePlaybackSourceTokenCurrent(current)).toBe(true);
		expect(sourceToken.sourceGeneration).toBe(7);
		expect(sourceToken.serverBurnIn).toBe(true);
		expect(isNativePlaybackSourceTokenCurrent({...current, activeSourceToken: {}})).toBe(false);
		expect(isNativePlaybackSourceTokenCurrent({...current, generation: 5})).toBe(false);
		expect(isNativePlaybackSourceTokenCurrent({...current, eventTarget: {}})).toBe(false);
		expect(isNativePlaybackSourceTokenCurrent({...current, exitInProgress: true})).toBe(false);
		expect(isPlaybackSourceMediaEventCurrent({
			...current,
			event: {type: 'playing', currentTarget: video, timeStamp: 199}
		})).toBe(false);
		expect(isPlaybackSourceMediaEventCurrent({
			...current,
			event: {type: 'playing', currentTarget: video, timeStamp: 201}
		})).toBe(true);
		expect(isPlaybackSourceMediaEventCurrent({
			...current,
			event: {type: 'playing', currentTarget: video, timeStamp: 2000000000001}
		})).toBe(true);
	});

	it('lets HLS.js own media errors while retaining its lifecycle events', () => {
		const video = {};
		const context = createPlaybackRuntimeContext({
			generation: 5,
			itemId: 'item-2',
			mediaSourceData: {Id: 'source-2'}
		});
		const sourceToken = createNativePlaybackSourceToken({
			runtimeContext: context,
			video,
			sourceUrl: 'stream.m3u8',
			engine: 'hls.js',
			attachedAtEventTime: 100
		});
		const base = {
			sourceToken,
			activeSourceToken: sourceToken,
			activeRuntimeContext: context,
			generation: 5,
			exitInProgress: false
		};

		expect(isPlaybackSourceMediaEventCurrent({
			...base,
			event: {type: 'loadedmetadata', currentTarget: video, timeStamp: 101}
		})).toBe(true);
		expect(isPlaybackSourceMediaEventCurrent({
			...base,
			event: {type: 'error', currentTarget: video, timeStamp: 101}
		})).toBe(false);
	});
});
