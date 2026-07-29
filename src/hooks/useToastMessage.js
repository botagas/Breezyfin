import {useState, useRef, useEffect, useCallback} from 'react';

export const TOAST_SEVERITIES = Object.freeze({
	INFO: 'info',
	WARNING: 'warning',
	ERROR: 'error'
});

export const normalizeToastInput = (input) => {
	if (typeof input === 'string') {
		return {
			message: input.trim(),
			severity: TOAST_SEVERITIES.INFO
		};
	}
	const message = typeof input?.message === 'string' ? input.message.trim() : '';
	const severity = Object.values(TOAST_SEVERITIES).includes(input?.severity)
		? input.severity
		: TOAST_SEVERITIES.INFO;
	return {message, severity};
};

export const useToastMessage = (options = {}) => {
	const {
		durationMs = 2000,
		fadeOutMs = 0,
		stack = false,
		maxVisible = 1
	} = options;
	const [toastMessage, setToastMessage] = useState('');
	const [toastSeverity, setToastSeverity] = useState(TOAST_SEVERITIES.INFO);
	const [toastVisible, setToastVisible] = useState(false);
	const [toastMessages, setToastMessages] = useState([]);
	const frameRef = useRef(null);
	const hideTimerRef = useRef(null);
	const clearTimerRef = useRef(null);
	const stackTimersRef = useRef(new Map());
	const nextToastIdRef = useRef(1);

	const clearToastTimers = useCallback(() => {
		if (frameRef.current !== null) {
			window.cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		}
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
		if (clearTimerRef.current) {
			clearTimeout(clearTimerRef.current);
			clearTimerRef.current = null;
		}
	}, []);

	const clearStackTimers = useCallback((id = null) => {
		if (id !== null) {
			const timers = stackTimersRef.current.get(id);
			if (!timers) return;
			if (timers.frame !== null) window.cancelAnimationFrame(timers.frame);
			if (timers.hide) clearTimeout(timers.hide);
			if (timers.clear) clearTimeout(timers.clear);
			stackTimersRef.current.delete(id);
			return;
		}
		stackTimersRef.current.forEach((timers) => {
			if (timers.frame !== null) window.cancelAnimationFrame(timers.frame);
			if (timers.hide) clearTimeout(timers.hide);
			if (timers.clear) clearTimeout(timers.clear);
		});
		stackTimersRef.current.clear();
	}, []);

	const clearToast = useCallback(() => {
		clearToastTimers();
		clearStackTimers();
		setToastVisible(false);
		setToastMessage('');
		setToastSeverity(TOAST_SEVERITIES.INFO);
		setToastMessages([]);
	}, [clearStackTimers, clearToastTimers]);

	const addStackedToast = useCallback((toastInput) => {
		const normalized = normalizeToastInput(toastInput);
		if (!normalized.message) {
			clearToast();
			return;
		}

		const id = nextToastIdRef.current;
		nextToastIdRef.current += 1;
		const entry = {
			id,
			message: normalized.message,
			severity: normalized.severity,
			visible: fadeOutMs <= 0
		};

		setToastMessage(normalized.message);
		setToastSeverity(normalized.severity);
		setToastVisible(true);
		setToastMessages((current) => {
			const limit = Math.max(1, Number(maxVisible) || 1);
			const next = [...current, entry];
			const removed = next.length > limit ? next.slice(0, next.length - limit) : [];
			removed.forEach((removedEntry) => clearStackTimers(removedEntry.id));
			return next.slice(-limit);
		});

		const timers = {
			frame: null,
			hide: null,
			clear: null
		};
		stackTimersRef.current.set(id, timers);

		if (fadeOutMs > 0) {
			timers.frame = window.requestAnimationFrame(() => {
				setToastMessages((current) => current.map((item) => (
					item.id === id ? {...item, visible: true} : item
				)));
				timers.frame = null;
			});
			const hideDelay = Math.max(0, durationMs - fadeOutMs);
			timers.hide = setTimeout(() => {
				setToastMessages((current) => current.map((item) => (
					item.id === id ? {...item, visible: false} : item
				)));
				timers.hide = null;
			}, hideDelay);
		}
		timers.clear = setTimeout(() => {
			setToastMessages((current) => current.filter((item) => item.id !== id));
			clearStackTimers(id);
		}, durationMs);
	}, [clearStackTimers, clearToast, durationMs, fadeOutMs, maxVisible]);

	const setToast = useCallback((toastInput) => {
		if (stack) {
			addStackedToast(toastInput);
			return;
		}
		const normalized = normalizeToastInput(toastInput);
		if (!normalized.message) {
			clearToast();
			return;
		}
		setToastMessage(normalized.message);
		setToastSeverity(normalized.severity);
	}, [addStackedToast, clearToast, stack]);

	useEffect(() => {
		if (stack) {
			return undefined;
		}
		if (!toastMessage) {
			setToastVisible(false);
			return undefined;
		}

		clearToastTimers();
		if (fadeOutMs > 0) {
			setToastVisible(false);
			frameRef.current = window.requestAnimationFrame(() => {
				setToastVisible(true);
				frameRef.current = null;
			});
			const hideDelay = Math.max(0, durationMs - fadeOutMs);
			hideTimerRef.current = setTimeout(() => {
				setToastVisible(false);
				hideTimerRef.current = null;
			}, hideDelay);
			clearTimerRef.current = setTimeout(() => {
				setToastMessage('');
				setToastSeverity(TOAST_SEVERITIES.INFO);
				clearTimerRef.current = null;
			}, durationMs);
		} else {
			setToastVisible(true);
			clearTimerRef.current = setTimeout(() => {
				setToastVisible(false);
				setToastMessage('');
				setToastSeverity(TOAST_SEVERITIES.INFO);
				clearTimerRef.current = null;
			}, durationMs);
		}

		return clearToastTimers;
	}, [clearToastTimers, durationMs, fadeOutMs, stack, toastMessage]);

	useEffect(() => () => {
		clearToastTimers();
		clearStackTimers();
	}, [clearStackTimers, clearToastTimers]);

	return {
		toastMessage,
		toastSeverity,
		toastVisible,
		toastMessages,
		setToastMessage: setToast,
		clearToast
	};
};
