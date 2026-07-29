const {
	BACKUP_ARTIFACT_PATTERN,
	findLiteralMatches,
	parseLocalLiterals
} = require('../repository-hygiene.cjs');

describe('repository hygiene', () => {
	it('parses, trims, and deduplicates local literals', () => {
		expect(parseLocalLiterals(JSON.stringify({
			literals: [' InternalCodename ', 'PrivateFixture', 'InternalCodename']
		}))).toEqual(['InternalCodename', 'PrivateFixture']);
	});

	it('rejects malformed local configurations', () => {
		expect(() => parseLocalLiterals('{')).toThrow('not valid JSON');
		expect(() => parseLocalLiterals(JSON.stringify({literals: []}))).toThrow(
			'must contain a non-empty string array'
		);
		expect(() => parseLocalLiterals(JSON.stringify({literals: ['']}))).toThrow(
			'must contain a non-empty string array'
		);
	});

	it('finds local literals without exposing matching behavior to case differences', () => {
		expect(findLiteralMatches('safe INTERNALCODENAME safe', ['InternalCodename'])).toEqual([
			{index: 5, patternIndex: 0}
		]);
	});

	it('recognizes backup and temporary artifacts without rejecting normal files', () => {
		expect(BACKUP_ARTIFACT_PATTERN.test('component.js.orig')).toBe(true);
		expect(BACKUP_ARTIFACT_PATTERN.test('notes.tmp')).toBe(true);
		expect(BACKUP_ARTIFACT_PATTERN.test('component.js')).toBe(false);
	});
});
