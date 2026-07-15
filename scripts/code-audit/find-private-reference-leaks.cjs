#!/usr/bin/env node

const {
	fs,
	path,
	ROOT,
	getLineColumn,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const IGNORED_DIRS = new Set(['.git', 'build', 'coverage', 'dist', 'node_modules', 'release']);
const IGNORED_FILES = new Set([
	'README.md',
	'find-private-reference-leaks.cjs',
	'package-lock.json'
]);
const TEXT_EXTENSIONS = new Set(['.cjs', '.css', '.js', '.json', '.jsx', '.less', '.md', '.txt', '.yaml', '.yml']);
const externalNames = [
	'Moon' + 'fin',
	'Ocen' + 'Fin',
	'Ocean' + 'Fin',
	'Lite' + 'fin',
	'Swift' + 'fin',
	'Abyss-' + 'Jellyfin',
	'AndroidTV-' + 'FireTV',
	'Wist' + 'oria',
	'Subs' + 'Please'
];
const externalPattern = new RegExp(`\\b(?:${externalNames.join('|')})\\b`, 'giu');

const files = walkFiles(ROOT, (filePath) => (
	!IGNORED_FILES.has(path.basename(filePath)) && TEXT_EXTENSIONS.has(path.extname(filePath))
), {ignoredDirs: IGNORED_DIRS});
const findings = [];

for (const filePath of files) {
	const source = fs.readFileSync(filePath, 'utf8');
	for (const match of source.matchAll(externalPattern)) {
		const location = getLineColumn(source, match.index);
		findings.push(`${relativePath(filePath)}:${location.line}:${location.column} unexpected external/test reference: ${match[0]}`);
	}
}

const backupFiles = walkFiles(ROOT, (filePath) => /(?:\.bak|\.orig|\.rej|~)$/u.test(path.basename(filePath)), {
	ignoredDirs: IGNORED_DIRS
});
backupFiles.forEach((filePath) => findings.push(`${relativePath(filePath)} backup/patch artifact`));

console.log(`Scanned ${files.length} repository files for private references and backup artifacts.`);
if (findings.length === 0) {
	console.log('No unexpected external-client, test-media, or backup references found.');
	process.exit(0);
}

console.error('\nPrivate-reference findings:');
findings.forEach((finding) => console.error(`  - ${finding}`));
process.exit(1);
