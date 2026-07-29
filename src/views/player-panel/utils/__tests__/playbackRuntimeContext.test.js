import {
	createNativePlaybackSourceToken,
	createPlaybackRuntimeContext,
	isNativePlaybackSourceTokenCurrent,
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
			sourceUrl: 'video.mkv'
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
		expect(isNativePlaybackSourceTokenCurrent({...current, activeSourceToken: {}})).toBe(false);
		expect(isNativePlaybackSourceTokenCurrent({...current, generation: 5})).toBe(false);
		expect(isNativePlaybackSourceTokenCurrent({...current, eventTarget: {}})).toBe(false);
		expect(isNativePlaybackSourceTokenCurrent({...current, exitInProgress: true})).toBe(false);
	});
});
