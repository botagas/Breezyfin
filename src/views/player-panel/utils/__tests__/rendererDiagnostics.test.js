import {
	collectExternalRendererDiagnostics,
	getCanvasPixelDiagnostics
} from '../subtitle-renderers/rendererDiagnostics';
import {mockCanvasElementCreation} from '../test-utils/canvasTestUtils';

describe('rendererDiagnostics utilities', () => {
	it('reports no canvas when no renderer canvas is available', () => {
		expect(getCanvasPixelDiagnostics(null)).toEqual({
			canvasPixels: 'no-canvas',
			canvasAlphaSamples: 0,
			canvasMaxAlpha: 0
		});
	});

	it('reports zero-size canvases without sampling pixels', () => {
		const canvas = document.createElement('canvas');
		canvas.width = 0;
		canvas.height = 0;

		expect(getCanvasPixelDiagnostics(canvas)).toEqual({
			canvasPixels: 'zero-size',
			canvasAlphaSamples: 0,
			canvasMaxAlpha: 0
		});
	});

	it('detects drawn pixels on a renderer canvas', () => {
		const sourceCanvas = document.createElement('canvas');
		sourceCanvas.width = 32;
		sourceCanvas.height = 18;
		const sourceContext = {
			clearRect: jest.fn(),
			drawImage: jest.fn(),
			getImageData: jest.fn()
		};
		const probeContext = {
			clearRect: jest.fn(),
			drawImage: jest.fn(),
			getImageData: jest.fn(() => ({
				data: new Uint8ClampedArray([
					0, 0, 0, 0,
					255, 255, 255, 180,
					255, 255, 255, 255
				])
			}))
		};
		const createElementSpy = mockCanvasElementCreation(() => probeContext);

		try {
			sourceCanvas.getContext = jest.fn(() => sourceContext);
			const result = getCanvasPixelDiagnostics(sourceCanvas);

			expect(probeContext.drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 0, 16, 9);
			expect(result).toEqual({
				canvasPixels: 'drawn',
				canvasAlphaSamples: 2,
				canvasMaxAlpha: 255
			});
		} finally {
			createElementSpy.mockRestore();
		}
	});

	it('reports video phase and layer hit-test target for active renderer diagnostics', () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		const hitTarget = document.createElement('video');
		canvas.width = 16;
		canvas.height = 9;
		container.appendChild(canvas);
		container.getBoundingClientRect = jest.fn(() => ({
			width: 1920,
			height: 1080,
			left: 0,
			top: 0,
			right: 1920,
			bottom: 1080
		}));
		const originalElementFromPoint = document.elementFromPoint;
		document.elementFromPoint = jest.fn(() => hitTarget);
		const videoElement = {
			paused: false,
			ended: false,
			seeking: false,
			readyState: 4,
			networkState: 2,
			currentTime: 42.34,
			parentNode: document.createElement('div')
		};
		const createElementSpy = mockCanvasElementCreation();

		try {
			const {
				videoPhase,
				videoState,
				layerHitTest
			} = collectExternalRendererDiagnostics({
				containerElement: container,
				renderer: {__breezyfinCanvas: canvas},
				videoElement
			});

			expect(videoPhase).toBe('playing');
			expect(videoState).toBe('playing@42.3s/r4/n2');
			expect(layerHitTest).toBe('video');
		} finally {
			createElementSpy.mockRestore();
			document.elementFromPoint = originalElementFromPoint;
		}
	});
});
