#!/usr/bin/env node

const {
	fs,
	path,
	ROOT,
	getLineColumn,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');
const {
	BACKUP_ARTIFACT_PATTERN,
	findLiteralMatches,
	parseLocalLiterals
} = require('./repository-hygiene.cjs');

const IGNORED_DIRS = new Set(['.git', 'build', 'coverage', 'dist', 'node_modules', 'release']);
const LOCAL_CONFIG_NAME = '.breezyfin-hygiene.local.json';
const IGNORED_FILES = new Set(['README.md', LOCAL_CONFIG_NAME, 'package-lock.json']);
const TEXT_EXTENSIONS = new Set([
	'.cjs',
	'.css',
	'.js',
	'.json',
	'.jsx',
	'.less',
	'.md',
	'.mjs',
	'.txt',
	'.yaml',
	'.yml'
]);

const explicitConfigPath = process.env.BREEZYFIN_HYGIENE_PATTERNS_FILE;
const localConfigPath = explicitConfigPath
	? path.resolve(explicitConfigPath)
	: path.join(ROOT, LOCAL_CONFIG_NAME);

if (explicitConfigPath && !fs.existsSync(localConfigPath)) {
	console.error(`Configured local hygiene file does not exist: ${localConfigPath}`);
	process.exit(1);
}

let localLiterals = [];
if (fs.existsSync(localConfigPath)) {
	try {
		localLiterals = parseLocalLiterals(fs.readFileSync(localConfigPath, 'utf8'), localConfigPath);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}

const files = walkFiles(ROOT, (filePath) => (
	!IGNORED_FILES.has(path.basename(filePath)) && TEXT_EXTENSIONS.has(path.extname(filePath))
), {ignoredDirs: IGNORED_DIRS});
const findings = [];

if (localLiterals.length > 0) {
	for (const filePath of files) {
		const source = fs.readFileSync(filePath, 'utf8');
		for (const match of findLiteralMatches(source, localLiterals)) {
			const location = getLineColumn(source, match.index);
			findings.push(
				`${relativePath(filePath)}:${location.line}:${location.column} local hygiene pattern ${match.patternIndex + 1}`
			);
		}
	}
}

const backupFiles = walkFiles(ROOT, (filePath) => BACKUP_ARTIFACT_PATTERN.test(path.basename(filePath)), {
	ignoredDirs: IGNORED_DIRS
});
backupFiles.forEach((filePath) => findings.push(`${relativePath(filePath)} backup/temporary artifact`));

console.log(`Scanned ${files.length} repository files for hygiene issues.`);
if (localLiterals.length > 0) {
	console.log(`Applied ${localLiterals.length} local hygiene patterns from an untracked configuration.`);
}

if (findings.length === 0) {
	console.log('No backup, temporary, or configured local-reference issues found.');
	process.exit(0);
}

console.error('\nRepository hygiene findings:');
findings.forEach((finding) => console.error(`  - ${finding}`));
process.exit(1);
