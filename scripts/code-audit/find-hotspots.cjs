#!/usr/bin/env node

/*
 * Code-size and complexity-marker report.
 *
 * Existing hotspots remain visible as prioritization input, while conservative
 * ceilings prevent new extreme growth before decomposition/testing follow-up.
 */

const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	STYLE_EXTENSIONS,
	isTestFile,
	relativePath,
	stripJsComments,
	walkFiles
} = require('../audit-utils/files.cjs');

const MAX_REPORTS = 25;
const LIMITS = {
	productionJsLines: 1000,
	productionJsDecisionMarkers: 260,
	styleLines: 400,
	testLines: 900
};

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
	const decisionMarkers = isJs
		? countMatches(code, /\b(?:if|for|while|switch|case|catch)\b|&&|\|\|/g)
		: 0;
	const hookMarkers = isJs
		? countMatches(code, /\buse[A-Z][A-Za-z0-9_]*\s*\(/g)
		: 0;
	const selectorMarkers = isStyle
		? countMatches(code, /(^|[\s,>+~])\.[A-Za-z_][A-Za-z0-9_-]*/gm)
		: 0;

	return {
		filePath: relativePath(filePath),
		extension,
		lines,
		decisionMarkers,
		hookMarkers,
		selectorMarkers,
		testFile: isTestFile(filePath)
	};
};

const printTable = (title, entries, formatter) => {
	console.log(`\n${title}`);
	if (entries.length === 0) {
		console.log('  none');
		return;
	}
	entries.forEach((entry) => {
		console.log(`  - ${formatter(entry)}`);
	});
};

const files = walkFiles(
	SRC_DIR,
	(filePath) => JS_EXTENSIONS.has(path.extname(filePath)) || STYLE_EXTENSIONS.has(path.extname(filePath)),
	{sort: false}
).map(analyzeFile);

const productionJs = files.filter((entry) => JS_EXTENSIONS.has(entry.extension) && !entry.testFile);
const testJs = files.filter((entry) => JS_EXTENSIONS.has(entry.extension) && entry.testFile);
const styleFiles = files.filter((entry) => STYLE_EXTENSIONS.has(entry.extension));

const largestProductionJs = [...productionJs]
	.sort((a, b) => b.lines - a.lines || a.filePath.localeCompare(b.filePath))
	.slice(0, MAX_REPORTS);
const markerHeavyProductionJs = [...productionJs]
	.sort((a, b) => b.decisionMarkers - a.decisionMarkers || b.lines - a.lines || a.filePath.localeCompare(b.filePath))
	.slice(0, MAX_REPORTS);
const largestStyleFiles = [...styleFiles]
	.sort((a, b) => b.lines - a.lines || a.filePath.localeCompare(b.filePath))
	.slice(0, MAX_REPORTS);
const largestTests = [...testJs]
	.sort((a, b) => b.lines - a.lines || a.filePath.localeCompare(b.filePath))
	.slice(0, 10);

const hotspotLimitViolations = [
	...productionJs
		.filter((entry) => entry.lines > LIMITS.productionJsLines)
		.map((entry) => ({
			filePath: entry.filePath,
			message: `${entry.lines} production JS lines > ${LIMITS.productionJsLines}`
		})),
	...productionJs
		.filter((entry) => entry.decisionMarkers > LIMITS.productionJsDecisionMarkers)
		.map((entry) => ({
			filePath: entry.filePath,
			message: `${entry.decisionMarkers} decision markers > ${LIMITS.productionJsDecisionMarkers}`
		})),
	...styleFiles
		.filter((entry) => entry.lines > LIMITS.styleLines)
		.map((entry) => ({
			filePath: entry.filePath,
			message: `${entry.lines} style lines > ${LIMITS.styleLines}`
		})),
	...testJs
		.filter((entry) => entry.lines > LIMITS.testLines)
		.map((entry) => ({
			filePath: entry.filePath,
			message: `${entry.lines} test lines > ${LIMITS.testLines}`
		}))
].sort((a, b) => a.filePath.localeCompare(b.filePath));

console.log(`Scanned ${files.length} source files (${productionJs.length} production JS, ${testJs.length} test JS, ${styleFiles.length} style).`);
console.log(
	`Hotspot ceilings: production JS <= ${LIMITS.productionJsLines} lines / ${LIMITS.productionJsDecisionMarkers} decision markers, style <= ${LIMITS.styleLines} lines, tests <= ${LIMITS.testLines} lines.`
);

printTable(
	`Largest production JS files (top ${MAX_REPORTS})`,
	largestProductionJs,
	(entry) => `${entry.filePath}: ${entry.lines} lines, ${entry.decisionMarkers} decision markers, ${entry.hookMarkers} hook calls`
);

printTable(
	`Highest decision-marker production JS files (top ${MAX_REPORTS})`,
	markerHeavyProductionJs,
	(entry) => `${entry.filePath}: ${entry.decisionMarkers} markers, ${entry.lines} lines`
);

printTable(
	`Largest style files (top ${MAX_REPORTS})`,
	largestStyleFiles,
	(entry) => `${entry.filePath}: ${entry.lines} lines, ${entry.selectorMarkers} selector markers`
);

printTable(
	'Largest test files (top 10)',
	largestTests,
	(entry) => `${entry.filePath}: ${entry.lines} lines, ${entry.decisionMarkers} decision markers`
);

console.log('\nRecommendation: use this report to prioritize decomposition, focused tests, or helper extraction. It is not a substitute for runtime TV validation.');

if (hotspotLimitViolations.length > 0) {
	console.error('\nHotspot ceiling violations:');
	hotspotLimitViolations.forEach((violation) => {
		console.error(`  - ${violation.filePath}: ${violation.message}`);
	});
	process.exit(1);
}
