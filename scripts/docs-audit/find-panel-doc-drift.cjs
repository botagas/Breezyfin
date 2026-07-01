#!/usr/bin/env node

/*
 * Verify that decomposed panel directories stay documented in the view and
 * developer architecture guides.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const VIEWS_DIR = path.join(ROOT, 'src', 'views');
const REQUIRED_DOCS = [
	'VIEWS.md',
	'DEVELOPING.md'
];
const DECOMPOSITION_SUBDIRS = new Set([
	'components',
	'hooks',
	'utils'
]);

const normalizePath = (value) => value.split(path.sep).join('/');
const relativePath = (absolutePath) => normalizePath(path.relative(ROOT, absolutePath));

const hasFiles = (directory) => {
	if (!fs.existsSync(directory)) {
		return false;
	}
	const stack = [directory];
	while (stack.length > 0) {
		const current = stack.pop();
		for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
			const resolved = path.join(current, entry.name);
			if (entry.isFile()) {
				return true;
			}
			if (entry.isDirectory()) {
				stack.push(resolved);
			}
		}
	}
	return false;
};

const getPanelDecompositionDirs = () => {
	if (!fs.existsSync(VIEWS_DIR)) {
		return [];
	}

	return fs.readdirSync(VIEWS_DIR, {withFileTypes: true})
		.filter((entry) => entry.isDirectory())
		.filter((entry) => entry.name.endsWith('-panel'))
		.map((entry) => path.join(VIEWS_DIR, entry.name))
		.filter((panelDir) => (
			fs.readdirSync(panelDir, {withFileTypes: true}).some((entry) => (
				entry.isDirectory() &&
				DECOMPOSITION_SUBDIRS.has(entry.name) &&
				hasFiles(path.join(panelDir, entry.name))
			))
		))
		.map(relativePath)
		.sort((a, b) => a.localeCompare(b));
};

const panelDirs = getPanelDecompositionDirs();
const missing = [];

for (const docFile of REQUIRED_DOCS) {
	const docPath = path.join(ROOT, docFile);
	const source = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
	for (const panelDir of panelDirs) {
		const normalizedPanelDir = `${panelDir}/`;
		if (!source.includes(normalizedPanelDir)) {
			missing.push({
				docFile,
				panelDir: normalizedPanelDir
			});
		}
	}
}

console.log(`Checked ${panelDirs.length} decomposed panel directories across ${REQUIRED_DOCS.length} docs.`);

if (missing.length === 0) {
	console.log('No panel documentation drift found.');
	process.exit(0);
}

console.error('\nPanel decompositions missing from docs:');
for (const item of missing) {
	console.error(`  - ${item.docFile}: ${item.panelDir}`);
}

process.exit(1);
