import {ensureFocusTargetVisibleWithTopChrome} from './verticalFocusScroll';

export const getRemainingGridItemsFromFocusEvent = (event, itemCount) => {
	const itemIndex = Number(event?.currentTarget?.dataset?.itemIndex);
	if (!Number.isInteger(itemIndex)) return null;
	return itemCount - itemIndex - 1;
};

export const shouldLoadMoreFromGridFocus = ({
	event,
	isPointerInputMode = false,
	hasMore = false,
	isLoadingMore = false,
	itemCount = 0,
	threshold = 12
} = {}) => {
	if (isPointerInputMode) return false;
	ensureFocusTargetVisibleWithTopChrome(event.currentTarget);
	if (!hasMore || isLoadingMore) return false;
	const remainingItems = getRemainingGridItemsFromFocusEvent(event, itemCount);
	return remainingItems !== null && remainingItems <= threshold;
};

export const isRightMostGridItemInRow = (currentCard, cards = []) => {
	if (!currentCard || !Array.isArray(cards) || cards.length === 0) return false;
	const currentTop = currentCard.offsetTop;
	const currentLeft = currentCard.offsetLeft;
	return !cards.some((candidate) => {
		if (candidate === currentCard) return false;
		return candidate.offsetTop === currentTop && candidate.offsetLeft > currentLeft;
	});
};

export const focusTargetFromRightMostGridItem = ({
	event,
	panelRoot,
	gridCardClassName,
	focusTarget,
	rightKeyCode = 39
} = {}) => {
	const code = event?.keyCode || event?.which;
	if (code !== rightKeyCode) return false;
	const cards = Array.from(panelRoot?.querySelectorAll?.(`.${gridCardClassName}`) || []);
	if (!isRightMostGridItemInRow(event.currentTarget, cards)) return false;
	event.preventDefault();
	event.stopPropagation();
	focusTarget?.();
	return true;
};
