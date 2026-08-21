import {act, renderHook} from '@testing-library/react';
import jellyfinService from '../../../../services/jellyfinService';
import {useLoginQuickConnect} from '../useLoginQuickConnect';

jest.mock('../../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		getQuickConnectEnabled: jest.fn(),
		initiateQuickConnect: jest.fn(),
		getQuickConnectState: jest.fn(),
		authenticateWithQuickConnect: jest.fn()
	}
}));

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

describe('useLoginQuickConnect', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it('polls without overlap and authenticates an approved code once', async () => {
		const onAuthenticated = jest.fn();
		let resolvePoll;
		jellyfinService.initiateQuickConnect.mockResolvedValue({Code: 'ABC123', Secret: 'secret-1'});
		jellyfinService.getQuickConnectState.mockImplementation(() => new Promise((resolve) => {
			resolvePoll = resolve;
		}));
		jellyfinService.authenticateWithQuickConnect.mockResolvedValue({Id: 'user-1'});
		const {result} = renderHook(() => useLoginQuickConnect({isActive: true, onAuthenticated}));

		await act(async () => {
			await result.current.start();
		});
		expect(result.current.code).toBe('ABC123');
		await act(async () => {
			jest.advanceTimersByTime(15000);
		});
		expect(jellyfinService.getQuickConnectState).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolvePoll({Authenticated: true});
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(jellyfinService.authenticateWithQuickConnect).toHaveBeenCalledTimes(1);
		expect(onAuthenticated).toHaveBeenCalledWith({Id: 'user-1'});
	});

	it('ignores initiation after cancellation', async () => {
		let resolveInitiation;
		jellyfinService.initiateQuickConnect.mockImplementation(() => new Promise((resolve) => {
			resolveInitiation = resolve;
		}));
		const {result} = renderHook(() => useLoginQuickConnect({isActive: true, onAuthenticated: jest.fn()}));

		act(() => {
			void result.current.start();
		});
		act(() => result.current.cancel());
		await act(async () => {
			resolveInitiation({Code: 'STALE1', Secret: 'stale-secret'});
			await Promise.resolve();
		});

		expect(result.current.phase).toBe('idle');
		expect(result.current.code).toBe('');
		expect(jellyfinService.getQuickConnectState).not.toHaveBeenCalled();
	});

	it('stops after four consecutive polling failures', async () => {
		jellyfinService.initiateQuickConnect.mockResolvedValue({Code: 'ABC123', Secret: 'secret-1'});
		jellyfinService.getQuickConnectState.mockRejectedValue(new Error('offline'));
		const {result} = renderHook(() => useLoginQuickConnect({isActive: true, onAuthenticated: jest.fn()}));
		await act(async () => {
			await result.current.start();
		});

		for (let index = 0; index < 4; index += 1) {
			await act(async () => {
				jest.advanceTimersByTime(5000);
				await Promise.resolve();
			});
		}
		await flush();
		expect(result.current.phase).toBe('failed');
		expect(jellyfinService.getQuickConnectState).toHaveBeenCalledTimes(4);
	});

	it('cancels pending work when the panel becomes inactive', async () => {
		jellyfinService.initiateQuickConnect.mockResolvedValue({Code: 'ABC123', Secret: 'secret-1'});
		const {result, rerender} = renderHook(
			({active}) => useLoginQuickConnect({isActive: active, onAuthenticated: jest.fn()}),
			{initialProps: {active: true}}
		);
		await act(async () => {
			await result.current.start();
		});

		rerender({active: false});
		act(() => jest.advanceTimersByTime(10000));
		expect(result.current.phase).toBe('idle');
		expect(jellyfinService.getQuickConnectState).not.toHaveBeenCalled();
	});

	it('expires after five minutes even when a polling request is pending', async () => {
		jellyfinService.initiateQuickConnect.mockResolvedValue({Code: 'ABC123', Secret: 'secret-1'});
		jellyfinService.getQuickConnectState.mockImplementation(() => new Promise(() => {}));
		const {result} = renderHook(() => useLoginQuickConnect({isActive: true, onAuthenticated: jest.fn()}));
		await act(async () => {
			await result.current.start();
		});
		act(() => {
			jest.advanceTimersByTime(5 * 60 * 1000);
		});

		expect(result.current.phase).toBe('expired');
		expect(jellyfinService.getQuickConnectState).toHaveBeenCalledTimes(1);
	});
});
