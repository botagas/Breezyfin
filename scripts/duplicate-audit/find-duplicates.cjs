#!/usr/bin/env node
/*
 * Mixed-language duplicate scanner for Breezyfin source files.
 * Uses normalized sliding windows and reports duplicate snippets across files.
 */
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const cp = require('child_process');

const SRC_ROOT = 'src';
const FILE_GLOBS = ['*.js', '*.less'];
const MIN_LINES_BY_EXT = {
	'.js': 8,
	'.less': 10
};
const MAX_REPORTS = 60;

const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();

const JS_LOW_SIGNAL_LINE_REGEX = /^(?:\.\.\.)?[A-Za-z_$][A-Za-z0-9_$]*(?:\s*:\s*[^,]+)?(?:\s*=\s*[^,]+)?,?$/;
const JS_LOW_SIGNAL_SCAFFOLD_REGEX = /^(?:const\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*use[A-Za-z0-9_$]+\(\{|}\);|}\) => \{)$/;

const isLowSignalSnippet = (extension, snippetKey) => {
	if (extension !== '.js') return false;
	const lines = snippetKey.split('\n').map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0) return true;
	const lowSignalLineCount = lines.filter((line) => (
		JS_LOW_SIGNAL_LINE_REGEX.test(line) || JS_LOW_SIGNAL_SCAFFOLD_REGEX.test(line)
	)).length;
	// Ignore windows that are primarily prop lists / hook-scaffolding and carry little structural value.
	return lowSignalLineCount / lines.length >= 0.85;
};

const getFiles = () => {
	const files = [];
	for (const glob of FILE_GLOBS) {
		const output = cp.execSync(`rg --files ${SRC_ROOT} -g '${glob}'`, {encoding: 'utf8'}).trim();
		if (!output) continue;
		output
			.split('\n')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.forEach((entry) => files.push(entry));
	}
	return files;
};

const scanFile = (filePath, store) => {
	const extension = path.extname(filePath);
	const minLines = MIN_LINES_BY_EXT[extension] || 8;
	const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
	const normalized = lines.map(normalizeLine);

	for (let i = 0; i + minLines <= normalized.length; i += 1) {
		const chunk = normalized.slice(i, i + minLines);
		if (chunk.some((line) => line.length === 0)) continue;
		const key = chunk.join('\n');
		const hash = nodeCrypto.createHash('sha1').update(`${extension}:${key}`).digest('hex');
		if (!store.has(hash)) {
			store.set(hash, {
				extension,
				key,
				occurrences: []
			});
		}
		store.get(hash).occurrences.push({
			filePath,
			line: i + 1
		});
	}
};

const buildReport = (store) => {
	const report = [];
	for (const entry of store.values()) {
		const byFile = new Map();
		entry.occurrences.forEach((occurrence) => {
			if (!byFile.has(occurrence.filePath)) byFile.set(occurrence.filePath, []);
			byFile.get(occurrence.filePath).push(occurrence.line);
		});

		if (byFile.size < 2) continue;

		report.push({
			extension: entry.extension,
			rawOccurrenceCount: entry.occurrences.length,
			fileCount: byFile.size,
			snippet: entry.key,
			locations: Array.from(byFile.entries()).map(([filePath, lines]) => ({
				filePath,
				line: Math.min(...lines)
			}))
		});
	}

	const filteredReport = report.filter((entry) => !isLowSignalSnippet(entry.extension, entry.snippet));
	filteredReport.sort((a, b) => b.fileCount - a.fileCount || b.rawOccurrenceCount - a.rawOccurrenceCount);
	return filteredReport.slice(0, MAX_REPORTS);
};

const printReport = (report) => {
	if (!report.length) {
		console.log('No cross-file duplicate snippets found for configured windows.');
		return;
	}

	console.log(`Found ${report.length} duplicate snippet groups (cross-file).`);
	report.forEach((entry, index) => {
		const preview = entry.snippet.split('\n').slice(0, 3).join(' | ');
		console.log(`\n#${index + 1} [${entry.extension}] files=${entry.fileCount} rawOccurrences=${entry.rawOccurrenceCount}`);
		entry.locations.forEach((location) => {
			console.log(` - ${location.filePath}:${location.line}`);
		});
		console.log(` snippet: ${preview}`);
	});
};

const main = () => {
	const files = getFiles();
	const store = new Map();
	files.forEach((filePath) => scanFile(filePath, store));
	const report = buildReport(store);
	printReport(report);
};

main();
