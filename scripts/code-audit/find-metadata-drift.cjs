#!/usr/bin/env node

/*
 * Verify release-critical metadata stays consistent before packaging/release.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const WEBOS_VERSION_RE = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const APP_ID_RE = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/;

const readJson = (relativePath) => (
	JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))
);

const hasFile = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const appinfo = readJson('appinfo.json');
const lockRoot = (packageLock.packages || {})[''] || {};

const failures = [];

const requireString = (sourceName, object, key) => {
	if (typeof object[key] !== 'string' || object[key].trim() === '') {
		failures.push(`${sourceName}.${key} must be a non-empty string.`);
	}
};

requireString('package.json', packageJson, 'name');
requireString('package.json', packageJson, 'version');
requireString('package.json', packageJson, 'description');
requireString('package.json', packageJson, 'main');

requireString('appinfo.json', appinfo, 'id');
requireString('appinfo.json', appinfo, 'version');
requireString('appinfo.json', appinfo, 'type');
requireString('appinfo.json', appinfo, 'main');
requireString('appinfo.json', appinfo, 'title');
requireString('appinfo.json', appinfo, 'icon');

if (packageJson.name !== lockRoot.name) {
	failures.push(`package-lock root name (${lockRoot.name || 'missing'}) must match package.json name (${packageJson.name}).`);
}

if (packageJson.version !== lockRoot.version) {
	failures.push(`package-lock root version (${lockRoot.version || 'missing'}) must match package.json version (${packageJson.version}).`);
}

if (packageJson.version !== appinfo.version) {
	failures.push(`appinfo.json version (${appinfo.version}) must match package.json version (${packageJson.version}).`);
}

if (typeof appinfo.version === 'string' && !WEBOS_VERSION_RE.test(appinfo.version)) {
	failures.push('appinfo.json version must use webOS X.X.X numeric format with no leading zeroes.');
}

if (typeof appinfo.id === 'string' && !APP_ID_RE.test(appinfo.id)) {
	failures.push('appinfo.json id should be a reverse-DNS app id such as com.breezyfin.app.');
}

if (appinfo.type !== 'web') {
	failures.push(`appinfo.json type should be "web" for this Enact app, got "${appinfo.type}".`);
}

if (!hasFile(packageJson.main || '')) {
	failures.push(`package.json main points to a missing file: ${packageJson.main || 'missing'}.`);
}

if (!hasFile(appinfo.icon || '')) {
	failures.push(`appinfo.json icon points to a missing file: ${appinfo.icon || 'missing'}.`);
}

const packageDependencies = packageJson.dependencies || {};
const lockDependencies = lockRoot.dependencies || {};
for (const dependencyName of Object.keys(packageDependencies).sort()) {
	if (lockDependencies[dependencyName] !== packageDependencies[dependencyName]) {
		failures.push(
			`package-lock root dependency ${dependencyName} (${lockDependencies[dependencyName] || 'missing'}) ` +
			`must match package.json (${packageDependencies[dependencyName]}).`
		);
	}
}

console.log('Checked package.json, package-lock.json, and appinfo.json metadata.');

if (failures.length === 0) {
	console.log('No release metadata drift found.');
	process.exit(0);
}

console.error('\nRelease metadata drift found:');
for (const failure of failures) {
	console.error(`  - ${failure}`);
}

process.exit(1);
