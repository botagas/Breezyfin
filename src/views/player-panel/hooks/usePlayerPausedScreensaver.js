import {useCallback, useEffect, useRef, useState} from 'react';
import {KeyCodes} from '../../../utils/keyCodes';
import useInactivityDeadline from '../../../hooks/useInactivityDeadline';
import {setRuntimeSuspension} from '../../../hooks/useRuntimeSuspension';
import {
	addManagedScreensaverActivityListeners,
	getScreensaverTimeoutMs,
	isPausedPlayerScreensaverEligible,
	normalizeScreensaverTimeoutMinutes,
	setScreensaverWakeSuppression
} from '../../../utils/screensaver';

const RESUME_KEYS = new Set([KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE]);
const WAKE_EVENT_SUPPRESSION_MS = 260;

const consumeWakeEvent = (event, {preventDefault = true} = {}) => {
	if (!event) return;
	if (preventDefault && event.cancelable) event.preventDefault();
	event.stopPropagation?.();
	event.stopImmediatePropagation?.();
};

export const isPausedScreensaverResumeEvent = (event) => (
	event?.type === 'keydown' && RESUME_KEYS.has(event.keyCode || event.which)
);

export const shouldRestorePlayerFocusAfterScreensaverWake = (event) => (
	!event || event.type === 'keydown'
);

export const usePlayerPausedScreensaver = ({
	isActive = false,
	playing = false,
	loading = false,
	error = null,
	playbackStarted = false,
	blocked = false,
	timeoutMinutes = '1',
	lastInteractionRef,
	setControlsVisible,
	focusWakeAction,
	preferSkipFocus = false,
	activeStateRef,
	onWake,
	onResume
} = {}) => {
	const [active, setActive] = useState(false);
	const activeRef = useRef(false);
	const idleActivityRef = useRef({lastPointerMoveAt: 0, suppressUntil: 0, suppressedEventType: ''});
	const onWakeRef = useRef(onWake);
	const onResumeRef = useRef(onResume);
	const wakeUiRef = useRef({lastInteractionRef, setControlsVisible, focusWakeAction, preferSkipFocus});
	if (activeStateRef) activeStateRef.current = active;

	useEffect(() => {
		onWakeRef.current = onWake;
		onResumeRef.current = onResume;
	}, [onResume, onWake]);
	useEffect(() => {
		wakeUiRef.current = {lastInteractionRef, setControlsVisible, focusWakeAction, preferSkipFocus};
	}, [focusWakeAction, lastInteractionRef, preferSkipFocus, setControlsVisible]);

	const dismiss = useCallback(() => {
		if (!activeRef.current) return false;
		activeRef.current = false;
		setActive(false);
		return true;
	}, []);
	const wake = useCallback((event) => {
		if (!dismiss()) return false;
		const wakeUi = wakeUiRef.current;
		if (wakeUi.lastInteractionRef) wakeUi.lastInteractionRef.current = Date.now();
		wakeUi.setControlsVisible?.(true);
		if (shouldRestorePlayerFocusAfterScreensaverWake(event)) {
			wakeUi.focusWakeAction?.({preferSkip: wakeUi.preferSkipFocus});
		}
		onWakeRef.current?.(event);
		return true;
	}, [dismiss]);

	const activate = useCallback(() => {
		if (activeRef.current) return;
		activeRef.current = true;
		setActive(true);
	}, []);
	const normalizedTimeout = normalizeScreensaverTimeoutMinutes(timeoutMinutes);
	const timeoutMs = getScreensaverTimeoutMs(normalizedTimeout);
	const eligible = isPausedPlayerScreensaverEligible({
		isActive,
		playing,
		loading,
		hasError: Boolean(error),
		playbackStarted,
		blocked,
		timeoutMinutes: normalizedTimeout
	});
	const {clear: clearInactivityDeadline, markActivity} = useInactivityDeadline({
		enabled: eligible,
		timeoutMs,
		onDeadline: activate
	});

	useEffect(() => {
		if (!eligible) {
			clearInactivityDeadline();
			dismiss();
		}
	}, [clearInactivityDeadline, dismiss, eligible]);

	useEffect(() => {
		setRuntimeSuspension('player-screensaver', active);
		return () => setRuntimeSuspension('player-screensaver', false);
	}, [active]);

	useEffect(() => {
		const removeActivityListeners = addManagedScreensaverActivityListeners({
			active,
			activeRef,
			onWake: (event) => {
				const shouldResume = isPausedScreensaverResumeEvent(event);
				consumeWakeEvent(event);
				setScreensaverWakeSuppression({
					idleState: idleActivityRef.current,
					event,
					durationMs: WAKE_EVENT_SUPPRESSION_MS
				});
				wake(event);
				if (shouldResume) {
					Promise.resolve(onResumeRef.current?.()).catch((resumeError) => {
						console.warn('Failed to resume playback from paused screensaver:', resumeError);
					});
				} else {
					markActivity();
				}
			},
			idleActivityRef,
			markActivity,
			consumeEvent: consumeWakeEvent
		});
		return removeActivityListeners;
	}, [active, markActivity, wake]);

	useEffect(() => () => {
		clearInactivityDeadline();
		activeRef.current = false;
	}, [clearInactivityDeadline]);

	return {active, dismiss: wake};
};
