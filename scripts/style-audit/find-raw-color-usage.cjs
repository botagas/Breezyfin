#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const STYLE_EXTENSIONS = new Set(['.less', '.css']);
const MAX_FILE_SUMMARY = 25;
const MAX_FINDING_LINES = 120;
const FAIL_ON_FINDINGS = process.argv.includes('--fail-on-findings');

const HEX_COLOR_REGEX = /(?<![A-Za-z0-9_-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![A-Za-z0-9_-])/g;
const FUNCTION_COLOR_REGEX = /\b(?:rgba?|hsla?)\((?!\s*var\()[^)]+\)/g;

const normalizePath = (value) => value.split(path.sep).join('/');
const relativePath = (absolutePath) => normalizePath(path.relative(ROOT, absolutePath));

const walkFiles = (directory, predicate) => {
	const results = [];
	const stack = [directory];
	while (stack.length > 0) {
		const current = stack.pop();
		const entries = fs.readdirSync(current, {withFileTypes: true});
		for (const entry of entries) {
			const resolved = path.join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(resolved);
				continue;
			}
			if (predicate(resolved)) {
				results.push(resolved);
			}
		}
	}
	return results;
};

const stripCommentsKeepingLines = (source) => (
	source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
);

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
	(filePath) => STYLE_EXTENSIONS.has(path.extname(filePath))
);

const tokenDeclarationFindings = [];
const rawUsageFindings = [];

styleFiles.forEach((filePath) => {
	const source = fs.readFileSync(filePath, 'utf8');
	const sourceWithoutComments = stripCommentsKeepingLines(source);
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

console.log(`Scanned ${styleFiles.length} style files under src/.`);
printSummary('Token declaration literals (expected in token definitions)', tokenDeclarationFindings);
printSummary('Raw color usage outside token declarations', rawUsageFindings);

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

if (FAIL_ON_FINDINGS && rawUsageFindings.length > 0) {
	process.exit(1);
}
