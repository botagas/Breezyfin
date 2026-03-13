import {useEffect} from 'react';
import {KeyCodes} from '../utils/keyCodes';

const DEFAULT_POPUP_FOCUS_SELECTOR = [
	'[data-popup-focus-first="true"]',
	'button:not([disabled]):not([aria-disabled="true"])',
	'[role="button"]:not([aria-disabled="true"])',
	'.spottable:not([disabled]):not([aria-disabled="true"])',
	'input:not([disabled]):not([aria-disabled="true"])',
	'select:not([disabled]):not([aria-disabled="true"])',
	'textarea:not([disabled]):not([aria-disabled="true"])',
	'[tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])'
].join(', ');
const ACTIVATION_KEYS = new Set([KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE]);

const isVisibleFocusableNode = (node) => {
	if (!node || typeof node.focus !== 'function') return false;
	if (node.hasAttribute('disabled')) return false;
	if (node.getAttribute('aria-disabled') === 'true') return false;
	if (node.getAttribute('hidden') !== null) return false;

	const style = window.getComputedStyle(node);
	if (style.display === 'none' || style.visibility === 'hidden') return false;

	return node.getClientRects().length > 0;
};

const focusNodeWithoutScroll = (node) => {
	try {
		node.focus({preventScroll: true});
		return true;
	} catch {
		try {
			node.focus();
			return true;
		} catch {
			return false;
		}
	}
};

const focusFirstPopupNode = (container, selector) => {
	if (!container?.querySelectorAll) return false;
	const candidates = Array.from(container.querySelectorAll(selector));
	const target = candidates.find(isVisibleFocusableNode);
	if (!target) return false;
	if (!focusNodeWithoutScroll(target)) return false;
	return container.contains(document.activeElement);
};

const hasFocusInsidePopup = (container) => (
	Boolean(container && container.contains(document.activeElement))
);

const isActivationKeyEvent = (event) => {
	const code = event?.keyCode || event?.which;
	if (ACTIVATION_KEYS.has(code)) return true;
	const key = String(event?.key || '').toLowerCase();
	return key === 'enter' || key === ' ';
};

const consumeDomEvent = (event) => {
	event?.preventDefault?.();
	event?.stopPropagation?.();
	event?.stopImmediatePropagation?.();
	event?.nativeEvent?.preventDefault?.();
	event?.nativeEvent?.stopPropagation?.();
	event?.nativeEvent?.stopImmediatePropagation?.();
};

export const usePopupInitialFocus = (open, popupContentRef, options = {}) => {
	const {
		selector = DEFAULT_POPUP_FOCUS_SELECTOR,
		retryDelayMs = 60,
		maxAttempts = 24,
		stabilizeForMs = 1400
	} = options;

	useEffect(() => {
		if (!open) return undefined;
		if (typeof window === 'undefined') return undefined;

		let cancelled = false;
		let timeoutId = null;
		let rafId = null;
		let secondRafId = null;
		const stabilizeUntil = Date.now() + Math.max(0, stabilizeForMs);

		const runAttempt = (attemptIndex) => {
			if (cancelled) return;

			const container = popupContentRef?.current;
			if (!hasFocusInsidePopup(container)) {
				focusFirstPopupNode(container, selector);
			}
			const shouldContinueByAttempt = attemptIndex + 1 < maxAttempts;
			const shouldContinueByTime = Date.now() < stabilizeUntil;
			if (!shouldContinueByAttempt && !shouldContinueByTime) return;
			timeoutId = window.setTimeout(() => {
				runAttempt(attemptIndex + 1);
			}, retryDelayMs);
		};

		const handleActivationKey = (event) => {
			if (!open || !isActivationKeyEvent(event)) return;
			const container = popupContentRef?.current;
			if (!container) return;
			if (hasFocusInsidePopup(container)) return;
			const focused = focusFirstPopupNode(container, selector);
			if (focused) {
				consumeDomEvent(event);
			}
		};

		document.addEventListener('keydown', handleActivationKey, true);

		rafId = window.requestAnimationFrame(() => {
			secondRafId = window.requestAnimationFrame(() => {
				runAttempt(0);
			});
		});

		return () => {
			cancelled = true;
			if (timeoutId !== null) {
				window.clearTimeout(timeoutId);
			}
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
			}
			if (secondRafId !== null) {
				window.cancelAnimationFrame(secondRafId);
			}
			document.removeEventListener('keydown', handleActivationKey, true);
		};
	}, [maxAttempts, open, popupContentRef, retryDelayMs, selector, stabilizeForMs]);
};

export default usePopupInitialFocus;
