import {useCallback, useEffect, useRef, useState} from 'react';
import {useRuntimeDiagnosticsEnabled} from './useRuntimeDiagnostics';

const emitScrollerDebugEvent = (detail, enabled) => {
	if (!enabled) return;
	if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof window.CustomEvent !== 'function') {
		return;
	}
	try {
		window.dispatchEvent(new CustomEvent('breezyfin:scroller-debug', {detail}));
	} catch (_) {
		// Debug telemetry must never affect scroll behavior.
	}
};

export const normalizeScrollTop = (value) => {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
	return numericValue;
};

const schedule = (callback) => {
	if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
		const frameId = window.requestAnimationFrame(callback);
		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}
	callback();
	return () => {};
};

const DEFAULT_RESTORE_MAX_ATTEMPTS = 3;
const RESTORE_POSITION_TOLERANCE_PX = 2;
const RESTORE_RETRY_DELAY_MS = 60;
const RESTORE_ANIMATION_TIMEOUT_MS = 1200;

export const resolveScrollerRestoreAttempt = ({
	targetTop = 0,
	actualTop = 0,
	attempt = 0,
	maxAttempts = DEFAULT_RESTORE_MAX_ATTEMPTS,
	tolerance = RESTORE_POSITION_TOLERANCE_PX
} = {}) => {
	const target = normalizeScrollTop(targetTop);
	const actual = normalizeScrollTop(actualTop);
	const normalizedAttempt = Math.max(0, Math.trunc(Number(attempt) || 0));
	const normalizedMaxAttempts = Math.max(0, Math.trunc(Number(maxAttempts) || 0));
	const reachedTarget = Math.abs(target - actual) <= Math.max(0, Number(tolerance) || 0);
	return {
		targetTop: target,
		actualTop: actual,
		reachedTarget,
		shouldRetry: !reachedTarget && normalizedAttempt < normalizedMaxAttempts
	};
};

export const useCachedScrollTopState = (cachedScrollTop = 0) => {
	const [scrollTop, setScrollTop] = useState(() => normalizeScrollTop(cachedScrollTop));

	useEffect(() => {
		const nextTop = normalizeScrollTop(cachedScrollTop);
		setScrollTop((currentTop) => (Math.abs(currentTop - nextTop) < 1 ? currentTop : nextTop));
	}, [cachedScrollTop]);

	return [scrollTop, setScrollTop];
};

