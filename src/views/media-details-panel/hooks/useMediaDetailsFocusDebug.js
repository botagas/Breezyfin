import {useCallback, useEffect, useMemo} from 'react';
import Spotlight from '@enact/spotlight';

export const useMediaDetailsFocusDebug = ({
	isActive,
	item,
	getDetailsScrollElement,
	getScrollSnapshot,
	debugLastScrollTopRef,
	debugLastScrollTimeRef
}) => {
	const detailsDebugEnabled = useMemo(() => {
		if (typeof window === 'undefined') return false;
		try {
			const params = new URLSearchParams(window.location.search);
			if (params.get('bfFocusDebug') === '1') return true;
			return localStorage.getItem('breezyfinFocusDebug') === '1';
		} catch (_) {
			return false;
		}
	}, []);

	const describeNode = useCallback((node) => {
		if (!node || typeof node !== 'object') return '(none)';
		const element = node;
		const tag = element.tagName ? element.tagName.toLowerCase() : 'node';
		const idPart = element.id ? `#${element.id}` : '';
		const className = typeof element.className === 'string' ? element.className.trim() : '';
		const classPart = className ? `.${className.split(/\s+/).slice(0, 2).join('.')}` : '';
		const spotlightId = element.getAttribute?.('data-spotlight-id');
		const role = element.getAttribute?.('role');
		const spotlightPart = spotlightId ? ` [spotlight=${spotlightId}]` : '';
		const rolePart = role ? ` [role=${role}]` : '';
		return `${tag}${idPart}${classPart}${spotlightPart}${rolePart}`;
	}, []);

	const logDetailsDebug = useCallback((message, payload = null) => {
		if (!detailsDebugEnabled) return;
		if (payload) {
			console.log('[MediaDetailsFocusDebug]', message, payload);
			return;
		}
		console.log('[MediaDetailsFocusDebug]', message);
	}, [detailsDebugEnabled]);

	useEffect(() => {
		if (!isActive || !detailsDebugEnabled) return undefined;

		const handleFocusIn = (event) => {
			logDetailsDebug('focusin', {
				target: describeNode(event.target),
				active: describeNode(document.activeElement),
				pointerMode: Spotlight?.getPointerMode?.(),
				scroll: getScrollSnapshot()
			});
		};

		const scrollEl = getDetailsScrollElement();
		if (scrollEl) {
			debugLastScrollTopRef.current = scrollEl.scrollTop;
		}

		const handleScroll = () => {
			if (!scrollEl) return;
			const top = scrollEl.scrollTop;
			const previous = debugLastScrollTopRef.current;
			if (previous !== null && Math.abs(top - previous) < 4) return;
			const now = Date.now();
			if (now - debugLastScrollTimeRef.current < 80) return;
			debugLastScrollTimeRef.current = now;
			debugLastScrollTopRef.current = top;
			logDetailsDebug('scroll', {
				top,
				clientHeight: scrollEl.clientHeight,
				scrollHeight: scrollEl.scrollHeight,
				active: describeNode(document.activeElement)
			});
		};

		document.addEventListener('focusin', handleFocusIn, true);
		scrollEl?.addEventListener('scroll', handleScroll, {passive: true});
		logDetailsDebug('debug-attached', {
			itemId: item?.Id,
			itemType: item?.Type,
			pointerMode: Spotlight?.getPointerMode?.(),
			active: describeNode(document.activeElement),
			scroll: getScrollSnapshot()
		});

		return () => {
			document.removeEventListener('focusin', handleFocusIn, true);
			scrollEl?.removeEventListener('scroll', handleScroll);
			logDetailsDebug('debug-detached', {itemId: item?.Id});
		};
	}, [
		describeNode,
		detailsDebugEnabled,
		getDetailsScrollElement,
		getScrollSnapshot,
		isActive,
		item?.Id,
		item?.Type,
		logDetailsDebug,
		debugLastScrollTimeRef,
		debugLastScrollTopRef
	]);

	return {
		detailsDebugEnabled,
		describeNode,
		logDetailsDebug
	};
};
