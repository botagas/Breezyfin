import {
	disposeExternalBitmapRenderer,
	disposeExternalAssRenderer,
	initExternalBitmapRenderer,
	initExternalAssRenderer,
	isExternalAssRendererId,
	isExternalBitmapRendererId,
	SUBTITLE_RENDERER_IDS,
	supportsExternalBitmapRenderer,
	supportsExternalAssRenderer
} from '../subtitle-renderers/subtitleRendererRegistry';
import {
	refreshJassubTrackDiagnostics,
	waitForJassubReady
} from '../subtitle-renderers/jassubRenderer';
import {collectExternalRendererDiagnostics} from '../subtitle-renderers/rendererDiagnostics';
import {mockCanvasElementCreation} from '../test-utils/canvasTestUtils';

const mockDestroy = jest.fn();
const mockShow = jest.fn(function show() {
	return this;
});
const mockLibassDispose = jest.fn();
const mockLibassResize = jest.fn();
const mockLibassSetCurrentTime = jest.fn();
const mockLibassSetIsPaused = jest.fn();
const mockLibassSetRate = jest.fn();
let sawRequestVideoFrameCallbackType = '';
let sawCancelVideoFrameCallbackType = '';
const mockAssConstructor = jest.fn();
const mockJassubConstructor = jest.fn();
const mockLibassConstructor = jest.fn();
const mockLibbitsubConstructor = jest.fn();
const mockLibpgsConstructor = jest.fn();

const FULL_HD_RECT = Object.freeze({
	width: 1920,
	height: 1080,
	left: 0,
	top: 0,
	right: 1920,
	bottom: 1080
});

const createFullHdVideoFixture = () => {
	const videoElement = document.createElement('video');
	const containerElement = document.createElement('div');
	containerElement.getBoundingClientRect = jest.fn(() => FULL_HD_RECT);
	videoElement.getBoundingClientRect = jest.fn(() => FULL_HD_RECT);
	Object.defineProperty(videoElement, 'videoWidth', {
		configurable: true,
		value: FULL_HD_RECT.width
	});
	Object.defineProperty(videoElement, 'videoHeight', {
		configurable: true,
		value: FULL_HD_RECT.height
	});
	return {videoElement, containerElement};
};

jest.mock('assjs', () => ({
	__esModule: true,
	default: mockAssConstructor
}));

jest.mock('libass-wasm', () => ({
	__esModule: true,
	default: mockLibassConstructor
}));

jest.mock('jassub', () => ({
	__esModule: true,
	default: mockJassubConstructor
}));

jest.mock('libbitsub', () => ({
	__esModule: true,
	PgsRenderer: mockLibbitsubConstructor
}));

jest.mock('libpgs', () => ({
	__esModule: true,
	PgsRenderer: mockLibpgsConstructor
}));

