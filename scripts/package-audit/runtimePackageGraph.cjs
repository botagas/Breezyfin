const getPackageNameFromPath = (packagePath) => {
	const marker = 'node_modules/';
	const index = packagePath.lastIndexOf(marker);
	return index >= 0 ? packagePath.slice(index + marker.length) : '';
};

const getParentPackagePath = (packagePath) => {
	const nestedMarker = '/node_modules/';
	const nestedIndex = packagePath.lastIndexOf(nestedMarker);
	if (nestedIndex >= 0) return packagePath.slice(0, nestedIndex);
	return '';
};

const resolveDependencyPath = (packages, ownerPath, dependencyName) => {
	let currentOwner = ownerPath;
	while (true) {
		const candidate = currentOwner
			? `${currentOwner}/node_modules/${dependencyName}`
			: `node_modules/${dependencyName}`;
		if (packages[candidate]) return candidate;
		if (!currentOwner) return null;
		currentOwner = getParentPackagePath(currentOwner);
	}
};

const getDependencyNames = (metadata = {}) => new Set([
	...Object.keys(metadata.dependencies || {}),
	...Object.keys(metadata.optionalDependencies || {}),
	...Object.keys(metadata.peerDependencies || {}).filter((name) => metadata.peerDependenciesMeta?.[name]?.optional !== true)
]);

const getRuntimePackageEntries = (packageLock) => {
	const packages = packageLock?.packages || {};
	const root = packages[''] || {};
	const queue = [];
	const visited = new Set();
	for (const dependencyName of Object.keys(root.dependencies || {})) {
		const resolved = resolveDependencyPath(packages, '', dependencyName);
		if (resolved) queue.push(resolved);
	}

	while (queue.length > 0) {
		const packagePath = queue.shift();
		if (!packagePath || visited.has(packagePath)) continue;
		visited.add(packagePath);
		const metadata = packages[packagePath];
		if (!metadata) continue;
		for (const dependencyName of getDependencyNames(metadata)) {
			const resolved = resolveDependencyPath(packages, packagePath, dependencyName);
			if (resolved && !visited.has(resolved)) queue.push(resolved);
		}
	}

	return [...visited]
		.sort()
		.map((packagePath) => ({
			packagePath,
			name: getPackageNameFromPath(packagePath),
			metadata: packages[packagePath]
		}));
};

const getCliBundledMetadataFailures = (packageJson, packageLock) => {
	const cliPath = 'node_modules/@enact/cli';
	if (!packageJson.devDependencies?.['@enact/cli'] || packageJson.dependencies?.['@enact/cli']) {
		return ['Enact CLI must remain a development-only dependency.'];
	}
	if (packageLock.packages?.[cliPath]?.dev !== true) {
		return ['The Enact CLI lockfile entry must be development-only.'];
	}
	return Object.entries(packageLock.packages || {})
		.filter(([packagePath, metadata]) => (
			packagePath.startsWith(`${cliPath}/node_modules/`) &&
			metadata.extraneous === true && metadata.dev !== true
		))
		.map(([packagePath]) => `${packagePath} is extraneous bundled CLI tooling without development-only metadata; regenerate the lockfile.`);
};

module.exports = {
	getPackageNameFromPath,
	getRuntimePackageEntries,
	getCliBundledMetadataFailures
};
