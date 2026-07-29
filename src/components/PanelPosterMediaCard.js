import PosterMediaCard from './PosterMediaCard';
import {getMediaCardPresentation} from '../utils/mediaCardPresentation';
import {
	getPlaybackProgressPercent,
	getPosterCardImageUrls,
	getSeriesUnplayedCount,
	hasStartedWatching,
	mergeMediaItemImageCandidates
} from '../utils/mediaItemUtils';

const PanelPosterMediaCard = ({
	item,
	index,
	variant = 'landscape-grid',
	className,
	imageOptions = {includeBackdrop: true, includeSeriesFallback: false},
	onClick,
	onPointerDown,
	onMouseDown,
	onFocus,
	onKeyDown,
	spotlightDisabled = false,
	...rest
}) => {
	const presentation = getMediaCardPresentation(item);
	const unwatchedCount = getSeriesUnplayedCount(item);
	const showWatchStatus = unwatchedCount !== null && hasStartedWatching(item);
	const isWatchComplete = showWatchStatus && unwatchedCount === 0;

	return (
		<PosterMediaCard
			{...rest}
			itemId={item.Id}
			data-item-index={index}
			variant={variant}
			className={className}
			imageCandidates={mergeMediaItemImageCandidates(
				item,
				getPosterCardImageUrls(item, imageOptions)
			)}
			title={presentation.title}
			subtitle={presentation.subtitle}
			contextBadge={presentation.contextBadge}
			ariaLabel={presentation.ariaLabel}
			showWatched={showWatchStatus}
			watchedContent={isWatchComplete ? '\u2713' : unwatchedCount}
			watchedVariant={isWatchComplete ? 'watched' : 'progress'}
			progressPercent={item.Type !== 'Series' && hasStartedWatching(item) ? getPlaybackProgressPercent(item) : null}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onMouseDown={onMouseDown}
			onFocus={onFocus}
			onKeyDown={onKeyDown}
			spotlightDisabled={spotlightDisabled}
		/>
	);
};

export default PanelPosterMediaCard;
