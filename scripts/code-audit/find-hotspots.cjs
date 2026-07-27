#!/usr/bin/env node

/*
 * Advisory source hotspot report.
 *
 * Metrics guide decomposition reviews. Only source parsing and baseline integrity
 * are correctness gates; growth is reported without failing the audit.
 */

const {
	fs,
	path,
	ROOT,
	SRC_DIR,
	JS_EXTENSIONS,
	STYLE_EXTENSIONS,
	isTestFile,
	relativePath,
	stripJsComments,
	walkFiles
} = require('../audit-utils/files.cjs');
const {
	analyzeJavaScript,
	compareHotspots,
	createBaseline,
	validateBaseline
} = require('./hotspot-metrics.cjs');

const MAX_REPORTS = 25;
const BASELINE_PATH = path.join(ROOT, 'scripts', 'code-audit', 'hotspot-baseline.json');
const WRITE_BASELINE = process.argv.includes('--write-baseline');

const countMatches = (source, regex) => {
	let count = 0;
	regex.lastIndex = 0;
	while (regex.exec(source)) count += 1;
	return count;
};

const analyzeFile = (filePath) => {
	const extension = path.extname(filePath);
	const source = fs.readFileSync(filePath, 'utf8');
	const lines = source.split(/\r?\n/).length;
	const code = stripJsComments(source);
	const isJs = JS_EXTENSIONS.has(extension);
	const isStyle = STYLE_EXTENSIONS.has(extension);
	return {
		filePath: relativePath(filePath),
		extension,
		lines,
		decisionMarkers: isJs
			? countMatches(code, /\b(?:if|for|while|switch|case|catch)\b|&&|\|\|/g)
			: 0,
		hookMarkers: isJs
			? countMatches(code, /\buse[A-Z][A-Za-z0-9_]*\s*\(/g)
			: 0,
		selectorMarkers: isStyle
			? countMatches(code, /(^|[\s,>+~])\.[A-Za-z_][A-Za-z0-9_-]*/gm)
			: 0,
		functions: isJs ? analyzeJavaScript(source, filePath) : [],
		testFile: isTestFile(filePath)
	};
};

const printTable = (title, entries, formatter) => {
	console.log(`\n${title}`);
	if (entries.length === 0) {
		console.log('  none');
		return;
	}
	entries.forEach((entry) => console.log(`  - ${formatter(entry)}`));
};

const rankFunction = (entry) => (
	entry.complexity * 10 +
	entry.nesting * 5 +
	entry.lines / 10
);

try {
	const files = walkFiles(
		SRC_DIR,
		(filePath) => JS_EXTENSIONS.has(path.extname(filePath)) || STYLE_EXTENSIONS.has(path.extname(filePath)),
		{sort: false}
	).map(analyzeFile);

	if (WRITE_BASELINE) {
		fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(createBaseline(files), null, 2)}\n`);
		console.log(`Updated hotspot baseline: ${relativePath(BASELINE_PATH)}`);
		process.exit(0);
	}

	if (!fs.existsSync(BASELINE_PATH)) {
		throw new Error(`Hotspot baseline is missing: ${relativePath(BASELINE_PATH)}`);
	}
	const baseline = validateBaseline(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')));
	const comparison = compareHotspots(files, baseline);
	const productionJs = files.filter((entry) => JS_EXTENSIONS.has(entry.extension) && !entry.testFile);
	const testJs = files.filter((entry) => JS_EXTENSIONS.has(entry.extension) && entry.testFile);
	const styleFiles = files.filter((entry) => STYLE_EXTENSIONS.has(entry.extension));
	const functions = productionJs.flatMap((entry) => (
		entry.functions.map((fn) => ({...fn, filePath: entry.filePath}))
	));

	console.log(`Scanned ${files.length} source files (${productionJs.length} production JS, ${testJs.length} test JS, ${styleFiles.length} style).`);
	console.log('Hotspot metrics are advisory. Parsing and baseline integrity are the only failure conditions.');

	printTable(
		`Largest production JS files (top ${MAX_REPORTS})`,
		[...productionJs].sort((a, b) => b.lines - a.lines).slice(0, MAX_REPORTS),
		(entry) => `${entry.filePath}: ${entry.lines} lines, ${entry.decisionMarkers} markers, ${entry.hookMarkers} hook calls`
	);
	printTable(
		`Highest-ranked production functions (top ${MAX_REPORTS})`,
		[...functions].sort((a, b) => rankFunction(b) - rankFunction(a)).slice(0, MAX_REPORTS),
		(entry) => `${entry.filePath}:${entry.line} ${entry.id}: ${entry.lines} lines, complexity ${entry.complexity}, nesting ${entry.nesting}`
	);
	printTable(
		'File growth since baseline',
		[...comparison.fileGrowth].sort((a, b) => b.growth - a.growth).slice(0, MAX_REPORTS),
		(entry) => `${entry.filePath}: +${entry.growth} lines (${entry.lines} current)`
	);
	printTable(
		'New files at or above 500 lines',
		comparison.newLargeFiles.slice(0, MAX_REPORTS),
		(entry) => `${entry.filePath}: ${entry.lines} lines`
	);
	printTable(
		'Function growth since baseline',
		[...comparison.functionGrowth]
			.sort((a, b) => (
				b.complexityGrowth - a.complexityGrowth ||
				b.lengthGrowth - a.lengthGrowth ||
				b.nestingGrowth - a.nestingGrowth
			))
			.slice(0, MAX_REPORTS),
		(entry) => (
			`${entry.filePath}:${entry.line} ${entry.id}: ` +
			`lines ${entry.lengthGrowth >= 0 ? '+' : ''}${entry.lengthGrowth}, ` +
			`complexity ${entry.complexityGrowth >= 0 ? '+' : ''}${entry.complexityGrowth}, ` +
			`nesting ${entry.nestingGrowth >= 0 ? '+' : ''}${entry.nestingGrowth}`
		)
	);
	printTable(
		`Largest style files (top ${MAX_REPORTS})`,
		[...styleFiles].sort((a, b) => b.lines - a.lines).slice(0, MAX_REPORTS),
		(entry) => `${entry.filePath}: ${entry.lines} lines, ${entry.selectorMarkers} selector markers`
	);

	console.log('\nRecommendation: review growth and high-ranked functions alongside tests and real-TV behavior; metrics do not determine correctness.');
} catch (error) {
	console.error(`Hotspot audit failed: ${error.message}`);
	process.exit(1);
}