describe('subtitle renderer registry', () => {
	beforeEach(() => {
		mockAssConstructor.mockImplementation(function MockAss(content, video, options) {
			this.content = content;
			this.video = video;
			this.options = options;
			sawRequestVideoFrameCallbackType = typeof video.requestVideoFrameCallback;
			sawCancelVideoFrameCallbackType = typeof video.cancelVideoFrameCallback;
			this.show = mockShow;
			this.destroy = mockDestroy;
		});
		mockLibassConstructor.mockImplementation(function MockLibass(options) {
			this.options = options;
			this.resize = mockLibassResize;
			this.setCurrentTime = mockLibassSetCurrentTime;
			this.setIsPaused = mockLibassSetIsPaused;
			this.setRate = mockLibassSetRate;
			this.dispose = mockLibassDispose;
		});
		mockDestroy.mockClear();
		mockShow.mockClear();
		mockLibassConstructor.mockClear();
		mockLibassDispose.mockClear();
		mockLibassResize.mockClear();
		mockLibassSetCurrentTime.mockClear();
		mockLibassSetIsPaused.mockClear();
		mockLibassSetRate.mockClear();
		mockJassubConstructor.mockClear();
		mockLibbitsubConstructor.mockClear();
		mockLibpgsConstructor.mockClear();
		sawRequestVideoFrameCallbackType = '';
		sawCancelVideoFrameCallbackType = '';
	});

	it('identifies external ASS renderers', () => {
		expect(isExternalAssRendererId(SUBTITLE_RENDERER_IDS.ASS_LIBASS)).toBe(true);
		expect(isExternalAssRendererId(SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL)).toBe(true);
		expect(isExternalAssRendererId(SUBTITLE_RENDERER_IDS.ASS_JASSUB)).toBe(true);
		expect(isExternalAssRendererId(SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL)).toBe(true);
		expect(isExternalAssRendererId(SUBTITLE_RENDERER_IDS.ASS_ASSJS)).toBe(true);
		expect(isExternalAssRendererId(SUBTITLE_RENDERER_IDS.ASS_LIGHTWEIGHT)).toBe(false);
		expect(supportsExternalAssRenderer('unknown')).toBe(false);
	});

	it('identifies external bitmap renderers', () => {
		expect(isExternalBitmapRendererId(SUBTITLE_RENDERER_IDS.BITMAP_AUTO)).toBe(true);
		expect(isExternalBitmapRendererId(SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB)).toBe(true);
		expect(isExternalBitmapRendererId(SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS)).toBe(true);
		expect(isExternalBitmapRendererId(SUBTITLE_RENDERER_IDS.TEXT)).toBe(false);
		expect(supportsExternalBitmapRenderer('unknown')).toBe(false);
	});

	it('initializes libbitsub with binary subtitle data through the common bitmap adapter interface', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn();
		const videoElement = document.createElement('video');
		const subtitleContent = new Uint8Array([1, 2, 3]).buffer;
		const mockGetMetadata = jest.fn(() => ({cueCount: 4, screenWidth: 1920, screenHeight: 1080}));
		const mockDispose = jest.fn();
		mockLibbitsubConstructor.mockImplementation(function MockLibbitsub(options) {
			this.options = options;
			this.dispose = mockDispose;
			this.getMetadata = mockGetMetadata;
			this.getCacheStats = jest.fn(() => ({cachedFrames: 2, cacheLimit: 24, usingWorker: true}));
			this.getStats = jest.fn(() => ({framesRendered: 5, framesDropped: 1}));
			this.getLastRenderInfo = jest.fn(() => ({backend: 'canvas2d', status: 'rendered', renderDuration: 7}));
			this.getCurrentCueMetadata = jest.fn(() => ({index: 1}));
		});

		try {
			const {debug, instance} = await initExternalBitmapRenderer(SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB, {
				videoElement,
				subtitleContent,
				subtitleUrl: 'https://jellyfin.example/sub.sup',
				sourceFormat: 'sup'
			});

			expect(mockLibbitsubConstructor).toHaveBeenCalledWith(expect.objectContaining({
				video: videoElement,
				subContent: subtitleContent,
				subUrl: undefined,
				cacheLimit: 24,
				prefetchWindow: {before: 1, after: 2}
			}));
			expect(debug).toEqual(expect.objectContaining({
				engine: 'libbitsub',
				mode: 'video-attached',
				sourceFormat: 'sup',
				bitmapSource: 'arraybuffer',
				bitmapBytes: 3,
				readyStatus: 'ready'
			}));
			expect(instance.__breezyfinGetDiagnostics()).toEqual(expect.objectContaining({
				bitmapCueCount: 4,
				bitmapBackend: 'canvas2d',
				bitmapCache: '2/24',
				bitmapWorker: 'yes',
				bitmapFrames: 5,
				bitmapDropped: 1
			}));

			disposeExternalBitmapRenderer(SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB, instance);
			expect(mockDispose).toHaveBeenCalled();
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('initializes libbitsub with a subtitle URL when binary content is not provided', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn();
		const videoElement = document.createElement('video');
		mockLibbitsubConstructor.mockImplementation(function MockLibbitsub(options) {
			this.options = options;
			this.dispose = jest.fn();
			this.getMetadata = jest.fn(() => ({cueCount: 1}));
		});

		try {
			const {debug} = await initExternalBitmapRenderer(SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB, {
				videoElement,
				subtitleContent: null,
				subtitleUrl: 'https://jellyfin.example/sub.pgssub',
				sourceFormat: 'pgssub'
			});

			expect(mockLibbitsubConstructor).toHaveBeenCalledWith(expect.objectContaining({
				video: videoElement,
				subContent: undefined,
				subUrl: 'https://jellyfin.example/sub.pgssub'
			}));
			expect(debug).toEqual(expect.objectContaining({
				engine: 'libbitsub',
				bitmapSource: 'url',
				bitmapBytes: null,
				sourceFormat: 'pgssub'
			}));
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('initializes libpgs with copied static worker assets and binary input', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn();
		const videoElement = document.createElement('video');
		const containerElement = document.createElement('div');
		const subtitleContent = new Uint8Array([4, 5, 6, 7]).buffer;
		const loadFromBuffer = jest.fn();
		const mockDispose = jest.fn();
		mockLibpgsConstructor.mockImplementation(function MockLibpgs(options) {
			this.options = options;
			this.loadFromBuffer = loadFromBuffer;
			this.dispose = mockDispose;
		});

		try {
			const {debug, instance} = await initExternalBitmapRenderer(SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS, {
				videoElement,
				containerElement,
				subtitleContent,
				subtitleUrl: 'https://jellyfin.example/sub.sup',
				sourceFormat: 'sup'
			});

			expect(mockLibpgsConstructor).toHaveBeenCalledWith(expect.objectContaining({
				video: videoElement,
				canvas: expect.any(window.HTMLCanvasElement),
				workerUrl: expect.stringContaining('node_modules/breezyfin-subtitle-assets/libpgs/libpgs.worker.js'),
				subUrl: undefined,
				aspectRatio: 'fill'
			}));
			expect(loadFromBuffer).toHaveBeenCalledWith(subtitleContent);
			expect(debug).toEqual(expect.objectContaining({
				engine: 'libpgs',
				mode: 'custom-canvas',
				sourceFormat: 'sup',
				bitmapBackend: 'libpgs',
				bitmapSource: 'arraybuffer',
				bitmapBytes: 4,
				readyStatus: 'ready'
			}));

			disposeExternalBitmapRenderer(SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS, instance, {containerElement});
			expect(mockDispose).toHaveBeenCalled();
			expect(containerElement.childNodes.length).toBe(0);
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('initializes libpgs with a subtitle URL when binary content is not provided', async () => {
		const originalFetch = global.fetch;
		global.fetch = jest.fn();
		const videoElement = document.createElement('video');
		const containerElement = document.createElement('div');
		mockLibpgsConstructor.mockImplementation(function MockLibpgs(options) {
			this.options = options;
			this.dispose = jest.fn();
		});

		try {
			const {debug} = await initExternalBitmapRenderer(SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS, {
				videoElement,
				containerElement,
				subtitleContent: null,
				subtitleUrl: 'https://jellyfin.example/sub.sup',
				sourceFormat: 'sup'
			});

			expect(mockLibpgsConstructor).toHaveBeenCalledWith(expect.objectContaining({
				video: videoElement,
				subUrl: 'https://jellyfin.example/sub.sup',
				workerUrl: expect.stringContaining('node_modules/breezyfin-subtitle-assets/libpgs/libpgs.worker.js')
			}));
			expect(debug).toEqual(expect.objectContaining({
				engine: 'libpgs',
				bitmapSource: 'url',
				bitmapBytes: null,
				sourceFormat: 'sup'
			}));
		} finally {
			global.fetch = originalFetch;
		}
	});

	it('initializes and disposes ASS.js through the common adapter interface', async () => {
		const videoElement = document.createElement('video');
		const containerElement = document.createElement('div');
		const requestVideoFrameCallback = jest.fn();
		const cancelVideoFrameCallback = jest.fn();
		Object.defineProperty(videoElement, 'requestVideoFrameCallback', {
			configurable: true,
			writable: true,
			value: requestVideoFrameCallback
		});
		Object.defineProperty(videoElement, 'cancelVideoFrameCallback', {
			configurable: true,
			writable: true,
			value: cancelVideoFrameCallback
		});

		const {debug, instance} = await initExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_ASSJS, {
			videoElement,
			containerElement,
			diagnosticsEnabled: true,
			subtitleContent: '[Script Info]\nScriptType: v4.00+'
		});

		expect(mockAssConstructor).toHaveBeenCalledWith(
			'[Script Info]\nScriptType: v4.00+',
			videoElement,
			{
				container: containerElement,
				resampling: 'video_width'
			}
		);
		expect(sawRequestVideoFrameCallbackType).toBe('undefined');
		expect(sawCancelVideoFrameCallbackType).toBe('undefined');
		expect(videoElement.requestVideoFrameCallback).toBe(requestVideoFrameCallback);
		expect(videoElement.cancelVideoFrameCallback).toBe(cancelVideoFrameCallback);
		expect(debug).toEqual(expect.objectContaining({
			engine: 'assjs',
			mode: 'dom-attached',
			resampling: 'video_width',
			timing: 'raf-forced',
			layerChildren: 0
		}));

		disposeExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_ASSJS, instance, {containerElement});
	});

	it('initializes JASSUB through copied static worker assets instead of bundled worker chunks', async () => {
		const videoElement = document.createElement('video');
		const containerElement = document.createElement('div');
		const createElementSpy = mockCanvasElementCreation();
		mockJassubConstructor.mockImplementation(function MockJassub(options) {
			this.options = options;
			this.ready = Promise.resolve();
			this.destroy = mockDestroy;
		});

		try {
			const {debug, instance} = await initExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_JASSUB, {
				videoElement,
				containerElement,
				subtitleContent: '[Script Info]\nScriptType: v4.00+'
			});

			expect(mockJassubConstructor).toHaveBeenCalledWith(expect.objectContaining({
				video: videoElement,
				subContent: '[Script Info]\nScriptType: v4.00+',
				queryFonts: false,
				defaultFont: 'breezyfin subtitle fallback',
				fonts: [expect.stringContaining('node_modules/breezyfin-subtitle-assets/default.woff2')],
				availableFonts: expect.objectContaining({
					'roboto medium': expect.stringContaining('node_modules/breezyfin-subtitle-assets/default.woff2')
				}),
				workerUrl: expect.stringContaining('node_modules/breezyfin-subtitle-assets/worker/worker.js'),
				wasmUrl: expect.stringContaining('node_modules/breezyfin-subtitle-assets/wasm/jassub-worker.wasm'),
				modernWasmUrl: expect.stringContaining('node_modules/breezyfin-subtitle-assets/wasm/jassub-worker-modern.wasm')
			}));
			const jassubOptions = mockJassubConstructor.mock.calls[0][0];
			expect(jassubOptions.workerUrl).toContain('node_modules/breezyfin-subtitle-assets/worker/worker.js');
			expect(jassubOptions.wasmUrl).toContain('node_modules/breezyfin-subtitle-assets/wasm/jassub-worker.wasm');
			expect(jassubOptions.modernWasmUrl).toContain('node_modules/breezyfin-subtitle-assets/wasm/jassub-worker-modern.wasm');
			expect(debug).toEqual(expect.objectContaining({
				engine: 'jassub',
				backend: 'canvas2d',
				readyStatus: 'ready',
				workerUrl: 'static',
				wasmUrl: 'static',
				modernWasmUrl: 'static'
			}));

			disposeExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_JASSUB, instance, {containerElement});
		} finally {
			createElementSpy.mockRestore();
		}
	});

	it('initializes manual-canvas JASSUB without video-frame callback ownership', async () => {
		const {videoElement, containerElement} = createFullHdVideoFixture();
		const manualRender = jest.fn(() => Promise.resolve());
		mockJassubConstructor.mockImplementation(function MockJassub(options) {
			this.options = options;
			this.ready = Promise.resolve();
			this.manualRender = manualRender;
			this.destroy = mockDestroy;
		});
		const createElementSpy = mockCanvasElementCreation();

		try {
			const {debug, instance} = await initExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL, {
				videoElement,
				containerElement,
				subtitleContent: '[Script Info]\nScriptType: v4.00+'
			});

			const jassubOptions = mockJassubConstructor.mock.calls[0][0];
			expect(jassubOptions.video).toBeUndefined();
			expect(jassubOptions.canvas).toBeInstanceOf(window.HTMLCanvasElement);
			expect(jassubOptions.subContent).toBe('[Script Info]\nScriptType: v4.00+');
			expect(jassubOptions.queryFonts).toBe(false);
			expect(jassubOptions.defaultFont).toBe('breezyfin subtitle fallback');
			expect(jassubOptions.fonts).toEqual([
				expect.stringContaining('node_modules/breezyfin-subtitle-assets/default.woff2')
			]);
			expect(jassubOptions.availableFonts).toEqual(expect.objectContaining({
				'roboto medium': expect.stringContaining('node_modules/breezyfin-subtitle-assets/default.woff2')
			}));
			expect(jassubOptions.workerUrl).toContain('node_modules/breezyfin-subtitle-assets/worker/worker.js');
			expect(jassubOptions.wasmUrl).toContain('node_modules/breezyfin-subtitle-assets/wasm/jassub-worker.wasm');
			expect(jassubOptions.modernWasmUrl).toContain('node_modules/breezyfin-subtitle-assets/wasm/jassub-worker-modern.wasm');
			expect(manualRender).toHaveBeenCalledWith(expect.objectContaining({
				width: 1920,
				height: 1080,
				mediaTime: 0
			}), true);
			expect(debug).toEqual(expect.objectContaining({
				engine: 'jassub',
				mode: 'manual-canvas',
				backend: 'canvas2d',
				readyStatus: 'ready',
				videoFrameCallback: 'not-used',
				manualSyncIntervalMs: 100
			}));
			await Promise.resolve();
			manualRender.mockClear();
			expect(typeof instance.__breezyfinSetRuntimeSuspended).toBe('function');
			instance.__breezyfinSetRuntimeSuspended(true);
			Object.defineProperty(videoElement, 'currentTime', {
				configurable: true,
				value: 1
			});
			videoElement.dispatchEvent(new Event('timeupdate'));
			await Promise.resolve();
			expect(manualRender).not.toHaveBeenCalled();
			instance.__breezyfinSetRuntimeSuspended(false);
			await Promise.resolve();
			expect(manualRender).toHaveBeenCalledWith(expect.objectContaining({
				width: 1920,
				height: 1080,
				mediaTime: 1
			}), true);

			disposeExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL, instance, {containerElement});
			expect(mockDestroy).toHaveBeenCalled();
			expect(containerElement.childNodes.length).toBe(0);
		} finally {
			createElementSpy.mockRestore();
		}
	});

	it('collects JASSUB source event/style diagnostics without worker introspection', async () => {
		let currentTime = 1.5;
		const videoElement = document.createElement('video');
		Object.defineProperty(videoElement, 'currentTime', {
			configurable: true,
			get: () => currentTime
		});
		const getEvents = jest.fn();
		const getStyles = jest.fn();
		const renderer = {renderer: {getEvents, getStyles}};
		const subtitleContent = [
			'[V4+ Styles]',
			'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour',
			'Style: Default,Roboto Medium,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000',
			'[Events]',
			'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
			'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Visible source event, with comma'
		].join('\n');

		const diagnostics = await refreshJassubTrackDiagnostics({
			renderer,
			videoElement,
			subtitleContent
		});

		expect(getEvents).not.toHaveBeenCalled();
		expect(getStyles).not.toHaveBeenCalled();
		expect(diagnostics).toEqual(expect.objectContaining({
			status: 'ready',
			eventStatus: 'source-ready',
			styleStatus: 'source-ready',
			eventCount: 1,
			styleCount: 1,
			activeEventsAssMs: 1,
			activeEventsAssCs: null,
			currentTimeSeconds: 1.5,
			activeEvent: expect.stringContaining('Visible source event, with comma')
		}));
		expect(renderer.__breezyfinJassubTrackDiagnostics).toEqual(expect.objectContaining({
			firstEvent: expect.stringContaining('Visible source event, with comma'),
			firstStyle: 'Default/Roboto Medium/48'
		}));

		renderer.__breezyfinRefreshJassubSourceDiagnostics = jest.fn((video) => (
			refreshJassubTrackDiagnostics({renderer, videoElement: video, subtitleContent})
		));
		currentTime = 4;
		const {
			jassubActiveEventsAssMs,
			jassubActiveEvent,
			jassubCurrentTimeSeconds
		} = collectExternalRendererDiagnostics({
			containerElement: document.createElement('div'),
			renderer,
			videoElement
		});
		expect(renderer.__breezyfinRefreshJassubSourceDiagnostics).toHaveBeenCalledWith(videoElement);
		expect(jassubCurrentTimeSeconds).toBe(4);
		expect(jassubActiveEventsAssMs).toBe(0);
		expect(jassubActiveEvent).toBe('-');
	});

	it('initializes manual-canvas libass without video-attached options and clears sync on dispose', async () => {
		const {videoElement, containerElement} = createFullHdVideoFixture();
		const createElementSpy = mockCanvasElementCreation();

		let instance = null;
		try {
			const {
				debug,
				instance: rendererInstance
			} = await initExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL, {
				videoElement,
				containerElement,
				subtitleContent: '[Script Info]\nScriptType: v4.00+'
			});
			instance = rendererInstance;

			expect(mockLibassConstructor).toHaveBeenCalledTimes(1);
			const options = mockLibassConstructor.mock.calls[0][0];
			expect(options.video).toBeUndefined();
			expect(options.canvas).toBeInstanceOf(window.HTMLCanvasElement);
			expect(options.subContent).toBe('[Script Info]\nScriptType: v4.00+');
			expect(debug).toEqual(expect.objectContaining({
				engine: 'libass-wasm',
				mode: 'manual-canvas',
				canvasMode: 'caller-owned-manual',
				manualSyncIntervalMs: 250,
				libassStatus: 'ready'
			}));
			expect(mockLibassSetCurrentTime).toHaveBeenCalled();
			expect(mockLibassSetIsPaused).toHaveBeenCalled();
			expect(mockLibassSetRate).toHaveBeenCalledWith(1);

			disposeExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL, instance, {containerElement});
			instance = null;

			expect(mockLibassDispose).toHaveBeenCalled();
			expect(containerElement.childNodes.length).toBe(0);
		} finally {
			if (instance) {
				disposeExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL, instance, {containerElement});
			}
			createElementSpy.mockRestore();
		}
	});

	it('does not block forever when JASSUB ready never settles', async () => {
		jest.useFakeTimers();
		try {
			const readyWait = waitForJassubReady(new Promise(() => {}), 4000);

			jest.advanceTimersByTime(4000);
			await expect(readyWait).resolves.toEqual(expect.objectContaining({
				status: 'timeout',
				waitedMs: 4000
			}));
		} finally {
			jest.useRealTimers();
		}
	});

	it('treats a JASSUB ready timeout as an initialization failure', async () => {
		const videoElement = document.createElement('video');
		const containerElement = document.createElement('div');
		const createElementSpy = mockCanvasElementCreation();
		const terminate = jest.fn();
		mockJassubConstructor.mockImplementation(function MockJassub(options) {
			this.options = options;
			this.ready = new Promise(() => {});
			this.destroy = mockDestroy;
			this._worker = {terminate};
		});

		try {
			const {debug, instance} = await initExternalAssRenderer(SUBTITLE_RENDERER_IDS.ASS_JASSUB, {
				videoElement,
				containerElement,
				subtitleContent: '[Script Info]\nScriptType: v4.00+',
				readyTimeoutMs: 1
			});

			expect(instance).toBeNull();
			expect(debug).toEqual(expect.objectContaining({
				engine: 'jassub',
				readyStatus: 'timeout',
				externalStatus: 'ready-timeout'
			}));
			expect(mockDestroy).toHaveBeenCalled();
			expect(terminate).toHaveBeenCalled();
			expect(containerElement.childNodes.length).toBe(0);
		} finally {
			createElementSpy.mockRestore();
		}
	});
});
