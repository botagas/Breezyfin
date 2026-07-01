/* global __dirname */

const fs = require('fs');
const path = require('path');
const {
	forceJassubCanvas2dRendererInSource
} = require('./subtitle-assets/jassubCanvas2dPatch.cjs');

const projectRoot = path.resolve(__dirname, '..');
const sandstoneFontDir = path.join(projectRoot, 'node_modules', '@enact', 'sandstone', 'fonts', 'MuseoSans');
const jassubDistDir = path.join(projectRoot, 'node_modules', 'jassub', 'dist');
const jassubSourceWasmDir = path.join(projectRoot, 'node_modules', 'jassub', 'src', 'wasm');
const jassubPackageJson = require(path.join(projectRoot, 'node_modules', 'jassub', 'package.json'));

const fallbackFontSource = path.join(sandstoneFontDir, 'MuseoSans-Medium.ttf');
const jassubDefaultFontOutput = path.join(jassubDistDir, 'default.woff2');
const jassubWorkerRendererSource = path.join(jassubDistDir, 'worker', 'worker.js');
const jassubWorkerDistSource = path.join(jassubDistDir, 'wasm', 'jassub-worker.js');
const jassubWorkerSourceMapSource = path.join(jassubSourceWasmDir, 'jassub-worker.js');

if (!fs.existsSync(fallbackFontSource)) {
	throw new Error(`Missing subtitle fallback font: ${fallbackFontSource}`);
}
if (!fs.existsSync(jassubDistDir)) {
	throw new Error(`Missing JASSUB dist directory: ${jassubDistDir}`);
}

fs.copyFileSync(fallbackFontSource, jassubDefaultFontOutput);
console.log(`Prepared JASSUB default font asset at ${jassubDefaultFontOutput}`);

if (!fs.existsSync(jassubWorkerRendererSource)) {
	throw new Error(`Missing JASSUB worker renderer source: ${jassubWorkerRendererSource}`);
}

const forceJassubCanvas2dRenderer = () => {
	const source = fs.readFileSync(jassubWorkerRendererSource, 'utf8');
	const result = forceJassubCanvas2dRendererInSource(source, {
		version: jassubPackageJson.version
	});
	if (!result.patched) {
		return false;
	}
	fs.writeFileSync(jassubWorkerRendererSource, result.source);
	return true;
};

if (forceJassubCanvas2dRenderer()) {
	console.log(`Patched JASSUB worker renderer selection to Canvas2D at ${jassubWorkerRendererSource}`);
} else {
	console.log(`JASSUB worker renderer selection already patched to Canvas2D at ${jassubWorkerRendererSource}`);
}

// JASSUB's published sourcemap references src/wasm/jassub-worker.js, but the npm
// package omits that source file. Restoring it avoids source-map-loader warnings.
if (fs.existsSync(jassubWorkerDistSource)) {
	fs.mkdirSync(jassubSourceWasmDir, {recursive: true});
	fs.copyFileSync(jassubWorkerDistSource, jassubWorkerSourceMapSource);
	console.log(`Prepared JASSUB worker sourcemap source at ${jassubWorkerSourceMapSource}`);
}
