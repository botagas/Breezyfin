#!/usr/bin/env node

/*
 * Verify source-local file paths referenced by package scripts and GitHub
 * workflow commands. This catches stale `scripts/...` / root metadata paths
 * that are not covered by the `npm run <script>` reference audit.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_PATH_PREFIXES = ['.github/', 'images/', 'scripts/', 'src/'];
const ROOT_FILE_REFERENCES = new Set([
	'appinfo.json',
	'icon.png',
	'package-lock.json',
	'package.json'
]);
const GENERATED_PATH_PREFIXES = ['build/', 'dist/', 'release/'];

const normalizePath = (value) => value.split(path.sep).join('/');
const relativePath = (absolutePath) => normalizePath(path.relative(ROOT, absolutePath));

const workflowDir = path.join(ROOT, '.github', 'workflows');
const scanFiles = [
	path.join(ROOT, 'package.json')
];

if (fs.existsSync(workflowDir)) {
	for (const entry of fs.readdirSync(workflowDir, {withFileTypes: true})) {
		if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
			scanFiles.push(path.join(workflowDir, entry.name));
		}
	}
}

const stripBoundaryPunctuation = (value) => value
	.trim()
	.replace(/^["'(<[{]+/, '')
	.replace(/[\\)"',.;:>\]}]+$/, '');

const normalizeCandidate = (rawValue) => {
	let value = stripBoundaryPunctuation(String(rawValue || ''));
	if (!value || value.includes('://') || value.includes('${{') || value.includes('*')) {
		return '';
	}

	value = value
		.replace(/^\.\/+/, '')
		.replace(/^\/+/, '')
		.split('#')[0]
		.split('?')[0];

	return stripBoundaryPunctuation(value);
};

const isGeneratedPath = (value) => (
	GENERATED_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))
);

const isSourceLocalReference = (value) => (
	!isGeneratedPath(value) &&
	!/[<>]/.test(value) &&
	(ROOT_FILE_REFERENCES.has(value) || SOURCE_PATH_PREFIXES.some((prefix) => value.startsWith(prefix)))
);

const extractReferences = (filePath) => {
	const source = fs.readFileSync(filePath, 'utf8');
	const references = [];
	const lines = source.split(/\r?\n/);

	lines.forEach((line, index) => {
		for (const rawToken of line.split(/\s+/)) {
			const candidate = normalizeCandidate(rawToken);
			if (!isSourceLocalReference(candidate)) {
				continue;
			}

			references.push({
				filePath: relativePath(filePath),
				line: index + 1,
				refPath: candidate
			});
		}
	});

	return references;
};

const seen = new Set();
const missing = [];
let checked = 0;

for (const filePath of scanFiles.sort((a, b) => relativePath(a).localeCompare(relativePath(b)))) {
	for (const reference of extractReferences(filePath)) {
		const key = `${reference.filePath}\0${reference.line}\0${reference.refPath}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		checked += 1;

		if (!fs.existsSync(path.join(ROOT, reference.refPath))) {
			missing.push(reference);
		}
	}
}

console.log(`Checked ${checked} source-local command path references across ${scanFiles.length} package/workflow files.`);

if (missing.length === 0) {
	console.log('No missing source-local command path references found.');
	process.exit(0);
}

console.error('\nMissing source-local command path references:');
for (const item of missing) {
	console.error(`  - ${item.filePath}:${item.line} -> ${item.refPath}`);
}

process.exit(1);
