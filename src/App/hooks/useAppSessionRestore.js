import {useCallback, useEffect} from 'react';
import jellyfinService from '../../services/jellyfinService';
import {CRASH_RECOVERY_ACTIONS, consumeCrashRecoveryAction, peekCrashRecoveryAction} from '../../utils/crashRecovery';
import {captureRuntimeSessionIdentity, isRuntimeSessionIdentityCurrent} from '../../utils/savedSessionIdentity';

export const useAppSessionRestore = ({
	crashRecoveryPendingRef, resetSessionState, applyPendingCrashRecovery, handleSessionExpired,
	setSessionActive, setCurrentView, setLoginNotice, setLoginNoticeNonce, setSessionRestorePending
}) => {
	const discardPendingCrashRecovery = useCallback(() => {
		consumeCrashRecoveryAction();
		crashRecoveryPendingRef.current = false;
	}, [crashRecoveryPendingRef]);
	useEffect(() => {
		let cancelled = false;
		const restoreSession = async () => {
			let restoredSessionIdentity = null;
			try {
				if (peekCrashRecoveryAction() === CRASH_RECOVERY_ACTIONS.HOME) {
					discardPendingCrashRecovery();
					resetSessionState();
					setCurrentView('login');
					setLoginNotice('Crash recovery paused automatic sign-in. Choose an account or open diagnostics.');
					setLoginNoticeNonce((value) => value + 1);
					return;
				}
				const restored = jellyfinService.restoreSession();
				if (!restored) return;
				restoredSessionIdentity = captureRuntimeSessionIdentity(jellyfinService);
				if (!restoredSessionIdentity) return;
				const user = await jellyfinService.getCurrentUser();
				if (cancelled || !isRuntimeSessionIdentityCurrent(restoredSessionIdentity, jellyfinService)) return;
				if (user) {
					setSessionActive(true);
					setCurrentView('home');
					applyPendingCrashRecovery();
					return;
				}
				handleSessionExpired();
			} catch (_) {
				if (!cancelled && (!restoredSessionIdentity || isRuntimeSessionIdentityCurrent(restoredSessionIdentity, jellyfinService))) {
					handleSessionExpired();
				}
			} finally {
				if (!cancelled) {
					if (crashRecoveryPendingRef.current) discardPendingCrashRecovery();
					setSessionRestorePending(false);
				}
			}
		};
		restoreSession();
		return () => {
			cancelled = true;
		};
	}, [
		applyPendingCrashRecovery, crashRecoveryPendingRef, discardPendingCrashRecovery,
		handleSessionExpired, resetSessionState, setCurrentView, setLoginNotice,
		setLoginNoticeNonce, setSessionActive, setSessionRestorePending
	]);
	return discardPendingCrashRecovery;
};
