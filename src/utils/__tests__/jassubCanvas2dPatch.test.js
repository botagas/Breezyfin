const {
	JASSUB_CANVAS2D_PATCH_MARKER,
	forceJassubCanvas2dRendererInSource,
	validateMinifiedJassubCanvas2dWorkerSource,
	validateJassubCanvas2dWorkerSource
} = require('../../../scripts/subtitle-assets/jassubCanvas2dPatch.cjs');

const JASSUB_VERSION = '2.5.6';
const ORIGINAL_RENDERER_SELECTION = `        try {
            const testCanvas = new OffscreenCanvas(1, 1);
            if (testCanvas.getContext('webgl2')) {
                this._gpurender = new WebGL2Renderer();
            }
            else {
                this._gpurender = testCanvas.getContext('webgl')?.getExtension('ANGLE_instanced_arrays') ? new WebGL1Renderer() : new Canvas2DRenderer();
            }
        }
        catch {
            this._gpurender = new Canvas2DRenderer();
        }`;

describe('JASSUB Canvas2D packaging patch', () => {
	it('patches JASSUB worker renderer selection to forced Canvas2D', () => {
		const {patched, source} = forceJassubCanvas2dRendererInSource(`before\n${ORIGINAL_RENDERER_SELECTION}\nafter`, {
			version: JASSUB_VERSION
		});

		expect(patched).toBe(true);
		expect(source).toContain(JASSUB_CANVAS2D_PATCH_MARKER);
		expect(source).toContain('this._gpurender = new Canvas2DRenderer();');
		expect(source).not.toContain('new WebGL2Renderer()');
		expect(source).not.toContain('new WebGL1Renderer()');
	});

	it('is idempotent once the Canvas2D marker is present', () => {
		const patched = `// ${JASSUB_CANVAS2D_PATCH_MARKER}\nthis._gpurender = new Canvas2DRenderer();`;
		const {source, patched: wasPatched} = forceJassubCanvas2dRendererInSource(patched, {
			version: JASSUB_VERSION
		});

		expect(source).toBe(patched);
		expect(wasPatched).toBe(false);
	});

	it('fails loudly for unsupported JASSUB versions or source shape drift', () => {
		expect(() => forceJassubCanvas2dRendererInSource(ORIGINAL_RENDERER_SELECTION, {
			version: '3.0.0'
		})).toThrow(/Unsupported JASSUB version/u);

		expect(() => forceJassubCanvas2dRendererInSource('no renderer block here', {
			version: JASSUB_VERSION
		})).toThrow(/Unable to locate JASSUB worker/u);
	});

	it('validates package source by Canvas2D marker', () => {
		expect(validateJassubCanvas2dWorkerSource(`minified;${JASSUB_CANVAS2D_PATCH_MARKER};`)).toBe(true);
		expect(() => validateJassubCanvas2dWorkerSource('minified without marker', {
			fileName: 'chunk.jassub-worker.js'
		})).toThrow(/chunk\.jassub-worker\.js/u);
	});

	it('validates generated worker chunks by minified Canvas2D construction', () => {
		expect(validateMinifiedJassubCanvas2dWorkerSource(
			`minified;${JASSUB_CANVAS2D_PATCH_MARKER};`
		)).toBe(true);
		expect(validateMinifiedJassubCanvas2dWorkerSource(
			'this._gpurender=new U(),this._gpurender.setCanvas(r)'
		)).toBe(true);
		expect(() => validateMinifiedJassubCanvas2dWorkerSource(
			'const testCanvas = new OffscreenCanvas(1, 1); testCanvas.getContext("webgl2");',
			{fileName: 'chunk.jassub-worker.worker'}
		)).toThrow(/WebGL renderer selection path/u);
		expect(() => validateMinifiedJassubCanvas2dWorkerSource('no renderer construction', {
			fileName: 'chunk.jassub-worker.worker'
		})).toThrow(/forced Canvas2D renderer/u);
	});
});
