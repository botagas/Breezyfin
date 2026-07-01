#!/usr/bin/env node

/*
 * Conservative Markdown path-reference audit.
 *
 * The goal is to catch stale docs without flagging examples, globs, URLs, or
 * placeholder paths. Only concrete repo-local paths in Markdown links, HTML
 * src/href attributes, and inline code are checked.
 */

const {
	fs,
	path,
	ROOT,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const DOC_EXTENSIONS = new Set(['.md', '.mdx']);
const REPO_PATH_PREFIXES = ['.github/', 'docs/', 'images/', 'scripts/', 'src/'];
const ROOT_FILE_REFERENCES = new Set([
	'AGENTS.md',
	'CHECKS.md',
	'COMPONENTS.md',
	'DEVELOPING.md',
	'HELPERS.md',
	'QUALITY.md',
	'README.md',
	'THEMES.md',
	'TODOS.md',
	'VIEWS.md',
	'appinfo.json',
	'package-lock.json',
	'package.json'
]);
const IGNORED_DIRS = new Set([
	'.git',
	'build',
	'dist',
	'node_modules',
	'release'
]);

const stripBoundaryPunctuation = (value) => value
	.trim()
	.replace(/^["'(<]+/, '')
	.replace(/[)"',.;:]+$/, '');

const normalizeReference = (rawValue) => {
	let value = stripBoundaryPunctuation(String(rawValue || ''));
	if (!value || value.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
		return '';
	}

	value = value
		.replace(/^\.\/+/, '')
		.replace(/^\/+/, '')
		.split('#')[0]
		.split('?')[0];

	return stripBoundaryPunctuation(value);
};

const isConcreteRepoPath = (value) => (
	(ROOT_FILE_REFERENCES.has(value) || REPO_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))) &&
	!/[<>*]/.test(value) &&
	!value.includes('...')
);

const addReference = (references, docPath, rawValue, context) => {
	const normalized = normalizeReference(rawValue);
	if (!isConcreteRepoPath(normalized)) {
		return;
	}

	references.push({
		docPath: relativePath(docPath),
		refPath: normalized.replace(/\/+$/, ''),
		context
	});
};

const extractReferences = (docPath) => {
	const source = fs.readFileSync(docPath, 'utf8');
	const references = [];

	for (const match of source.matchAll(/\[[^\]]+]\(([^)]+)\)/g)) {
		addReference(references, docPath, match[1], 'markdown-link');
	}

	for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
		addReference(references, docPath, match[1], 'html-attribute');
	}

	for (const match of source.matchAll(/`([^`]+)`/g)) {
		for (const part of match[1].split(/,\s*/)) {
			addReference(references, docPath, part, 'inline-code');
		}
	}

	return references;
};

const docs = walkFiles(ROOT, (filePath) => DOC_EXTENSIONS.has(path.extname(filePath)), {
	ignoredDirs: IGNORED_DIRS
});
const seen = new Set();
const missing = [];
let checked = 0;

for (const docPath of docs) {
	for (const reference of extractReferences(docPath)) {
		const key = `${reference.docPath}\0${reference.refPath}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		checked += 1;

		const absoluteRefPath = path.join(ROOT, reference.refPath);
		if (!fs.existsSync(absoluteRefPath)) {
			missing.push(reference);
		}
	}
}

console.log(`Checked ${checked} concrete documentation path references across ${docs.length} Markdown files.`);

if (missing.length === 0) {
	console.log('No missing documentation path references found.');
	process.exit(0);
}

console.error('\nMissing documentation path references:');
for (const item of missing) {
	console.error(`  - ${item.docPath}: ${item.refPath} (${item.context})`);
}

process.exit(1);
