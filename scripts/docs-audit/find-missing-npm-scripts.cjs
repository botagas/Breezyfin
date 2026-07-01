#!/usr/bin/env node

/*
 * Verify that documented and workflow-referenced `npm run <script>` commands
 * still point at scripts that exist in package.json.
 */

const {
	fs,
	path,
	ROOT,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const SCAN_EXTENSIONS = new Set(['.json', '.md', '.mdx', '.yml', '.yaml']);
const IGNORED_DIRS = new Set([
	'.git',
	'build',
	'dist',
	'node_modules',
	'release'
]);

const packageJsonPath = path.join(ROOT, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scriptNames = new Set(Object.keys(packageJson.scripts || {}));

const files = walkFiles(ROOT, (filePath) => {
	const relative = relativePath(filePath);
	if (!SCAN_EXTENSIONS.has(path.extname(filePath))) {
		return false;
	}
	return (
		relative === 'package.json' ||
		relative.startsWith('.github/') ||
		relative.startsWith('docs/') ||
		!relative.includes('/')
	);
}, {ignoredDirs: IGNORED_DIRS});

const references = [];

for (const filePath of files) {
	const relative = relativePath(filePath);
	const source = fs.readFileSync(filePath, 'utf8');
	const lines = source.split(/\r?\n/);
	lines.forEach((line, index) => {
		for (const match of line.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)) {
			references.push({
				filePath: relative,
				line: index + 1,
				scriptName: match[1]
			});
		}
	});
}

const missing = references.filter(({scriptName}) => !scriptNames.has(scriptName));

console.log(`Checked ${references.length} npm script references across ${files.length} docs/workflow files.`);

if (missing.length === 0) {
	console.log('No missing npm script references found.');
	process.exit(0);
}

console.error('\nMissing npm script references:');
for (const item of missing) {
	console.error(`  - ${item.filePath}:${item.line} -> npm run ${item.scriptName}`);
}

process.exit(1);
