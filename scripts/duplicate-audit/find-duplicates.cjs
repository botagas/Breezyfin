#!/usr/bin/env node
/*
 * Mixed-language duplicate scanner for Breezyfin source files.
 * Uses normalized sliding windows and reports duplicate snippets across files.
 */
const nodeCrypto = require('crypto');
const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	STYLE_EXTENSIONS,
	hasExtension,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const SCAN_EXTENSIONS = new Set([...STYLE_EXTENSIONS, ...JS_EXTENSIONS]);
const MIN_LINES_BY_EXT = {
	'.css': 10,
	'.js': 8,
	'.jsx': 8,
	'.less': 10,
	'.ts': 8,
	'.tsx': 8
};
const MAX_REPORTS = 60;

const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();

const JS_LOW_SIGNAL_LINE_REGEX = /^(?:\.\.\.)?[A-Za-z_$][A-Za-z0-9_$]*(?:\s*:\s*[^,]+)?(?:\s*=\s*[^,]+)?,?$/;
const JS_LOW_SIGNAL_SCAFFOLD_REGEX = /^(?:const\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*use[A-Za-z0-9_$]+\(\{|}\);|}\) => \{)$/;
const JS_LOW_SIGNAL_OBJECT_ARG_REGEX = /^(?:if\s*\()?[$A-Za-z_][A-Za-z0-9_$]*\(\{$|^\}\)\)?\s*\{?$/;
const JS_LOW_SIGNAL_SIMPLE_STATEMENT_REGEX = /^(?:[A-Za-z_$][A-Za-z0-9_$]*\(\);|\})$/;
const JS_LOW_SIGNAL_ASSIGNMENT_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+ = [A-Za-z_$][A-Za-z0-9_$]*;$/;
const JS_LOW_SIGNAL_HOOK_OBJECT_REGEX = /^(?:const \{|[A-Za-z_$][A-Za-z0-9_$]*:\s*\(\)\s*=>\s*\{|}\);?)$/;
const JS_LOW_SIGNAL_HOOK_DESTRUCTURE_REGEX = /^(?:const \{[^}]+} = use[A-Za-z0-9_$]+\(\{|\} = use[A-Za-z0-9_$]+\(\{)$/;
const JS_LOW_SIGNAL_GUARD_REGEX = /^(?:if \(![A-Za-z_$][A-Za-z0-9_$]*\) return false;|return true;)$/;
const JS_LOW_SIGNAL_JSX_REGEX = /^(?:\{[A-Za-z_$][A-Za-z0-9_$]*\}|<\/?[A-Za-z][^>]*>?|[A-Za-z_$][A-Za-z0-9_$-]*=.+|\/?>)$/;
const JS_LOW_SIGNAL_JSX_SCAFFOLD_REGEX = /^(?:const [A-Za-z_$][A-Za-z0-9_$]* = \(|\);|\{[^{}]+\? \(|\) : \(|\)}|<>)$/;
const JS_LOW_SIGNAL_IMPORT_EXPORT_REGEX = /^(?:import \{|import .+ from .+;|export \{|} from .+;)$/;
const JS_LOW_SIGNAL_PUNCTUATION_REGEX = /^[()[\]{};,]+$/;

const isLowSignalSnippet = (extension, snippetKey) => {
	if (extension !== '.js') return false;
	const lines = snippetKey.split('\n').map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0) return true;
	const lowSignalLineCount = lines.filter((line) => (
		JS_LOW_SIGNAL_LINE_REGEX.test(line) ||
		JS_LOW_SIGNAL_SCAFFOLD_REGEX.test(line) ||
		JS_LOW_SIGNAL_OBJECT_ARG_REGEX.test(line) ||
		JS_LOW_SIGNAL_SIMPLE_STATEMENT_REGEX.test(line) ||
		JS_LOW_SIGNAL_ASSIGNMENT_REGEX.test(line) ||
		JS_LOW_SIGNAL_HOOK_OBJECT_REGEX.test(line) ||
		JS_LOW_SIGNAL_HOOK_DESTRUCTURE_REGEX.test(line) ||
		JS_LOW_SIGNAL_GUARD_REGEX.test(line) ||
		JS_LOW_SIGNAL_JSX_REGEX.test(line) ||
		JS_LOW_SIGNAL_JSX_SCAFFOLD_REGEX.test(line) ||
		JS_LOW_SIGNAL_IMPORT_EXPORT_REGEX.test(line) ||
		JS_LOW_SIGNAL_PUNCTUATION_REGEX.test(line)
	)).length;
	// Ignore windows that are primarily prop lists / hook-helper object arguments / JSX scaffolding and carry little structural value.
	return lowSignalLineCount / lines.length >= 0.85;
};

const getFiles = () => {
	return walkFiles(SRC_DIR, hasExtension(SCAN_EXTENSIONS));
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
			filePath: relativePath(filePath),
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

	console.error(`Found ${report.length} duplicate snippet groups (cross-file).`);
	report.forEach((entry, index) => {
		const preview = entry.snippet.split('\n').slice(0, 3).join(' | ');
		console.error(`\n#${index + 1} [${entry.extension}] files=${entry.fileCount} rawOccurrences=${entry.rawOccurrenceCount}`);
		entry.locations.forEach((location) => {
			console.error(` - ${location.filePath}:${location.line}`);
		});
		console.error(` snippet: ${preview}`);
	});
};

const main = () => {
	const files = getFiles();
	const store = new Map();
	files.forEach((filePath) => scanFile(filePath, store));
	const report = buildReport(store);
	printReport(report);
	if (report.length > 0) {
		process.exit(1);
	}
};

main();
