const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const STYLE_EXTENSIONS = new Set(['.css', '.less']);

const normalizePath = (value) => value.split(path.sep).join('/');
const relativePath = (absolutePath) => normalizePath(path.relative(ROOT, absolutePath));

const walkFiles = (directory, predicate, {ignoredDirs = new Set(), sort = true} = {}) => {
	if (!fs.existsSync(directory)) {
		return [];
	}

	const results = [];
	const stack = [directory];
	while (stack.length > 0) {
		const current = stack.pop();
		for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
			const resolved = path.join(current, entry.name);
			if (entry.isDirectory()) {
				if (ignoredDirs.has(entry.name)) {
					continue;
				}
				stack.push(resolved);
				continue;
			}
			if (predicate(resolved)) {
				results.push(resolved);
			}
		}
	}

	if (!sort) {
		return results;
	}
	return results.sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
};

const hasExtension = (extensions) => (filePath) => extensions.has(path.extname(filePath));

const stripBlockComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const stripStyleComments = stripBlockComments;

const stripJsComments = (source) => (
	source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1')
);

const stripJsCommentsKeepingLines = (source) => (
	source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
		.replace(/(^|[^:])\/\/.*$/gm, (match, prefix) => `${prefix}${' '.repeat(Math.max(0, match.length - prefix.length))}`)
);

const stripBlockCommentsKeepingLines = (source) => (
	source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
);

const isLocalReference = (importPath) => (
	importPath.startsWith('./') ||
	importPath.startsWith('../') ||
	importPath.startsWith('/')
);

const getResolutionCandidates = (fromFile, importPath, extensions = []) => {
	const basePath = importPath.startsWith('/')
		? path.join(ROOT, importPath.replace(/^\/+/, ''))
		: path.resolve(path.dirname(fromFile), importPath);
	const extension = path.extname(basePath);
	if (extension) {
		return [basePath];
	}
	return [
		basePath,
		...extensions.map((item) => `${basePath}${item}`)
	];
};

const resolveExistingFile = (fromFile, importPath, extensions = []) => {
	const candidates = getResolutionCandidates(fromFile, importPath, extensions);
	return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const isTestFile = (filePath) => (
	filePath.includes(`${path.sep}__tests__${path.sep}`) ||
	/\.test\.[jt]sx?$/.test(filePath) ||
	/\.spec\.[jt]sx?$/.test(filePath)
);

const getLineNumber = (source, index) => source.slice(0, index).split(/\r?\n/).length;

const getLineColumn = (source, index) => {
	const before = source.slice(0, index);
	const lines = before.split(/\r?\n/);
	return {
		line: lines.length,
		column: lines[lines.length - 1].length + 1
	};
};

const getJsImportReferences = (source, {include = () => true} = {}) => {
	const references = [];
	const lines = source.split(/\r?\n/);
	const importRegex = /\bimport(?:\s+[^'"]*?\s+from)?\s*['"]([^'"]+)['"]/g;
	const exportFromRegex = /\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g;
	const requireRegex = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
	const dynamicImportRegex = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

	lines.forEach((line, index) => {
		for (const regex of [importRegex, exportFromRegex, requireRegex, dynamicImportRegex]) {
			regex.lastIndex = 0;
			for (const match of line.matchAll(regex)) {
				const importPath = match[1];
				if (!include(importPath)) {
					continue;
				}
				references.push({
					line: index + 1,
					importPath
				});
			}
		}
	});

	return references;
};

const getStyleImportReferences = (source, {include = () => true} = {}) => {
	const references = [];
	const lines = source.split(/\r?\n/);
	const importRegex = /@import\s*(?:\([^)]*\)\s*)?["']([^"']+)["']\s*;/g;

	lines.forEach((line, index) => {
		for (const match of line.matchAll(importRegex)) {
			const importPath = match[1];
			if (!include(importPath)) {
				continue;
			}
			references.push({
				line: index + 1,
				importPath
			});
		}
	});

	return references;
};

module.exports = {
	fs,
	path,
	ROOT,
	SRC_DIR,
	JS_EXTENSIONS,
	STYLE_EXTENSIONS,
	getLineColumn,
	getLineNumber,
	getResolutionCandidates,
	getJsImportReferences,
	getStyleImportReferences,
	hasExtension,
	isLocalReference,
	isTestFile,
	normalizePath,
	relativePath,
	resolveExistingFile,
	stripBlockComments,
	stripBlockCommentsKeepingLines,
	stripJsComments,
	stripJsCommentsKeepingLines,
	stripStyleComments,
	walkFiles
};
