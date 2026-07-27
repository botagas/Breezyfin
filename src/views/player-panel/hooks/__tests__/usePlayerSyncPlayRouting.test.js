jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		reportPlaybackStart: jest.fn(),
		reportPlaybackProgress: jest.fn()
	}
}));

import {act, renderHook} from '@testing-library/react';
import {SyncPlayProvider} from '../../../../contexts/SyncPlayContext';
import {usePlayerEpisodeAndSurfaceHandlers} from '../usePlayerEpisodeAndSurfaceHandlers';
import {usePlayerPlaybackCommands} from '../usePlayerPlaybackCommands';
import {usePlayerBackNavigation} from '../usePlayerBackNavigation';

const createEpisodeProps = (overrides = {}) => ({
	item: {Id: 'episode-1', Type: 'Episode'},
	onPlay: jest.fn(),
	hasNextEpisode: true,
	nextEpisodeData: {Id: 'episode-2', Type: 'Episode'},
	getNextEpisode: jest.fn(),
	hasPreviousEpisode: true,
	getPreviousEpisode: jest.fn(),
	buildPlaybackOptions: jest.fn(() => ({})),
	playbackOverrideRef: {current: null},
	handleStop: jest.fn(),
	loading: false,
	error: null,
	showAudioPopup: false,
	showSubtitlePopup: false,
	showControls: true,
	playing: false,
	handlePause: jest.fn(),
	handlePlay: jest.fn(),
	lastInteractionRef: {current: 0},
	videoRef: {current: null},
	muted: false,
	setMuted: jest.fn(),
	setVolume: jest.fn(),
	setPlaying: jest.fn(),
	setError: jest.fn(),
	setToastMessage: jest.fn(),
	...overrides
});

const createPlaybackProps = (overrides = {}) => ({
	item: {Id: 'episode-1', Type: 'Episode'},
	onBack: jest.fn(),
	onPlay: jest.fn(),
	hasNextEpisode: true,
	getNextEpisode: jest.fn(),
	buildPlaybackOptions: jest.fn(() => ({})),
	playbackSettingsRef: {current: {autoPlayNext: true}},
	videoRef: {current: null},
	handleStop: jest.fn().mockResolvedValue(undefined),
	getPlaybackSessionContext: jest.fn(() => ({})),
	startProgressReporting: jest.fn(),
	setPlaying: jest.fn(),
	setShowControls: jest.fn(),
	setError: jest.fn(),
	setLoadingStatusMessage: jest.fn(),
	setToastMessage: jest.fn(),
	showPlaybackError: jest.fn(),
	resetRecoveryGuards: jest.fn(),
	playSessionRebuildAttemptsRef: {current: 0},
	transcodeFallbackAttemptedRef: {current: false},
	reloadAttemptedRef: {current: false},
	subtitleCompatibilityFallbackAttemptedRef: {current: false},
	loadVideo: jest.fn(),
	attemptTranscodeFallback: jest.fn(),
	isCurrentTranscoding: false,
	exitInProgressRef: {current: false},
	loadRequestIdRef: {current: 0},
	...overrides
});

const createSyncPlayWrapper = ({next, previous = jest.fn()}) => {
	const value = {
		group: {GroupId: 'group-1'},
		followMode: 'following',
		next,
		previous
	};
	return function SyncPlayTestWrapper({children}) {
		return <SyncPlayProvider value={value}>{children}</SyncPlayProvider>;
	};
};

describe('Player SyncPlay routing', () => {
	it('routes next and previous controls only through the authoritative group queue', async () => {
		const syncPlayNext = jest.fn().mockResolvedValue(undefined);
		const syncPlayPrevious = jest.fn().mockResolvedValue(undefined);
		const props = createEpisodeProps();
		const {result} = renderHook(() => usePlayerEpisodeAndSurfaceHandlers(props), {
			wrapper: createSyncPlayWrapper({next: syncPlayNext, previous: syncPlayPrevious})
		});

		await act(() => result.current.handlePlayNextEpisode());
		await act(() => result.current.handlePlayPreviousEpisode());

		expect(syncPlayNext).toHaveBeenCalledTimes(1);
		expect(syncPlayPrevious).toHaveBeenCalledTimes(1);
		expect(props.getNextEpisode).not.toHaveBeenCalled();
		expect(props.getPreviousEpisode).not.toHaveBeenCalled();
		expect(props.onPlay).not.toHaveBeenCalled();
		expect(props.handleStop).not.toHaveBeenCalled();
	});

	it('routes playback completion through SyncPlay without local autoplay or Back', async () => {
		const syncPlayNext = jest.fn().mockResolvedValue(undefined);
		const props = createPlaybackProps();
		const {result} = renderHook(() => usePlayerPlaybackCommands(props), {
			wrapper: createSyncPlayWrapper({next: syncPlayNext})
		});

		await act(() => result.current.handleEnded());

		expect(props.handleStop).toHaveBeenCalledTimes(1);
		expect(syncPlayNext).toHaveBeenCalledTimes(1);
		expect(props.getNextEpisode).not.toHaveBeenCalled();
		expect(props.onPlay).not.toHaveBeenCalled();
		expect(props.onBack).not.toHaveBeenCalled();
	});

	it('runs Player teardown Back when controls are already hidden', () => {
		const handleBackButton = jest.fn();
		const {result} = renderHook(() => usePlayerBackNavigation({
			hasPlaybackError: false,
			handleBackButton,
			showAudioPopup: false,
			closeAudioPopup: jest.fn(),
			showSubtitlePopup: false,
			closeSubtitlePopup: jest.fn(),
			skipOverlayVisible: false,
			handleDismissSkipOverlay: jest.fn(),
			showControls: false,
			setShowControls: jest.fn()
		}));

		expect(result.current.handleInternalBack()).toBe(true);
		expect(handleBackButton).toHaveBeenCalledTimes(1);
	});
});
