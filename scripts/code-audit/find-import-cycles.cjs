#!/usr/bin/env node

/*
 * Detect circular imports in production app source. Package imports, style
 * imports, and test files are intentionally ignored so this stays focused on
 * runtime module-order risks.
 */

const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	getJsImportReferences,
	hasExtension,
	isTestFile,
	relativePath,
	resolveExistingFile,
	stripJsComments,
	walkFiles
} = require('../audit-utils/files.cjs');
const MAX_REPORTED_CYCLES = 40;

const JS_EXTENSION_LIST = [...JS_EXTENSIONS];
const isJsFile = hasExtension(JS_EXTENSIONS);

const resolveLocalJsImport = (fromFile, importPath) => {
	if (!importPath.startsWith('.')) {
		return '';
	}

	const resolved = path.resolve(path.dirname(fromFile), importPath);
	const explicitExtension = path.extname(resolved);
	if (explicitExtension && !JS_EXTENSIONS.has(explicitExtension)) {
		return '';
	}

	const directMatch = resolveExistingFile(fromFile, importPath, JS_EXTENSION_LIST);
	if (directMatch && isJsFile(directMatch)) {
		return relativePath(directMatch);
	}
	if (explicitExtension) {
		return '';
	}
	const indexMatch = JS_EXTENSION_LIST
		.map((extension) => path.join(resolved, `index${extension}`))
		.find((candidate) => fs.existsSync(candidate));

	return indexMatch ? relativePath(indexMatch) : '';
};

const canonicalCycleKey = (cycle) => {
	const cycleWithoutDuplicateEnd = cycle.slice(0, -1);
	const rotations = cycleWithoutDuplicateEnd.map((_, index) => [
		...cycleWithoutDuplicateEnd.slice(index),
		...cycleWithoutDuplicateEnd.slice(0, index)
	]);
	const reversed = [...cycleWithoutDuplicateEnd].reverse();
	const reverseRotations = reversed.map((_, index) => [
		...reversed.slice(index),
		...reversed.slice(0, index)
	]);
	return [...rotations, ...reverseRotations]
		.map((entry) => entry.join(' -> '))
		.sort((a, b) => a.localeCompare(b))[0];
};

const sourceFiles = walkFiles(SRC_DIR, (filePath) => isJsFile(filePath) && !isTestFile(filePath));
const sourceFileSet = new Set(sourceFiles.map(relativePath));
const graph = new Map();

for (const filePath of sourceFiles) {
	const relative = relativePath(filePath);
	const source = stripJsComments(fs.readFileSync(filePath, 'utf8'));
	const dependencyPaths = getJsImportReferences(source)
		.map((reference) => reference.importPath)
		.map((importPath) => resolveLocalJsImport(filePath, importPath))
		.filter((resolvedImport) => resolvedImport && sourceFileSet.has(resolvedImport));
	const dependencies = [...new Set(dependencyPaths)].sort((a, b) => a.localeCompare(b));
	graph.set(relative, dependencies);
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const seenCycles = new Set();
const cycles = [];

const visit = (node) => {
	if (visited.has(node)) {
		return;
	}
	if (visiting.has(node)) {
		const startIndex = stack.indexOf(node);
		if (startIndex === -1) {
			return;
		}
		const cycle = [...stack.slice(startIndex), node];
		const key = canonicalCycleKey(cycle);
		if (!seenCycles.has(key)) {
			seenCycles.add(key);
			cycles.push(cycle);
		}
		return;
	}

	visiting.add(node);
	stack.push(node);
	for (const dependency of graph.get(node) || []) {
		visit(dependency);
	}
	stack.pop();
	visiting.delete(node);
	visited.add(node);
};

for (const node of [...graph.keys()].sort((a, b) => a.localeCompare(b))) {
	visit(node);
}

console.log(`Scanned ${sourceFiles.length} production source files for local import cycles.`);

if (cycles.length === 0) {
	console.log('No local production import cycles found.');
	process.exit(0);
}

console.error(`\nLocal production import cycles found: ${cycles.length}`);
for (const cycle of cycles.slice(0, MAX_REPORTED_CYCLES)) {
	console.error(`  - ${cycle.join(' -> ')}`);
}
if (cycles.length > MAX_REPORTED_CYCLES) {
	console.error(`  ... and ${cycles.length - MAX_REPORTED_CYCLES} more`);
}

process.exit(1);
