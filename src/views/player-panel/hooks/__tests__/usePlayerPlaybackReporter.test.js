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
		jellyfinService.reportPlaybackProgress
			.mockImplementationOnce(() => first.promise)
			.mockResolvedValue(undefined);
		const props = createProps();
		const {result} = renderHook(() => usePlayerPlaybackReporter(props));

		act(() => {
			result.current.reportPlaybackProgressNow(false);
			result.current.reportPlaybackProgressNow(false, {force: false});
			props.videoRef.current.currentTime = 15;
			result.current.reportPlaybackProgressNow(true);
		});

		await waitFor(() => expect(jellyfinService.reportPlaybackProgress).toHaveBeenCalledTimes(1));
		first.resolve();
		await waitFor(() => expect(jellyfinService.reportPlaybackProgress).toHaveBeenCalledTimes(2));
		expect(jellyfinService.reportPlaybackProgress).toHaveBeenLastCalledWith(
			'item-1',
			150000000,
			true,
			expect.objectContaining({playSessionId: 'session-1'})
		);
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
