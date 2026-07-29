export const buildGridQuerySignature = (scopeId, filterIds = []) => (
	`${String(scopeId || '')}|${[...filterIds].map(String).sort().join(',')}`
);

export const resolveGridScrollRestore = ({
	targetTop = 0,
	scrollHeight = 0,
	clientHeight = 0,
	hasMore = false
} = {}) => {
	const normalizedTarget = Math.max(0, Number(targetTop) || 0);
	const maxReachableTop = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));
	const needsMoreContent = normalizedTarget > maxReachableTop + 1;
	return {
		targetTop: normalizedTarget,
		maxReachableTop,
		needsMoreContent,
		shouldLoadMore: needsMoreContent && hasMore === true,
		finalTop: needsMoreContent ? maxReachableTop : normalizedTarget
	};
};

const EMPTY_RESTORE_CYCLE = Object.freeze({
	active: false,
	queryKey: '',
	targetItemId: null,
	focusFirstItem: false,
	completed: false
});

export const updateGridFocusRestoreCycle = (currentCycle = EMPTY_RESTORE_CYCLE, {
	isActive = false,
	queryKey = '',
	restoreItemId = null,
	focusFirstItem = false
} = {}) => {
	const previousCycle = currentCycle || EMPTY_RESTORE_CYCLE;
	if (!isActive) {
		return previousCycle.active ? {...previousCycle, active: false} : previousCycle;
	}

	const normalizedQueryKey = String(queryKey || '');
	if (previousCycle.active && previousCycle.queryKey === normalizedQueryKey) {
		return previousCycle;
	}

	return {
		active: true,
		queryKey: normalizedQueryKey,
		targetItemId: restoreItemId || null,
		focusFirstItem: focusFirstItem === true,
		completed: false
	};
};

export const resolveGridFocusRestoreTarget = ({
	cycle = EMPTY_RESTORE_CYCLE,
	items = [],
	getItemId = (item) => item?.Id
} = {}) => {
	if (!cycle.active || cycle.completed || items.length === 0) return null;
	if (cycle.targetItemId) return cycle.targetItemId;
	return cycle.focusFirstItem ? getItemId(items[0]) || null : null;
};
