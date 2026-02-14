import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';
import {KeyCodes} from '../utils/keyCodes';

import css from './LibraryPanel.module.less';

const SpottableDiv = Spottable('div');
const LIBRARY_PAGE_SIZE = 60;
const FOCUS_PREFETCH_THRESHOLD = 12;

const LibraryPanel = ({ library, onItemSelect, onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [items, setItems] = useState([]);
	const libraryScrollToRef = useRef(null);
	const gridRef = useRef(null);
	const paginationRef = useRef({ nextStartIndex: 0, itemTypes: undefined });
	const requestIdRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const itemsById = useMemo(() => {
		const map = new Map();
		items.forEach((item) => {
			map.set(String(item.Id), item);
		});
		return map;
	}, [items]);

	const getItemTypesForLibrary = useCallback((libraryValue) => {
		if (!libraryValue) return undefined;
		if (libraryValue.CollectionType === 'movies') return ['Movie'];
		if (libraryValue.CollectionType === 'tvshows') return ['Series'];
		return undefined;
	}, []);

	const loadNextPage = useCallback(async () => {
		if (!library || loading || !hasMore || loadingMoreRef.current) return;

		loadingMoreRef.current = true;
		setLoadingMore(true);
		const requestId = requestIdRef.current;
		const { nextStartIndex, itemTypes } = paginationRef.current;

		try {
			const nextBatch = await jellyfinService.getLibraryItems(
				library.Id,
				itemTypes,
				LIBRARY_PAGE_SIZE,
				nextStartIndex
			);
			if (requestId !== requestIdRef.current) return;

			const safeBatch = Array.isArray(nextBatch) ? nextBatch : [];
			if (safeBatch.length === 0) {
				setHasMore(false);
				return;
			}

			paginationRef.current.nextStartIndex = nextStartIndex + safeBatch.length;
			setItems((prevItems) => {
				const existingIds = new Set(prevItems.map((item) => String(item.Id)));
				const dedupedBatch = safeBatch.filter((item) => !existingIds.has(String(item.Id)));
				return dedupedBatch.length ? [...prevItems, ...dedupedBatch] : prevItems;
			});
			if (safeBatch.length < LIBRARY_PAGE_SIZE) {
				setHasMore(false);
			}
		} catch (error) {
			console.error('Failed to load additional library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoadingMore(false);
			}
			loadingMoreRef.current = false;
		}
	}, [hasMore, library, loading]);

	const loadLibraryItems = useCallback(async () => {
		if (!library) return;
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		const itemTypes = getItemTypesForLibrary(library);
		paginationRef.current = { nextStartIndex: 0, itemTypes };
		loadingMoreRef.current = false;
		setLoading(true);
		setLoadingMore(false);
		setItems([]);
		setHasMore(false);
		try {
			const firstBatch = await jellyfinService.getLibraryItems(
				library.Id,
				itemTypes,
				LIBRARY_PAGE_SIZE,
				0
			);
			if (requestId !== requestIdRef.current) return;

			const safeFirstBatch = Array.isArray(firstBatch) ? firstBatch : [];
			setItems(safeFirstBatch);
			paginationRef.current.nextStartIndex = safeFirstBatch.length;
			setHasMore(safeFirstBatch.length === LIBRARY_PAGE_SIZE);
		} catch (error) {
			console.error('Failed to load library items:', error);
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
			}
		}
	}, [getItemTypesForLibrary, library]);

	useEffect(() => {
		if (library) {
			loadLibraryItems();
		}
	}, [library, loadLibraryItems]);

	const handleGridCardClick = useCallback((event) => {
		const itemId = event.currentTarget.dataset.itemId;
		const selectedItem = itemsById.get(itemId);
		if (!selectedItem) return;
		onItemSelect(selectedItem);
	}, [itemsById, onItemSelect]);

	const handleGridImageError = useCallback((e) => {
		e.target.style.display = 'none';
		e.target.parentElement.classList.add(css.placeholder);
	}, []);

	const getImageUrl = (itemId, item) => {
		if (item.ImageTags && item.ImageTags.Primary) {
			return `${jellyfinService.serverUrl}/Items/${itemId}/Images/Primary?maxWidth=400&tag=${item.ImageTags.Primary}&quality=100&fillWidth=400&fillHeight=600`;
		}
		if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return `${jellyfinService.serverUrl}/Items/${itemId}/Images/Backdrop/${item.BackdropImageTags[0]}?maxWidth=400&quality=100`;
		}
		return '';
	};

	const getUnwatchedCount = (item) => {
		if (item.Type !== 'Series') return null;
		const unplayedCount = item.UserData?.UnplayedItemCount;
		return Number.isInteger(unplayedCount) ? unplayedCount : null;
	};

	const hasStartedWatching = (item) => {
		const userData = item?.UserData;
		if (!userData) return false;
		if (userData.Played) return true;
		if (typeof userData.PlayedPercentage === 'number' && userData.PlayedPercentage > 0) return true;
		if (typeof userData.PlaybackPositionTicks === 'number' && userData.PlaybackPositionTicks > 0) return true;
		return false;
	};

	const captureLibraryScrollTo = useCallback((fn) => {
		libraryScrollToRef.current = fn;
	}, []);

	const focusTopToolbarAction = useCallback(() => {
		if (library?.Id && Spotlight?.focus?.(`toolbar-library-${library.Id}`)) return true;
		if (Spotlight?.focus?.('toolbar-home')) return true;
		const target = document.querySelector('[data-spotlight-id="toolbar-home"]') ||
			document.querySelector('[data-spotlight-id="toolbar-user"]');
		if (target?.focus) {
			target.focus({preventScroll: true});
			return true;
		}
		return false;
	}, [library?.Id]);

	const handleGridCardKeyDown = useCallback((event) => {
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.UP) return;
		const cards = Array.from(gridRef.current?.querySelectorAll(`.${css.gridCard}`) || []);
		if (cards.length === 0) return;
		const firstRowTop = Math.min(...cards.map((card) => card.offsetTop));
		const currentTop = event.currentTarget.offsetTop;
		if (currentTop > firstRowTop + 1) return;

		event.preventDefault();
		event.stopPropagation();
		if (typeof libraryScrollToRef.current === 'function') {
			libraryScrollToRef.current({align: 'top', animate: true});
		}
		focusTopToolbarAction();
	}, [focusTopToolbarAction]);

	const handleGridCardFocus = useCallback((event) => {
		if (!hasMore || loadingMoreRef.current) return;
		const itemIndex = Number(event.currentTarget.dataset.itemIndex);
		if (!Number.isInteger(itemIndex)) return;
		const remainingItems = items.length - itemIndex - 1;
		if (remainingItems <= FOCUS_PREFETCH_THRESHOLD) {
			loadNextPage();
		}
	}, [hasMore, items.length, loadNextPage]);

	const handleScrollerScrollStop = useCallback((event) => {
		if (event?.reachedEdgeInfo?.bottom) {
			loadNextPage();
		}
	}, [loadNextPage]);

	if (loading) {
		return (
			<Panel {...rest}>
				<Header title={library?.Name || 'Library'} />
					<Toolbar
						activeSection="library"
						activeLibraryId={library?.Id}
						onNavigate={onNavigate}
						onSwitchUser={onSwitchUser}
						onLogout={onLogout}
						onExit={onExit}
						registerBackHandler={registerBackHandler}
					/>
				<div className={css.loading}>
					<Spinner />
				</div>
			</Panel>
		);
	}

	return (
		<Panel {...rest}>
			<Header title={library?.Name || 'Library'} />
				<Toolbar
					activeSection="library"
					activeLibraryId={library?.Id}
					onNavigate={onNavigate}
					onSwitchUser={onSwitchUser}
					onLogout={onLogout}
					onExit={onExit}
					registerBackHandler={registerBackHandler}
				/>
			<div className={css.libraryContainer}>
				<Scroller
					className={css.scroller}
					cbScrollTo={captureLibraryScrollTo}
					onScrollStop={handleScrollerScrollStop}
				>
					<div className={css.gridContainer} ref={gridRef}>
							{items.map((item, index) => (
									<SpottableDiv
										key={item.Id}
										data-item-id={item.Id}
										data-item-index={index}
										className={css.gridCard}
										onClick={handleGridCardClick}
										onKeyDown={handleGridCardKeyDown}
										onFocus={handleGridCardFocus}
									>
								<div className={css.cardImage}>
										<img
											src={getImageUrl(item.Id, item)}
											alt={item.Name}
											onError={handleGridImageError}
											loading="lazy"
											decoding="async"
											draggable={false}
										/>
									{getUnwatchedCount(item) !== null && hasStartedWatching(item) && (
										<div className={css.progressBadge}>
											{getUnwatchedCount(item) === 0 ? '\u2713' : getUnwatchedCount(item)}
										</div>
									)}
									{item.Type !== 'Series' && hasStartedWatching(item) && (
										<div className={css.progressBar}>
											<div
												className={css.progress}
												style={{ width: `${item.UserData?.Played ? 100 : (item.UserData?.PlayedPercentage || 0)}%` }}
											/>
										</div>
									)}
								</div>
								<BodyText className={css.cardTitle}>{item.Name}</BodyText>
								{item.ProductionYear && (
									<BodyText className={css.cardSubtitle}>{item.ProductionYear}</BodyText>
								)}
							</SpottableDiv>
						))}
						{loadingMore && (
							<div className={css.loadingMore}>
								<Spinner size="small" />
							</div>
						)}
					</div>
				</Scroller>
			</div>
		</Panel>
	);
};

export default LibraryPanel;

