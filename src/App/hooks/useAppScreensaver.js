import {useCallback, useEffect, useRef, useState} from 'react';
import Spotlight from '@enact/spotlight';
import useInactivityDeadline from '../../hooks/useInactivityDeadline';
import {setRuntimeSuspension} from '../../hooks/useRuntimeSuspension';
import {
	addManagedScreensaverActivityListeners,
	getScreensaverTimeoutMs,
	isScreensaverEligibleView,
	normalizeScreensaverTimeoutMinutes,
	pauseSpotlightForScreensaver,
	resumeSpotlightAfterScreensaver
} from '../../utils/screensaver';

const WAKE_EVENT_SUPPRESSION_MS = 260;

const consumeWakeEvent = (event, {preventDefault = true} = {}) => {
	if (!event) return;
	if (preventDefault && event.cancelable) event.preventDefault();
	event.stopPropagation?.();
	event.stopImmediatePropagation?.();
};

export const useAppScreensaver = ({
	authenticated = false,
	currentView = '',
	timeoutMinutes = '1',
	spotlight = Spotlight
} = {}) => {
	const [active, setActive] = useState(false);
	const activeRef = useRef(false);
	const idleActivityRef = useRef({lastPointerMoveAt: 0, suppressUntil: 0});
	const focusRestoreRef = useRef(null);
	const spotlightPausedByScreensaverRef = useRef(false);
	const normalizedTimeout = normalizeScreensaverTimeoutMinutes(timeoutMinutes);
	const timeoutMs = getScreensaverTimeoutMs(normalizedTimeout);
	const eligible = isScreensaverEligibleView({authenticated, currentView}) && timeoutMs > 0;

	const restoreSpotlight = useCallback(() => {
		if (resumeSpotlightAfterScreensaver(spotlight, spotlightPausedByScreensaverRef.current)) {
			spotlightPausedByScreensaverRef.current = false;
		}
		const restoreTarget = focusRestoreRef.current;
		focusRestoreRef.current = null;
		if (!restoreTarget) return;
		window.requestAnimationFrame?.(() => {
			const {element, spotlightId} = restoreTarget;
			if (spotlightId && spotlight?.focus?.(spotlightId)) return;
			if (!element?.isConnected) return;
			try {
				if (spotlight?.focus?.(element)) return;
			} catch (_) {
				// Fall back to native focus when Spotlight rejects a stale wrapper.
			}
			element.focus?.();
		});
	}, [spotlight]);

	const dismiss = useCallback(({consumeUntil = 0} = {}) => {
		if (!activeRef.current) return false;
		activeRef.current = false;
		setActive(false);
		if (consumeUntil > 0) {
			idleActivityRef.current.suppressUntil = Date.now() + consumeUntil;
		}
		restoreSpotlight();
		return true;
	}, [restoreSpotlight]);

	const activate = useCallback(() => {
		if (activeRef.current) return;
		const activeElement = document.activeElement;
		focusRestoreRef.current = activeElement && activeElement !== document.body
			? {
				element: activeElement,
				spotlightId: activeElement.dataset?.spotlightId || ''
			}
			: null;
		spotlightPausedByScreensaverRef.current = pauseSpotlightForScreensaver(spotlight);
		activeRef.current = true;
		setActive(true);
	}, [spotlight]);
	const {clear: clearInactivityDeadline, markActivity} = useInactivityDeadline({
		enabled: eligible,
		timeoutMs,
		onDeadline: activate
	});

	useEffect(() => {
		if (!eligible) {
			clearInactivityDeadline();
			if (activeRef.current) dismiss();
		}
	}, [clearInactivityDeadline, dismiss, eligible]);

	useEffect(() => {
		setRuntimeSuspension('app-screensaver', active);
		return () => setRuntimeSuspension('app-screensaver', false);
	}, [active]);

	useEffect(() => {
		const removeActivityListeners = addManagedScreensaverActivityListeners({
			active,
			activeRef,
			onWake: (event) => {
				consumeWakeEvent(event);
				dismiss({consumeUntil: WAKE_EVENT_SUPPRESSION_MS});
				markActivity();
			},
			idleActivityRef,
			markActivity,
			consumeEvent: consumeWakeEvent
		});
		return removeActivityListeners;
	}, [active, dismiss, markActivity]);

	useEffect(() => () => {
		clearInactivityDeadline();
		if (!activeRef.current) return;
		activeRef.current = false;
		restoreSpotlight();
	}, [clearInactivityDeadline, restoreSpotlight]);

	return {active, dismiss};
};
