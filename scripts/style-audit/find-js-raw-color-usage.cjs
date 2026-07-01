#!/usr/bin/env node

/*
 * Conservative raw-color audit for JavaScript/TypeScript source.
 *
 * CSS/LESS raw colors are handled by audit:style-tokens. This audit covers
 * component/service code so token drift does not hide in inline styles.
 */

const {
	fs,
	SRC_DIR,
	JS_EXTENSIONS,
	getLineColumn,
	hasExtension,
	isTestFile,
	relativePath,
	stripJsComments,
	walkFiles
} = require('../audit-utils/files.cjs');

const MAX_FINDINGS = 80;
const ALLOWED_DYNAMIC_COLOR_FILES = new Set([
	'src/views/player-panel/utils/subtitleRenderer.js',
	'src/views/player-panel/utils/subtitleRendererAssColors.js',
	'src/views/player-panel/utils/subtitleRendererAssTransform.js'
]);

const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|(?:rgba?|hsla?)\((?:[^()'"]|'[^']*'|"[^"]*")*?\)/g;

const files = walkFiles(SRC_DIR, hasExtension(JS_EXTENSIONS));
const findings = [];
let allowedFindings = 0;

for (const filePath of files) {
	if (isTestFile(filePath)) {
		continue;
	}

	const source = stripJsComments(fs.readFileSync(filePath, 'utf8'));
	const relative = relativePath(filePath);
	for (const match of source.matchAll(RAW_COLOR_PATTERN)) {
		if (ALLOWED_DYNAMIC_COLOR_FILES.has(relative)) {
			allowedFindings += 1;
			continue;
		}
		const location = getLineColumn(source, match.index);
		findings.push({
			filePath: relative,
			line: location.line,
			column: location.column,
			literal: match[0]
		});
	}
}

console.log(`Scanned ${files.length} source files for raw JS color literals.`);
console.log(`Allowed dynamic color literals: ${allowedFindings}`);

if (findings.length === 0) {
	console.log('No raw JS color literals found outside allowed dynamic color parsing.');
	process.exit(0);
}

console.error('\nRaw JS color literals found outside allowed dynamic color parsing:');
for (const finding of findings.slice(0, MAX_FINDINGS)) {
	console.error(`  - ${finding.filePath}:${finding.line}:${finding.column} -> ${finding.literal}`);
}
if (findings.length > MAX_FINDINGS) {
	console.error(`  ... and ${findings.length - MAX_FINDINGS} more`);
}

process.exit(1);
