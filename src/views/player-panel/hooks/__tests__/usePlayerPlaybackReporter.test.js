jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		reportPlaybackStart: jest.fn(),
		reportPlaybackProgress: jest.fn(),
		reportPlaybackStopped: jest.fn()
	}
}));

import {act, renderHook, waitFor} from '@testing-library/react';

import jellyfinService from '../../../../services/jellyfinService';
import {usePlayerPlaybackReporter} from '../usePlayerPlaybackReporter';

const createDeferred = () => {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return {promise, resolve};
};

const createProps = () => ({
	item: {Id: 'item-1'},
	videoRef: {current: {currentTime: 12, paused: false}},
	progressIntervalRef: {current: null},
	playbackGenerationRef: {current: 3},
	playbackSessionRef: {
		current: {
			playSessionId: 'session-1',
			mediaSourceId: 'source-1',
			playMethod: 'DirectPlay'
		}
	},
	getPlaybackSessionContext: jest.fn(() => ({
		playSessionId: 'session-1',
		mediaSourceId: 'source-1',
		playMethod: 'DirectPlay'
	}))
});

describe('usePlayerPlaybackReporter', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('reports PlaybackStart once for the active item, session, and generation', async () => {
		jellyfinService.reportPlaybackStart.mockResolvedValue(undefined);
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));

		await act(async () => {
			await result.current.reportPlaybackStartedOnce();
			await result.current.reportPlaybackStartedOnce();
		});

		expect(jellyfinService.reportPlaybackStart).toHaveBeenCalledTimes(1);
		expect(jellyfinService.reportPlaybackStart).toHaveBeenCalledWith(
			'item-1',
			120000000,
			expect.objectContaining({playSessionId: 'session-1'})
		);
	});

	it('does not overlap progress requests and keeps the latest forced pause state', async () => {
		const first = createDeferred();
		const second = createDeferred();
		jellyfinService.reportPlaybackProgress
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));
		let forcedReport;
		let forcedSettled = false;

		act(() => {
			result.current.reportPlaybackProgressNow(false);
			result.current.reportPlaybackProgressNow(false, {force: false});
			props.videoRef.current.currentTime = 15;
			forcedReport = result.current.reportPlaybackProgressNow(true).then((value) => {
				forcedSettled = true;
				return value;
			});
		});

		await waitFor(() => expect(jellyfinService.reportPlaybackProgress).toHaveBeenCalledTimes(1));
		first.resolve();
		await waitFor(() => expect(jellyfinService.reportPlaybackProgress).toHaveBeenCalledTimes(2));
		expect(forcedSettled).toBe(false);
		expect(jellyfinService.reportPlaybackProgress).toHaveBeenLastCalledWith(
			'item-1',
			150000000,
			true,
			expect.objectContaining({playSessionId: 'session-1'})
		);
		second.resolve();
		await act(async () => {
			await expect(forcedReport).resolves.toBe(true);
		});
		expect(forcedSettled).toBe(true);
	});

	it('coalesces forced progress waiters onto the latest queued snapshot', async () => {
		const first = createDeferred();
		jellyfinService.reportPlaybackProgress
			.mockImplementationOnce(() => first.promise)
			.mockResolvedValueOnce(undefined);
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));
		let firstForced;
		let secondForced;

		act(() => {
			result.current.reportPlaybackProgressNow(false);
			props.videoRef.current.currentTime = 14;
			firstForced = result.current.reportPlaybackProgressNow(true);
			props.videoRef.current.currentTime = 16;
			secondForced = result.current.reportPlaybackProgressNow(false);
		});

		first.resolve();
		await act(async () => {
			await expect(Promise.all([firstForced, secondForced])).resolves.toEqual([true, true]);
		});
		expect(jellyfinService.reportPlaybackProgress).toHaveBeenCalledTimes(2);
		expect(jellyfinService.reportPlaybackProgress).toHaveBeenLastCalledWith(
			'item-1',
			160000000,
			false,
			expect.objectContaining({playSessionId: 'session-1'})
		);
	});

	it('resolves queued forced progress as stale after a generation change', async () => {
		const first = createDeferred();
		jellyfinService.reportPlaybackProgress.mockImplementationOnce(() => first.promise);
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));
		let queuedReport;

		act(() => {
			result.current.reportPlaybackProgressNow(false);
			queuedReport = result.current.reportPlaybackProgressNow(true);
		});
		props.playbackGenerationRef.current = 4;
		first.resolve();

		await act(async () => {
			await expect(queuedReport).resolves.toBe(false);
		});
		expect(jellyfinService.reportPlaybackProgress).not.toHaveBeenCalled();
	});

	it('reports and deduplicates an explicit superseded session without stopping the active timer', async () => {
		jellyfinService.reportPlaybackStopped.mockResolvedValue(undefined);
		const props = createProps();
		props.progressIntervalRef.current = setInterval(() => {}, 1000);
		const {result, unmount} = renderHook(() => usePlayerPlaybackReporter(props));
		const snapshot = {
			itemId: 'item-1',
			positionTicks: 90000000,
			session: {
				playSessionId: 'old-session',
				mediaSourceId: 'old-source',
				playMethod: 'DirectPlay'
			}
		};

		await act(async () => {
			await expect(result.current.reportPlaybackSessionStopped(snapshot)).resolves.toBe(true);
			await expect(result.current.reportPlaybackSessionStopped(snapshot)).resolves.toBe(false);
		});

		expect(jellyfinService.reportPlaybackStopped).toHaveBeenCalledTimes(1);
		expect(jellyfinService.reportPlaybackStopped).toHaveBeenCalledWith(
			'item-1',
			90000000,
			expect.objectContaining({playSessionId: 'old-session'})
		);
		expect(props.progressIntervalRef.current).not.toBeNull();
		unmount();
	});

	it('rejects explicit session stops without an addressable PlaySessionId', async () => {
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));

		await act(async () => {
			await expect(result.current.reportPlaybackSessionStopped({
				itemId: 'item-1',
				positionTicks: 1,
				session: {mediaSourceId: 'source-1'}
			})).resolves.toBe(false);
		});
		expect(jellyfinService.reportPlaybackStopped).not.toHaveBeenCalled();
	});

	it('retains explicit stop deduplication across an item replacement', async () => {
		jellyfinService.reportPlaybackStopped.mockResolvedValue(undefined);
		const props = createProps();
		const {result, rerender} = renderHook(() => usePlayerPlaybackReporter(props));
		const snapshot = {
			itemId: 'item-1',
			positionTicks: 90000000,
			session: {playSessionId: 'old-session'}
		};

		await act(async () => {
			await result.current.reportPlaybackSessionStopped(snapshot);
		});
		props.item = {Id: 'item-2'};
		rerender();
		await act(async () => {
			await expect(result.current.reportPlaybackSessionStopped(snapshot)).resolves.toBe(false);
		});

		expect(jellyfinService.reportPlaybackStopped).toHaveBeenCalledTimes(1);
	});

	it('keeps reporting failures best-effort', async () => {
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		jellyfinService.reportPlaybackProgress.mockRejectedValue(new Error('offline'));
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));

		await act(async () => {
			await expect(result.current.reportPlaybackProgressNow(true)).resolves.toBeUndefined();
		});
		warnSpy.mockRestore();
	});
});
