export const PLAYBACK_NEGOTIATION_ERROR_CODES = {
	NO_MEDIA_SOURCE: 'no-media-source',
	SUBTITLE_BURN_IN_NO_SOURCE: 'subtitle-burn-in-no-source'
};

export class PlaybackNegotiationError extends Error {
	constructor(message, {code = PLAYBACK_NEGOTIATION_ERROR_CODES.NO_MEDIA_SOURCE, diagnostics = [], details = {}} = {}) {
		super(message);
		this.name = 'PlaybackNegotiationError';
		this.code = code;
		this.diagnostics = Array.isArray(diagnostics) ? diagnostics : [];
		this.details = details || {};
	}
}

export const createNoMediaSourceError = ({
	forceSubtitleBurnIn = false,
	diagnostics = [],
	subtitleStreamIndex = null
} = {}) => new PlaybackNegotiationError(
	forceSubtitleBurnIn
		? 'Jellyfin returned no media source for subtitle burn-in.'
		: 'Jellyfin returned no playable media source.',
	{
		code: forceSubtitleBurnIn
			? PLAYBACK_NEGOTIATION_ERROR_CODES.SUBTITLE_BURN_IN_NO_SOURCE
			: PLAYBACK_NEGOTIATION_ERROR_CODES.NO_MEDIA_SOURCE,
		diagnostics,
		details: {subtitleStreamIndex}
	}
);
