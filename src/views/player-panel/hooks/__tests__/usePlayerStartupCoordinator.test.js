jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		reportPlaybackStart: jest.fn()
	}
}));

import {act, renderHook} from '@testing-library/react';
import jellyfinService from '../../../../services/jellyfinService';
import {usePlayerStartupCoordinator} from '../usePlayerStartupCoordinator';
import {
	PLAYER_SUBTITLE_STARTUP_TIMEOUT_MS,
	getPlayerStartupState,
	isInterruptedPlaybackStartError
} from '../../utils/playerStartupState';
import {createSyncPlayStartupBridge} from '../../utils/syncPlayStartupBridge';

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

	it('waits for authoritative SyncPlay start and completes playback exactly once', async () => {
		const video = document.createElement('video');
		video.play = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(video, 'currentTime', {configurable: true, value: 12});
		const syncPlayStartupBridge = createSyncPlayStartupBridge();
		const reportVideoReady = jest.fn().mockResolvedValue(true);
		syncPlayStartupBridge.registerSyncPlayHandlers({
			shouldBlockAutomaticStart: () => true,
			reportVideoReady
		});
		const playbackStartedRef = {current: false};
		const startProgressReporting = jest.fn();
		const setLoadingStatusMessage = jest.fn();
		jellyfinService.reportPlaybackStart.mockResolvedValue(undefined);
		const {result} = renderHook(() => usePlayerStartupCoordinator({
			item: {Id: 'item-1'},
			playbackGeneration: 1,
			videoRef: {current: video},
			currentSubtitleTrack: -1,
			subtitleRendererPolicy: null,
			subtitleRendererState: null,
			exitInProgressRef: {current: false},
			playbackStartedRef,
			playbackOverrideRef: {current: null},
			pendingOverrideClearRef: {current: false},
			startupFallbackTimerRef: {current: null},
			clearStartWatch: jest.fn(),
			getPlaybackSessionContext: jest.fn(() => ({PlaySessionId: 'session-1'})),
			startProgressReporting,
			syncPlayStartupBridge,
			setLoading: jest.fn(),
			setLoadingStatusMessage,
			setPlaying: jest.fn(),
			setToastMessage: jest.fn(),
			showPlaybackError: jest.fn(),
			attemptTranscodeFallback: jest.fn(),
			isCurrentTranscoding: false,
			onSubtitleTimeout: jest.fn()
		}));

		act(() => {
			result.current.markVideoReady();
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current.status).toBe('waiting-syncplay');
		expect(setLoadingStatusMessage).toHaveBeenLastCalledWith('Waiting for SyncPlay...');
		expect(reportVideoReady).toHaveBeenCalledTimes(1);
		expect(video.play).not.toHaveBeenCalled();

		await act(async () => {
			await expect(syncPlayStartupBridge.startAuthoritativePlayback()).resolves.toBe(true);
			await expect(syncPlayStartupBridge.startAuthoritativePlayback()).resolves.toBe(false);
		});

		expect(video.play).toHaveBeenCalledTimes(1);
		expect(jellyfinService.reportPlaybackStart).toHaveBeenCalledTimes(1);
		expect(startProgressReporting).toHaveBeenCalledTimes(1);
	});
});
