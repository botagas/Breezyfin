/* global __dirname */

const fs = require('fs');
const path = require('path');
const {
	validateMinifiedJassubCanvas2dWorkerSource
} = require('./subtitle-assets/jassubCanvas2dPatch.cjs');

const projectRoot = path.resolve(__dirname, '..');
const libassSourceDir = path.join(projectRoot, 'node_modules', 'libass-wasm', 'dist', 'js');
const sandstoneFontDir = path.join(projectRoot, 'node_modules', '@enact', 'sandstone', 'fonts', 'MuseoSans');
const outputDir = path.join(projectRoot, 'dist');
const jassubOutputDir = path.join(outputDir, 'node_modules', 'breezyfin-subtitle-assets');
const enactCliNodeModules = path.join(projectRoot, 'node_modules', '@enact', 'cli', 'node_modules');

const LIBASS_ASSET_NAMES = [
	'subtitles-octopus.js',
	'subtitles-octopus-worker.js',
	'subtitles-octopus-worker-legacy.js',
	'subtitles-octopus-worker.wasm'
];

const removeFilesMatching = (patterns) => {
	if (!fs.existsSync(outputDir)) return 0;
	let removedCount = 0;
	for (const fileName of fs.readdirSync(outputDir)) {
		if (!patterns.some((pattern) => pattern.test(fileName))) continue;
		fs.rmSync(path.join(outputDir, fileName), {force: true});
		removedCount += 1;
	}
	return removedCount;
};

const removeGeneratedJassubPthreadChunks = () => removeFilesMatching([
	/^chunk\.em-pthread\..*\.js(?:\.LICENSE\.txt)?$/
]);

const resolveEnactCliModule = (moduleName) => require.resolve(moduleName, {
	paths: [enactCliNodeModules]
});

const getRendererChunkTranspiler = () => {
	try {
		const babel = require(resolveEnactCliModule('@babel/core'));
		const pluginOptions = {loose: true};
		const plugins = [
			'@babel/plugin-transform-private-methods',
			'@babel/plugin-transform-class-properties',
			'@babel/plugin-transform-private-property-in-object',
			'@babel/plugin-transform-optional-chaining',
			'@babel/plugin-transform-nullish-coalescing-operator'
		].map((pluginName) => [resolveEnactCliModule(pluginName), pluginOptions]);
		return (code) => babel.transformSync(code, {
			babelrc: false,
			comments: false,
			compact: true,
			configFile: false,
			plugins,
			sourceType: 'script'
		})?.code || code;
	} catch (error) {
		throw new Error(`Unable to load Enact Babel renderer chunk transpiler: ${error.message}`);
	}
};

const transpileExperimentalRendererChunks = () => {
	if (!fs.existsSync(outputDir)) return 0;
	const chunkPattern = /^chunk\.(?:ass-renderer-(?:assjs|jassub)|jassub-worker)\..*\.js$/;
	const chunkNames = fs.readdirSync(outputDir).filter((fileName) => chunkPattern.test(fileName));
	if (chunkNames.length === 0) return 0;
	const transpileChunk = getRendererChunkTranspiler();
	for (const chunkName of chunkNames) {
		const chunkPath = path.join(outputDir, chunkName);
		const source = fs.readFileSync(chunkPath, 'utf8');
		const transformed = transpileChunk(source);
		if (transformed && transformed !== source) {
			fs.writeFileSync(chunkPath, transformed);
		}
	}
	return chunkNames.length;
};

const patchJassubWorkerRuntimeUrl = () => {
	const mainChunkNames = fs.readdirSync(outputDir).filter((fileName) => /^main\..*\.js$/u.test(fileName));
	let patchedCount = 0;
	for (const chunkName of mainChunkNames) {
		const chunkPath = path.join(outputDir, chunkName);
		const source = fs.readFileSync(chunkPath, 'utf8');
		if (!source.includes('434:"jassub-worker"')) continue;
		const patched = source.replace(
			/(\.u=function\((\w+)\)\{return"chunk\."\+\(\{[^}]*434:"jassub-worker"[^}]*\}\[\2\]\|\|\2\)\+"\."\+\{[^}]*\}\[\2\])\+"\.js"(\})/u,
			'$1+(434===$2?".worker":".js")$3'
		);
		if (patched === source) {
			throw new Error(`Unable to patch JASSUB worker runtime URL in ${chunkPath}`);
		}
		fs.writeFileSync(chunkPath, patched);
		patchedCount += 1;
	}
	return patchedCount;
};

