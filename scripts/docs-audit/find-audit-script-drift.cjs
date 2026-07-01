#!/usr/bin/env node

/*
 * Verify that targeted audit scripts stay wired into the aggregate audit
 * command and documented in the developer guide.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const DEVELOPING_DOC = path.join(ROOT, 'DEVELOPING.md');

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const scripts = packageJson.scripts || {};
const aggregateAudit = scripts.audit || '';
const auditScriptNames = Object.keys(scripts)
	.filter((scriptName) => scriptName.startsWith('audit:'))
	.sort((a, b) => a.localeCompare(b));

const documentedSource = fs.existsSync(DEVELOPING_DOC)
	? fs.readFileSync(DEVELOPING_DOC, 'utf8')
	: '';

const aggregateMissing = auditScriptNames.filter((scriptName) => (
	!aggregateAudit.includes(`npm run ${scriptName}`)
));

const docsMissing = auditScriptNames.filter((scriptName) => (
	!documentedSource.includes(`npm run ${scriptName}`)
));

console.log(`Checked ${auditScriptNames.length} targeted audit scripts for aggregate/docs drift.`);

let hasFailure = false;

if (aggregateMissing.length > 0) {
	hasFailure = true;
	console.error('\nAudit scripts missing from `npm run audit`:');
	for (const scriptName of aggregateMissing) {
		console.error(`  - ${scriptName}`);
	}
}

if (docsMissing.length > 0) {
	hasFailure = true;
	console.error('\nAudit scripts missing from DEVELOPING.md targeted audit commands:');
	for (const scriptName of docsMissing) {
		console.error(`  - ${scriptName}`);
	}
}

if (!hasFailure) {
	console.log('No audit script drift found.');
	process.exit(0);
}

process.exit(1);
