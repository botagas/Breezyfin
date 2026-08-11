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
			severity: TOAST_SEVERITIES.INFO,
			key: '',
			persistent: false
		};
	}
	const message = typeof input?.message === 'string' ? input.message.trim() : '';
	const severity = Object.values(TOAST_SEVERITIES).includes(input?.severity)
		? input.severity
		: TOAST_SEVERITIES.INFO;
	return {
		message,
		severity,
		key: String(input?.key || '').trim(),
		persistent: input?.persistent === true
	};
};

export const appendProtectedStackedToast = (current = [], entry, maxVisible = 1) => {
	const limit = Math.max(1, Number(maxVisible) || 1);
	const next = [...current, entry];
	const removed = [];
	while (next.length > limit) {
		const transientIndex = next.findIndex((item) => item?.persistent !== true);
		if (transientIndex < 0) break;
		removed.push(next.splice(transientIndex, 1)[0]);
	}
	return {
		items: next,
		removed,
		accepted: next.some((item) => item?.id === entry?.id)
	};
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
	const [toastRevision, setToastRevision] = useState(0);
	const frameRef = useRef(null);
	const hideTimerRef = useRef(null);
	const clearTimerRef = useRef(null);
	const stackTimersRef = useRef(new Map());
	const nextToastIdRef = useRef(1);
	const activeToastRef = useRef({key: '', persistent: false});
	const toastMessagesRef = useRef([]);

	const updateToastMessages = useCallback((updater) => {
		const current = toastMessagesRef.current;
		const next = typeof updater === 'function' ? updater(current) : updater;
		toastMessagesRef.current = next;
		setToastMessages(next);
		return next;
	}, []);

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
		updateToastMessages([]);
		activeToastRef.current = {key: '', persistent: false};
	}, [clearStackTimers, clearToastTimers, updateToastMessages]);

	const addStackedToast = useCallback((toastInput) => {
		const normalized = normalizeToastInput(toastInput);
		if (!normalized.message) {
			clearToast();
			return;
		}
		if (normalized.key) {
			updateToastMessages((current) => current.filter((item) => {
				if (item.key !== normalized.key) return true;
				clearStackTimers(item.id);
				return false;
			}));
		}

		const id = nextToastIdRef.current;
		nextToastIdRef.current += 1;
		const entry = {
			id,
			key: normalized.key,
			message: normalized.message,
			severity: normalized.severity,
			visible: normalized.persistent || fadeOutMs <= 0,
			persistent: normalized.persistent
		};

		const stackResult = appendProtectedStackedToast(
			toastMessagesRef.current,
			entry,
			maxVisible
		);
		stackResult.removed.forEach((removedEntry) => clearStackTimers(removedEntry.id));
		updateToastMessages(stackResult.items);
		if (!stackResult.accepted) return;
		setToastMessage(normalized.message);
		setToastSeverity(normalized.severity);
		setToastVisible(true);

		const timers = {
			frame: null,
			hide: null,
			clear: null
		};
		stackTimersRef.current.set(id, timers);
		if (normalized.persistent) return;

		if (fadeOutMs > 0) {
			timers.frame = window.requestAnimationFrame(() => {
				updateToastMessages((current) => current.map((item) => (
					item.id === id ? {...item, visible: true} : item
				)));
				timers.frame = null;
			});
			const hideDelay = Math.max(0, durationMs - fadeOutMs);
			timers.hide = setTimeout(() => {
				updateToastMessages((current) => current.map((item) => (
					item.id === id ? {...item, visible: false} : item
				)));
				timers.hide = null;
			}, hideDelay);
		}
		timers.clear = setTimeout(() => {
			updateToastMessages((current) => current.filter((item) => item.id !== id));
			clearStackTimers(id);
		}, durationMs);
	}, [clearStackTimers, clearToast, durationMs, fadeOutMs, maxVisible, updateToastMessages]);

	const dismissToast = useCallback((key) => {
		const normalizedKey = String(key || '').trim();
		if (!normalizedKey) return;
		if (!stack && activeToastRef.current.key === normalizedKey) {
			clearToast();
			return;
		}
		updateToastMessages((current) => current.filter((item) => {
			if (item.key !== normalizedKey) return true;
			clearStackTimers(item.id);
			return false;
		}));
	}, [clearStackTimers, clearToast, stack, updateToastMessages]);

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
		activeToastRef.current = {
			key: normalized.key,
			persistent: normalized.persistent
		};
		setToastRevision((current) => current + 1);
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
		if (activeToastRef.current.persistent) {
			setToastVisible(true);
			return clearToastTimers;
		}
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
	}, [clearToastTimers, durationMs, fadeOutMs, stack, toastMessage, toastRevision]);

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
		clearToast,
		dismissToast
	};
};
