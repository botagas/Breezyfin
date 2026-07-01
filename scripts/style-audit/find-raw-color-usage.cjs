#!/usr/bin/env node

const {
	fs,
	path,
	ROOT,
	SRC_DIR,
	STYLE_EXTENSIONS,
	hasExtension,
	relativePath,
	stripBlockCommentsKeepingLines,
	walkFiles
} = require('../audit-utils/files.cjs');

const BASELINE_PATH = path.join(ROOT, 'scripts', 'style-audit', 'raw-color-baseline.json');
const MAX_FILE_SUMMARY = 25;
const MAX_FINDING_LINES = 120;
const FAIL_ON_FINDINGS = process.argv.includes('--fail-on-findings');

const HEX_COLOR_REGEX = /(?<![A-Za-z0-9_-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![A-Za-z0-9_-])/g;
const FUNCTION_COLOR_REGEX = /\b(?:rgba?|hsla?)\((?!\s*(?:var\(|@))[^)]+\)/g;

const isTokenDeclarationLine = (line) => {
	const trimmed = line.trim();
	if (!trimmed) return false;
	return /^--[A-Za-z0-9_-]+\s*:/.test(trimmed) || /^@[A-Za-z0-9_-]+\s*:/.test(trimmed);
};

const collectLiterals = (line) => {
	const matches = [];
	for (const regex of [HEX_COLOR_REGEX, FUNCTION_COLOR_REGEX]) {
		regex.lastIndex = 0;
		let match;
		while ((match = regex.exec(line))) {
			matches.push({
				literal: match[0],
				column: match.index + 1
			});
		}
	}
	return matches.sort((a, b) => a.column - b.column);
};

const styleFiles = walkFiles(
	SRC_DIR,
	hasExtension(STYLE_EXTENSIONS),
	{sort: false}
);

const tokenDeclarationFindings = [];
const rawUsageFindings = [];

styleFiles.forEach((filePath) => {
	const source = fs.readFileSync(filePath, 'utf8');
	const sourceWithoutComments = stripBlockCommentsKeepingLines(source);
	const lines = sourceWithoutComments.split(/\r?\n/);
	lines.forEach((line, lineIndex) => {
		const literals = collectLiterals(line);
		if (literals.length === 0) return;
		const target = isTokenDeclarationLine(line) ? tokenDeclarationFindings : rawUsageFindings;
		literals.forEach((entry) => {
			target.push({
				filePath: relativePath(filePath),
				line: lineIndex + 1,
				column: entry.column,
				literal: entry.literal
			});
		});
	});
});

const summarizeByFile = (findings) => {
	const byFile = new Map();
	findings.forEach((finding) => {
		const current = byFile.get(finding.filePath) || 0;
		byFile.set(finding.filePath, current + 1);
	});
	return [...byFile.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, MAX_FILE_SUMMARY);
};

const printSummary = (label, findings) => {
	const byFile = summarizeByFile(findings);
	console.log(`${label}: ${findings.length}`);
	if (byFile.length === 0) return;
	byFile.forEach(([file, count]) => {
		console.log(`  - ${file}: ${count}`);
	});
};

const countByFile = (findings) => {
	const byFile = new Map();
	findings.forEach((finding) => {
		const current = byFile.get(finding.filePath) || 0;
		byFile.set(finding.filePath, current + 1);
	});
	return Object.fromEntries([...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0])));
};

const readBaseline = () => {
	if (!fs.existsSync(BASELINE_PATH)) {
		return null;
	}
	return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
};

const getBaselineRegressions = (baselineConfig, currentCounts) => {
	if (!baselineConfig) {
		return [];
	}

	const baselineFiles = baselineConfig.files || {};
	return Object.entries(currentCounts)
		.filter(([filePath, count]) => count > (baselineFiles[filePath] || 0))
		.map(([filePath, count]) => ({
			filePath,
			count,
			baselineCount: baselineFiles[filePath] || 0
		}));
};

console.log(`Scanned ${styleFiles.length} style files under src/.`);
printSummary('Token declaration literals (expected in token definitions)', tokenDeclarationFindings);
printSummary('Raw color usage outside token declarations', rawUsageFindings);

const rawCountsByFile = countByFile(rawUsageFindings);
const baseline = readBaseline();
const baselineRegressions = getBaselineRegressions(baseline, rawCountsByFile);

if (baseline) {
	console.log(`Raw color baseline: ${baseline.total} usages across ${Object.keys(baseline.files || {}).length} files.`);
	if (baselineRegressions.length === 0) {
		console.log('No raw color usage above baseline found.');
	}
} else {
	console.log('No raw color baseline found; audit is informational only.');
}

if (rawUsageFindings.length > 0) {
	console.log('\nTop raw usage findings:');
	rawUsageFindings.slice(0, MAX_FINDING_LINES).forEach((finding) => {
		console.log(`  - ${finding.filePath}:${finding.line}:${finding.column} -> ${finding.literal}`);
	});
	if (rawUsageFindings.length > MAX_FINDING_LINES) {
		console.log(`  ... and ${rawUsageFindings.length - MAX_FINDING_LINES} more`);
	}
	console.log('\nRecommendation: prefer existing theme tokens / CSS vars over inline color literals.');
}

if (baselineRegressions.length > 0) {
	console.error('\nRaw color usage increased above baseline:');
	baselineRegressions.forEach((item) => {
		console.error(`  - ${item.filePath}: ${item.count} current, ${item.baselineCount} baseline`);
	});
	console.error('\nPrefer tokenizing new colors. If a raw color is intentionally retained, reduce another raw usage in the same file or update the baseline in the same review with justification.');
	process.exit(1);
}

if (FAIL_ON_FINDINGS && rawUsageFindings.length > 0) {
	process.exit(1);
}
