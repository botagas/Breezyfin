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
	const candidates = document.querySelectorAll('[data-bf-navbar=\"true\"], .bf-header');
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

export const ensureFocusTargetVisibleWithTopChrome = (
	target,
	{
		topPadding = 10,
		bottomPadding = 10,
		behavior = 'auto'
	} = {}
) => {
	if (!isNodeElement(target) || typeof window === 'undefined') return false;
	const scroller = findVerticalScrollableAncestor(target);
	if (!scroller) return false;

	const scrollerRect = scroller.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const topChromeBottom = getTopChromeBottom();
	const safeTop = Math.max(scrollerRect.top + topPadding, topChromeBottom + topPadding);
	const safeBottom = scrollerRect.bottom - bottomPadding;

	let nextScrollTop = null;
	if (targetRect.top < safeTop) {
		nextScrollTop = Math.max(0, scroller.scrollTop - (safeTop - targetRect.top));
	} else if (targetRect.bottom > safeBottom) {
		nextScrollTop = Math.max(0, scroller.scrollTop + (targetRect.bottom - safeBottom));
	}

	if (nextScrollTop === null) return false;
	if (typeof scroller.scrollTo === 'function') {
		scroller.scrollTo({top: nextScrollTop, behavior});
	} else {
		scroller.scrollTop = nextScrollTop;
	}
	return true;
};
