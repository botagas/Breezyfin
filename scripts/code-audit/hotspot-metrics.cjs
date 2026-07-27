const parser = require('@babel/parser');

const FUNCTION_TYPES = new Set([
	'ArrowFunctionExpression',
	'ClassMethod',
	'ClassPrivateMethod',
	'FunctionDeclaration',
	'FunctionExpression',
	'ObjectMethod'
]);

const DECISION_TYPES = new Set([
	'CatchClause',
	'ConditionalExpression',
	'DoWhileStatement',
	'ForInStatement',
	'ForOfStatement',
	'ForStatement',
	'IfStatement',
	'WhileStatement'
]);

const isAstNode = (value) => (
	value !== null &&
	typeof value === 'object' &&
	typeof value.type === 'string'
);

const forEachChild = (node, callback) => {
	for (const [key, value] of Object.entries(node)) {
		if (key === 'loc' || key === 'start' || key === 'end') continue;
		if (Array.isArray(value)) {
			value.forEach((item) => {
				if (isAstNode(item)) callback(item, node);
			});
		} else if (isAstNode(value)) {
			callback(value, node);
		}
	}
};

const isFunctionNode = (node) => FUNCTION_TYPES.has(node.type);

const isDecisionNode = (node) => (
	DECISION_TYPES.has(node.type) ||
	(node.type === 'SwitchCase' && node.test !== null) ||
	(node.type === 'LogicalExpression' && ['&&', '||', '??'].includes(node.operator))
);

const getPropertyName = (node) => {
	if (!node) return null;
	if (node.type === 'Identifier' || node.type === 'PrivateName') return node.name || node.id?.name || null;
	if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') return String(node.value);
	return null;
};

const getFunctionName = (node, parent) => {
	if (node.id?.name) return node.id.name;
	const ownKey = getPropertyName(node.key);
	if (ownKey) return ownKey;
	if (parent?.type === 'VariableDeclarator') return getPropertyName(parent.id) || '<anonymous>';
	if (parent?.type === 'AssignmentExpression') return getPropertyName(parent.left) || '<anonymous>';
	if (parent?.type === 'ObjectProperty') return getPropertyName(parent.key) || '<anonymous>';
	return '<anonymous>';
};

const analyzeFunction = (node, parent) => {
	let complexity = 1;
	let nesting = 0;

	const inspect = (current, currentNesting) => {
		if (current !== node && isFunctionNode(current)) return;
		const nextNesting = isDecisionNode(current) ? currentNesting + 1 : currentNesting;
		if (isDecisionNode(current)) {
			complexity += 1;
			nesting = Math.max(nesting, nextNesting);
		}
		forEachChild(current, (child) => inspect(child, nextNesting));
	};
	inspect(node, 0);

	return {
		name: getFunctionName(node, parent),
		line: node.loc.start.line,
		lines: node.loc.end.line - node.loc.start.line + 1,
		complexity,
		nesting
	};
};

const createFunctionIds = (functions) => {
	const occurrences = new Map();
	return [...functions]
		.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name))
		.map((entry) => {
			const occurrence = (occurrences.get(entry.name) || 0) + 1;
			occurrences.set(entry.name, occurrence);
			return {...entry, id: `${entry.name}#${occurrence}`};
		});
};

const analyzeJavaScript = (source, filePath = 'fixture.js') => {
	const plugins = [
		'jsx',
		'classProperties',
		'classPrivateProperties',
		'classPrivateMethods',
		'objectRestSpread',
		'optionalCatchBinding',
		'optionalChaining',
		'nullishCoalescingOperator',
		'dynamicImport'
	];
	if (/\.[cm]?tsx?$/.test(filePath)) plugins.push('typescript');
	const ast = parser.parse(source, {
		sourceType: 'unambiguous',
		allowAwaitOutsideFunction: true,
		allowReturnOutsideFunction: true,
		plugins
	});
	const functions = [];
	const visit = (node, parent = null) => {
		if (isFunctionNode(node)) functions.push(analyzeFunction(node, parent));
		forEachChild(node, (child) => visit(child, node));
	};
	visit(ast);
	return createFunctionIds(functions);
};

const createBaseline = (entries) => ({
	version: 1,
	generatedAt: new Date().toISOString(),
	files: Object.fromEntries(entries.map((entry) => [
		entry.filePath,
		{
			lines: entry.lines,
			decisionMarkers: entry.decisionMarkers,
			hookMarkers: entry.hookMarkers,
			selectorMarkers: entry.selectorMarkers,
			functions: Object.fromEntries((entry.functions || []).map((fn) => [
				fn.id,
				{
					line: fn.line,
					lines: fn.lines,
					complexity: fn.complexity,
					nesting: fn.nesting
				}
			]))
		}
	]))
});

const validateBaseline = (baseline) => {
	if (!baseline || baseline.version !== 1 || !baseline.files || typeof baseline.files !== 'object') {
		throw new Error('Hotspot baseline must contain version 1 and a files object.');
	}
	for (const [filePath, entry] of Object.entries(baseline.files)) {
		if (!entry || !Number.isInteger(entry.lines) || entry.lines < 0) {
			throw new Error(`Hotspot baseline has invalid file metrics for ${filePath}.`);
		}
		if (!entry.functions || typeof entry.functions !== 'object') {
			throw new Error(`Hotspot baseline has invalid function metrics for ${filePath}.`);
		}
		for (const [functionId, fn] of Object.entries(entry.functions)) {
			if (
				!fn ||
				!Number.isInteger(fn.lines) ||
				!Number.isInteger(fn.complexity) ||
				!Number.isInteger(fn.nesting)
			) {
				throw new Error(`Hotspot baseline has invalid function metrics for ${filePath}:${functionId}.`);
			}
		}
	}
	return baseline;
};

const compareHotspots = (entries, baseline) => {
	validateBaseline(baseline);
	const fileGrowth = [];
	const newLargeFiles = [];
	const functionGrowth = [];

	for (const entry of entries) {
		const previous = baseline.files[entry.filePath];
		if (!previous) {
			if (entry.lines >= 500) newLargeFiles.push(entry);
			continue;
		}
		if (entry.lines > previous.lines) {
			fileGrowth.push({...entry, growth: entry.lines - previous.lines});
		}
		for (const fn of entry.functions || []) {
			const previousFunction = previous.functions?.[fn.id];
			if (!previousFunction) continue;
			const lengthGrowth = fn.lines - previousFunction.lines;
			const complexityGrowth = fn.complexity - previousFunction.complexity;
			const nestingGrowth = fn.nesting - previousFunction.nesting;
			if (lengthGrowth > 0 || complexityGrowth > 0 || nestingGrowth > 0) {
				functionGrowth.push({
					...fn,
					filePath: entry.filePath,
					lengthGrowth,
					complexityGrowth,
					nestingGrowth
				});
			}
		}
	}

	return {fileGrowth, functionGrowth, newLargeFiles};
};

module.exports = {
	analyzeJavaScript,
	compareHotspots,
	createBaseline,
	validateBaseline
};
