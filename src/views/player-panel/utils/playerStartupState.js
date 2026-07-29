export const PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS = 15000;
export const PLAYER_PLAYBACK_START_TIMEOUT_MS = 12000;

export const isInterruptedPlaybackStartError = (error) => {
	if (!error) return false;
	if (error.name === 'AbortError') return true;
	const message = String(error.message || error).toLowerCase();
	return message.includes('play() request was interrupted') ||
		message.includes('media was removed from the document') ||
		message.includes('new load request');
};

const rendererNeedsStartupGate = ({currentSubtitleTrack, subtitleRendererPolicy}) => (
	Number.isInteger(currentSubtitleTrack) &&
	currentSubtitleTrack >= 0 &&
	subtitleRendererPolicy?.clientRender === true
);

export const getPlayerStartupState = ({
	sourceAttached = false,
	currentSubtitleTrack = -1,
	subtitleRendererPolicy = null,
	subtitleRendererStatus = 'off'
} = {}) => {
	if (!sourceAttached) return 'waiting-source';
	if (!rendererNeedsStartupGate({currentSubtitleTrack, subtitleRendererPolicy})) return 'starting';
	if (subtitleRendererStatus === 'ready') return 'starting';
	if (subtitleRendererStatus === 'timed-out') return 'timed-out';
	if (
		subtitleRendererStatus === 'failed' ||
		subtitleRendererStatus === 'fetch-failed' ||
		subtitleRendererStatus === 'unsupported-payload' ||
		subtitleRendererStatus === 'empty-events'
	) return 'failed';
	return 'waiting-subtitles';
};
