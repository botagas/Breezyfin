import {act, renderHook} from '@testing-library/react';
import Hls from 'hls.js';

import {usePlayerSourcePipeline} from '../usePlayerSourcePipeline';
import {createPlaybackRuntimeContext} from '../../utils/playbackRuntimeContext';
import {PLAYER_HLS_ENGINE_STARTUP_TIMEOUT_MS} from '../../utils/playerStartupState';

jest.mock('hls.js', () => {
	const Events = {
		MEDIA_ATTACHED: 'mediaAttached',
		MANIFEST_PARSED: 'manifestParsed',
		FRAG_BUFFERED: 'fragBuffered',
		ERROR: 'error'
	};
	const MockHls = jest.fn();
	MockHls.Events = Events;
	MockHls.isSupported = jest.fn(() => true);
	return {
		__esModule: true,
		default: MockHls
	};
});

const createMockHlsInstance = () => {
	const handlers = new Map();
	return {
		on: jest.fn((event, handler) => {
			handlers.set(event, handler);
		}),
		emit: (event, data = {}) => {
			handlers.get(event)?.(event, data);
		},
		attachMedia: jest.fn(),
		loadSource: jest.fn(),
		stopLoad: jest.fn(),
		destroy: jest.fn()
	};
};

const createVideo = ({nativeHls = false} = {}) => {
	const listeners = new Map();
	return {
		src: 'old-source.mkv',
		currentSrc: 'old-source.mkv',
		currentTime: 0,
		readyState: 0,
		pause: jest.fn(),
		load: jest.fn(),
		removeAttribute: jest.fn(function removeAttribute(name) {
			if (name === 'src') {
				this.src = '';
				this.currentSrc = '';
			}
		}),
		canPlayType: jest.fn(() => nativeHls ? 'probably' : ''),
		addEventListener: jest.fn((event, handler) => {
			listeners.set(event, handler);
		}),
		removeEventListener: jest.fn((event, handler) => {
			if (listeners.get(event) === handler) listeners.delete(event);
		}),
		emit: (event, data = {}) => listeners.get(event)?.({
			type: event,
			currentTarget: data.currentTarget === undefined ? null : data.currentTarget,
			target: data.target === undefined ? null : data.target,
			...data
		})
	};
};

const createPipeline = ({nativeHls = false} = {}) => {
	const video = createVideo({nativeHls});
	const runtimeContext = createPlaybackRuntimeContext({
		generation: 1,
		itemId: 'item-1',
		mediaSourceData: {Id: 'source-1'},
		playMethod: 'Transcode',
		subtitlePolicy: {requiresBurnIn: true}
	});
	const props = {
		videoRef: {current: video},
		hlsRef: {current: null},
		nativeHlsFallbackCleanupRef: {current: null},
		nativeSourceTokenRef: {current: null},
		playbackRuntimeContextRef: {current: runtimeContext},
		playbackGenerationRef: {current: 1},
		exitInProgressRef: {current: false},
		hlsConfig: {},
		appendPlaybackDiagnostic: jest.fn(),
		onPlaybackSourceAttached: jest.fn(),
		onPlaybackSourceInvalidated: jest.fn(),
		onPlaybackEngineReady: jest.fn(),
		onHlsRuntimeError: jest.fn(),
		onHlsBootstrapTimeout: jest.fn()
	};
	const descriptor = {
		url: 'https://example.test/master.m3u8',
		isHls: true,
		isHdrLikeStream: false,
		playMethod: 'Transcode',
		serverBurnIn: true,
		runtimeContext,
		onEngineSelected: jest.fn()
	};
	return {video, runtimeContext, props, descriptor};
};

