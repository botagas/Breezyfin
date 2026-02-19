import {useState, useRef, useEffect, useCallback} from 'react';

export const useToastMessage = (options = {}) => {
	const {
		durationMs = 2000,
		fadeOutMs = 0
	} = options;
	const [toastMessage, setToastMessage] = useState('');
	const [toastVisible, setToastVisible] = useState(false);
	const frameRef = useRef(null);
	const hideTimerRef = useRef(null);
	const clearTimerRef = useRef(null);

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

	const clearToast = useCallback(() => {
		clearToastTimers();
		setToastVisible(false);
		setToastMessage('');
	}, [clearToastTimers]);

	useEffect(() => {
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
				clearTimerRef.current = null;
			}, durationMs);
		} else {
			setToastVisible(true);
			clearTimerRef.current = setTimeout(() => {
				setToastVisible(false);
				setToastMessage('');
				clearTimerRef.current = null;
			}, durationMs);
		}

		return clearToastTimers;
	}, [clearToastTimers, durationMs, fadeOutMs, toastMessage]);

	useEffect(() => clearToastTimers, [clearToastTimers]);

	return {
		toastMessage,
		toastVisible,
		setToastMessage,
		clearToast
	};
};

