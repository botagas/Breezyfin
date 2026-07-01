const JASSUB_CANVAS2D_PATCH_MARKER = 'Breezyfin: force Canvas2D renderer for webOS';
const SUPPORTED_JASSUB_CANVAS2D_PATCH_VERSIONS = Object.freeze(['2.5.6']);

const JASSUB_RENDERER_SELECTION_PATTERN = /[ ]{8}try \{\n[ ]{12}const testCanvas = new OffscreenCanvas\(1, 1\);\n[ ]{12}if \(testCanvas\.getContext\('webgl2'\)\) \{\n[ ]{16}this\._gpurender = new WebGL2Renderer\(\);\n[ ]{12}\}\n[ ]{12}else \{\n[ ]{16}this\._gpurender = testCanvas\.getContext\('webgl'\)\?\.getExtension\('ANGLE_instanced_arrays'\) \? new WebGL1Renderer\(\) : new Canvas2DRenderer\(\);\n[ ]{12}\}\n[ ]{8}\}\n[ ]{8}catch \{\n[ ]{12}this\._gpurender = new Canvas2DRenderer\(\);\n[ ]{8}\}/u;

const JASSUB_FORCED_CANVAS2D_RENDERER_SELECTION = `        // ${JASSUB_CANVAS2D_PATCH_MARKER}.` +
	'\n        this._gpurender = new Canvas2DRenderer();';

const MINIFIED_FORCED_CANVAS2D_PATTERN = /_gpurender\s*=\s*new [A-Za-z_$][\w$]*\(\)\s*,\s*this\._gpurender\.setCanvas/u;
const WEBGL_SELECTION_PATTERN = /getContext\((['"])webgl2\1\)|ANGLE_instanced_arrays/u;

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

const validateJassubCanvas2dWorkerSource = (source, {fileName = 'JASSUB worker'} = {}) => {
	const text = String(source || '');
	if (!hasJassubCanvas2dPatchMarker(text)) {
		throw new Error(`${fileName} is missing Breezyfin Canvas2D patch marker.`);
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
	SUPPORTED_JASSUB_CANVAS2D_PATCH_VERSIONS,
	forceJassubCanvas2dRendererInSource,
	validateMinifiedJassubCanvas2dWorkerSource,
	validateJassubCanvas2dWorkerSource
};
