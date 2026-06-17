import {buildMediaSegmentsLoadDiagnostic} from '../playerDiagnostics';

describe('playerDiagnostics', () => {
	it('builds a success diagnostic for loaded media segments', () => {
		expect(buildMediaSegmentsLoadDiagnostic({segments: [{Type: 'Intro'}, {Type: 'Credits'}]}))
			.toEqual({
				scope: 'media-segments',
				stage: 'load',
				status: 'ok',
				reason: 'segments-loaded',
				message: 'Loaded 2 media segment(s).'
			});
	});

	it('builds a failure diagnostic for failed media segment loading', () => {
		expect(buildMediaSegmentsLoadDiagnostic({error: new Error('Segment request failed')}))
			.toEqual({
				scope: 'media-segments',
				stage: 'load',
				status: 'failed',
				reason: 'request-failed',
				message: 'Segment request failed'
			});
	});
});