describe('usePlayerSourcePipeline', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		Hls.mockClear();
		Hls.mockImplementation(() => createMockHlsInstance());
		Hls.isSupported.mockReturnValue(true);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('lets HLS.js own the media element after a single pre-attachment reset', () => {
		const view = createPipeline();
		const {result} = renderHook(() => usePlayerSourcePipeline(view.props));

		let sourceToken;
		act(() => {
			sourceToken = result.current.attachSource(view.descriptor);
		});
		const hls = Hls.mock.results[0].value;

		expect(view.video.pause).toHaveBeenCalledTimes(1);
		expect(view.video.removeAttribute).toHaveBeenCalledWith('src');
		expect(view.video.load).toHaveBeenCalledTimes(1);
		expect(hls.attachMedia).toHaveBeenCalledWith(view.video);
		expect(hls.loadSource).not.toHaveBeenCalled();
		expect(view.props.onPlaybackSourceAttached).toHaveBeenCalledWith(
			sourceToken,
			{engineReady: false}
		);

		act(() => {
			hls.emit(Hls.Events.MEDIA_ATTACHED);
			hls.emit(Hls.Events.MANIFEST_PARSED);
		});
		expect(hls.loadSource).toHaveBeenCalledWith(view.descriptor.url);
		expect(view.props.onPlaybackEngineReady).not.toHaveBeenCalled();
		expect(view.video.load).toHaveBeenCalledTimes(1);

		act(() => {
			hls.emit(Hls.Events.FRAG_BUFFERED);
			hls.emit(Hls.Events.FRAG_BUFFERED);
		});
		expect(view.props.onPlaybackEngineReady).toHaveBeenCalledTimes(1);
		expect(view.props.onPlaybackEngineReady).toHaveBeenCalledWith(
			sourceToken,
			'first-fragment-buffered'
		);
	});

	it('keeps the HLS bootstrap deadline separate and generation-bound', async () => {
		const view = createPipeline();
		const {result} = renderHook(() => usePlayerSourcePipeline(view.props));

		act(() => {
			result.current.attachSource(view.descriptor);
		});
		const hls = Hls.mock.results[0].value;

		await act(async () => {
			jest.advanceTimersByTime(PLAYER_HLS_ENGINE_STARTUP_TIMEOUT_MS);
			await Promise.resolve();
		});
		expect(view.props.onHlsBootstrapTimeout).toHaveBeenCalledTimes(1);

		view.props.playbackGenerationRef.current = 2;
		act(() => {
			hls.emit(Hls.Events.ERROR, {fatal: true});
			hls.emit(Hls.Events.FRAG_BUFFERED);
		});
		expect(view.props.onHlsRuntimeError).not.toHaveBeenCalled();
		expect(view.props.onPlaybackEngineReady).not.toHaveBeenCalled();
	});

	it('attaches native sources with one load and immediate engine readiness', () => {
		const view = createPipeline();
		view.descriptor = {
			...view.descriptor,
			url: 'https://example.test/video.mkv',
			isHls: false,
			serverBurnIn: false,
			playMethod: 'DirectPlay'
		};
		const {result} = renderHook(() => usePlayerSourcePipeline(view.props));

		let sourceToken;
		act(() => {
			result.current.detachSource({
				clearRuntimeContext: false,
				resetVideo: true,
				reason: 'new-playback-load'
			});
		});
		view.video.load.mockClear();
		act(() => {
			sourceToken = result.current.attachSource(view.descriptor);
		});

		expect(Hls).not.toHaveBeenCalled();
		expect(view.video.src).toBe(view.descriptor.url);
		expect(view.video.load).toHaveBeenCalledTimes(1);
		expect(view.props.onPlaybackSourceAttached).toHaveBeenCalledWith(
			sourceToken,
			{engineReady: true}
		);
		expect(view.descriptor.onEngineSelected).toHaveBeenCalledWith('native');
	});

	it('replaces a stalled native HLS token with a generation-bound HLS.js token', () => {
		const view = createPipeline({nativeHls: true});
		const {result} = renderHook(() => usePlayerSourcePipeline(view.props));

		let nativeToken;
		act(() => {
			nativeToken = result.current.attachSource(view.descriptor);
		});
		expect(nativeToken.engine).toBe('native-hls');
		expect(Hls).not.toHaveBeenCalled();
		expect(view.props.onPlaybackSourceAttached).toHaveBeenLastCalledWith(
			nativeToken,
			{engineReady: true}
		);

		act(() => {
			jest.advanceTimersByTime(3500);
		});
		const hlsToken = view.props.nativeSourceTokenRef.current;
		expect(Hls).toHaveBeenCalledTimes(1);
		expect(hlsToken.engine).toBe('hls.js');
		expect(hlsToken.sourceGeneration).toBeGreaterThan(nativeToken.sourceGeneration);
		expect(result.current.isSourceTokenCurrent(nativeToken)).toBe(false);
		expect(view.props.onPlaybackSourceAttached).toHaveBeenLastCalledWith(
			hlsToken,
			{engineReady: false}
		);
	});

	it('does not treat loadeddata readiness as native HLS playback evidence', () => {
		const view = createPipeline({nativeHls: true});
		const {result} = renderHook(() => usePlayerSourcePipeline(view.props));

		act(() => {
			result.current.attachSource(view.descriptor);
		});
		view.video.readyState = 2;
		act(() => {
			jest.advanceTimersByTime(3500);
		});

		expect(Hls).toHaveBeenCalledTimes(1);
		expect(view.props.nativeSourceTokenRef.current.engine).toBe('hls.js');
	});

	it('ignores native HLS events that predate the active source attachment', () => {
		const view = createPipeline({nativeHls: true});
		const {result} = renderHook(() => usePlayerSourcePipeline(view.props));

		let sourceToken;
		act(() => {
			sourceToken = result.current.attachSource(view.descriptor);
		});
		act(() => {
			view.video.emit('canplay', {
				currentTarget: view.video,
				timeStamp: sourceToken.attachedAtEpochMs - 1
			});
			view.video.emit('error', {
				currentTarget: view.video,
				timeStamp: sourceToken.attachedAtEpochMs - 1
			});
		});
		expect(Hls).not.toHaveBeenCalled();

		act(() => {
			jest.advanceTimersByTime(3500);
		});
		expect(Hls).toHaveBeenCalledTimes(1);
		expect(view.props.nativeSourceTokenRef.current.engine).toBe('hls.js');
	});

	it('destroys HLS and invalidates the token on teardown', () => {
		const view = createPipeline();
		const {result, unmount} = renderHook(() => usePlayerSourcePipeline(view.props));

		act(() => {
			result.current.attachSource(view.descriptor);
		});
		const hls = Hls.mock.results[0].value;
		hls.destroy.mockImplementation(() => {
			hls.emit(Hls.Events.ERROR, {fatal: true});
		});
		unmount();

		expect(hls.stopLoad).toHaveBeenCalledTimes(1);
		expect(hls.destroy).toHaveBeenCalledTimes(1);
		expect(view.props.onHlsRuntimeError).not.toHaveBeenCalled();
		expect(view.props.nativeSourceTokenRef.current).toBeNull();
		expect(view.props.onPlaybackSourceInvalidated).toHaveBeenCalled();
	});
});
