#!/usr/bin/env node

const {
	fs,
	path,
	SRC_DIR,
	JS_EXTENSIONS,
	hasExtension,
	relativePath,
	stripBlockComments,
	walkFiles
} = require('../audit-utils/files.cjs');
const LESS_MODULE_SUFFIX = '.module.less';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripGlobalScopes = (source) => source.replace(/:global\([^)]*\)/g, '');

const parseImportedModuleAliases = (source) => {
	const imports = [];
	const importRegex = /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+\.module\.less)['"]/g;
	for (const match of source.matchAll(importRegex)) {
		imports.push({
			alias: match[1],
			importPath: match[2]
		});
	}
	return imports;
};

const parseLessImports = (source) => {
	const imports = [];
	const importRegex = /@import\s*(?:\([^)]*\)\s*)?['"]([^'"]+)['"]\s*;/g;
	for (const match of source.matchAll(importRegex)) {
		imports.push(match[1]);
	}
	return imports;
};

const parseDefinedClasses = (source) => {
	const classes = new Set();
	const moduleScopedSource = stripGlobalScopes(source);
	// CSS module selectors can be chained/pseudo-only in LESS. Exclude mixin
	// definitions that use `.name(...)`, and strip :global(...) first so
	// Sandstone/global classes are not mistaken for module-local exports.
	const selectorRegex = /(^|[\s,>+~&])\.([A-Za-z_][A-Za-z0-9_-]*)(?![A-Za-z0-9_-])(?!(?:\s*\())/gm;
	for (const match of moduleScopedSource.matchAll(selectorRegex)) {
		classes.add(match[2]);
	}
	return classes;
};

const parseUsedClassesForAlias = (source, alias) => {
	const used = new Set();
	const safeAlias = escapeRegExp(alias);
	const dotRegex = new RegExp(`${safeAlias}\\.([A-Za-z0-9_-]+)`, 'g');
	const bracketRegex = new RegExp(`${safeAlias}\\[['"]([A-Za-z0-9_-]+)['"]\\]`, 'g');
	for (const match of source.matchAll(dotRegex)) {
		used.add(match[1]);
	}
	for (const match of source.matchAll(bracketRegex)) {
		used.add(match[1]);
	}
	return used;
};

const hasForwardedCssAlias = (source, alias) => {
	const safeAlias = escapeRegExp(alias);
	const forwardedCssPropRegex = new RegExp(`\\bcss\\s*=\\s*{\\s*${safeAlias}\\s*}`);
	return forwardedCssPropRegex.test(source);
};

const resolveLessFile = (importerFile, importPath) => {
	const resolved = path.resolve(path.dirname(importerFile), importPath);
	if (fs.existsSync(resolved)) return resolved;
	if (fs.existsSync(`${resolved}.less`)) return `${resolved}.less`;
	return null;
};

const collectLessGraph = (entryFile) => {
	const visited = new Set();
	const perFileClassMap = new Map();
	const stack = [entryFile];

	while (stack.length > 0) {
		const current = stack.pop();
		if (visited.has(current)) continue;
		visited.add(current);
		if (!fs.existsSync(current)) continue;

		const rawSource = fs.readFileSync(current, 'utf8');
		const source = stripBlockComments(rawSource);
		perFileClassMap.set(current, parseDefinedClasses(source));

		const imports = parseLessImports(source);
		imports.forEach((importPath) => {
			const resolved = resolveLessFile(current, importPath);
			if (!resolved) return;
			stack.push(resolved);
		});
	}

	return perFileClassMap;
};

const jsFiles = walkFiles(
	SRC_DIR,
	hasExtension(JS_EXTENSIONS)
);

const moduleLessFiles = walkFiles(
	SRC_DIR,
	(filePath) => filePath.endsWith(LESS_MODULE_SUFFIX)
);

const moduleImportUsage = new Map();

for (const jsFile of jsFiles) {
	const source = stripBlockComments(fs.readFileSync(jsFile, 'utf8'));
	const imports = parseImportedModuleAliases(source);
	if (imports.length === 0) continue;
	for (const imported of imports) {
		const resolvedModule = path.resolve(path.dirname(jsFile), imported.importPath);
		if (!fs.existsSync(resolvedModule)) continue;
		const usedClasses = parseUsedClassesForAlias(source, imported.alias);
		if (!moduleImportUsage.has(resolvedModule)) {
			moduleImportUsage.set(resolvedModule, {
				importers: new Set(),
				usedClasses: new Set(),
				forwardedCssAlias: false
			});
		}
		const usage = moduleImportUsage.get(resolvedModule);
		usage.importers.add(jsFile);
		usage.forwardedCssAlias = usage.forwardedCssAlias || hasForwardedCssAlias(source, imported.alias);
		usedClasses.forEach((className) => usage.usedClasses.add(className));
	}
}

const report = [];

for (const moduleFile of moduleLessFiles) {
	const usage = moduleImportUsage.get(moduleFile) || {
		importers: new Set(),
		usedClasses: new Set(),
		forwardedCssAlias: false
	};
	if (usage.forwardedCssAlias) continue;
	const classMap = collectLessGraph(moduleFile);
	const allDefinedClasses = new Set();
	for (const classes of classMap.values()) {
		classes.forEach((className) => allDefinedClasses.add(className));
	}
	const deadClasses = [...allDefinedClasses].filter((className) => !usage.usedClasses.has(className)).sort();
	if (deadClasses.length === 0) continue;

	const deadClassDefinitions = [];
	for (const [filePath, classes] of classMap.entries()) {
		for (const className of deadClasses) {
			if (classes.has(className)) {
				deadClassDefinitions.push({
					file: filePath,
					className
				});
			}
		}
	}

	report.push({
		moduleFile,
		importerCount: usage.importers.size,
		definitionCount: allDefinedClasses.size,
		usedCount: usage.usedClasses.size,
		deadCount: deadClasses.length,
		deadClasses,
		deadClassDefinitions
	});
}

report.sort((a, b) => b.deadCount - a.deadCount || a.moduleFile.localeCompare(b.moduleFile));

if (report.length === 0) {
	console.log('No dead CSS module classes found.');
	process.exit(0);
}

console.log(`Dead CSS module candidates: ${report.length} module files\n`);

for (const entry of report) {
	console.log(`${relativePath(entry.moduleFile)} (dead ${entry.deadCount}/${entry.definitionCount}, used refs ${entry.usedCount}, importers ${entry.importerCount})`);
	const deadByFile = new Map();
	entry.deadClassDefinitions.forEach(({file, className}) => {
		const key = relativePath(file);
		if (!deadByFile.has(key)) deadByFile.set(key, []);
		deadByFile.get(key).push(className);
	});
	for (const [file, classNames] of [...deadByFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		const uniqueNames = [...new Set(classNames)].sort();
		console.log(`  - ${file}: ${uniqueNames.join(', ')}`);
	}
	console.log('');
}
