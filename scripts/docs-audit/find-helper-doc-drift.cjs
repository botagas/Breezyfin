#!/usr/bin/env node

/*
 * Verify that shared and panel-local hook files stay discoverable from the
 * helper/developer docs. This intentionally checks file paths, not prose
 * completeness, so docs can choose the right level of detail per hook.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REQUIRED_DOCS = [
	'HELPERS.md',
	'DEVELOPING.md'
];

const normalizePath = (value) => value.split(path.sep).join('/');
const relativePath = (absolutePath) => normalizePath(path.relative(ROOT, absolutePath));

const listHookDirs = () => {
	const dirs = [
		path.join(ROOT, 'src', 'hooks'),
		path.join(ROOT, 'src', 'App', 'hooks')
	];
	const viewsDir = path.join(ROOT, 'src', 'views');
	if (fs.existsSync(viewsDir)) {
		for (const entry of fs.readdirSync(viewsDir, {withFileTypes: true})) {
			if (!entry.isDirectory() || !entry.name.endsWith('-panel')) continue;
			dirs.push(path.join(viewsDir, entry.name, 'hooks'));
		}
	}
	return dirs.filter((dir) => fs.existsSync(dir));
};

const listHookFiles = () => (
	listHookDirs()
		.flatMap((dir) => (
			fs.readdirSync(dir, {withFileTypes: true})
				.filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
				.map((entry) => path.join(dir, entry.name))
		))
		.map(relativePath)
		.sort((a, b) => a.localeCompare(b))
);

const docsSource = REQUIRED_DOCS
	.map((docFile) => {
		const docPath = path.join(ROOT, docFile);
		return fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
	})
	.join('\n');

const hookFiles = listHookFiles();
const missing = hookFiles.filter((hookPath) => !docsSource.includes(hookPath));

console.log(`Checked ${hookFiles.length} hook files across ${REQUIRED_DOCS.length} docs.`);

if (missing.length === 0) {
	console.log('No hook helper/developer documentation drift found.');
	process.exit(0);
}

console.error('\nHook files missing from helper/developer docs:');
for (const hookPath of missing) {
	console.error(`  - ${hookPath}`);
}

process.exit(1);
