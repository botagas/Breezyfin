#!/usr/bin/env node

/*
 * Verify that local LESS/CSS @import references resolve. This catches stale
 * split-style paths before a package build is needed.
 */

const {
	fs,
	SRC_DIR,
	STYLE_EXTENSIONS,
	getResolutionCandidates,
	getStyleImportReferences,
	hasExtension,
	isLocalReference,
	relativePath,
	stripStyleComments,
	walkFiles
} = require('../audit-utils/files.cjs');

const getImportReferences = (filePath) => {
	const source = stripStyleComments(fs.readFileSync(filePath, 'utf8'));
	return getStyleImportReferences(source, {
		include: isLocalReference
	}).map((reference) => ({
		filePath,
		...reference
	}));
};

const styleFiles = walkFiles(SRC_DIR, hasExtension(STYLE_EXTENSIONS));
const missing = [];
let checked = 0;

for (const filePath of styleFiles) {
	for (const reference of getImportReferences(filePath)) {
		checked += 1;
		const candidates = getResolutionCandidates(reference.filePath, reference.importPath, ['.less', '.css']);
		if (candidates.some((candidate) => fs.existsSync(candidate))) {
			continue;
		}
		missing.push(reference);
	}
}

console.log(`Checked ${checked} local style @import references across ${styleFiles.length} style files.`);

if (missing.length === 0) {
	console.log('No missing local style imports found.');
	process.exit(0);
}

console.error('\nMissing local style imports:');
for (const item of missing) {
	console.error(`  - ${relativePath(item.filePath)}:${item.line} -> ${item.importPath}`);
}

process.exit(1);
