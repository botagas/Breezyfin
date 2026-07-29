const {
	analyzeJavaScript,
	compareHotspots,
	createBaseline,
	validateBaseline
} = require('../hotspot-metrics.cjs');

describe('hotspot metrics', () => {
	it('calculates function length, complexity, and nesting from the AST', () => {
		const [fn] = analyzeJavaScript(`
			const choose = (value) => {
				if (value) {
					for (const item of value) {
						if (item.ready && item.visible) return item;
					}
				}
				return null;
			};
		`);

		expect(fn).toEqual(expect.objectContaining({
			id: 'choose#1',
			complexity: 5,
			nesting: 4
		}));
		expect(fn.lines).toBeGreaterThan(5);
	});

	it('reports growth without turning it into a failure', () => {
		const baseline = createBaseline([{
			filePath: 'src/example.js',
			lines: 10,
			decisionMarkers: 1,
			hookMarkers: 0,
			selectorMarkers: 0,
			functions: [{id: 'work#1', line: 1, lines: 5, complexity: 2, nesting: 1}]
		}]);
		const comparison = compareHotspots([{
			filePath: 'src/example.js',
			lines: 14,
			decisionMarkers: 2,
			hookMarkers: 0,
			selectorMarkers: 0,
			functions: [{id: 'work#1', line: 1, lines: 8, complexity: 3, nesting: 2}]
		}], baseline);

		expect(comparison.fileGrowth).toHaveLength(1);
		expect(comparison.functionGrowth).toEqual([
			expect.objectContaining({lengthGrowth: 3, complexityGrowth: 1, nestingGrowth: 1})
		]);
	});

	it('fails invalid baselines and malformed source', () => {
		expect(() => validateBaseline({version: 1, files: {bad: {lines: 'many'}}})).toThrow();
		expect(() => analyzeJavaScript('const broken = (')).toThrow();
	});
});
