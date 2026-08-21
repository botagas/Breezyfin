jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		onWebSocketMessage: jest.fn(),
		sampleSyncPlayClock: jest.fn(),
		syncPlayPing: jest.fn(),
		syncPlayReady: jest.fn(),
		syncPlayBuffering: jest.fn(),
		syncPlayPause: jest.fn(),
		syncPlayPlay: jest.fn(),
		syncPlaySeek: jest.fn()
	}
}));

import {act, renderHook} from '@testing-library/react';
import jellyfinService from '../../../../services/jellyfinService';
import {SyncPlayProvider} from '../../../../contexts/SyncPlayContext';
import {useNativeSyncPlay} from '../useNativeSyncPlay';
import {createSyncPlayStartupBridge} from '../../utils/syncPlayStartupBridge';

const buildVideo = ({trackCurrentTimeWrites = false} = {}) => {
	const video = document.createElement('video');
	let paused = true;
	let currentTime = 0;
	const currentTimeWrites = [];
	Object.defineProperties(video, {
		readyState: {configurable: true, value: 4},
		currentSrc: {configurable: true, value: 'https://media.test/video.m3u8'},
		paused: {configurable: true, get: () => paused},
		currentTime: {
			configurable: true,
			get: () => currentTime,
			set: (value) => {
				currentTime = value;
				if (trackCurrentTimeWrites) currentTimeWrites.push(value);
			}
		}
	});
	video.currentTime = 0;
	currentTimeWrites.length = 0;
	video.playbackRate = 1;
	video.pause = jest.fn(() => {
		paused = true;
	});
	video.play = jest.fn(() => {
		paused = false;
		return Promise.resolve();
	});
	video.currentTimeWrites = currentTimeWrites;
	return video;
};

const renderNativeSyncPlay = ({video, setToastMessage = jest.fn()} = {}) => {
	const syncPlayStartupBridge = createSyncPlayStartupBridge();
	const value = {
		group: {GroupId: 'group-1'},
		followMode: 'following',
		queue: {activePlaylistItemId: 'playlist-1'},
		leaveGroup: jest.fn(),
		startGroupPlayback: jest.fn(),
		next: jest.fn(),
		previous: jest.fn()
	};
	const wrapper = ({children}) => (
		<SyncPlayProvider value={value}>{children}</SyncPlayProvider>
	);
	const view = renderHook(({generation}) => useNativeSyncPlay({
		isActive: true,
		item: {Id: 'item-1'},
		playbackGeneration: generation,
		videoRef: {current: video},
		handleLocalPause: jest.fn(),
		handleLocalPlay: jest.fn(),
		handleLocalSeek: jest.fn(),
		syncPlayStartupBridge,
		setToastMessage
	}), {initialProps: {generation: 1}, wrapper});
	view.syncPlayStartupBridge = syncPlayStartupBridge;
	return view;
};

const flushClockSample = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
};

