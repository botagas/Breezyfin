#!/usr/bin/env node

/*
 * Enforce the Jellyfin service boundary documented in DEVELOPING.md:
 * app code should import request/API behavior through the public
 * `jellyfinService` facade. A few pure playback helpers are intentionally
 * shared with PlayerPanel code until they can be moved to a neutral namespace.
 */

const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	getLineNumber,
	hasExtension,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const ALLOWED_DIRECT_IMPORT_PATTERNS = [
	/^src\/services\/jellyfinService\.js$/,
	/^src\/services\/jellyfin\//,
	/^src\/services\/__tests__\//,
	/^src\/services\/testUtils\//
];
const ALLOWED_APP_HELPER_IMPORTS = new Set([
	'src/services/jellyfin/playbackSelection.js',
	'src/services/jellyfin/playback-api/diagnostics.js'
]);

const isAllowedDirectImporter = (relativeFilePath) => (
	ALLOWED_DIRECT_IMPORT_PATTERNS.some((pattern) => pattern.test(relativeFilePath))
);

const isForbiddenDirectImport = (resolvedImport) => (
	resolvedImport.startsWith('src/services/jellyfin/') &&
	!ALLOWED_APP_HELPER_IMPORTS.has(resolvedImport)
);

const resolveImportPath = (fromFilePath, importPath) => {
	if (!importPath.startsWith('.')) {
		return '';
	}
	const resolved = path.resolve(path.dirname(fromFilePath), importPath);
	const candidates = [
		resolved,
		`${resolved}.js`,
		`${resolved}.jsx`,
		`${resolved}.ts`,
		`${resolved}.tsx`,
		path.join(resolved, 'index.js')
	];
	const match = candidates.find((candidate) => fs.existsSync(candidate));
	return match ? relativePath(match) : relativePath(resolved);
};

const files = walkFiles(SRC_DIR, hasExtension(JS_EXTENSIONS));
const findings = [];
const importPattern = /\b(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|require\()\s*['"]([^'"]+)['"]/g;

for (const filePath of files) {
	const relative = relativePath(filePath);
	const source = fs.readFileSync(filePath, 'utf8');
	for (const match of source.matchAll(importPattern)) {
		const importPath = match[1];
		const resolvedImport = resolveImportPath(filePath, importPath);
		if (!isForbiddenDirectImport(resolvedImport)) {
			continue;
		}
		if (isAllowedDirectImporter(relative)) {
			continue;
		}
		findings.push({
			filePath: relative,
			line: getLineNumber(source, match.index),
			importPath,
			resolvedImport
		});
	}
}

console.log(`Scanned ${files.length} source files for Jellyfin service boundary violations.`);

if (findings.length === 0) {
	console.log('No direct Jellyfin API/request-module imports found outside the service layer/tests.');
	process.exit(0);
}

console.error('\nJellyfin service boundary violations:');
for (const finding of findings) {
	console.error(`  - ${finding.filePath}:${finding.line} imports ${finding.importPath} -> ${finding.resolvedImport}`);
}

process.exit(1);
