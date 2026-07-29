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

module.exports = {
	getPackageNameFromPath,
	getRuntimePackageEntries
};
