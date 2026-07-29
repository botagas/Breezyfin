/* global __dirname */

const fs = require('fs');
const path = require('path');
const {
	validateJassubCanvas2dWorkerSource,
	validateJassubStaticAssetEntrySource
} = require('./subtitle-assets/jassubCanvas2dPatch.cjs');

const projectRoot = path.resolve(__dirname, '..');
const libassSourceDir = path.join(projectRoot, 'node_modules', 'libass-wasm', 'dist', 'js');
const jassubSourceDir = path.join(projectRoot, 'node_modules', 'jassub', 'dist');
const libbitsubWasmSource = path.join(projectRoot, 'node_modules', 'libbitsub', 'pkg', 'libbitsub_bg.wasm');
const libpgsWorkerSource = path.join(projectRoot, 'node_modules', 'libpgs', 'dist', 'libpgs.worker.js');
const sandstoneFontDir = path.join(projectRoot, 'node_modules', '@enact', 'sandstone', 'fonts', 'MuseoSans');
const outputDir = path.join(projectRoot, 'dist');
const jassubOutputDir = path.join(outputDir, 'node_modules', 'breezyfin-subtitle-assets');
const subtitleAssetOutputDir = jassubOutputDir;
const enactCliNodeModules = path.join(projectRoot, 'node_modules', '@enact', 'cli', 'node_modules');
const packMode = process.env.BREEZYFIN_PACK_MODE === 'production' ? 'production' : 'development';
const projectLicenseSource = path.join(projectRoot, 'LICENSE');
const thirdPartyNoticesSource = path.join(projectRoot, 'THIRD_PARTY_NOTICES.txt');

const validateRelativeWebosEntryAssets = () => {
	const indexPath = path.join(outputDir, 'index.html');
	if (!fs.existsSync(indexPath)) {
		throw new Error(`Missing packaged webOS entry document: ${indexPath}`);
	}
	const indexSource = fs.readFileSync(indexPath, 'utf8');
	const entryAssetPattern = /<(?:link|script)\b[^>]*\b(?:href|src)="([^"]+)"/giu;
	const invalidAssets = [...indexSource.matchAll(entryAssetPattern)]
		.map((match) => match[1])
		.filter((assetPath) => /^(?:\/|https?:\/\/)/iu.test(assetPath));
	if (invalidAssets.length > 0) {
		throw new Error(
			'Packaged webOS entry assets must be relative for file:// loading: ' +
			invalidAssets.join(', ')
		);
	}
};

const LIBASS_ASSET_NAMES = [
	'subtitles-octopus.js',
	'subtitles-octopus-worker.js',
	'subtitles-octopus-worker-legacy.js',
	'subtitles-octopus-worker.wasm'
];

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
	const chunkPattern = /^chunk\.(?:ass-renderer-(?:assjs|jassub)|subtitle-renderer-(?:libbitsub|libpgs))\..*\.js$/;
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

