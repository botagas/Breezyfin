import {createPlaybackDiagnostic} from '../../../services/jellyfin/playback-api/diagnostics';

export const buildMediaSegmentsLoadDiagnostic = ({segments = [], error = null} = {}) => {
	if (error) {
		return createPlaybackDiagnostic({
			scope: 'media-segments',
			stage: 'load',
			status: 'failed',
			reason: 'request-failed',
			message: error?.message || 'Failed to load media segments.'
		});
	}
	return createPlaybackDiagnostic({
		scope: 'media-segments',
		stage: 'load',
		status: 'ok',
		reason: 'segments-loaded',
		message: `Loaded ${Array.isArray(segments) ? segments.length : 0} media segment(s).`
	});
};
