import {useCallback, useEffect, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';

const SCROLL_IDLE_MS = 150;
const SCROLL_START_TIMEOUT_MS = 500;

export const useHorizontalPointerReveal = ({rootRef, resolveTarget, enabled = true, isBlocked, onBeforeReveal}) => {
	const pendingRef = useRef({active: false, timer: null, position: null});
	const reset = useCallback(() => {
		window.clearTimeout(pendingRef.current.timer);
		pendingRef.current = {active: false, timer: null, position: null};
	}, []);
	const waitForScroll = useCallback((delay) => {
		const pending = pendingRef.current;
		window.clearTimeout(pending.timer);
		pending.active = true;
		pending.timer = window.setTimeout(() => {
			pending.active = false;
			pending.timer = null;
		}, delay);
	}, []);
	const onMouseOver = useCallback((event) => {
		if (!enabled || !Spotlight.getPointerMode() || Spotlight.isPaused() || isBlocked?.()) return;
		const target = resolveTarget(event.target);
		const pending = pendingRef.current;
		if (!target?.card) {
			pending.position = null;
			return;
		}
		const {card, scroller, options} = target;
		if (!rootRef.current?.contains(card) || !scroller || (event.relatedTarget?.nodeType && card.contains(event.relatedTarget))) return;
		if (pending.active) return;
		// A scroll can change the hovered card without moving the remote cursor.
		if (pending.position?.x === event.clientX && pending.position?.y === event.clientY) return;
		const viewport = scroller.getBoundingClientRect();
		const bounds = card.getBoundingClientRect();
		if (bounds.left >= viewport.left && bounds.right <= viewport.right) return;
		onBeforeReveal?.();
		if (scrollElementIntoHorizontalView(scroller, card, options)) {
			pending.position = {x: event.clientX, y: event.clientY};
			waitForScroll(SCROLL_START_TIMEOUT_MS);
		}
	}, [enabled, isBlocked, onBeforeReveal, resolveTarget, rootRef, waitForScroll]);
	const onScrollCapture = useCallback((event) => {
		if (!enabled || !Spotlight.getPointerMode()) return;
		const target = resolveTarget(event.target);
		if (target?.scroller === event.target) waitForScroll(SCROLL_IDLE_MS);
	}, [enabled, resolveTarget, waitForScroll]);
	const onMouseLeave = useCallback(() => {
		pendingRef.current.position = null;
	}, []);

	useEffect(() => {
		reset();
		return reset;
	}, [enabled, reset]);

	return {onMouseOver, onMouseLeave, onScrollCapture};
};
