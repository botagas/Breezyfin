import {act, renderHook} from '@testing-library/react';
import {usePlayerPlaybackDecision} from '../usePlayerPlaybackDecision';

const createProps = () => ({
	itemId: 'item-1',
	mediaSourceId: 'source-1',
	playbackOptions: {},
	currentAudioTrack: 1,
	currentSubtitleTrack: -1,
	audioTracks: [
		{Index: 1, Codec: 'dts-hd'},
		{Index: 2, Codec: 'eac3'}
	],
	videoRef: {current: {paused: true, currentTime: 12}},
	currentTimeRef: {current: 12},
	playbackOverrideRef: {current: null},
	setToastMessage: jest.fn(),
	setLoading: jest.fn(),
	setLoadingStatusMessage: jest.fn(),
	handleStop: jest.fn().mockResolvedValue(undefined),
	loadVideoRef: {current: jest.fn()},
	setCurrentAudioTrack: jest.fn(),
	setCurrentSubtitleTrack: jest.fn(),
	saveAudioSelection: jest.fn(),
	exitInProgressRef: {current: false},
	loadRequestIdRef: {current: 0},
	playbackGenerationRef: {current: 4},
	onBack: jest.fn()
});

describe('usePlayerPlaybackDecision', () => {
	it('ignores confirmation after the playback generation changes', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackDecision(props));
		await act(async () => {
			await result.current.requestPlaybackDecision({
				type: 'dynamic-range-fallback',
				itemId: 'item-1',
				mediaSourceId: 'source-1',
				generation: 4,
				proposedRange: 'hdr10'
			});
		});
		props.playbackGenerationRef.current = 5;

		await act(async () => {
			await result.current.handleConfirmPlaybackDecision();
		});

		expect(props.loadVideoRef.current).not.toHaveBeenCalled();
		expect(props.playbackOverrideRef.current).toBeNull();
	});

	it('restarts once with the confirmed range and bound resume position', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackDecision(props));
		await act(async () => {
			await result.current.requestPlaybackDecision({
				type: 'dynamic-range-fallback',
				itemId: 'item-1',
				mediaSourceId: 'source-1',
				generation: 4,
				proposedRange: 'hdr10',
				resumeTicks: 230000000
			});
		});
		await act(async () => {
			await result.current.handleConfirmPlaybackDecision();
		});

		expect(props.handleStop).toHaveBeenCalledTimes(1);
		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
		expect(props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			mediaSourceId: 'source-1',
			seekSeconds: 23,
			dynamicRangeCap: 'hdr10',
			avoidDolbyVision: true,
			confirmedDynamicRangeFallback: 'hdr10'
		}));
	});

	it('does not replace an active subtitle prompt with a later range fallback', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackDecision(props));
		await act(async () => {
			await result.current.requestPlaybackDecision({
				type: 'no-subtitles',
				itemId: 'item-1',
				generation: 4,
				subtitleStreamIndex: 7,
				reason: 'renderer-failed'
			});
			await result.current.requestPlaybackDecision({
				type: 'dynamic-range-fallback',
				itemId: 'item-1',
				generation: 4,
				proposedRange: 'sdr'
			});
		});

		expect(result.current.playbackDecisionPrompt).toEqual(expect.objectContaining({
			type: 'no-subtitles',
			reason: 'renderer-failed'
		}));
	});

	it('reserves a runtime decision while teardown is pending', async () => {
		const props = createProps();
		let finishStop;
		props.handleStop = jest.fn(() => new Promise((resolve) => {
			finishStop = resolve;
		}));
		const {result} = renderHook(() => usePlayerPlaybackDecision(props));
		let firstRequest;
		await act(async () => {
			firstRequest = result.current.requestPlaybackDecision({
				type: 'dynamic-range-fallback',
				itemId: 'item-1',
				generation: 4,
				proposedRange: 'hdr10',
				runtime: true
			});
			await result.current.requestPlaybackDecision({
				type: 'no-subtitles',
				itemId: 'item-1',
				generation: 4,
				subtitleStreamIndex: 7,
				runtime: true
			});
			finishStop();
			await firstRequest;
		});

		expect(props.handleStop).toHaveBeenCalledTimes(1);
		expect(result.current.playbackDecisionPrompt).toEqual(expect.objectContaining({
			type: 'dynamic-range-fallback',
			proposedRange: 'hdr10'
		}));
	});

	it('retries original-quality DV once without changing the saved bitrate setting', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackDecision(props));
		await act(async () => {
			await result.current.requestPlaybackDecision({
				type: 'dolby-vision-original-quality',
				itemId: 'item-1',
				mediaSourceId: 'source-1',
				generation: 4,
				proposedBitrateMbps: 120
			});
		});
		await act(async () => {
			await result.current.handleConfirmPlaybackDecision();
		});

		expect(props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			maxBitrate: '120',
			confirmedDolbyVisionOriginalQuality: true
		}));
		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
	});

	it('uses the configured bitrate when the user chooses an SDR transcode instead', async () => {
		const props = createProps();
		props.playbackOptions = {maxBitrate: '20'};
		const {result} = renderHook(() => usePlayerPlaybackDecision(props));
		await act(async () => {
			await result.current.requestPlaybackDecision({
				type: 'dolby-vision-original-quality',
				itemId: 'item-1',
				mediaSourceId: 'source-1',
				generation: 4,
				proposedBitrateMbps: 100,
				configuredBitrateMbps: 20
			});
		});
		await act(async () => {
			await result.current.handleAlternatePlaybackDecision();
		});

		expect(props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			maxBitrate: '20',
			forceTranscoding: true,
			dynamicRangeCap: 'sdr',
			avoidDolbyVision: true,
			confirmedDynamicRangeFallback: 'sdr'
		}));
		expect(props.loadVideoRef.current).toHaveBeenCalledTimes(1);
	});
});
