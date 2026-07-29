#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) {
	console.error('dist/ is missing. Run npm run pack or npm run pack-p first.');
	process.exit(1);
}

const totals = new Map();
const files = [];
const add = (category, bytes) => totals.set(category, (totals.get(category) || 0) + bytes);
const classify = (relative) => {
	const normalized = relative.toLowerCase();
	if (normalized.includes('ilib')) return 'iLib locales/runtime';
	if (/\.(?:woff2?|ttf|otf)$/u.test(normalized)) return 'Fonts';
	if (/(?:jassub|libass|libbitsub|libpgs|subtitle)/u.test(normalized)) return 'Subtitle engines/assets';
	if (/\.(?:map|d\.ts)$/u.test(normalized)) return 'Source maps/declarations';
	if (/^(?:main|chunk\.|runtime-main|styles).*\.(?:js|css)$/u.test(path.basename(normalized))) return 'Application bundles';
	return 'Other packaged files';
};
const walk = (directory) => {
	for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			walk(absolute);
		} else if (entry.isFile()) {
			const bytes = fs.statSync(absolute).size;
			const relative = path.relative(DIST, absolute);
			add(classify(relative), bytes);
			files.push({relative, bytes});
		}
	}
};
walk(DIST);

const formatMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
const totalBytes = files.reduce((sum, entry) => sum + entry.bytes, 0);
console.log(`Package footprint: ${formatMb(totalBytes)} across ${files.length} files.`);
[...totals.entries()]
	.sort((left, right) => right[1] - left[1])
	.forEach(([category, bytes]) => console.log(`  ${category}: ${formatMb(bytes)}`));
console.log('Largest packaged files:');
files.sort((left, right) => right.bytes - left.bytes).slice(0, 15)
	.forEach((entry) => console.log(`  ${formatMb(entry.bytes)}  ${entry.relative}`));
