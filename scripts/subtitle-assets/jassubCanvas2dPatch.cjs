const JASSUB_CANVAS2D_PATCH_MARKER = 'Breezyfin: force Canvas2D renderer for webOS';
const JASSUB_STATIC_ASSET_PATCH_MARKER = 'Breezyfin: require explicit static JASSUB asset URLs for webOS packaging';
const SUPPORTED_JASSUB_CANVAS2D_PATCH_VERSIONS = Object.freeze(['2.5.6']);

const JASSUB_RENDERER_SELECTION_PATTERN = /[ ]{8}try \{\n[ ]{12}const testCanvas = new OffscreenCanvas\(1, 1\);\n[ ]{12}if \(testCanvas\.getContext\('webgl2'\)\) \{\n[ ]{16}this\._gpurender = new WebGL2Renderer\(\);\n[ ]{12}\}\n[ ]{12}else \{\n[ ]{16}this\._gpurender = testCanvas\.getContext\('webgl'\)\?\.getExtension\('ANGLE_instanced_arrays'\) \? new WebGL1Renderer\(\) : new Canvas2DRenderer\(\);\n[ ]{12}\}\n[ ]{8}\}\n[ ]{8}catch \{\n[ ]{12}this\._gpurender = new Canvas2DRenderer\(\);\n[ ]{8}\}/u;

const JASSUB_FORCED_CANVAS2D_RENDERER_SELECTION = `        // ${JASSUB_CANVAS2D_PATCH_MARKER}.` +
	'\n        this._gpurender = new Canvas2DRenderer();';

const JASSUB_ENTRY_STATIC_ASSET_FALLBACK_PATTERN = /[ ]{8}\/\/ yes this is awful, but bundlers check for new Worker\(new URL\(\)\) patterns, so can't use new Worker\(workerUrl \?\? new URL\(\.\.\.\)\) \.\.\. bruh\n[ ]{8}this\._worker = opts\.workerUrl\n[ ]{12}\? new Worker\(opts\.workerUrl, \{ name: 'jassub-worker', type: 'module' \}\)\n[ ]{12}: new Worker\(new URL\('\.\/worker\/worker\.js', import\.meta\.url\), \{ name: 'jassub-worker', type: 'module' \}\);\n[ ]{8}const Renderer = wrap\(this\._worker\);\n[ ]{8}const modern = opts\.modernWasmUrl \?\? new URL\('\.\/wasm\/jassub-worker-modern\.wasm', import\.meta\.url\)\.href;\n[ ]{8}const normal = opts\.wasmUrl \?\? new URL\('\.\/wasm\/jassub-worker\.wasm', import\.meta\.url\)\.href;\n[ ]{8}const availableFonts = opts\.availableFonts \?\? \{\};\n[ ]{8}if \(!availableFonts\['liberation sans'\] && !opts\.defaultFont\) \{\n[ ]{12}availableFonts\['liberation sans'\] = new URL\('\.\/default\.woff2', import\.meta\.url\)\.href;\n[ ]{8}\}/u;

const JASSUB_ENTRY_EXPLICIT_STATIC_ASSETS = `        // ${JASSUB_STATIC_ASSET_PATCH_MARKER}.` +
	'\n        if (!opts.workerUrl || !opts.wasmUrl || !opts.modernWasmUrl) {' +
	"\n            throw new Error('Breezyfin JASSUB static asset URLs are required.');" +
	'\n        }' +
	"\n        this._worker = new Worker(opts.workerUrl, { name: 'jassub-worker', type: 'module' });" +
	'\n        const Renderer = wrap(this._worker);' +
	'\n        const modern = opts.modernWasmUrl;' +
	'\n        const normal = opts.wasmUrl;' +
	'\n        const availableFonts = opts.availableFonts ?? {};' +
	"\n        if (!availableFonts['liberation sans'] && !opts.defaultFont) {" +
	"\n            throw new Error('Breezyfin JASSUB default font must be provided explicitly.');" +
	'\n        }';

