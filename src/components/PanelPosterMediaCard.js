import PosterMediaCard from './PosterMediaCard';
import MediaCardStatusOverlay from './MediaCardStatusOverlay';
import {
	getPlaybackProgressPercent,
	getPosterCardImageUrl,
	getSeriesUnplayedCount,
	hasStartedWatching
} from '../utils/mediaItemUtils';

const getPanelCardTitle = (item) => (
	item?.Type === 'Episode' ? (item.SeriesName || item.Name) : item?.Name
);

const getPanelCardSubtitle = (item) => {
	if (item?.Type === 'Episode') {
		return `S${item.ParentIndexNumber || 1}:E${item.IndexNumber || 1}`;
	}
	return item?.ProductionYear ? String(item.ProductionYear) : '';
};

const PanelPosterMediaCard = ({
	item,
	index,
	classes,
	imageOptions = {includeBackdrop: true, includeSeriesFallback: false},
	onClick,
	onPointerDown,
	onMouseDown,
	onFocus,
	onKeyDown,
	spotlightDisabled = false
}) => {
	const unwatchedCount = getSeriesUnplayedCount(item);
	const showWatchStatus = unwatchedCount !== null && hasStartedWatching(item);
	const isWatchComplete = showWatchStatus && unwatchedCount === 0;

	return (
		<PosterMediaCard
			itemId={item.Id}
			data-item-index={index}
			className={classes.gridCard}
			imageClassName={classes.cardImage}
			placeholderClassName={classes.placeholder}
			usePlaceholderClassWhenNoImage
			imageUrl={getPosterCardImageUrl(item, imageOptions) || ''}
			title={getPanelCardTitle(item)}
			subtitle={getPanelCardSubtitle(item)}
			titleClassName={classes.cardTitle}
			subtitleClassName={classes.cardSubtitle}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onMouseDown={onMouseDown}
			onFocus={onFocus}
			onKeyDown={onKeyDown}
			spotlightDisabled={spotlightDisabled}
			overlayContent={(
				<MediaCardStatusOverlay
					showWatched={showWatchStatus}
					watchedContent={isWatchComplete ? '\u2713' : unwatchedCount}
					watchedClassName={isWatchComplete ? classes.watchedBadge : classes.progressBadge}
					progressPercent={item.Type !== 'Series' && hasStartedWatching(item) ? getPlaybackProgressPercent(item) : null}
					progressBarClassName={classes.progressBar}
					progressClassName={classes.progress}
				/>
			)}
		/>
	);
};

export default PanelPosterMediaCard;
