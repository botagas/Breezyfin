import {act, renderHook} from '@testing-library/react';

import {usePlayerSeekAndTrackSwitching} from '../usePlayerSeekAndTrackSwitching';

const createProps = () => {
	const video = document.createElement('video');
	Object.defineProperties(video, {
		currentTime: {configurable: true, writable: true, value: 12},
		paused: {configurable: true, writable: true, value: true},
		ended: {configurable: true, writable: true, value: false}
	});
	const props = {
		videoRef: {current: video},
		hlsRef: {current: null},
		nativeSourceTokenRef: {current: {generation: 1, sourceGeneration: 1}},
		duration: 100,
		isCurrentTranscoding: false,
		mediaSourceData: {Id: 'source-1'},
		checkSkipSegments: jest.fn(),
		playbackOptions: {
			audioTrackIntent: {language: 'eng'},
			subtitleTrackIntent: {language: 'eng'}
		},
		playbackSettingsRef: {current: {}},
		currentAudioTrack: 0,
		currentSubtitleTrack: 3,
		reportPlaybackProgressNow: jest.fn(),
		handleStop: jest.fn().mockResolvedValue(undefined),
		loadVideo: jest.fn(),
		playbackOverrideRef: {current: null},
		lastInteractionRef: {current: 0},
		seekOffsetRef: {current: 0},
		seekFeedbackTimerRef: {current: null},
		setCurrentTime: jest.fn(),
		setLoading: jest.fn(),
		setSeekFeedback: jest.fn(),
		audioTracks: [
			{Index: 0, Language: 'eng', DisplayTitle: 'English'},
			{Index: 1, Language: 'jpn', DisplayTitle: 'Japanese'}
		],
		subtitleTracks: [],
		closeAudioPopup: jest.fn(),
		closeSubtitlePopup: jest.fn(),
		saveAudioSelection: jest.fn(),
		saveSubtitleSelection: jest.fn(),
		setCurrentAudioTrack: jest.fn(),
		setCurrentSubtitleTrack: jest.fn(),
		setToastMessage: jest.fn(),
		appendPlaybackDiagnostic: jest.fn()
	};
	return {video, props};
};

describe('usePlayerSeekAndTrackSwitching', () => {
	it('reloads with the explicit audio index when HLS.js rejects a runtime switch', async () => {
		const view = createProps();
		let currentHlsTrack = 0;
		const hls = {
			audioTracks: [
				{lang: 'eng', name: 'English'},
				{lang: 'jpn', name: 'Japanese'}
			]
		};
		Object.defineProperty(hls, 'audioTrack', {
			get: () => currentHlsTrack,
			set: jest.fn(() => {
				currentHlsTrack = 0;
			})
		});
		view.props.hlsRef.current = hls;
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));

		await act(async () => {
			await result.current.handleAudioTrackChange(1);
		});

		expect(view.props.playbackOverrideRef.current).toEqual(expect.objectContaining({
			audioStreamIndex: 1,
			subtitleStreamIndex: 3,
			disableDirectPlay: true
		}));
		expect(view.props.playbackOverrideRef.current.audioTrackIntent).toBeUndefined();
		expect(view.props.playbackOverrideRef.current.subtitleTrackIntent).toBeUndefined();
		expect(view.props.handleStop).toHaveBeenCalledTimes(1);
		expect(view.props.loadVideo).toHaveBeenCalledTimes(1);
	});

	it('pauses active native playback until the switched audio track settles', async () => {
		const view = createProps();
		const nativeTracks = [
			{language: 'eng', label: 'English', enabled: true},
			{language: 'jpn', label: 'Japanese', enabled: false}
		];
		Object.defineProperty(view.video, 'audioTracks', {
			configurable: true,
			value: nativeTracks
		});
		view.video.paused = false;
		view.video.pause = jest.fn(() => {
			view.video.paused = true;
		});
		view.video.play = jest.fn(() => {
			view.video.paused = false;
			return Promise.resolve();
		});
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));

		await act(async () => {
			const switching = result.current.handleAudioTrackChange(1);
			view.video.dispatchEvent(new Event('canplay'));
			await switching;
		});

		expect(view.video.pause).toHaveBeenCalledTimes(1);
		expect(nativeTracks.map((track) => track.enabled)).toEqual([false, true]);
		expect(view.video.play).toHaveBeenCalledTimes(1);
		expect(view.props.handleStop).not.toHaveBeenCalled();
		expect(view.props.setCurrentAudioTrack).toHaveBeenCalledWith(1);
	});

	it('does not resume a replaced native source after audio settling', async () => {
		const view = createProps();
		Object.defineProperty(view.video, 'audioTracks', {
			configurable: true,
			value: [
				{language: 'eng', label: 'English', enabled: true},
				{language: 'jpn', label: 'Japanese', enabled: false}
			]
		});
		view.video.paused = false;
		view.video.pause = jest.fn(() => {
			view.video.paused = true;
		});
		view.video.play = jest.fn().mockResolvedValue(undefined);
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));

		await act(async () => {
			const switching = result.current.handleAudioTrackChange(1);
			view.props.nativeSourceTokenRef.current = {generation: 2, sourceGeneration: 2};
			view.video.dispatchEvent(new Event('canplay'));
			await switching;
		});

		expect(view.video.play).not.toHaveBeenCalled();
	});
});