const renameGeneratedJassubWorkerChunks = () => {
	const workerChunkNames = fs.readdirSync(outputDir).filter((fileName) => (
		/^chunk\.jassub-worker\..*\.js$/u.test(fileName)
	));
	let renamedCount = 0;
	for (const chunkName of workerChunkNames) {
		const sourcePath = path.join(outputDir, chunkName);
		const outputPath = path.join(outputDir, chunkName.replace(/\.js$/u, '.worker'));
		fs.renameSync(sourcePath, outputPath);
		renamedCount += 1;
	}
	return renamedCount;
};

const validateGeneratedJassubWorkerChunks = () => {
	const workerChunkNames = fs.readdirSync(outputDir).filter((fileName) => (
		/^chunk\.jassub-worker(?:\..*)?\.(?:js|worker)$/u.test(fileName)
	));
	if (workerChunkNames.length === 0) {
		throw new Error('No generated JASSUB worker chunk found for Canvas2D validation.');
	}
	workerChunkNames.forEach((chunkName) => {
		const chunkPath = path.join(outputDir, chunkName);
		validateMinifiedJassubCanvas2dWorkerSource(fs.readFileSync(chunkPath, 'utf8'), {
			fileName: chunkPath
		});
	});
	return workerChunkNames.length;
};

if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir, {recursive: true});
}

for (const assetName of LIBASS_ASSET_NAMES) {
	const sourcePath = path.join(libassSourceDir, assetName);
	const outputPath = path.join(outputDir, assetName);
	if (!fs.existsSync(sourcePath)) {
		throw new Error(`Missing libass-wasm asset: ${sourcePath}`);
	}
	fs.copyFileSync(sourcePath, outputPath);
}

if (fs.existsSync(jassubOutputDir)) {
	fs.rmSync(jassubOutputDir, {recursive: true, force: true});
}
const transpiledRendererChunks = transpileExperimentalRendererChunks();
if (transpiledRendererChunks > 0) {
	console.log(`Transpiled ${transpiledRendererChunks} experimental subtitle renderer chunks for webOS packaging`);
}
const renamedWorkerChunks = renameGeneratedJassubWorkerChunks();
if (renamedWorkerChunks > 0) {
	const patchedRuntimeChunks = patchJassubWorkerRuntimeUrl();
	console.log(`Renamed ${renamedWorkerChunks} JASSUB worker chunk(s) and patched ${patchedRuntimeChunks} runtime chunk(s)`);
}
const validatedJassubWorkerChunks = validateGeneratedJassubWorkerChunks();
if (validatedJassubWorkerChunks > 0) {
	console.log(`Validated ${validatedJassubWorkerChunks} Canvas2D-patched JASSUB worker chunk(s)`);
}
const removedPthreadChunks = removeGeneratedJassubPthreadChunks();
if (removedPthreadChunks > 0) {
	console.log(`Removed ${removedPthreadChunks} JASSUB pthread chunk(s) for webOS packaging`);
}

const fallbackFontSource = path.join(sandstoneFontDir, 'MuseoSans-Medium.ttf');
const fallbackFontOutput = path.join(outputDir, 'breezyfin-subtitle-fallback.ttf');
if (!fs.existsSync(fallbackFontSource)) {
	throw new Error(`Missing subtitle fallback font: ${fallbackFontSource}`);
}
fs.copyFileSync(fallbackFontSource, fallbackFontOutput);

console.log(
	`Copied ${LIBASS_ASSET_NAMES.length} libass-wasm assets, ` +
	'bundled JASSUB assets, ' +
	`and 1 fallback font to ${outputDir}`
);
