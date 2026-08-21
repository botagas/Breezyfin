import {act, renderHook} from '@testing-library/react';
import Hls from 'hls.js';

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
		subtitleTracks: [
			{Index: 3, Language: 'eng', DisplayTitle: 'English'},
			{Index: 4, Language: 'jpn', DisplayTitle: 'Japanese'}
		],
		closeAudioPopup: jest.fn(),
		closeSubtitlePopup: jest.fn(),
		saveAudioSelection: jest.fn(),
		saveSubtitleSelection: jest.fn(),
		setCurrentAudioTrack: jest.fn(),
		setCurrentSubtitleTrack: jest.fn(),
		setToastMessage: jest.fn(),
		dismissToast: jest.fn(),
		requestAudioTransition: jest.fn().mockResolvedValue(true),
		isTrackTransitionActive: jest.fn(() => false),
		setInlineAudioSwitchActive: jest.fn(),
		appendPlaybackDiagnostic: jest.fn()
	};
	return {video, props};
};

describe('usePlayerSeekAndTrackSwitching', () => {
	it('commits an HLS.js audio selection only after the switch event', async () => {
		const view = createProps();
		const handlers = new Map();
		const hls = {
			audioTracks: [
				{lang: 'eng', name: 'English'},
				{lang: 'jpn', name: 'Japanese'}
			],
			on: jest.fn((event, handler) => handlers.set(event, handler)),
			off: jest.fn((event) => handlers.delete(event))
		};
		Object.defineProperty(hls, 'audioTrack', {
			set: jest.fn((index) => {
				const handler = [...handlers.values()][0];
				queueMicrotask(() => handler?.(null, {id: index}));
			})
		});
		view.props.hlsRef.current = hls;
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));

		await act(async () => {
			await result.current.handleAudioTrackChange(1);
		});

		expect(view.props.setCurrentAudioTrack).toHaveBeenCalledWith(1);
		expect(view.props.saveAudioSelection).toHaveBeenCalledWith(1, view.props.audioTracks);
		expect(view.props.requestAudioTransition).not.toHaveBeenCalled();
		expect(view.props.setInlineAudioSwitchActive.mock.calls).toEqual([[true], [false]]);
	});

	it('delegates native audio changes to the controlled source transition', async () => {
		const view = createProps();
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));

		await act(async () => {
			await result.current.handleAudioTrackChange(1);
		});

		expect(view.props.requestAudioTransition).toHaveBeenCalledWith(1);
		expect(view.props.setCurrentAudioTrack).not.toHaveBeenCalled();
	});

	it('does not reload after an HLS audio switch becomes stale', async () => {
		const view = createProps();
		const handlers = new Map();
		const hls = {
			audioTracks: [
				{lang: 'eng', name: 'English'},
				{lang: 'jpn', name: 'Japanese'}
			],
			on: jest.fn((event, handler) => handlers.set(event, handler)),
			off: jest.fn((event) => handlers.delete(event))
		};
		Object.defineProperty(hls, 'audioTrack', {set: jest.fn()});
		view.props.hlsRef.current = hls;
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));
		let switchPromise;

		await act(async () => {
			switchPromise = result.current.handleAudioTrackChange(1);
			await Promise.resolve();
		});
		view.props.nativeSourceTokenRef.current = {generation: 2, sourceGeneration: 2};
		await act(async () => {
			handlers.get(Hls.Events.AUDIO_TRACK_SWITCHED)?.(null, {id: 1});
			await switchPromise;
		});

		expect(view.props.requestAudioTransition).not.toHaveBeenCalled();
		expect(view.props.setCurrentAudioTrack).not.toHaveBeenCalled();
	});

	it('waits for the HLS subtitle track to load before committing selection', async () => {
		const view = createProps();
		const handlers = new Map();
		const hls = {
			subtitleTracks: [
				{lang: 'eng', name: 'English'},
				{lang: 'jpn', name: 'Japanese'}
			],
			subtitleTrack: 0,
			on: jest.fn((event, handler) => handlers.set(event, handler)),
			off: jest.fn((event) => handlers.delete(event))
		};
		view.props.hlsRef.current = hls;
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));
		let switchPromise;

		await act(async () => {
			switchPromise = result.current.handleSubtitleTrackChange(4);
			await Promise.resolve();
		});
		expect(view.props.setCurrentSubtitleTrack).not.toHaveBeenCalled();
		expect(view.props.loadVideo).not.toHaveBeenCalled();

		await act(async () => {
			handlers.get(Hls.Events.SUBTITLE_TRACK_LOADED)?.(null, {id: 1});
			await switchPromise;
		});

		expect(view.props.setCurrentSubtitleTrack).toHaveBeenCalledWith(4);
		expect(view.props.saveSubtitleSelection).toHaveBeenCalledWith(4, view.props.subtitleTracks);
		expect(view.props.loadVideo).not.toHaveBeenCalled();
	});

	it('ignores repeated audio selections while a transition is active', async () => {
		const view = createProps();
		view.props.isTrackTransitionActive.mockReturnValue(true);
		const {result} = renderHook(() => usePlayerSeekAndTrackSwitching(view.props));

		await act(async () => {
			await result.current.handleAudioTrackChange(1);
		});

		expect(view.props.requestAudioTransition).not.toHaveBeenCalled();
	});
});
