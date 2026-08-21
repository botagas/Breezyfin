import {useCallback, useEffect, useRef, useState} from 'react';
import jellyfinService from '../../../services/jellyfinService';
import {getUserErrorMessage} from '../../../utils/errorMessages';

const POLL_INTERVAL_MS = 5000;
const OPERATION_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_FAILURES = 3;

const INITIAL_STATE = Object.freeze({
	available: null,
	phase: 'idle',
	code: '',
	error: ''
});

export const useLoginQuickConnect = ({isActive, onAuthenticated}) => {
	const [state, setState] = useState(INITIAL_STATE);
	const operationIdRef = useRef(0);
	const secretRef = useRef(null);
	const timerRef = useRef(null);
	const deadlineTimerRef = useRef(null);
	const abortControllerRef = useRef(null);
	const mountedRef = useRef(true);
	const onAuthenticatedRef = useRef(onAuthenticated);

	useEffect(() => {
		onAuthenticatedRef.current = onAuthenticated;
	}, [onAuthenticated]);

	const clearResources = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (deadlineTimerRef.current !== null) {
			window.clearTimeout(deadlineTimerRef.current);
			deadlineTimerRef.current = null;
		}
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		secretRef.current = null;
	}, []);

	const cancel = useCallback((options = {}) => {
		operationIdRef.current += 1;
		clearResources();
		if (options.resetState !== false && mountedRef.current) {
			setState((current) => options.preserveAvailability
				? {...INITIAL_STATE, available: current.available}
				: INITIAL_STATE);
		}
	}, [clearResources]);

	const isCurrent = useCallback((operationId) => (
		mountedRef.current && isActive && operationIdRef.current === operationId
	), [isActive]);

	const checkAvailability = useCallback(async () => {
		operationIdRef.current += 1;
		const operationId = operationIdRef.current;
		clearResources();
		const controller = new AbortController();
		abortControllerRef.current = controller;
		setState(INITIAL_STATE);
		try {
			const available = await jellyfinService.getQuickConnectEnabled({signal: controller.signal});
			if (!isCurrent(operationId)) return false;
			abortControllerRef.current = null;
			setState((current) => ({...current, available: Boolean(available)}));
			return Boolean(available);
		} catch (error) {
			if (!isCurrent(operationId) || error?.name === 'AbortError') return false;
			abortControllerRef.current = null;
			setState((current) => ({...current, available: false}));
			return false;
		}
	}, [clearResources, isCurrent]);

	const start = useCallback(async () => {
		operationIdRef.current += 1;
		const operationId = operationIdRef.current;
		clearResources();
		const controller = new AbortController();
		abortControllerRef.current = controller;
		setState((current) => ({
			...current,
			phase: 'starting',
			code: '',
			error: ''
		}));

		try {
			const initiated = await jellyfinService.initiateQuickConnect({signal: controller.signal});
			if (!isCurrent(operationId)) return false;
			secretRef.current = initiated.Secret;
			const deadline = Date.now() + OPERATION_TIMEOUT_MS;
			let consecutiveFailures = 0;
			let exchangeStarted = false;
			setState((current) => ({
				...current,
				available: true,
				phase: 'waiting',
				code: String(initiated.Code || ''),
				error: ''
			}));
			deadlineTimerRef.current = window.setTimeout(() => {
				if (!isCurrent(operationId)) return;
				clearResources();
				if (isCurrent(operationId)) {
					setState((current) => ({
						...current,
						phase: 'expired',
						error: 'The Quick Connect code expired. Generate a new code.'
					}));
				}
			}, OPERATION_TIMEOUT_MS);

			const poll = async () => {
				if (!isCurrent(operationId)) return;
				if (Date.now() >= deadline) {
					clearResources();
					if (isCurrent(operationId)) {
						setState((current) => ({
							...current,
							phase: 'expired',
							error: 'The Quick Connect code expired. Generate a new code.'
						}));
					}
					return;
				}

				try {
					const status = await jellyfinService.getQuickConnectState(secretRef.current, {
						signal: controller.signal
					});
					if (!isCurrent(operationId)) return;
					consecutiveFailures = 0;
					if (status?.Authenticated && !exchangeStarted) {
						exchangeStarted = true;
						setState((current) => ({...current, phase: 'completing', error: ''}));
						let user;
						try {
							user = await jellyfinService.authenticateWithQuickConnect(secretRef.current, {
								signal: controller.signal
							});
						} catch (error) {
							if (!isCurrent(operationId) || error?.name === 'AbortError') return;
							clearResources();
							if (isCurrent(operationId)) {
								setState((current) => ({
									...current,
									phase: 'failed',
									error: getUserErrorMessage(error, 'Quick Connect could not complete sign-in.')
								}));
							}
							return;
						}
						if (!isCurrent(operationId)) return;
						clearResources();
						setState((current) => ({...current, phase: 'completed', error: ''}));
						await onAuthenticatedRef.current?.(user);
						return;
					}
				} catch (error) {
					if (!isCurrent(operationId) || error?.name === 'AbortError') return;
					consecutiveFailures += 1;
					if (consecutiveFailures > MAX_CONSECUTIVE_POLL_FAILURES) {
						clearResources();
						if (isCurrent(operationId)) {
							setState((current) => ({
								...current,
								phase: 'failed',
								error: getUserErrorMessage(error, 'Quick Connect could not contact the server.')
							}));
						}
						return;
					}
				}

				if (isCurrent(operationId)) {
					timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
				}
			};

			timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
			return true;
		} catch (error) {
			if (!isCurrent(operationId) || error?.name === 'AbortError') return false;
			clearResources();
			setState((current) => ({
				...current,
				phase: 'failed',
				error: getUserErrorMessage(error, 'Quick Connect could not generate a code.')
			}));
			return false;
		}
	}, [clearResources, isCurrent]);

	useEffect(() => {
		if (!isActive) cancel({resetState: true});
	}, [cancel, isActive]);

	useEffect(() => () => {
		mountedRef.current = false;
		operationIdRef.current += 1;
		clearResources();
	}, [clearResources]);

	return {
		...state,
		checkAvailability,
		start,
		retry: start,
		cancel
	};
};

export default useLoginQuickConnect;
