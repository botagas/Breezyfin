#!/usr/bin/env node

/*
 * Verify that CSS/LESS files under src are reachable from production JS/JSX
 * style entrypoints and nested local style @imports. This catches orphaned
 * split-style files that still exist on disk but are no longer bundled.
 */

const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	STYLE_EXTENSIONS,
	getJsImportReferences,
	getResolutionCandidates,
	getStyleImportReferences: parseStyleImportReferences,
	hasExtension,
	isLocalReference,
	normalizePath,
	relativePath,
	stripJsCommentsKeepingLines,
	stripStyleComments,
	walkFiles
} = require('../audit-utils/files.cjs');

const resolveStyleFile = (fromFile, importPath) => {
	if (!isLocalReference(importPath)) {
		return null;
	}
	const candidates = getResolutionCandidates(fromFile, importPath, ['.less', '.css']);
	return candidates.find((candidate) => STYLE_EXTENSIONS.has(path.extname(candidate)) && fs.existsSync(candidate)) || null;
};

const isProductionSourceFile = (filePath) => {
	const extension = path.extname(filePath);
	if (!JS_EXTENSIONS.has(extension)) {
		return false;
	}
	const normalized = normalizePath(filePath);
	return (
		!normalized.includes('/__tests__/') &&
		!/\.test\.[jt]sx?$/.test(normalized) &&
		!/\.spec\.[jt]sx?$/.test(normalized)
	);
};

const getJsStyleReferences = (filePath) => {
	const source = stripJsCommentsKeepingLines(fs.readFileSync(filePath, 'utf8'));
	return getJsImportReferences(source)
		.map((reference) => ({
			filePath,
			...reference,
			resolved: resolveStyleFile(filePath, reference.importPath)
		}))
		.filter((reference) => reference.resolved);
};

const getStyleImportReferences = (filePath) => {
	const source = stripStyleComments(fs.readFileSync(filePath, 'utf8'));
	return parseStyleImportReferences(source, {
		include: isLocalReference
	}).map((reference) => ({
		filePath,
		...reference,
		resolved: resolveStyleFile(filePath, reference.importPath)
	}));
};

const styleFiles = walkFiles(SRC_DIR, hasExtension(STYLE_EXTENSIONS));
const sourceFiles = walkFiles(SRC_DIR, isProductionSourceFile);

const allStyles = new Set(styleFiles);
const reachable = new Set();
const roots = [];
const unresolved = [];

for (const filePath of sourceFiles) {
	for (const reference of getJsStyleReferences(filePath)) {
		roots.push(reference.resolved);
	}
}

const queue = Array.from(new Set(roots));
while (queue.length > 0) {
	const current = queue.shift();
	if (reachable.has(current)) {
		continue;
	}
	reachable.add(current);

	for (const reference of getStyleImportReferences(current)) {
		if (!reference.resolved) {
			unresolved.push(reference);
			continue;
		}
		if (!reachable.has(reference.resolved)) {
			queue.push(reference.resolved);
		}
	}
}

const orphaned = Array.from(allStyles)
	.filter((filePath) => !reachable.has(filePath))
	.sort((a, b) => relativePath(a).localeCompare(relativePath(b)));

console.log(`Checked ${styleFiles.length} style files from ${roots.length} production JS style entrypoints.`);
console.log(`Reachable style files: ${reachable.size}.`);

let hasFailure = false;

if (unresolved.length > 0) {
	hasFailure = true;
	console.error('\nUnresolved local style imports encountered while walking reachable styles:');
	for (const item of unresolved) {
		console.error(`  - ${relativePath(item.filePath)}:${item.line} -> ${item.importPath}`);
	}
}

if (orphaned.length > 0) {
	hasFailure = true;
	console.error('\nOrphaned local style files not reachable from production JS style entrypoints:');
	for (const filePath of orphaned) {
		console.error(`  - ${relativePath(filePath)}`);
	}
}

if (!hasFailure) {
	console.log('No orphaned local style files found.');
	process.exit(0);
}

process.exit(1);
