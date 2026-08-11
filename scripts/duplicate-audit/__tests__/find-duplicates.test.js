const {isLowSignalSnippet} = require('../find-duplicates.cjs');

describe('duplicate audit signal classification', () => {
	it('ignores repeated immutable object-spread test fixtures', () => {
		const fixture = [
			'view.sourceToken = Object.freeze({',
			'...view.sourceToken,',
			'runtimeContext: Object.freeze({',
			'...view.sourceToken.runtimeContext,',
			"audioTransition: Object.freeze({id: 'audio-1'})",
			'})',
			'});',
			'view.props.nativeSourceTokenRef.current = view.sourceToken;'
		].join('\n');

		expect(isLowSignalSnippet('.js', fixture, [
			{filePath: 'src/example/__tests__/one.test.js'},
			{filePath: 'src/example/__tests__/two.test.js'}
		])).toBe(true);
	});

	it('retains repeated immutable object construction in production files', () => {
		const fixture = [
			'view.sourceToken = Object.freeze({',
			'...view.sourceToken,',
			'runtimeContext: Object.freeze({',
			'...view.sourceToken.runtimeContext,',
			"audioTransition: Object.freeze({id: 'audio-1'})",
			'})',
			'});',
			'view.props.nativeSourceTokenRef.current = view.sourceToken;'
		].join('\n');

		expect(isLowSignalSnippet('.js', fixture, [
			{filePath: 'src/example/one.js'},
			{filePath: 'src/example/two.js'}
		])).toBe(false);
	});

	it('retains duplicated executable control flow as actionable', () => {
		const behavior = [
			'if (request.failed) {',
			'cancelPlayback(request.id);',
			'setError(request.message);',
			'return false;',
			'}',
			'await retryPlayback(request);',
			'publishPlaybackState(request.id);',
			'return true;'
		].join('\n');

		expect(isLowSignalSnippet('.js', behavior)).toBe(false);
	});

	it('does not apply JavaScript fixture rules to styles', () => {
		expect(isLowSignalSnippet('.less', 'view.sourceToken = Object.freeze({')).toBe(false);
	});
});