const MINIFIED_FORCED_CANVAS2D_PATTERN = /_gpurender\s*=\s*new [A-Za-z_$][\w$]*\(\)\s*,\s*this\._gpurender\.setCanvas/u;
const WEBGL_SELECTION_PATTERN = /getContext\((['"])webgl2\1\)|ANGLE_instanced_arrays/u;
const STATIC_ASSET_FALLBACK_PATTERN = /new Worker\(new URL\('\.\/worker\/worker\.js'|new URL\('\.\/wasm\/jassub-worker(?:-modern)?\.wasm'|new URL\('\.\/default\.woff2'/u;

const assertSupportedJassubVersion = (version) => {
	if (!SUPPORTED_JASSUB_CANVAS2D_PATCH_VERSIONS.includes(String(version || '').trim())) {
		throw new Error(
			`Unsupported JASSUB version for Breezyfin Canvas2D patch: ${version || 'unknown'}. ` +
			`Expected one of: ${SUPPORTED_JASSUB_CANVAS2D_PATCH_VERSIONS.join(', ')}. ` +
			'Review JASSUB worker renderer selection before packaging.'
		);
	}
};

const hasJassubCanvas2dPatchMarker = (source) => (
	String(source || '').includes(JASSUB_CANVAS2D_PATCH_MARKER)
);

const hasJassubStaticAssetPatchMarker = (source) => (
	String(source || '').includes(JASSUB_STATIC_ASSET_PATCH_MARKER)
);

const forceJassubCanvas2dRendererInSource = (source, {version = ''} = {}) => {
	assertSupportedJassubVersion(version);
	const text = String(source || '');
	if (hasJassubCanvas2dPatchMarker(text)) {
		return {
			source: text,
			patched: false
		};
	}
	const patchedSource = text.replace(
		JASSUB_RENDERER_SELECTION_PATTERN,
		JASSUB_FORCED_CANVAS2D_RENDERER_SELECTION
	);
	if (patchedSource === text) {
		throw new Error('Unable to locate JASSUB worker WebGL renderer selection block for Canvas2D patch.');
	}
	return {
		source: patchedSource,
		patched: true
	};
};

const requireExplicitJassubStaticAssetUrlsInSource = (source, {version = ''} = {}) => {
	assertSupportedJassubVersion(version);
	const text = String(source || '');
	if (hasJassubStaticAssetPatchMarker(text)) {
		return {
			source: text,
			patched: false
		};
	}
	const patchedSource = text.replace(
		JASSUB_ENTRY_STATIC_ASSET_FALLBACK_PATTERN,
		JASSUB_ENTRY_EXPLICIT_STATIC_ASSETS
	);
	if (patchedSource === text) {
		throw new Error('Unable to locate JASSUB entry worker/WASM/font fallback block for static asset patch.');
	}
	return {
		source: patchedSource,
		patched: true
	};
};

const validateJassubCanvas2dWorkerSource = (source, {fileName = 'JASSUB worker'} = {}) => {
	const text = String(source || '');
	if (!hasJassubCanvas2dPatchMarker(text)) {
		throw new Error(`${fileName} is missing Breezyfin Canvas2D patch marker.`);
	}
	return true;
};

const validateJassubStaticAssetEntrySource = (source, {fileName = 'JASSUB entry'} = {}) => {
	const text = String(source || '');
	if (!hasJassubStaticAssetPatchMarker(text)) {
		throw new Error(`${fileName} is missing Breezyfin static asset URL patch marker.`);
	}
	if (STATIC_ASSET_FALLBACK_PATTERN.test(text)) {
		throw new Error(`${fileName} still contains JASSUB worker/WASM/font static fallback imports.`);
	}
	return true;
};

const validateMinifiedJassubCanvas2dWorkerSource = (source, {fileName = 'JASSUB worker'} = {}) => {
	const text = String(source || '');
	if (hasJassubCanvas2dPatchMarker(text)) {
		return true;
	}
	if (WEBGL_SELECTION_PATTERN.test(text)) {
		throw new Error(`${fileName} still contains the WebGL renderer selection path after Canvas2D patching.`);
	}
	if (!MINIFIED_FORCED_CANVAS2D_PATTERN.test(text)) {
		throw new Error(`${fileName} is missing forced Canvas2D renderer construction after minification.`);
	}
	return true;
};

module.exports = {
	JASSUB_CANVAS2D_PATCH_MARKER,
	JASSUB_STATIC_ASSET_PATCH_MARKER,
	SUPPORTED_JASSUB_CANVAS2D_PATCH_VERSIONS,
	forceJassubCanvas2dRendererInSource,
	requireExplicitJassubStaticAssetUrlsInSource,
	validateMinifiedJassubCanvas2dWorkerSource,
	validateJassubStaticAssetEntrySource,
	validateJassubCanvas2dWorkerSource
};
