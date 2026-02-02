export const scrollElementIntoHorizontalView = (scroller, element, options = {}) => {
	if (!scroller || !element) return false;

	const {
		edgeRatio = 0.10,
		minBuffer = 60,
		padding = 0,
		behavior = 'smooth'
	} = options;

	const scrollerRect = scroller.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();
	const buffer = Math.max(minBuffer, Math.floor((scroller.clientWidth || 0) * edgeRatio));

	let delta = 0;
	if (elementRect.left < scrollerRect.left + buffer) {
		delta = -((scrollerRect.left + buffer) - elementRect.left + padding);
	} else if (elementRect.right > scrollerRect.right - buffer) {
		delta = elementRect.right - (scrollerRect.right - buffer) + padding;
	}

	if (!delta) return false;

	if (typeof scroller.scrollBy === 'function') {
		scroller.scrollBy({left: delta, behavior});
	} else {
		scroller.scrollLeft += delta;
	}

	return true;
};
