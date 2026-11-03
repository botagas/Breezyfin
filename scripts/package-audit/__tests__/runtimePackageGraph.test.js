const {getCliBundledMetadataFailures, getRuntimePackageEntries} = require('../runtimePackageGraph.cjs');

const cliPath = 'node_modules/@enact/cli';
const bundledZod = `${cliPath}/node_modules/@enact/dev-utils/node_modules/zod`;
const manifest = {dependencies: {zod: '4.6.7'}, devDependencies: {'@enact/cli': '7.3.3'}};
const createLock = () => ({packages: {
	'': {...manifest},
	[cliPath]: {version: '7.3.3', dev: true},
	[bundledZod]: {version: '4.4.3', extraneous: true},
	'node_modules/zod': {version: '4.6.7'}
}});

describe('bundled CLI audit scope', () => {
	it('detects the metadata that incorrectly includes bundled Zod in npm production audits', () => {
		expect(getCliBundledMetadataFailures(manifest, createLock())).toEqual([
			expect.stringContaining(bundledZod)
		]);
	});

	it('accepts development metadata or npm pruning without changing runtime dependencies', () => {
		const lock = createLock();
		lock.packages[bundledZod].dev = true;
		expect(getCliBundledMetadataFailures(manifest, lock)).toEqual([]);
		delete lock.packages[bundledZod];
		expect(getCliBundledMetadataFailures(manifest, lock)).toEqual([]);
		expect(getRuntimePackageEntries(lock).map(({packagePath}) => packagePath)).toEqual(['node_modules/zod']);
	});

	it('rejects moving the CLI into production or losing its development classification', () => {
		const lock = createLock();
		expect(getCliBundledMetadataFailures({...manifest, dependencies: {'@enact/cli': '7.3.3'}}, lock))
			.toEqual([expect.stringContaining('development-only dependency')]);
		delete lock.packages[cliPath].dev;
		expect(getCliBundledMetadataFailures(manifest, lock))
			.toEqual([expect.stringContaining('lockfile entry')]);
	});
});
