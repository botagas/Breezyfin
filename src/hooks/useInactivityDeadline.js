import {useCallback, useEffect, useRef} from 'react';

export const useInactivityDeadline = ({
	enabled = false,
	timeoutMs = 0,
	onDeadline
} = {}) => {
	const deadlineRef = useRef(0);
	const timerRef = useRef(null);
	const enabledRef = useRef(enabled);
	const timeoutMsRef = useRef(timeoutMs);
	const onDeadlineRef = useRef(onDeadline);

	useEffect(() => {
		onDeadlineRef.current = onDeadline;
	}, [onDeadline]);

	const clear = useCallback(() => {
		deadlineRef.current = 0;
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const scheduleCheck = useCallback(() => {
		if (timerRef.current !== null || !enabledRef.current || timeoutMsRef.current <= 0) return;
		const checkDeadline = () => {
			timerRef.current = null;
			if (!enabledRef.current || timeoutMsRef.current <= 0 || deadlineRef.current <= 0) return;
			const deadlineRemainingMs = deadlineRef.current - Date.now();
			if (deadlineRemainingMs > 0) {
				timerRef.current = setTimeout(checkDeadline, deadlineRemainingMs);
				return;
			}
			deadlineRef.current = 0;
			onDeadlineRef.current?.();
		};
		const remainingMs = Math.max(0, deadlineRef.current - Date.now());
		timerRef.current = setTimeout(checkDeadline, remainingMs);
	}, []);

	const markActivity = useCallback((atMs = Date.now()) => {
		if (!enabledRef.current || timeoutMsRef.current <= 0) return false;
		deadlineRef.current = Number(atMs) + timeoutMsRef.current;
		scheduleCheck();
		return true;
	}, [scheduleCheck]);

	useEffect(() => {
		enabledRef.current = enabled;
		timeoutMsRef.current = Math.max(0, Number(timeoutMs) || 0);
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (!enabledRef.current || timeoutMsRef.current <= 0) {
			deadlineRef.current = 0;
			return undefined;
		}
		deadlineRef.current = Date.now() + timeoutMsRef.current;
		scheduleCheck();
		return undefined;
	}, [clear, enabled, scheduleCheck, timeoutMs]);

	useEffect(() => clear, [clear]);

	return {clear, deadlineRef, markActivity};
};

export default useInactivityDeadline;
