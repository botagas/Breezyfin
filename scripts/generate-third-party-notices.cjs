#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {getRuntimePackageEntries} = require('./package-audit/runtimePackageGraph.cjs');

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'THIRD_PARTY_NOTICES.txt');
const CHECK_ONLY = process.argv.includes('--check');
const REQUIRED_COPIED_PACKAGES = [
	'@enact/sandstone',
	'@jellyfin/sdk',
	'hls.js',
	'jassub',
	'libass-wasm',
	'libbitsub',
	'libpgs'
];
const EXTRA_ASSET_LICENSES = [
	{
		label: 'JASSUB renderer and packaged worker assets',
		path: 'node_modules/jassub/LICENSE'
	},
	{
		label: 'libass-wasm renderer and packaged worker assets',
		path: 'node_modules/libass-wasm/LICENSE'
	},
	{
		label: 'libbitsub renderer and packaged WASM',
		path: 'node_modules/libbitsub/pkg/LICENSE'
	},
	{
		label: 'libpgs renderer',
		path: 'node_modules/libpgs/LICENSE'
	},
	{
		label: 'Jellyfin SDK',
		path: 'node_modules/@jellyfin/sdk/LICENSE'
	},
	{
		label: 'HLS.js playback engine',
		path: 'node_modules/hls.js/LICENSE'
	},
	{
		label: 'Museo Sans subtitle fallback font',
		path: 'node_modules/@enact/sandstone/fonts/MuseoSans/LICENSE.txt'
	}
];

const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const runtimePackages = new Map();

for (const {packagePath, name, metadata} of getRuntimePackageEntries(packageLock)) {
	if (!metadata?.version) continue;
	if (!name) continue;
	let license = metadata.license || '';
	if (!license) {
		const packageJsonPath = path.join(ROOT, packagePath, 'package.json');
		if (fs.existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			license = packageJson.license || packageJson.licenses?.map?.((entry) => entry.type).filter(Boolean).join(' OR ') || '';
		}
	}
	const key = `${name}@${metadata.version}`;
	runtimePackages.set(key, {
		name,
		version: metadata.version,
		license: license || 'UNKNOWN'
	});
}

for (const packageName of REQUIRED_COPIED_PACKAGES) {
	const present = [...runtimePackages.values()].some((entry) => entry.name === packageName);
	if (!present) throw new Error(`Required packaged dependency is missing from notices: ${packageName}`);
}

const lines = [
	'Breezyfin Third-Party Notices',
	'==============================',
	'',
	'This file is generated from package-lock.json. Breezyfin is licensed under',
	'GPL-3.0-only; third-party components remain under their respective licenses.',
	'The corresponding Breezyfin source for a release is available from the matching',
	'Git tag at https://github.com/botagas/Breezyfin.',
	'',
	'Production dependency inventory',
	'-------------------------------'
];

[...runtimePackages.values()]
	.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version))
	.forEach((entry) => lines.push(`${entry.name}@${entry.version} — ${entry.license}`));

lines.push('', 'Copied runtime asset licenses', '-----------------------------');
for (const entry of EXTRA_ASSET_LICENSES) {
	const absolutePath = path.join(ROOT, entry.path);
	if (!fs.existsSync(absolutePath)) throw new Error(`Missing copied asset license: ${entry.path}`);
	lines.push('', `### ${entry.label}`, `Source: ${entry.path}`, '', fs.readFileSync(absolutePath, 'utf8').trim());
}
lines.push('');
const output = lines.join('\n');

if (CHECK_ONLY) {
	if (!fs.existsSync(OUTPUT_PATH) || fs.readFileSync(OUTPUT_PATH, 'utf8') !== output) {
		console.error('THIRD_PARTY_NOTICES.txt is missing or stale. Run npm run prepare:release-notices.');
		process.exit(1);
	}
	console.log(`Validated ${runtimePackages.size} production dependency notices and copied asset licenses.`);
	process.exit(0);
}

fs.writeFileSync(OUTPUT_PATH, output);
console.log(`Generated THIRD_PARTY_NOTICES.txt for ${runtimePackages.size} production dependencies.`);
