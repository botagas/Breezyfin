import { useState, useEffect } from 'react';
import { Panel, Header } from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import BodyText from '@enact/sandstone/BodyText';
import jellyfinService from '../services/jellyfinService';
import Toolbar from '../components/Toolbar';

import css from './LibraryPanel.module.less';

const LibraryPanel = ({ library, onItemSelect, onNavigate, onLogout, onExit, onBack, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState([]);

	useEffect(() => {
		if (library) {
			loadLibraryItems();
		}
	}, [library]);

	const loadLibraryItems = async () => {
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
	};

	const handleItemClick = (item) => {
		onItemSelect(item);
	};

	const getImageUrl = (itemId, item) => {
		if (item.ImageTags && item.ImageTags.Primary) {
			return `${jellyfinService.serverUrl}/Items/${itemId}/Images/Primary?maxWidth=400&tag=${item.ImageTags.Primary}&quality=100&fillWidth=400&fillHeight=600`;
		}
		if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return `${jellyfinService.serverUrl}/Items/${itemId}/Images/Backdrop/${item.BackdropImageTags[0]}?maxWidth=400&quality=100`;
		}
		return '';
	};

	if (loading) {
		return (
			<Panel {...rest}>
				<Header title={library?.Name || 'Library'} />
				<Toolbar 
					activeSection="library"
					activeLibraryId={library?.Id}
					onNavigate={onNavigate}
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
				onLogout={onLogout}
				onExit={onExit}
			/>
			<Scroller className={css.scroller}>
				<div className={css.gridContainer}>
					{items.map(item => (
						<div
							key={item.Id}
							className={css.gridCard}
							onClick={() => handleItemClick(item)}
							tabIndex={0}
							onKeyDown={(e) => {
								const card = e.currentTarget;
								const cards = Array.from(card.parentElement.querySelectorAll(`.${css.gridCard}`));
								const idx = cards.indexOf(card);
								const columns = Math.floor(card.parentElement.clientWidth / card.clientWidth) || 1;
								if (e.keyCode === 37 && idx > 0) { // left
									e.preventDefault();
									cards[idx - 1].focus();
								} else if (e.keyCode === 39 && idx < cards.length - 1) { // right
									e.preventDefault();
									cards[idx + 1].focus();
								} else if (e.keyCode === 38 && idx - columns >= 0) { // up
									e.preventDefault();
									cards[idx - columns].focus();
								} else if (e.keyCode === 40 && idx + columns < cards.length) { // down
									e.preventDefault();
									cards[idx + columns].focus();
								}
							}}
						>
							<div className={css.cardImage}>
								<img 
									src={getImageUrl(item.Id, item)} 
									alt={item.Name}
									onError={(e) => {
										e.target.style.display = 'none';
										e.target.parentElement.classList.add(css.placeholder);
									}}
								/>
							</div>
							<BodyText className={css.cardTitle}>{item.Name}</BodyText>
							{item.ProductionYear && (
								<BodyText className={css.cardSubtitle}>{item.ProductionYear}</BodyText>
							)}
						</div>
					))}
				</div>
			</Scroller>
		</Panel>
	);
};

export default LibraryPanel;
