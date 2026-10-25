import {act, renderHook, waitFor} from '@testing-library/react';
import {useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {CRASH_RECOVERY_ACTIONS, consumeCrashRecoveryAction, peekCrashRecoveryAction, queueCrashRecoveryAction} from '../../../utils/crashRecovery';
import {useAppSessionRestore} from '../useAppSessionRestore';
import {useHomePlaybackLaunch} from '../useHomePlaybackLaunch';
import {createHomeLaunchInbox} from '../../utils/homeLaunch';

jest.mock('../../../services/jellyfinService', () => ({__esModule: true, default: {
	restoreSession: jest.fn(), getCurrentUser: jest.fn(), getPublicServerInfo: jest.fn(), getItem: jest.fn()
}}));

describe('session restoration crash-recovery ownership', () => {
	let options;
	beforeEach(() => {
		localStorage.clear(); jest.clearAllMocks();
		Object.assign(jellyfinService, {sessionGeneration: 1, serverUrl: 'https://jellyfin.example.test', userId: 'user', accessToken: 'local-test-token'});
		jellyfinService.restoreSession.mockReturnValue(true);
		jellyfinService.getCurrentUser.mockResolvedValue({Id: 'user'});
		queueCrashRecoveryAction(CRASH_RECOVERY_ACTIONS.DETAILS);
		options = {
			crashRecoveryPendingRef: {current: true}, resetSessionState: jest.fn(),
			applyPendingCrashRecovery: jest.fn(), handleSessionExpired: jest.fn(),
			setSessionActive: jest.fn(), setCurrentView: jest.fn(), setLoginNotice: jest.fn(),
			setLoginNoticeNonce: jest.fn(), setSessionRestorePending: jest.fn()
		};
	});
	it.each(['no saved session', 'invalid runtime identity', 'missing user'])('releases recovery after %s so later Home launches are not blocked', async (failure) => {
		if (failure === 'no saved session') jellyfinService.restoreSession.mockReturnValue(false);
		if (failure === 'invalid runtime identity') jellyfinService.accessToken = null;
		if (failure === 'missing user') jellyfinService.getCurrentUser.mockResolvedValue(null);
		renderHook(() => useAppSessionRestore(options));
		await waitFor(() => expect(options.setSessionRestorePending).toHaveBeenCalledWith(false));
		expect(options.crashRecoveryPendingRef.current).toBe(false);
		expect(peekCrashRecoveryAction()).toBeNull();
		expect(options.applyPendingCrashRecovery).not.toHaveBeenCalled();
	});
	it('applies recovery on successful restore before releasing the recovery latch', async () => {
		options.applyPendingCrashRecovery.mockImplementation(() => {
			expect(consumeCrashRecoveryAction()).toBe(CRASH_RECOVERY_ACTIONS.DETAILS);
			options.crashRecoveryPendingRef.current = false;
		});
		renderHook(() => useAppSessionRestore(options));
		await waitFor(() => expect(options.setSessionRestorePending).toHaveBeenCalledWith(false));
		expect(options.applyPendingCrashRecovery).toHaveBeenCalledTimes(1);
		expect(options.setSessionActive).toHaveBeenCalledWith(true);
		expect(options.crashRecoveryPendingRef.current).toBe(false);
	});
	it.each(['restore', 'user lookup'])('releases recovery if %s throws', async (stage) => {
		if (stage === 'restore') jellyfinService.restoreSession.mockImplementation(() => { throw new Error('restore failed'); });
		else jellyfinService.getCurrentUser.mockRejectedValue(new Error('lookup failed'));
		renderHook(() => useAppSessionRestore(options));
		await waitFor(() => expect(options.setSessionRestorePending).toHaveBeenCalledWith(false));
		expect(options.crashRecoveryPendingRef.current).toBe(false);
		expect(peekCrashRecoveryAction()).toBeNull();
		expect(options.handleSessionExpired).toHaveBeenCalledTimes(1);
	});
	it('lets explicit login discard stale recovery without applying a previous account snapshot', async () => {
		let resolve;
		jellyfinService.getCurrentUser.mockReturnValue(new Promise((r) => { resolve = r; }));
		const view = renderHook(() => useAppSessionRestore(options));
		act(() => {
			view.result.current();
			jellyfinService.sessionGeneration += 1;
		});
		expect(peekCrashRecoveryAction()).toBeNull();
		expect(options.crashRecoveryPendingRef.current).toBe(false);
		await act(async () => resolve({Id: 'old-user'}));
		expect(options.applyPendingCrashRecovery).not.toHaveBeenCalled();
		expect(options.setSessionActive).not.toHaveBeenCalled();
	});
	it('does not expire a newer session when the old user lookup rejects', async () => {
		let reject;
		jellyfinService.getCurrentUser.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
		renderHook(() => useAppSessionRestore(options));
		jellyfinService.sessionGeneration += 1;
		await act(async () => reject(new Error('old lookup failed')));
		expect(options.handleSessionExpired).not.toHaveBeenCalled();
		expect(options.applyPendingCrashRecovery).not.toHaveBeenCalled();
		expect(options.crashRecoveryPendingRef.current).toBe(false);
	});
	it('keeps Return Home recovery ahead of automatic sign-in', async () => {
		queueCrashRecoveryAction(CRASH_RECOVERY_ACTIONS.HOME);
		renderHook(() => useAppSessionRestore(options));
		await waitFor(() => expect(options.setSessionRestorePending).toHaveBeenCalledWith(false));
		expect(jellyfinService.restoreSession).not.toHaveBeenCalled();
		expect(options.setCurrentView).toHaveBeenCalledWith('login');
		expect(options.crashRecoveryPendingRef.current).toBe(false);
		expect(peekCrashRecoveryAction()).toBeNull();
	});
	it('does not clear a recovery action after its restoration owner unmounts', async () => {
		let resolve;
		jellyfinService.getCurrentUser.mockReturnValue(new Promise((r) => { resolve = r; }));
		const view = renderHook(() => useAppSessionRestore(options));
		view.unmount();
		await act(async () => resolve({Id: 'user'}));
		expect(options.setSessionRestorePending).not.toHaveBeenCalled();
		expect(options.applyPendingCrashRecovery).not.toHaveBeenCalled();
		expect(peekCrashRecoveryAction()).toBe(CRASH_RECOVERY_ACTIONS.DETAILS);
	});
	it('allows a fresh Home request to prompt for login and continue after failed recovery', async () => {
		jellyfinService.restoreSession.mockReturnValue(false);
		Object.defineProperty(document, 'hidden', {configurable: true, value: false});
		const serverId = 'b'.repeat(32), userId = 'c'.repeat(32), itemId = 'd'.repeat(32);
		const item = {Id: itemId, Type: 'Movie'};
		jellyfinService.getPublicServerInfo.mockResolvedValue({Id: serverId});
		jellyfinService.getItem.mockResolvedValue(item);
		const inbox = createHomeLaunchInbox();
		const prepare = jest.fn();
		const view = renderHook(() => {
			const [authenticated, setAuthenticated] = useState(false);
			const [restoring, setRestoring] = useState(true);
			const discard = useAppSessionRestore({...options, setSessionActive: setAuthenticated, setSessionRestorePending: setRestoring});
			const home = useHomePlaybackLaunch({
				inbox, authenticated, restoring, crashRecoveryPending: options.crashRecoveryPendingRef.current,
				currentView: 'login', selectedItem: null, onPrepare: prepare, onChooseAccount: options.resetSessionState
			});
			return {home, login: () => { discard(); setRestoring(false); setAuthenticated(true); }};
		});
		await waitFor(() => expect(options.crashRecoveryPendingRef.current).toBe(false));
		act(() => inbox.receive({breezyfinHome: {
			version: 1, action: 'play', requestId: 'after-failed-recovery', itemId, serverId, userId, serverUrl: jellyfinService.serverUrl
		}}));
		await waitFor(() => expect(view.result.current.home.notice?.account).toBe(true));
		act(() => {
			view.result.current.home.chooseAccount();
			jellyfinService.userId = userId;
			jellyfinService.sessionGeneration += 1;
			view.result.current.login();
		});
		await waitFor(() => expect(prepare).toHaveBeenCalledWith(item));
		expect(options.applyPendingCrashRecovery).not.toHaveBeenCalled();
		expect(peekCrashRecoveryAction()).toBeNull();
	});
});
