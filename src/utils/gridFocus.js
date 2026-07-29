import Spotlight from '@enact/spotlight';
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

const getGridCards = (panelRoot, gridCardClassName) => (
	Array.from(panelRoot?.querySelectorAll?.(`.${gridCardClassName}`) || [])
);

const getElementCenter = (element) => {
	const rect = element?.getBoundingClientRect?.();
	if (!rect) return null;
	return {
		x: rect.left + (rect.width / 2),
		y: rect.top + (rect.height / 2),
		top: rect.top,
		left: rect.left,
		width: rect.width,
		height: rect.height
	};
};

const getGridRowTolerance = (first, second) => (
	Math.max(8, Math.min(first?.height || 0, second?.height || 0) * 0.12)
);

export const findDirectionalGridTarget = ({currentCard, cards = [], direction = ''} = {}) => {
	const current = getElementCenter(currentCard);
	if (!current || !Array.isArray(cards)) return null;
	const normalizedDirection = String(direction || '').toLowerCase();
	const vertical = normalizedDirection === 'up' || normalizedDirection === 'down';
	const forward = normalizedDirection === 'down' || normalizedDirection === 'right';
	if (!vertical && normalizedDirection !== 'left' && normalizedDirection !== 'right') return null;

	const candidates = cards.reduce((matches, candidate) => {
		if (!candidate || candidate === currentCard) return matches;
		const center = getElementCenter(candidate);
		if (!center) return matches;
		const rowDelta = center.top - current.top;
		const rowTolerance = getGridRowTolerance(current, center);
		const primaryDelta = vertical ? rowDelta : center.x - current.x;
		if (vertical && Math.abs(rowDelta) <= rowTolerance) return matches;
		if ((forward && primaryDelta <= 1) || (!forward && primaryDelta >= -1)) return matches;
		const perpendicularDelta = vertical
			? Math.abs(center.x - current.x)
			: Math.abs(rowDelta);
		if (!vertical) {
			if (perpendicularDelta > rowTolerance) return matches;
		}
		matches.push({
			candidate,
			primaryDistance: Math.abs(primaryDelta),
			perpendicularDistance: perpendicularDelta,
			rowTolerance
		});
		return matches;
	}, []);

	if (vertical && candidates.length > 0) {
		const closestRowDistance = Math.min(...candidates.map((candidate) => candidate.primaryDistance));
		const rowCandidates = candidates.filter((candidate) => (
			Math.abs(candidate.primaryDistance - closestRowDistance) <= candidate.rowTolerance
		));
		rowCandidates.sort((first, second) => (
			first.perpendicularDistance - second.perpendicularDistance ||
			first.primaryDistance - second.primaryDistance
		));
		return rowCandidates[0]?.candidate || null;
	}

	candidates.sort((first, second) => (
		first.primaryDistance - second.primaryDistance ||
		first.perpendicularDistance - second.perpendicularDistance
	));
	return candidates[0]?.candidate || null;
};

export const focusDirectionalGridTarget = ({currentCard, cards = [], direction = ''} = {}) => (
	focusGridCardElement(findDirectionalGridTarget({currentCard, cards, direction}))
);

function focusGridCardElement(target) {
	if (!target) return false;
	try {
		Spotlight.focus(target);
		if (document.activeElement === target || target.contains(document.activeElement)) {
			return true;
		}
	} catch (error) {
		// Fall through to DOM focus for webOS pointer/Spotlight disagreement.
	}
	target.focus?.();
	return document.activeElement === target || target.contains(document.activeElement);
}

export const focusSpotlightTarget = (spotlightId) => {
	if (!spotlightId) return false;
	try {
		const result = Spotlight.focus(spotlightId);
		const activeSpotlightId = document.activeElement?.dataset?.spotlightId || '';
		return result === true || activeSpotlightId === spotlightId;
	} catch (error) {
		return false;
	}
};

export const focusRestoredOrFirstGridCard = ({
	panelRoot,
	gridCardClassName,
	lastFocusedCardId = null
} = {}) => {
	const cards = getGridCards(panelRoot, gridCardClassName);
	if (lastFocusedCardId) {
		const restoredCard = cards.find((card) => card.dataset?.itemId === lastFocusedCardId);
		if (focusGridCardElement(restoredCard)) return true;
	}
	return focusGridCardElement(cards[0]);
};

