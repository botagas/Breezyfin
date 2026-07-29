#!/usr/bin/env node

/*
 * Conservative portability/privacy audit for repository text.
 *
 * This intentionally avoids broad `/Users/...` matching because Jellyfin API
 * routes use `/Users/{id}`. It focuses on generic local filesystem path shapes
 * and unredacted credential literals. Project-specific checks belong in the
 * ignored local repository-hygiene configuration.
 */

const {
	fs,
	path,
	ROOT,
	getLineColumn,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const IGNORED_DIRS = new Set([
	'.git',
	'.venv',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'release'
]);
const IGNORED_FILES = new Set([
	'package-lock.json'
]);
const TEXT_EXTENSIONS = new Set([
	'.cjs',
	'.css',
	'.html',
	'.js',
	'.json',
	'.jsx',
	'.less',
	'.md',
	'.mdx',
	'.mjs',
	'.py',
	'.sh',
	'.ts',
	'.tsx',
	'.txt',
	'.yaml',
	'.yml'
]);

const CHECKS = [
	{
		name: 'macOS user home path',
		pattern: /(?:file:\/\/)?\/Users\/[^/\s"'`]+\/(?:Applications|Desktop|Documents|Downloads|Library|Movies|Music|Pictures|Projects|Public|Sites)\b/gi
	},
	{
		name: 'Linux user home path',
		pattern: /(?:file:\/\/)?\/home\/[^/\s"'`]+\/(?:Desktop|Documents|Downloads|Projects|Public|Videos|work|workspace)\b/gi
	},
	{
		name: 'macOS private temp path',
		pattern: /\/private\/var\/folders\/[^\s"'`]+/gi
	},
	{
		name: 'Windows user home path',
		pattern: /[A-Z]:\\Users\\[^\\\s"'`]+\\/g
	},
	{
		name: 'unredacted bearer token literal',
		pattern: /\bBearer\s+(?!\[REDACTED])(?:[A-Za-z0-9._~+/=-]{24,})\b/g
	},
	{
		name: 'unredacted query token value',
		pattern: /[?&](?:api_key|access_token|token)=(?!\[REDACTED])[^&#\s"'`]{16,}/gi
	}
];

const files = walkFiles(ROOT, (filePath) => {
	const relative = relativePath(filePath);
	return !IGNORED_FILES.has(path.basename(relative)) && TEXT_EXTENSIONS.has(path.extname(filePath));
}, {ignoredDirs: IGNORED_DIRS});

const findings = [];

for (const filePath of files) {
	const source = fs.readFileSync(filePath, 'utf8');
	const relative = relativePath(filePath);
	for (const check of CHECKS) {
		check.pattern.lastIndex = 0;
		for (const match of source.matchAll(check.pattern)) {
			const location = getLineColumn(source, match.index);
			findings.push({
				filePath: relative,
				line: location.line,
				column: location.column,
				name: check.name,
				value: match[0]
			});
		}
	}
}

console.log(`Scanned ${files.length} repository text files for portability/privacy leaks.`);

if (findings.length === 0) {
	console.log('No machine-specific paths or unredacted token literals found.');
	process.exit(0);
}

console.error('\nPortability/privacy findings:');
for (const finding of findings) {
	console.error(`  - ${finding.filePath}:${finding.line}:${finding.column} [${finding.name}] ${finding.value}`);
}

process.exit(1);
