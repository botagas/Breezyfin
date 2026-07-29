import {
	appendPlaybackDiagnostic,
	createPlaybackDiagnostic
} from '../playbackDiagnostics';

describe('playback diagnostics', () => {
	it('normalizes the existing diagnostic shape', () => {
		expect(createPlaybackDiagnostic({stage: ' source ', status: 'applied'})).toEqual({
			scope: 'playback',
			stage: 'source',
			status: 'applied',
			reason: '',
			message: ''
		});
	});

	it('appends only to diagnostic arrays', () => {
		const diagnostics = [];
		appendPlaybackDiagnostic(diagnostics, {scope: 'subtitle', stage: 'policy'});
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0].scope).toBe('subtitle');
		expect(() => appendPlaybackDiagnostic(null, {})).not.toThrow();
	});
});
