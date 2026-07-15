const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

const isNodeElement = (value) => Boolean(value && typeof value === 'object' && value.nodeType === 1);

const isScrollableVertically = (element) => {
	if (!isNodeElement(element) || typeof window === 'undefined') return false;
	const style = window.getComputedStyle(element);
	if (!style || !SCROLLABLE_OVERFLOW_VALUES.has(String(style.overflowY || '').toLowerCase())) return false;
	return element.scrollHeight > element.clientHeight + 1;
};

export const findVerticalScrollableAncestor = (target) => {
	if (!isNodeElement(target)) return null;
	let node = target.parentElement;
	while (isNodeElement(node)) {
		if (isScrollableVertically(node)) return node;
		node = node.parentElement;
	}
	return null;
};

const getTopChromeBottom = () => {
	if (typeof document === 'undefined') return 0;
	const candidates = document.querySelectorAll('[data-bf-navbar=\"true\"], [data-bf-panel-controls=\"true\"], .bf-header');
	let maxBottom = 0;
	candidates.forEach((node) => {
		if (!isNodeElement(node)) return;
		const rect = node.getBoundingClientRect();
		if (rect.height <= 0 || rect.bottom <= 0) return;
		if (rect.bottom > maxBottom) {
			maxBottom = rect.bottom;
		}
	});
	return maxBottom;
};

export const getVerticalVisibilityDelta = ({
	targetRect,
	scrollerRect,
	topBoundary,
	topPadding = 12,
	bottomPadding = 14
} = {}) => {
	if (!targetRect || !scrollerRect) return 0;
	const safeTop = Math.max(scrollerRect.top + topPadding, (topBoundary || 0) + topPadding);
	const safeBottom = scrollerRect.bottom - bottomPadding;
	if (targetRect.top < safeTop) return targetRect.top - safeTop;
	if (targetRect.bottom > safeBottom) return targetRect.bottom - safeBottom;
	return 0;
};

export const ensureFocusTargetVisibleWithTopChrome = (
	target,
	{
		topPadding = 12,
		bottomPadding = 14,
		behavior = 'auto'
	} = {}
) => {
	if (!isNodeElement(target) || typeof window === 'undefined') return false;
	const scroller = findVerticalScrollableAncestor(target);
	if (!scroller) return false;

	const scrollerRect = scroller.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const topChromeBottom = getTopChromeBottom();
	const delta = getVerticalVisibilityDelta({
		targetRect,
		scrollerRect,
		topBoundary: topChromeBottom,
		topPadding,
		bottomPadding
	});
	if (!delta) return false;
	const nextScrollTop = Math.max(0, scroller.scrollTop + delta);
	if (typeof scroller.scrollTo === 'function') {
		scroller.scrollTo({top: nextScrollTop, behavior});
	} else {
		scroller.scrollTop = nextScrollTop;
	}
	return true;
};
