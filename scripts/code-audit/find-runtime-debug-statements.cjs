#!/usr/bin/env node

/*
 * Fail on runtime debug statements that should not be left in app source.
 *
 * `console.warn`, `console.error`, and `console.info` are intentionally allowed:
 * the app's persistent logger captures them according to runtime log settings.
 */

const {
	fs,
	SRC_DIR,
	JS_EXTENSIONS,
	getLineNumber,
	hasExtension,
	relativePath,
	stripJsComments,
	walkFiles
} = require('../audit-utils/files.cjs');

const findings = [];
const files = walkFiles(SRC_DIR, hasExtension(JS_EXTENSIONS));
const pattern = /\b(?:console\.(?:log|debug)|debugger)\b/g;

for (const filePath of files) {
	const source = fs.readFileSync(filePath, 'utf8');
	const code = stripJsComments(source);
	for (const match of code.matchAll(pattern)) {
		findings.push({
			filePath: relativePath(filePath),
			line: getLineNumber(code, match.index),
			statement: match[0]
		});
	}
}

console.log(`Scanned ${files.length} source files for runtime debug statements.`);

if (findings.length === 0) {
	console.log('No console.log, console.debug, or debugger statements found in app source.');
	process.exit(0);
}

console.error('\nRuntime debug statements found:');
for (const finding of findings) {
	console.error(`  - ${finding.filePath}:${finding.line} -> ${finding.statement}`);
}

process.exit(1);
