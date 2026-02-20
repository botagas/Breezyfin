import {useCallback, useEffect, useRef, useState} from 'react';

export const normalizeScrollTop = (value) => {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
	return numericValue;
};

const schedule = (callback) => {
	if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
		window.requestAnimationFrame(callback);
		return;
	}
	callback();
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
	scrollTop = 0,
	onScrollTopChange = null
} = {}) => {
	const scrollToRef = useRef(null);
	const targetScrollTopRef = useRef(normalizeScrollTop(scrollTop));
	const lastKnownScrollTopRef = useRef(null);

	useEffect(() => {
		targetScrollTopRef.current = normalizeScrollTop(scrollTop);
	}, [scrollTop]);

	const applyScrollRestore = useCallback((force = false) => {
		if (!isActive) return;
		if (typeof scrollToRef.current !== 'function') return;

		const targetTop = targetScrollTopRef.current;
		const lastTop = lastKnownScrollTopRef.current;
		if (!force && lastTop !== null && Math.abs(targetTop - lastTop) < 1) return;

		if (targetTop <= 0) {
			scrollToRef.current({align: 'top', animate: false});
		} else {
			scrollToRef.current({position: {y: targetTop}, animate: false});
		}
		lastKnownScrollTopRef.current = targetTop;
	}, [isActive]);

	useEffect(() => {
		if (!isActive) {
			lastKnownScrollTopRef.current = null;
			return;
		}
		schedule(() => applyScrollRestore());
	}, [applyScrollRestore, isActive, scrollTop]);

	const captureScrollTo = useCallback((fn) => {
		scrollToRef.current = fn;
		if (!isActive || typeof fn !== 'function') return;
		schedule(() => applyScrollRestore());
	}, [applyScrollRestore, isActive]);

	const handleScrollStop = useCallback((event) => {
		const nextTop = normalizeScrollTop(event?.scrollTop);
		lastKnownScrollTopRef.current = nextTop;
		if (typeof onScrollTopChange === 'function') {
			onScrollTopChange(nextTop);
		}
	}, [onScrollTopChange]);

	return {
		captureScrollTo,
		handleScrollStop
	};
};
