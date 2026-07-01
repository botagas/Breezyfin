#!/usr/bin/env node

/*
 * Verify that CSS custom property references resolve to declarations in the
 * source style corpus, have an explicit fallback, or are intentionally injected
 * at runtime by React inline styles.
 */

const {
	fs,
	SRC_DIR,
	STYLE_EXTENSIONS,
	getLineColumn,
	hasExtension,
	relativePath,
	stripBlockCommentsKeepingLines,
	walkFiles
} = require('../audit-utils/files.cjs');

const RUNTIME_STYLE_VARS = new Set([
	'--bf-player-subtitle-absolute-x',
	'--bf-player-subtitle-absolute-y'
]);

const findVarExpressionEnd = (source, startIndex) => {
	let depth = 0;
	for (let index = startIndex; index < source.length; index += 1) {
		const char = source[index];
		if (char === '(') {
			depth += 1;
			continue;
		}
		if (char === ')') {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return -1;
};

const hasTopLevelFallback = (expression) => {
	let depth = 0;
	for (let index = 0; index < expression.length; index += 1) {
		const char = expression[index];
		if (char === '(') {
			depth += 1;
			continue;
		}
		if (char === ')') {
			depth = Math.max(0, depth - 1);
			continue;
		}
		if (char === ',' && depth === 0) return true;
	}
	return false;
};

const collectDeclarations = (source) => {
	const declarations = new Set();
	const declarationRegex = /(^|[\s;{])(--[A-Za-z0-9_-]+)\s*:/gm;
	for (const match of source.matchAll(declarationRegex)) {
		declarations.add(match[2]);
	}
	return declarations;
};

const collectReferences = (source) => {
	const foundReferences = [];
	const referenceRegex = /var\(\s*(--[A-Za-z0-9_-]+)/g;
	for (const match of source.matchAll(referenceRegex)) {
		const expressionEnd = findVarExpressionEnd(source, match.index + 3);
		const expression = expressionEnd >= 0
			? source.slice(match.index + 4, expressionEnd)
			: '';
		foundReferences.push({
			name: match[1],
			index: match.index,
			hasFallback: hasTopLevelFallback(expression)
		});
	}
	return foundReferences;
};

const styleFiles = walkFiles(SRC_DIR, hasExtension(STYLE_EXTENSIONS));

const declaredVars = new Set();
const references = [];

for (const filePath of styleFiles) {
	const source = stripBlockCommentsKeepingLines(fs.readFileSync(filePath, 'utf8'));
	for (const name of collectDeclarations(source)) {
		declaredVars.add(name);
	}
	for (const reference of collectReferences(source)) {
		const location = getLineColumn(source, reference.index);
		references.push({
			filePath: relativePath(filePath),
			line: location.line,
			column: location.column,
			...reference
		});
	}
}

const unresolved = references.filter((reference) => (
	!declaredVars.has(reference.name) &&
	!reference.hasFallback &&
	!RUNTIME_STYLE_VARS.has(reference.name)
));

const uniqueUnresolved = [...new Map(
	unresolved.map((reference) => [`${reference.name}\0${reference.filePath}`, reference])
).values()].sort((a, b) => (
	a.name.localeCompare(b.name) ||
	a.filePath.localeCompare(b.filePath) ||
	a.line - b.line
));

console.log(`Checked ${references.length} CSS custom property references across ${styleFiles.length} style files.`);
console.log(`Declared CSS custom properties: ${declaredVars.size}. Runtime-injected allowlist: ${RUNTIME_STYLE_VARS.size}.`);

if (uniqueUnresolved.length === 0) {
	console.log('No unresolved CSS custom property references found.');
	process.exit(0);
}

console.error('\nUnresolved CSS custom property references:');
for (const reference of uniqueUnresolved) {
	console.error(`  - ${reference.filePath}:${reference.line}:${reference.column} -> ${reference.name}`);
}
console.error('\nDeclare the token, add an explicit var() fallback, or add a narrow runtime-variable allowlist entry with justification.');

process.exit(1);