export const useScrollerScrollMemory = ({
	isActive = false,
	restoreAnimated = false,
	restoreReady = true,
	restoreMaxAttempts = DEFAULT_RESTORE_MAX_ATTEMPTS,
	restoreRequestId = 0,
	scrollTop = 0,
	onRestoreComplete = null,
	onScrollTopChange = null,
	onScrollTopPersist = null
} = {}) => {
	const diagnosticsEnabled = useRuntimeDiagnosticsEnabled();
	const scrollToRef = useRef(null);
	const targetScrollTopRef = useRef(normalizeScrollTop(scrollTop));
	const lastKnownScrollTopRef = useRef(null);
	// Sandstone scrollers mount at zero even when the requested cached target is
	// non-zero. Keep actual observations separate from the requested target.
	const latestScrollTopRef = useRef(0);
	const hasObservedScrollRef = useRef(false);
	const restoringRef = useRef(false);
	const restoreTimerRef = useRef(null);
	const restoreAttemptRef = useRef(0);
	const retryRestoreRef = useRef(() => {});
	const previousActiveRef = useRef(isActive);
	const lastCommittedScrollTopRef = useRef(null);
	const onRestoreCompleteRef = useRef(onRestoreComplete);
	const onScrollTopChangeRef = useRef(onScrollTopChange);
	const onScrollTopPersistRef = useRef(onScrollTopPersist);
	const persistLatestScrollTopRef = useRef(() => 0);
	const cancelScheduledRestoreRef = useRef(() => {});
	onRestoreCompleteRef.current = onRestoreComplete;
	onScrollTopChangeRef.current = onScrollTopChange;
	onScrollTopPersistRef.current = onScrollTopPersist;

	useEffect(() => {
		targetScrollTopRef.current = normalizeScrollTop(scrollTop);
	}, [scrollTop]);

	const clearRestoreTimer = useCallback(() => {
		if (restoreTimerRef.current !== null) {
			clearTimeout(restoreTimerRef.current);
			restoreTimerRef.current = null;
		}
	}, []);

	const finishRestore = useCallback((rawActualTop = latestScrollTopRef.current) => {
		if (!restoringRef.current) return;
		clearRestoreTimer();
		const restoreAttempt = resolveScrollerRestoreAttempt({
			targetTop: targetScrollTopRef.current,
			actualTop: rawActualTop,
			attempt: restoreAttemptRef.current,
			maxAttempts: restoreMaxAttempts
		});
		if (restoreAttempt.shouldRetry) {
			restoreAttemptRef.current += 1;
			emitScrollerDebugEvent({
				phase: 'restore',
				type: 'retry',
				targetTop: restoreAttempt.targetTop,
				actualTop: restoreAttempt.actualTop,
				attempt: restoreAttemptRef.current
			}, diagnosticsEnabled);
			restoreTimerRef.current = setTimeout(() => {
				restoreTimerRef.current = null;
				retryRestoreRef.current();
			}, RESTORE_RETRY_DELAY_MS);
			return;
		}
		restoringRef.current = false;
		restoreAttemptRef.current = 0;
		const actualTop = restoreAttempt.actualTop;
		latestScrollTopRef.current = actualTop;
		lastKnownScrollTopRef.current = actualTop;
		lastCommittedScrollTopRef.current = actualTop;
		onScrollTopChangeRef.current?.(actualTop);
		emitScrollerDebugEvent({
			phase: 'restore',
			type: restoreAttempt.reachedTarget ? 'complete' : 'clamped',
			targetTop: restoreAttempt.targetTop,
			actualTop
		}, diagnosticsEnabled);
		onRestoreCompleteRef.current?.(actualTop);
	}, [clearRestoreTimer, diagnosticsEnabled, restoreMaxAttempts]);

	const commitLatestScrollTop = useCallback((rawTop = latestScrollTopRef.current) => {
		const nextTop = normalizeScrollTop(rawTop);
		latestScrollTopRef.current = nextTop;
		lastKnownScrollTopRef.current = nextTop;
		lastCommittedScrollTopRef.current = nextTop;
		onScrollTopChangeRef.current?.(nextTop);
		return nextTop;
	}, []);

	const persistLatestScrollTop = useCallback(() => {
		const nextTop = normalizeScrollTop(
			hasObservedScrollRef.current ? latestScrollTopRef.current : targetScrollTopRef.current
		);
		if (lastCommittedScrollTopRef.current === nextTop) return nextTop;
		lastCommittedScrollTopRef.current = nextTop;
		onScrollTopPersistRef.current?.(nextTop);
		return nextTop;
	}, []);
	persistLatestScrollTopRef.current = persistLatestScrollTop;

	const cancelScrollRestore = useCallback(({commit = true} = {}) => {
		if (!restoringRef.current) return false;
		clearRestoreTimer();
		restoringRef.current = false;
		restoreAttemptRef.current = 0;
		const currentTop = normalizeScrollTop(latestScrollTopRef.current);
		try {
			if (typeof scrollToRef.current === 'function') {
				scrollToRef.current({position: {y: currentTop}, animate: false});
			}
		} catch (error) {
			// The tracked position is still safe to persist if the scroller is already gone.
		}
		if (commit) commitLatestScrollTop();
		return true;
	}, [clearRestoreTimer, commitLatestScrollTop]);

	const applyScrollRestore = useCallback((force = false, retry = false) => {
		if (!isActive || !restoreReady) return;
		if (typeof scrollToRef.current !== 'function') return;

		const targetTop = targetScrollTopRef.current;
		const lastTop = lastKnownScrollTopRef.current;
		if (!retry) restoreAttemptRef.current = 0;
		if (!force && lastTop !== null && Math.abs(targetTop - lastTop) < 1) {
			restoringRef.current = true;
			finishRestore(lastTop);
			return;
		}

		try {
			restoringRef.current = true;
			if (targetTop <= 0) {
				emitScrollerDebugEvent({
					phase: 'restore',
					type: 'align-top',
					targetTop,
					force,
					isActive
				}, diagnosticsEnabled);
				scrollToRef.current({align: 'top', animate: restoreAnimated});
			} else {
				emitScrollerDebugEvent({
					phase: 'restore',
					type: 'position',
					targetTop,
					force,
					isActive
				}, diagnosticsEnabled);
				scrollToRef.current({position: {y: targetTop}, animate: restoreAnimated});
			}
		} catch (error) {
			console.warn('Scroller scroll restore skipped due to unavailable scroller surface:', error);
			scrollToRef.current = null;
			restoringRef.current = false;
			return;
		}
		clearRestoreTimer();
		restoreTimerRef.current = setTimeout(
			() => finishRestore(latestScrollTopRef.current),
			restoreAnimated && targetTop > 0 ? RESTORE_ANIMATION_TIMEOUT_MS : 0
		);
	}, [clearRestoreTimer, diagnosticsEnabled, finishRestore, isActive, restoreAnimated, restoreReady]);
	retryRestoreRef.current = () => applyScrollRestore(true, true);

	useEffect(() => {
		cancelScheduledRestoreRef.current();
		cancelScheduledRestoreRef.current = () => {};
		if (previousActiveRef.current && !isActive) {
			const cancelledRestore = cancelScrollRestore();
			if (!cancelledRestore) commitLatestScrollTop();
		}
		previousActiveRef.current = isActive;
		if (!isActive) {
			lastKnownScrollTopRef.current = null;
			scrollToRef.current = null;
			return;
		}
		cancelScheduledRestoreRef.current = schedule(() => applyScrollRestore());
	}, [applyScrollRestore, cancelScrollRestore, commitLatestScrollTop, isActive, restoreReady, restoreRequestId]);

	useEffect(() => {
		return () => {
			cancelScheduledRestoreRef.current();
			cancelScheduledRestoreRef.current = () => {};
			clearRestoreTimer();
			persistLatestScrollTopRef.current();
			scrollToRef.current = null;
		};
	}, [clearRestoreTimer]);

	const captureScrollTo = useCallback((fn) => {
		scrollToRef.current = typeof fn === 'function' ? fn : null;
		if (!isActive || typeof fn !== 'function') return;
		cancelScheduledRestoreRef.current();
		cancelScheduledRestoreRef.current = schedule(() => applyScrollRestore());
	}, [applyScrollRestore, isActive]);

	const handleScroll = useCallback((event) => {
		const rawTop = event?.scrollTop;
		if (!Number.isFinite(Number(rawTop))) return;
		const nextTop = normalizeScrollTop(rawTop);
		hasObservedScrollRef.current = true;
		latestScrollTopRef.current = nextTop;
		lastKnownScrollTopRef.current = nextTop;
	}, []);

	const handleScrollStop = useCallback((event) => {
		const rawTop = event?.scrollTop;
		emitScrollerDebugEvent({
			phase: 'stop',
			type: 'event',
			rawTop,
			reachedBottom: event?.reachedEdgeInfo?.bottom === true,
			reachedTop: event?.reachedEdgeInfo?.top === true
		}, diagnosticsEnabled);
		if (!Number.isFinite(Number(rawTop))) return;
		handleScroll(event);
		if (restoringRef.current) {
			finishRestore(rawTop);
			return;
		}
		commitLatestScrollTop(rawTop);
	}, [commitLatestScrollTop, diagnosticsEnabled, finishRestore, handleScroll]);

	return {
		cancelScrollRestore,
		captureScrollTo,
		commitLatestScrollTop,
		handleScroll,
		handleScrollStop
	};
};
