import {useCallback, useEffect, useMemo, useRef} from 'react';
import Spinner from '@enact/sandstone/Spinner';
import {VirtualGridList} from '@enact/sandstone/VirtualList';
import ri from '@enact/ui/resolution';

import {SCROLLER_OVERSCROLL_EFFECT_OFF} from '../constants/scroller';
import {usePerformanceMode} from '../hooks/usePerformanceMode';
import {useRuntimeDiagnosticsEnabled} from '../hooks/useRuntimeDiagnostics';
import {getVirtualGridOverhang} from '../utils/performanceMode';
import {
	resolveGridFocusRestoreTarget,
	updateGridFocusRestoreCycle
} from '../utils/gridScrollRestore';
import {
	registerMediaGridProfile,
	unregisterMediaGridProfile
} from '../utils/mediaPerformanceMetrics';
import css from './MediaVirtualGrid.module.less';

export const MEDIA_VIRTUAL_GRID_VARIANTS = Object.freeze({
	POSTER: 'poster-grid',
	LANDSCAPE: 'landscape-grid'
});

export const getMediaVirtualGridMetrics = (variant) => (
	variant === MEDIA_VIRTUAL_GRID_VARIANTS.LANDSCAPE
		? {
			itemSize: {minWidth: ri.scale(1020), minHeight: ri.scale(920)},
			spacing: ri.scale(72)
		}
		: {
			itemSize: {minWidth: ri.scale(576), minHeight: ri.scale(1200)},
			spacing: ri.scale(72)
		}
);

const getDefaultItemId = (item) => item?.Id;
const EMPTY_ITEM_RENDERER_PROPS = Object.freeze({});

const MediaVirtualGrid = ({
	id,
	spotlightId = id,
	className = '',
	items = [],
	itemRenderer,
	variant = MEDIA_VIRTUAL_GRID_VARIANTS.POSTER,
	isActive = true,
	queryKey = '',
	restoreItemId = null,
	focusFirstItem = false,
	getItemId = getDefaultItemId,
	hasMore = false,
	loadingMore = false,
	loadMoreThreshold = 12,
	onLoadMore,
	onItemFocus,
	focusedItemIdRef = null,
	focusFirstItemRef = null,
	itemRendererProps = EMPTY_ITEM_RENDERER_PROPS,
	disableFocusScale = true,
	overhang,
	overscrollEffectOn = SCROLLER_OVERSCROLL_EFFECT_OFF,
	cbScrollTo,
	...rest
}) => {
	const scrollToRef = useRef(null);
	const restoreCycleRef = useRef(null);
	const metricTokenRef = useRef(Symbol('media-virtual-grid'));
	const performanceMode = usePerformanceMode();
	const diagnosticsEnabled = useRuntimeDiagnosticsEnabled();
	const resolvedOverhang = Number.isFinite(overhang)
		? Math.max(0, Math.trunc(overhang))
		: getVirtualGridOverhang(performanceMode);
	const metrics = useMemo(() => getMediaVirtualGridMetrics(variant), [variant]);
	const requestLoadMore = useCallback((lastVisibleIndex) => {
		if (!hasMore || loadingMore || typeof onLoadMore !== 'function') return;
		if (!Number.isInteger(lastVisibleIndex)) return;
		if (items.length - lastVisibleIndex - 1 <= loadMoreThreshold) onLoadMore();
	}, [hasMore, items.length, loadMoreThreshold, loadingMore, onLoadMore]);
	const handleItemFocus = useCallback((index, event) => {
		if (focusedItemIdRef) focusedItemIdRef.current = getItemId(items[index]) || null;
		if (focusFirstItemRef) focusFirstItemRef.current = false;
		onItemFocus?.(index, event);
		requestLoadMore(index);
	}, [focusFirstItemRef, focusedItemIdRef, getItemId, items, onItemFocus, requestLoadMore]);
	const handleItemFocusEvent = useCallback((event) => {
		const index = Number(event?.currentTarget?.dataset?.index);
		if (Number.isInteger(index)) handleItemFocus(index, event);
	}, [handleItemFocus]);
	const childProps = useMemo(() => ({
		...itemRendererProps,
		items,
		onVirtualItemFocusEvent: handleItemFocusEvent
	}), [handleItemFocusEvent, itemRendererProps, items]);
	const captureScrollTo = useCallback((scrollTo) => {
		scrollToRef.current = scrollTo;
		cbScrollTo?.(scrollTo);
	}, [cbScrollTo]);
	const handleScrollStop = useCallback(({moreInfo} = {}) => {
		requestLoadMore(moreInfo?.lastVisibleIndex);
	}, [requestLoadMore]);

	useEffect(() => {
		if (!diagnosticsEnabled) return undefined;
		const metricToken = metricTokenRef.current;
		registerMediaGridProfile(metricToken, {
			overhang: resolvedOverhang,
			active: isActive
		});
		return () => unregisterMediaGridProfile(metricToken);
	}, [diagnosticsEnabled, isActive, resolvedOverhang]);

	useEffect(() => {
		const cycle = updateGridFocusRestoreCycle(restoreCycleRef.current, {
			isActive,
			queryKey,
			restoreItemId,
			focusFirstItem
		});
		restoreCycleRef.current = cycle;
		if (!isActive || !scrollToRef.current) return;
		const targetItemId = resolveGridFocusRestoreTarget({cycle, items, getItemId});
		if (!targetItemId) return;
		const restoreIndex = items.findIndex((item) => String(getItemId(item)) === String(targetItemId));
		if (restoreIndex < 0) return;
		restoreCycleRef.current = {
			...cycle,
			targetItemId,
			completed: true
		};
		const frameId = window.requestAnimationFrame(() => {
			scrollToRef.current?.({index: restoreIndex, focus: true, animate: false});
		});
		return () => window.cancelAnimationFrame(frameId);
	}, [focusFirstItem, getItemId, isActive, items, queryKey, restoreItemId]);

	return (
		<div
			className={`${css.container} ${disableFocusScale ? css.disableFocusScale : ''}`}
			data-bf-grid-overhang={resolvedOverhang}
		>
			<VirtualGridList
				{...rest}
				id={id}
				spotlightId={spotlightId}
				className={className}
				dataSize={items.length}
				itemRenderer={itemRenderer}
				itemSize={metrics.itemSize}
				spacing={metrics.spacing}
				childProps={childProps}
				cbScrollTo={captureScrollTo}
				onScrollStop={handleScrollStop}
				overhang={resolvedOverhang}
				overscrollEffectOn={overscrollEffectOn}
				snapToCenter={false}
			/>
			{loadingMore ? (
				<div className={css.loadingMore} aria-hidden="true">
					<Spinner size="small" />
				</div>
			) : null}
		</div>
	);
};

export default MediaVirtualGrid;
