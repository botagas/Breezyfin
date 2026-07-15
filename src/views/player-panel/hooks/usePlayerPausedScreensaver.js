import {useCallback, useEffect, useRef, useState} from 'react';
import {KeyCodes} from '../../../utils/keyCodes';
import useInactivityDeadline from '../../../hooks/useInactivityDeadline';
import {setRuntimeSuspension} from '../../../hooks/useRuntimeSuspension';
import {
	addManagedScreensaverActivityListeners,
	getScreensaverTimeoutMs,
	isPausedPlayerScreensaverEligible,
	normalizeScreensaverTimeoutMinutes
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

export const usePlayerPausedScreensaver = ({
	isActive = false,
	playing = false,
	loading = false,
	error = null,
	playbackStarted = false,
	blocked = false,
	timeoutMinutes = '1',
	onWake,
	onResume
} = {}) => {
	const [active, setActive] = useState(false);
	const activeRef = useRef(false);
	const idleActivityRef = useRef({lastPointerMoveAt: 0, suppressUntil: 0});
	const onWakeRef = useRef(onWake);
	const onResumeRef = useRef(onResume);

	useEffect(() => {
		onWakeRef.current = onWake;
		onResumeRef.current = onResume;
	}, [onResume, onWake]);

	const dismiss = useCallback(() => {
		if (!activeRef.current) return false;
		activeRef.current = false;
		setActive(false);
		return true;
	}, []);

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
				idleActivityRef.current.suppressUntil = Date.now() + WAKE_EVENT_SUPPRESSION_MS;
				dismiss();
				onWakeRef.current?.();
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
	}, [active, dismiss, markActivity]);

	useEffect(() => () => {
		clearInactivityDeadline();
		activeRef.current = false;
	}, [clearInactivityDeadline]);

	return {active, dismiss};
};
