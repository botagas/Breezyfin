#!/usr/bin/env node

/*
 * Verify that local CSS/LESS files imported directly from JS/JSX resolve.
 * `audit:style-imports` covers style-to-style @imports; this covers style
 * entrypoints consumed by React components and app bootstrap files.
 */

const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	STYLE_EXTENSIONS,
	getJsImportReferences,
	getResolutionCandidates,
	hasExtension,
	isLocalReference,
	relativePath,
	stripJsCommentsKeepingLines,
	walkFiles
} = require('../audit-utils/files.cjs');

const hasStyleExtension = (importPath) => (
	STYLE_EXTENSIONS.has(path.extname(importPath))
);

const getStyleImportReferences = (filePath) => {
	const source = stripJsCommentsKeepingLines(fs.readFileSync(filePath, 'utf8'));
	return getJsImportReferences(source, {
		include: (importPath) => isLocalReference(importPath) && hasStyleExtension(importPath)
	}).map((reference) => ({
		filePath,
		...reference
	}));
};

const sourceFiles = walkFiles(SRC_DIR, hasExtension(JS_EXTENSIONS));

const missing = [];
let checked = 0;

for (const filePath of sourceFiles) {
	for (const reference of getStyleImportReferences(filePath)) {
		checked += 1;
		const candidates = getResolutionCandidates(reference.filePath, reference.importPath, ['.less', '.css']);
		if (candidates.some((candidate) => fs.existsSync(candidate))) {
			continue;
		}
		missing.push(reference);
	}
}

console.log(`Checked ${checked} local JS style imports across ${sourceFiles.length} source files.`);

if (missing.length === 0) {
	console.log('No missing local JS style imports found.');
	process.exit(0);
}

console.error('\nMissing local JS style imports:');
for (const item of missing) {
	console.error(`  - ${relativePath(item.filePath)}:${item.line} -> ${item.importPath}`);
}

process.exit(1);
