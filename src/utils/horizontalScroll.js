const normalizeFinite = (value, fallback = 0) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const getHorizontalScrollAdjustment = ({
	scrollLeft = 0,
	viewportWidth = 0,
	scrollWidth = 0,
	elementLeft = 0,
	elementWidth = 0,
	edgeRatio = 0.10,
	minBuffer = 60,
	padding = 0
} = {}) => {
	const currentScrollLeft = Math.max(0, normalizeFinite(scrollLeft));
	const safeViewportWidth = Math.max(0, normalizeFinite(viewportWidth));
	const safeScrollWidth = Math.max(safeViewportWidth, normalizeFinite(scrollWidth, safeViewportWidth));
	const safeElementLeft = normalizeFinite(elementLeft);
	const safeElementWidth = Math.max(0, normalizeFinite(elementWidth));
	if (!safeViewportWidth || !safeElementWidth) return 0;

	const buffer = Math.max(
		Math.max(0, normalizeFinite(minBuffer)),
		Math.floor(safeViewportWidth * Math.max(0, normalizeFinite(edgeRatio)))
	);
	const safePadding = Math.max(0, normalizeFinite(padding));
	const visibleLeft = currentScrollLeft + buffer;
	const visibleRight = currentScrollLeft + safeViewportWidth - buffer;
	const elementRight = safeElementLeft + safeElementWidth;
	let targetScrollLeft = currentScrollLeft;

	if (safeElementLeft < visibleLeft) {
		targetScrollLeft = safeElementLeft - buffer - safePadding;
	} else if (elementRight > visibleRight) {
		targetScrollLeft = elementRight - safeViewportWidth + buffer + safePadding;
	}

	const maxScrollLeft = Math.max(0, safeScrollWidth - safeViewportWidth);
	targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, targetScrollLeft));
	return targetScrollLeft - currentScrollLeft;
};

const getElementOffsetWithinScroller = (scroller, element) => {
	let node = element;
	let offsetLeft = 0;
	while (node && node !== scroller) {
		offsetLeft += normalizeFinite(node.offsetLeft);
		node = node.offsetParent;
	}
	return node === scroller ? offsetLeft : normalizeFinite(element.offsetLeft);
};

export const scrollElementIntoHorizontalView = (scroller, element, options = {}) => {
	if (!scroller || !element) return false;

	const {
		behavior = 'smooth',
		viewportWidth = scroller.clientWidth,
		scrollWidth = scroller.scrollWidth,
		...adjustmentOptions
	} = options;
	const delta = getHorizontalScrollAdjustment({
		...adjustmentOptions,
		scrollLeft: scroller.scrollLeft,
		viewportWidth,
		scrollWidth,
		elementLeft: getElementOffsetWithinScroller(scroller, element),
		elementWidth: element.offsetWidth
	});

	if (!delta) return false;
	const targetScrollLeft = Math.max(0, scroller.scrollLeft + delta);
	if (typeof scroller.scrollTo === 'function') {
		scroller.scrollTo({left: targetScrollLeft, behavior});
	} else {
		scroller.scrollLeft = targetScrollLeft;
	}

	return true;
};