export const focusRestoredOrFallbackGridCard = ({
	panelRoot,
	gridCardClassName,
	lastFocusedCardId = null,
	fallbackSpotlightId = ''
} = {}) => (
	focusRestoredOrFirstGridCard({
		panelRoot,
		gridCardClassName,
		lastFocusedCardId
	}) || focusSpotlightTarget(fallbackSpotlightId)
);

export const scheduleFocusRestoredOrFallbackGridCard = (options = {}, delayMs = 50) => {
	setTimeout(() => {
		focusRestoredOrFallbackGridCard(options);
	}, delayMs);
};

export const handleGridEntryNavigationKeyDown = ({
	event,
	panelRoot,
	gridCardClassName,
	lastFocusedCardId = null,
	entrySpotlightIds = [],
	filterTriggerSpotlightId = '',
	gridExitSpotlightId = '',
	fallbackSpotlightId = '',
	downKeyCode = 40,
	leftKeyCode = 37
} = {}) => {
	const code = event?.keyCode || event?.which;
	const spotlightId = document.activeElement?.dataset?.spotlightId || '';
	const shouldEnterGrid = code === downKeyCode && entrySpotlightIds.includes(spotlightId);
	const resolvedGridExitSpotlightId = gridExitSpotlightId || filterTriggerSpotlightId;
	const shouldLeaveFilter = code === leftKeyCode && spotlightId === resolvedGridExitSpotlightId;
	if (!shouldEnterGrid && !shouldLeaveFilter) return false;
	const focused = focusRestoredOrFallbackGridCard({
		panelRoot,
		gridCardClassName,
		lastFocusedCardId,
		fallbackSpotlightId
	});
	if (!focused) return false;
	event.preventDefault();
	event.stopPropagation();
	return true;
};

export const isBottomMostGridItem = (currentCard, cards = []) => {
	if (!currentCard || !Array.isArray(cards) || cards.length === 0) return false;
	const currentTop = currentCard.offsetTop;
	return !cards.some((candidate) => (
		candidate !== currentCard && candidate.offsetTop > currentTop
	));
};

export const getGridKeyDownLoadMoreState = ({
	event,
	panelRoot,
	gridCardClassName,
	hasMore = false,
	isLoadingMore = false,
	itemCount = 0,
	threshold = 12,
	downKeyCode = 40
} = {}) => {
	const code = event?.keyCode || event?.which;
	if (code !== downKeyCode || !hasMore || isLoadingMore) {
		return {
			shouldLoadMore: false,
			shouldConsume: false
		};
	}
	const remainingItems = getRemainingGridItemsFromFocusEvent(event, itemCount);
	const cards = getGridCards(panelRoot, gridCardClassName);
	const atBottomRow = isBottomMostGridItem(event?.currentTarget, cards);
	return {
		shouldLoadMore: remainingItems !== null && remainingItems <= threshold,
		shouldConsume: atBottomRow
	};
};

export const maybeLoadMoreFromGridFocus = ({
	event,
	lastFocusedCardIdRef,
	isPointerInputMode = false,
	hasMore = false,
	isLoadingMore = false,
	itemCount = 0,
	threshold = 12,
	loadNextPage
} = {}) => {
	if (lastFocusedCardIdRef) {
		lastFocusedCardIdRef.current = event?.currentTarget?.dataset?.itemId || null;
	}
	if (typeof loadNextPage !== 'function') return false;
	if (!shouldLoadMoreFromGridFocus({
		event,
		isPointerInputMode,
		hasMore,
		isLoadingMore,
		itemCount,
		threshold
	})) {
		return false;
	}
	loadNextPage();
	return true;
};

export const handleGridKeyDownLoadMore = ({
	event,
	panelRoot,
	gridCardClassName,
	hasMore = false,
	isLoadingMore = false,
	itemCount = 0,
	threshold = 12,
	loadNextPage
} = {}) => {
	const loadMoreState = getGridKeyDownLoadMoreState({
		event,
		panelRoot,
		gridCardClassName,
		hasMore,
		isLoadingMore,
		itemCount,
		threshold
	});
	if (loadMoreState.shouldLoadMore && typeof loadNextPage === 'function') {
		loadNextPage();
	}
	if (loadMoreState.shouldConsume) {
		event.preventDefault();
		event.stopPropagation();
		return true;
	}
	return false;
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
	const cards = getGridCards(panelRoot, gridCardClassName);
	if (!isRightMostGridItemInRow(event.currentTarget, cards)) return false;
	const focused = focusTarget?.() === true;
	if (!focused) return false;
	event.preventDefault();
	event.stopPropagation();
	return true;
};
