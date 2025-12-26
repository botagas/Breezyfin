import { useState, useRef, useCallback } from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Scroller from '@enact/sandstone/Scroller';
import BodyText from '@enact/sandstone/BodyText';
import Spinner from '@enact/sandstone/Spinner';

import css from './MediaRow.module.less';

const SpottableDiv = Spottable('div');

const MediaCard = ({ item, imageUrl, onClick, ...rest }) => {
	const [imageError, setImageError] = useState(false);

	// Format title: for episodes show "Series Name" and "S1:E2" below
	const getDisplayTitle = () => {
		if (item.Type === 'Episode') {
			return item.SeriesName || item.Name;
		}
		return item.Name;
	};

	const getSubtitle = () => {
		if (item.Type === 'Episode') {
			const season = item.ParentIndexNumber || 1;
			const episode = item.IndexNumber || 1;
			return `S${season}:E${episode}`;
		}
		return null;
	};

	// Get remaining episodes count for series and episodes
	const getRemainingCount = () => {
		if (item.Type === 'Series' && item.UserData) {
			const hasWatched = item.UserData.PlayedPercentage > 0 || item.UserData.PlaybackPositionTicks > 0 || item.UserData.Played;
			const unwatchedCount = item.UserData.UnplayedItemCount;
			if (hasWatched && unwatchedCount > 0) {
				return unwatchedCount;
			}
		}
		// For episodes, check if there's a series unwatched count
		if (item.Type === 'Episode') {
			// Episodes from NextUp/Resume should have SeriesId and we can use the series' UnplayedItemCount
			// This data might be embedded in the episode response from the server
			const unwatchedCount = item.SeriesUserData?.UnplayedItemCount || item.UnplayedItemCount;
			if (unwatchedCount > 0) {
				return unwatchedCount;
			}
		}
		return null;
	};

	// Use series backdrop for episodes if they don't have their own
	const getImageUrl = () => {
		if (item.Type === 'Episode' && item.SeriesId && imageError) {
			// Fallback to series backdrop
			return imageUrl.replace(item.Id, item.SeriesId);
		}
		return imageUrl;
	};

	return (
		<SpottableDiv
			className={css.card}
			onClick={() => onClick(item)}
			onKeyDown={(e) => {
				// Ensure left/right navigation moves focus predictably across cards
				if (e.keyCode === 37 && e.target.previousElementSibling) { // left
					e.preventDefault();
					e.target.previousElementSibling.focus();
				} else if (e.keyCode === 39 && e.target.nextElementSibling) { // right
					e.preventDefault();
					e.target.nextElementSibling.focus();
				}
			}}
			{...rest}
		>
			<div className={css.cardImage}>
				{!imageError ? (
					<img
						src={getImageUrl()}
						alt={item.Name}
						onError={() => setImageError(true)}
					/>
				) : (
					<div className={css.placeholder}>
						<BodyText>{getDisplayTitle()}</BodyText>
					</div>
				)}
				{getRemainingCount() && (
					<div className={css.episodeBadge}>
						{getRemainingCount()}
					</div>
				)}
				{item.UserData?.PlayedPercentage > 0 && (
					<div className={css.progressBar}>
						<div
							className={css.progress}
							style={{ width: `${item.UserData.PlayedPercentage}%` }}
						/>
					</div>
				)}
			</div>
			<div className={css.cardInfo}>
				<BodyText className={css.cardTitle}>
					{getDisplayTitle()}
				</BodyText>
				{getSubtitle() && (
					<BodyText className={css.cardSubtitle} size="small">
						{getSubtitle()}
					</BodyText>
				)}
			</div>
		</SpottableDiv>
	);
};

const Container = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-only'
}, 'div');

const MediaRow = ({ title, items, loading, onItemClick, getImageUrl, ...rest }) => {
	const scrollerRef = useRef(null);

	// Handle focus to scroll item into view
	const handleFocus = useCallback((e) => {
		if (scrollerRef.current && scrollerRef.current.contains(e.target)) {
			const scroller = scrollerRef.current;
			const element = e.target.closest('.' + css.card);
			if (element) {
				const scrollerRect = scroller.getBoundingClientRect();
				const elementRect = element.getBoundingClientRect();

				if (elementRect.left < scrollerRect.left + 60) {
					scroller.scrollLeft -= (scrollerRect.left + 60) - elementRect.left + 20;
				} else if (elementRect.right > scrollerRect.right - 60) {
					scroller.scrollLeft += elementRect.right - (scrollerRect.right - 60) + 20;
				}
			}
		}
	}, []);

	if (loading) {
		return (
			<div className={css.row} {...rest}>
				<BodyText className={css.rowTitle}>{title}</BodyText>
				<div className={css.loading}>
					<Spinner />
				</div>
			</div>
		);
	}

	if (!items || items.length === 0) {
		return null;
	}

	return (
		<div className={css.row} {...rest}>
			<BodyText className={css.rowTitle}>{title}</BodyText>
			<Container 
				className={css.rowContent}
				onFocus={handleFocus}
			>
				<div className={css.cardContainer} ref={scrollerRef}>
					{items.map((item, index) => (
						<MediaCard
							key={item.Id}
							item={item}
							imageUrl={getImageUrl(item.Id, item)}
							onClick={onItemClick}
							spotlightId={`${title}-${index}`}
						/>
					))}
				</div>
			</Container>
		</div>
	);
};

export default MediaRow;
