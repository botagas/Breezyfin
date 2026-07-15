#!/usr/bin/env node

const {
	fs,
	path,
	ROOT,
	relativePath,
	walkFiles
} = require('../audit-utils/files.cjs');

const findings = [];
const files = walkFiles(path.join(ROOT, 'src'), (filePath) => (
	/\.(?:js|jsx)$/u.test(filePath) &&
	!filePath.includes(`${path.sep}__tests__${path.sep}`) &&
	!filePath.endsWith(`${path.sep}sensitiveData.js`)
));

const report = (filePath, source, index, message) => {
	const line = source.slice(0, index).split('\n').length;
	findings.push(`${relativePath(filePath)}:${line} ${message}`);
};

for (const filePath of files) {
	const source = fs.readFileSync(filePath, 'utf8');
	for (const match of source.matchAll(/console\.(?:log|info|warn|error)\s*\([\s\S]{0,500}?\);/gu)) {
		const statement = match[0];
		if (
			/(?:currentSrc|video\??\.src|__debugVideoUrl)/u.test(statement) &&
			!/(?:redactSensitiveUrl|buildHlsErrorSummary)/u.test(statement)
		) {
			report(filePath, source, match.index, 'raw playback URL may reach console output');
		}
		if (/[,]\s*(?:event|video|audio)\s*\)/u.test(statement)) {
			report(filePath, source, match.index, 'raw media/event object may expose an authenticated playback source');
		}
	}
	for (const match of source.matchAll(/\.apply\(\s*console\s*,\s*args\s*\)/gu)) {
		report(filePath, source, match.index, 'raw console arguments bypass the shared sanitizer');
	}
	for (const match of source.matchAll(/__debugVideoUrl\s*:\s*videoUrl\b/gu)) {
		report(filePath, source, match.index, 'raw playback URL is stored in debug metadata');
	}
	for (const match of source.matchAll(/`\$\{url\.pathname\}\$\{url\.search\}`/gu)) {
		report(filePath, source, match.index, 'URL query is exposed without the shared redactor');
	}
}

console.log(`Scanned ${files.length} production source files for unsafe runtime URL logging.`);
if (findings.length === 0) {
	console.log('No unsafe playback URL logging patterns found.');
	process.exit(0);
}

console.error('\nUnsafe runtime logging findings:');
findings.forEach((finding) => console.error(`  - ${finding}`));
process.exit(1);