const stripSourceMapReference = (source) => source
	.replace(/\n?\/\/[#@]\s*sourceMappingURL=.*$/gmu, '')
	.replace(/\n?\/\*[#@]\s*sourceMappingURL=.*?\*\//gsu, '');

const copyRuntimeFile = (sourcePath, targetPath) => {
	const extension = path.extname(sourcePath).toLowerCase();
	if (extension === '.ts' || sourcePath.endsWith('.d.ts')) return false;
	if (packMode === 'production' && extension === '.map') return false;
	if (packMode === 'production' && extension === '.js') {
		fs.writeFileSync(targetPath, stripSourceMapReference(fs.readFileSync(sourcePath, 'utf8')));
		return true;
	}
	fs.copyFileSync(sourcePath, targetPath);
	return true;
};

const copyDirectoryRecursive = (sourceDir, targetDir) => {
	if (!fs.existsSync(sourceDir)) {
		throw new Error(`Missing source directory: ${sourceDir}`);
	}
	fs.mkdirSync(targetDir, {recursive: true});
	for (const entry of fs.readdirSync(sourceDir, {withFileTypes: true})) {
		const sourcePath = path.join(sourceDir, entry.name);
		const targetPath = path.join(targetDir, entry.name);
		if (entry.isDirectory()) {
			copyDirectoryRecursive(sourcePath, targetPath);
		} else if (entry.isFile()) {
			copyRuntimeFile(sourcePath, targetPath);
		}
	}
};

const copyJassubStaticAssets = () => {
	const workerSourceDir = path.join(jassubSourceDir, 'worker');
	const wasmSourceDir = path.join(jassubSourceDir, 'wasm');
	const fontSource = path.join(jassubSourceDir, 'default.woff2');
	const entrySource = path.join(jassubSourceDir, 'jassub.js');
	if (!fs.existsSync(fontSource)) {
		throw new Error(`Missing JASSUB default font asset: ${fontSource}`);
	}
	if (!fs.existsSync(entrySource)) {
		throw new Error(`Missing JASSUB entry source: ${entrySource}`);
	}
	if (fs.existsSync(jassubOutputDir)) {
		fs.rmSync(jassubOutputDir, {recursive: true, force: true});
	}
	copyDirectoryRecursive(workerSourceDir, path.join(jassubOutputDir, 'worker'));
	copyDirectoryRecursive(wasmSourceDir, path.join(jassubOutputDir, 'wasm'));
	fs.copyFileSync(fontSource, path.join(jassubOutputDir, 'default.woff2'));
	validateJassubStaticAssetEntrySource(fs.readFileSync(entrySource, 'utf8'), {
		fileName: entrySource
	});
	validateJassubCanvas2dWorkerSource(fs.readFileSync(path.join(jassubOutputDir, 'worker', 'worker.js'), 'utf8'), {
		fileName: path.join(jassubOutputDir, 'worker', 'worker.js')
	});
	return 3;
};

const assertNoGeneratedJassubRuntimeChunks = () => {
	if (!fs.existsSync(outputDir)) return true;
	const generatedJassubChunks = fs.readdirSync(outputDir).filter((fileName) => (
		/^chunk\.(?:jassub-worker|em-pthread)\./u.test(fileName)
	));
	if (generatedJassubChunks.length > 0) {
		throw new Error(
			'Generated JASSUB worker/runtime chunks remain after pack: ' +
			generatedJassubChunks.join(', ')
		);
	}
	return true;
};

const copyBitmapSubtitleAssets = () => {
	if (!fs.existsSync(libbitsubWasmSource)) {
		throw new Error(`Missing libbitsub WASM asset: ${libbitsubWasmSource}`);
	}
	if (!fs.existsSync(libpgsWorkerSource)) {
		throw new Error(`Missing libpgs worker asset: ${libpgsWorkerSource}`);
	}
	const libbitsubPublicDir = path.join(outputDir, 'libbitsub');
	const libbitsubAssetDir = path.join(subtitleAssetOutputDir, 'libbitsub');
	const libpgsAssetDir = path.join(subtitleAssetOutputDir, 'libpgs');
	fs.mkdirSync(libbitsubPublicDir, {recursive: true});
	fs.mkdirSync(libbitsubAssetDir, {recursive: true});
	fs.mkdirSync(libpgsAssetDir, {recursive: true});
	fs.copyFileSync(libbitsubWasmSource, path.join(libbitsubPublicDir, 'libbitsub_bg.wasm'));
	fs.copyFileSync(libbitsubWasmSource, path.join(libbitsubAssetDir, 'libbitsub_bg.wasm'));
	fs.copyFileSync(libpgsWorkerSource, path.join(libpgsAssetDir, 'libpgs.worker.js'));
	return 3;
};

if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir, {recursive: true});
}

validateRelativeWebosEntryAssets();

for (const assetName of LIBASS_ASSET_NAMES) {
	const sourcePath = path.join(libassSourceDir, assetName);
	const outputPath = path.join(outputDir, assetName);
	if (!fs.existsSync(sourcePath)) {
		throw new Error(`Missing libass-wasm asset: ${sourcePath}`);
	}
	fs.copyFileSync(sourcePath, outputPath);
}

const copiedJassubAssetGroups = copyJassubStaticAssets();
const copiedBitmapSubtitleAssets = copyBitmapSubtitleAssets();
const transpiledRendererChunks = transpileExperimentalRendererChunks();
if (transpiledRendererChunks > 0) {
	console.log(`Transpiled ${transpiledRendererChunks} experimental subtitle renderer chunks for webOS packaging`);
}
assertNoGeneratedJassubRuntimeChunks();
console.log(`Copied and validated ${copiedJassubAssetGroups} JASSUB static asset group(s) to ${jassubOutputDir}`);
console.log(`Copied ${copiedBitmapSubtitleAssets} bitmap subtitle renderer asset(s)`);

const fallbackFontSource = path.join(sandstoneFontDir, 'MuseoSans-Medium.ttf');
const fallbackFontOutput = path.join(outputDir, 'breezyfin-subtitle-fallback.ttf');
if (!fs.existsSync(fallbackFontSource)) {
	throw new Error(`Missing subtitle fallback font: ${fallbackFontSource}`);
}
fs.copyFileSync(fallbackFontSource, fallbackFontOutput);

for (const requiredNotice of [projectLicenseSource, thirdPartyNoticesSource]) {
	if (!fs.existsSync(requiredNotice)) {
		throw new Error(`Missing required release notice: ${requiredNotice}`);
	}
}
fs.copyFileSync(projectLicenseSource, path.join(outputDir, 'LICENSE'));
fs.copyFileSync(thirdPartyNoticesSource, path.join(outputDir, 'THIRD_PARTY_NOTICES.txt'));

console.log(
	`Copied ${LIBASS_ASSET_NAMES.length} libass-wasm assets, ` +
	'static JASSUB assets, ' +
	'bitmap subtitle assets, ' +
	`1 fallback font, and release notices to ${outputDir} (${packMode})`
);
