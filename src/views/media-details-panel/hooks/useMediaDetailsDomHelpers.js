import {useCallback} from 'react';

export const useMediaDetailsDomHelpers = ({detailsContainerRef}) => {
	const getDetailsScrollElement = useCallback(() => {
		const container = detailsContainerRef.current;
		if (!container) return null;
		const contentNode = container.closest?.('[id$="_content"]');
		if (contentNode && typeof contentNode.scrollTop === 'number') return contentNode;
		return container.closest?.('[data-webos-voice-intent="Scroll"]') || null;
	}, [detailsContainerRef]);

	const getScrollSnapshot = useCallback(() => {
		const scrollEl = getDetailsScrollElement();
		if (!scrollEl) return null;
		return {
			top: scrollEl.scrollTop,
			clientHeight: scrollEl.clientHeight,
			scrollHeight: scrollEl.scrollHeight
		};
	}, [getDetailsScrollElement]);

	const focusNodeWithoutScroll = useCallback((node) => {
		if (!node?.focus) return;
		try {
			node.focus({preventScroll: true});
		} catch (error) {
			node.focus();
		}
	}, []);

	return {
		getDetailsScrollElement,
		getScrollSnapshot,
		focusNodeWithoutScroll
	};
};
