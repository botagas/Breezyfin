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

const LibraryPanel = ({ library, onItemSelect, onNavigate, onSwitchUser, onLogout, onExit, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState([]);
	const libraryScrollToRef = useRef(null);
	const gridRef = useRef(null);
	const itemsById = useMemo(() => {
		const map = new Map();
		items.forEach((item) => {
			map.set(String(item.Id), item);
		});
		return map;
	}, [items]);

	const loadLibraryItems = useCallback(async () => {
		if (!library) return;
		setLoading(true);
		try {
			console.log('Loading library items for:', library);
			let itemTypes = undefined;
			if (library.CollectionType === 'movies') itemTypes = ['Movie'];
			if (library.CollectionType === 'tvshows') itemTypes = ['Series'];
			const response = await jellyfinService.getLibraryItems(library.Id, itemTypes);
			setItems(response || []);
		} catch (error) {
			console.error('Failed to load library items:', error);
		} finally {
			setLoading(false);
		}
	}, [library]);

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
				/>
			<Scroller className={css.scroller} cbScrollTo={captureLibraryScrollTo}>
				<div className={css.gridContainer} ref={gridRef}>
						{items.map(item => (
								<SpottableDiv
									key={item.Id}
									data-item-id={item.Id}
									className={css.gridCard}
									onClick={handleGridCardClick}
									onKeyDown={handleGridCardKeyDown}
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
								{getUnwatchedCount(item) !== null && (
									<div className={css.progressBadge}>
										{getUnwatchedCount(item) === 0 ? '✓' : getUnwatchedCount(item)}
									</div>
								)}
								{item.Type !== 'Series' && item.UserData?.PlayedPercentage > 0 && (
									<div className={css.progressBar}>
										<div
											className={css.progress}
											style={{ width: `${item.UserData.PlayedPercentage}%` }}
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
				</div>
			</Scroller>
		</Panel>
	);
};

export default LibraryPanel;