const reportInitialReady = async (view) => {
	await act(async () => {
		await view.syncPlayStartupBridge.reportVideoReady();
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe('useNativeSyncPlay', () => {
	let websocketListeners;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		websocketListeners = {};
		jellyfinService.onWebSocketMessage.mockImplementation((type, listener) => {
			websocketListeners[type] = listener;
			return jest.fn();
		});
		const now = Date.now();
		jellyfinService.sampleSyncPlayClock.mockResolvedValue({
			requestSentAtMs: now,
			requestReceivedServerTime: new Date(now + 10).toISOString(),
			responseSentServerTime: new Date(now + 12).toISOString(),
			responseReceivedAtMs: now + 22
		});
		jellyfinService.syncPlayPing.mockResolvedValue(undefined);
		jellyfinService.syncPlayReady.mockResolvedValue(undefined);
		jellyfinService.syncPlayBuffering.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	it('reports Ready while paused without starting local playback', async () => {
		const video = buildVideo();
		const view = renderNativeSyncPlay({video});

		await flushClockSample();
		expect(jellyfinService.syncPlayReady).not.toHaveBeenCalled();

		await reportInitialReady(view);

		expect(jellyfinService.syncPlayReady).toHaveBeenCalledWith(expect.objectContaining({
			IsPlaying: false,
			PlaylistItemId: 'playlist-1'
		}));
		expect(video.play).not.toHaveBeenCalled();
		expect(video.pause).not.toHaveBeenCalled();
		view.unmount();
	});

	it('applies the authoritative Unpause position before starting local playback', async () => {
		const video = buildVideo();
		const positionsAtPlay = [];
		video.play.mockImplementation(() => {
			positionsAtPlay.push(video.currentTime);
			return Promise.resolve();
		});
		const view = renderNativeSyncPlay({video});
		await flushClockSample();
		await reportInitialReady(view);
		positionsAtPlay.length = 0;

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: 'invalid',
					PositionTicks: 500000000,
					PlaylistItemId: 'playlist-1'
				}
			});
			jest.advanceTimersByTime(0);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(positionsAtPlay).toEqual([50]);
		expect(view.syncPlayStartupBridge.getAuthoritativePosition(0)).toBeCloseTo(50, 1);
		view.unmount();
	});

	it('resumes established playback after an authoritative Pause and Unpause sequence', async () => {
		const video = buildVideo();
		const view = renderNativeSyncPlay({video});
		await flushClockSample();
		await reportInitialReady(view);

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: 'invalid',
					PositionTicks: 500000000,
					PlaylistItemId: 'playlist-1'
				}
			});
			jest.advanceTimersByTime(0);
		});
		await act(async () => {
			await Promise.resolve();
		});
		expect(video.play).toHaveBeenCalledTimes(1);

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Pause',
					When: 'invalid',
					PositionTicks: 500000000,
					PlaylistItemId: 'playlist-1'
				}
			});
			jest.advanceTimersByTime(0);
		});
		expect(video.pause).toHaveBeenCalledTimes(1);

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: 'invalid',
					PositionTicks: 520000000,
					PlaylistItemId: 'playlist-1'
				}
			});
			jest.advanceTimersByTime(0);
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(video.currentTime).toBe(52);
		expect(video.play).toHaveBeenCalledTimes(2);
		view.unmount();
	});

	it('hard-seeks at most once and keeps playback at 1x for one authoritative Unpause command', async () => {
		const video = buildVideo({trackCurrentTimeWrites: true});
		const view = renderNativeSyncPlay({video});
		await flushClockSample();
		await reportInitialReady(view);

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: 'invalid',
					PositionTicks: 500000000,
					PlaylistItemId: 'playlist-1'
				}
			});
			jest.advanceTimersByTime(0);
		});
		await act(async () => {
			await Promise.resolve();
		});

		video.currentTime = 40;
		video.currentTimeWrites.length = 0;
		act(() => {
			jest.advanceTimersByTime(2500);
		});

		expect(video.currentTimeWrites).toEqual([]);
		expect(video.playbackRate).toBe(1);
		view.unmount();
	});

	it('queues Unpause commands until the first valid clock sample and Ready report', async () => {
		let resolveClock;
		jellyfinService.sampleSyncPlayClock.mockReturnValue(new Promise((resolve) => {
			resolveClock = resolve;
		}));
		const video = buildVideo();
		const view = renderNativeSyncPlay({video});

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: 'invalid',
					PositionTicks: 250000000,
					PlaylistItemId: 'playlist-1'
				}
			});
			jest.advanceTimersByTime(0);
		});
		expect(video.play).not.toHaveBeenCalled();

		await act(async () => {
			const now = Date.now();
			resolveClock({
				requestSentAtMs: now,
				requestReceivedServerTime: new Date(now + 10).toISOString(),
				responseSentServerTime: new Date(now + 12).toISOString(),
				responseReceivedAtMs: now + 22
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		await reportInitialReady(view);
		act(() => {
			jest.advanceTimersByTime(0);
		});

		await act(async () => {
			await Promise.resolve();
		});

		expect(video.currentTime).toBe(25);
		expect(video.play).toHaveBeenCalledTimes(1);
		view.unmount();
	});

	it('preserves a queued Unpause command across a same-item source generation change', async () => {
		let resolveClock;
		jellyfinService.sampleSyncPlayClock.mockReturnValue(new Promise((resolve) => {
			resolveClock = resolve;
		}));
		const video = buildVideo();
		const view = renderNativeSyncPlay({video});

		websocketListeners.SyncPlayCommand({
			Data: {
				Command: 'Unpause',
				When: 'invalid',
				PositionTicks: 250000000,
				PlaylistItemId: 'playlist-1'
			}
		});
		view.rerender({generation: 2});

		await act(async () => {
			const now = Date.now();
			resolveClock({
				requestSentAtMs: now,
				requestReceivedServerTime: new Date(now + 10).toISOString(),
				responseSentServerTime: new Date(now + 12).toISOString(),
				responseReceivedAtMs: now + 22
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		await reportInitialReady(view);
		act(() => jest.advanceTimersByTime(0));

		await act(async () => {
			await Promise.resolve();
		});

		expect(video.currentTime).toBe(25);
		expect(video.play).toHaveBeenCalledTimes(1);
		view.unmount();
	});

	it('reports buffering only after a sustained wait and reports Ready after recovery', async () => {
		const video = buildVideo();
		const view = renderNativeSyncPlay({video});
		await flushClockSample();
		await reportInitialReady(view);
		jellyfinService.syncPlayReady.mockClear();

		await video.play();
		act(() => {
			video.dispatchEvent(new Event('waiting'));
			jest.advanceTimersByTime(2999);
		});
		expect(jellyfinService.syncPlayBuffering).not.toHaveBeenCalled();

		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(jellyfinService.syncPlayBuffering).toHaveBeenCalledTimes(1);

		await act(async () => {
			video.dispatchEvent(new Event('playing'));
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(jellyfinService.syncPlayReady).toHaveBeenCalledTimes(1);
		view.unmount();
	});
});
