#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {getRuntimePackageEntries} = require('../package-audit/runtimePackageGraph.cjs');

const ROOT = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const EXPECTED_RUNTIME = Object.freeze({
	'@enact/core': '4.9.8',
	'@enact/i18n': '4.9.8',
	'@enact/sandstone': '2.9.13',
	'@enact/spotlight': '4.9.8',
	'@enact/ui': '4.9.8',
	'@enact/webos': '4.9.8',
	ilib: '14.21.1',
	react: '18.3.1',
	'react-dom': '18.3.1'
});

const failures = [];
const EXPECTED_BUILD_REACT_IS = '18.3.1';
const runtimeEntries = getRuntimePackageEntries(packageLock);
for (const [name, expectedVersion] of Object.entries(EXPECTED_RUNTIME)) {
	if (packageJson.dependencies?.[name] !== expectedVersion) {
		failures.push(`${name} must be pinned to ${expectedVersion} in package.json.`);
	}
	const versions = new Set();
	for (const entry of runtimeEntries) {
		if (entry.name !== name) continue;
		if (entry.metadata?.version) versions.add(entry.metadata.version);
	}
	if (versions.size !== 1 || !versions.has(expectedVersion)) {
		failures.push(`${name} production closure resolved ${[...versions].join(', ') || 'nothing'}; expected only ${expectedVersion}.`);
	}
}

if (packageJson.devDependencies?.['react-is-18'] !== `npm:react-is@${EXPECTED_BUILD_REACT_IS}`) {
	failures.push(`react-is-18 must alias react-is@${EXPECTED_BUILD_REACT_IS} for the React 18 build toolchain.`);
}
if (packageJson.enact?.alias?.['react-is'] !== 'react-is-18') {
	failures.push('Enact must resolve react-is through the react-is-18 package alias to prevent React 19 CLI type checks leaking into React 18 builds.');
}
if (packageLock.packages?.['node_modules/react-is-18']?.version !== EXPECTED_BUILD_REACT_IS) {
	failures.push(`react-is-18 resolved ${packageLock.packages?.['node_modules/react-is-18']?.version || 'nothing'}; expected ${EXPECTED_BUILD_REACT_IS}.`);
}

console.log('Checked production Enact, React, and iLib runtime generations.');
if (failures.length === 0) {
	console.log('Production runtime dependencies are coherent.');
	process.exit(0);
}

console.error('\nRuntime dependency drift found:');
failures.forEach((failure) => console.error(`  - ${failure}`));
process.exit(1);
