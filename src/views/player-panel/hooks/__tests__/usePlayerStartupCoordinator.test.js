import {
	PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS,
	getPlayerStartupState,
	isInterruptedPlaybackStartError
} from '../../utils/playerStartupState';

describe('usePlayerStartupCoordinator state', () => {
	it('recognizes stale browser play interruptions without hiding real failures', () => {
		expect(isInterruptedPlaybackStartError({name: 'AbortError'})).toBe(true);
		expect(isInterruptedPlaybackStartError(new Error('The play() request was interrupted because the media was removed from the document.'))).toBe(true);
		expect(isInterruptedPlaybackStartError(new Error('NotSupportedError: format is unsupported'))).toBe(false);
	});
	it('waits for video before evaluating subtitle readiness', () => {
		expect(getPlayerStartupState({
			videoReady: false,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: true},
			subtitleRendererStatus: 'ready'
		})).toBe('waiting-video');
	});

	it('waits for a selected client renderer but bypasses native and subtitle-off paths', () => {
		expect(getPlayerStartupState({
			videoReady: true,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: true},
			subtitleRendererStatus: 'loading'
		})).toBe('waiting-subtitles');
		expect(getPlayerStartupState({videoReady: true, currentSubtitleTrack: -1})).toBe('ready');
		expect(getPlayerStartupState({
			videoReady: true,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: false},
			subtitleRendererStatus: 'loading'
		})).toBe('ready');
	});

	it('reports ready, failed, and timed-out client renderer states explicitly', () => {
		const baseState = {
			videoReady: true,
			currentSubtitleTrack: 2,
			subtitleRendererPolicy: {clientRender: true}
		};
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'ready'})).toBe('ready');
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'fetch-failed'})).toBe('failed');
		expect(getPlayerStartupState({...baseState, subtitleRendererStatus: 'timed-out'})).toBe('timed-out');
		expect(PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS).toBe(15000);
	});
});
