import {memo, useRef, useCallback, useEffect} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import BodyText from '@enact/sandstone/BodyText';
import Spinner from '@enact/sandstone/Spinner';
import Icon from '@enact/sandstone/Icon';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';
import { createLastFocusedSpotlightContainer } from '../utils/spotlightContainerUtils';
import {KeyCodes} from '../utils/keyCodes';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';
import {getEpisodeLocator} from '../utils/mediaItemUtils';
import {buildMediaListItemKey} from '../utils/reactKeys';
import MediaCardImage from './MediaCardImage';

import css from './MediaRow.module.less';

const SpottableDiv = Spottable('div');

const MediaCard = memo(function MediaCard({item, imageCandidates, imageDeferred, onClick, showEpisodeProgress, onCardKeyDown, variant, ...rest}) {
	const handleCardClick = useCallback(() => {
		onClick(item);
	}, [item, onClick]);

	const handleCardKeyDown = useCallback((e) => {
		const code = e.keyCode || e.which;
		if (typeof onCardKeyDown === 'function') {
			onCardKeyDown(e, item);
		}
		if (e.defaultPrevented) return;
		if (code === KeyCodes.LEFT && e.target.previousElementSibling) {
			e.preventDefault();
			e.target.previousElementSibling.focus();
		} else if (code === KeyCodes.RIGHT && e.target.nextElementSibling) {
			e.preventDefault();
			e.target.nextElementSibling.focus();
		}
	}, [item, onCardKeyDown]);

	const getDisplayTitle = () => {
		if (item.Type === 'Episode') {
			return item.SeriesName || item.Name;
		}
		return item.Name;
	};

	const getSubtitle = () => {
		if (item.Type === 'Episode') {
			return getEpisodeLocator(item) || null;
		}
		return null;
	};

	const getRemainingCount = () => {
		if (item.Type === 'Series' && item.UserData) {
			const hasWatched = item.UserData.PlayedPercentage > 0 || item.UserData.PlaybackPositionTicks > 0 || item.UserData.Played;
			const remainingUnwatchedCount = item.UserData.UnplayedItemCount;
			if (hasWatched && remainingUnwatchedCount > 0) {
				return remainingUnwatchedCount;
			}
		}
		if (item.Type === 'Episode') {
			const remainingUnwatchedCount = item.SeriesUserData?.UnplayedItemCount || item.UnplayedItemCount;
			if (remainingUnwatchedCount > 0) {
				return remainingUnwatchedCount;
			}
		}
		return null;
	};

	const getUnwatchedCount = () => {
		if (!showEpisodeProgress) return null;
		if (item.Type === 'Series') {
			const seriesUnplayedCount = item.UserData?.UnplayedItemCount;
			return Number.isInteger(seriesUnplayedCount) ? seriesUnplayedCount : null;
		}
		if (item.Type === 'Episode') {
			const episodeUnplayedCount = item.SeriesUserData?.UnplayedItemCount || item.UnplayedItemCount;
			return Number.isInteger(episodeUnplayedCount) ? episodeUnplayedCount : null;
		}
		return null;
	};

	const cardUnwatchedCount = getUnwatchedCount();
	const showWatchedStatusBadge = showEpisodeProgress && cardUnwatchedCount !== null;
	const isCompletedWatchBadge = showWatchedStatusBadge && cardUnwatchedCount === 0;
	const remainingCount = getRemainingCount();
	return (
		<SpottableDiv
			className={`${css.card} ${variant === 'cinematic' ? css.cardCinematic : ''}`}
			onClick={handleCardClick}
			onKeyDown={handleCardKeyDown}
			{...rest}
		>
			<div className={css.cardImage}>
				<MediaCardImage
					candidates={imageCandidates}
					alt={item.Name}
					width={640}
					height={360}
					loading="eager"
					deferred={imageDeferred}
					placeholder={(
						<div className={css.placeholder}>
							<BodyText>{getDisplayTitle()}</BodyText>
						</div>
					)}
				/>
				{showWatchedStatusBadge ? (
					<div className={isCompletedWatchBadge ? css.watchedBadge : css.progressBadge}>
						{isCompletedWatchBadge ? '✓' : cardUnwatchedCount}
					</div>
				) : (
					remainingCount && (
						<div className={css.episodeBadge}>
							{remainingCount}
						</div>
					)
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
});

const Container = createLastFocusedSpotlightContainer('div', {
	restrict: 'self-only'
});

const MediaRow = ({
	title,
	items,
	loading,
	onItemClick,
	getImageUrl,
	getImageCandidates,
	imagesActive = true,
	onRowVisible,
	onRowFocus,
	showEpisodeProgress = false,
	rowIndex = 0,
	onCardKeyDown,
	onMoreClick,
	moreSpotlightId,
	sectionKey,
	variant = 'current',
	...rest
}) => {
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	const isLegacyCompactLayout = runtimeCapabilities.webosV6Compat
		|| runtimeCapabilities.legacyWebOS
		|| (!runtimeCapabilities.supportsAspectRatio && !runtimeCapabilities.supportsFlexGap);
	const scrollerRef = useRef(null);
	const rowRef = useRef(null);
	const focusAnimationFrameRef = useRef(0);
	const horizontalMetricsRef = useRef(null);

	useEffect(() => {
		return () => {
			window.cancelAnimationFrame(focusAnimationFrameRef.current);
		};
	}, []);

	useEffect(() => {
		const resetHorizontalMetrics = () => {
			horizontalMetricsRef.current = null;
		};
		resetHorizontalMetrics();
		window.addEventListener('resize', resetHorizontalMetrics);
		return () => window.removeEventListener('resize', resetHorizontalMetrics);
	}, [items?.length, variant]);

	useEffect(() => {
		if (imagesActive || typeof onRowVisible !== 'function' || !rowRef.current) return undefined;
		if (typeof window.IntersectionObserver !== 'function') return undefined;
		const observer = new window.IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			onRowVisible(rowIndex);
			observer.disconnect();
		}, {rootMargin: '65% 0px'});
		observer.observe(rowRef.current);
		return () => observer.disconnect();
	}, [imagesActive, onRowVisible, rowIndex]);

	const handleFocus = useCallback((e) => {
		onRowVisible?.(rowIndex);
		onRowFocus?.(rowIndex, rowRef.current);
		if (scrollerRef.current && scrollerRef.current.contains(e.target)) {
			const scroller = scrollerRef.current;
			const element = e.target.closest('.' + css.card);
			if (element) {
				window.cancelAnimationFrame(focusAnimationFrameRef.current);
				focusAnimationFrameRef.current = window.requestAnimationFrame(() => {
					if (!horizontalMetricsRef.current) {
						horizontalMetricsRef.current = {
							viewportWidth: scroller.clientWidth,
							scrollWidth: scroller.scrollWidth
						};
					}
					scrollElementIntoHorizontalView(scroller, element, {
						...horizontalMetricsRef.current,
						minBuffer: 60,
						edgeRatio: 0.10,
						padding: 20,
						behavior: 'auto'
					});
					focusAnimationFrameRef.current = 0;
				});
			}
		}
	}, [onRowFocus, onRowVisible, rowIndex]);

	const handleMoreClick = useCallback(() => {
		if (typeof onMoreClick === 'function') {
			onMoreClick(sectionKey);
		}
	}, [onMoreClick, sectionKey]);

	if (loading) {
		return (
			<div className={`${css.row} ${isLegacyCompactLayout ? css.rowCompactWebos6 : ''}`} {...rest}>
				<div className={css.rowHeader}>
					<BodyText className={`${css.rowTitle} ${isLegacyCompactLayout ? css.rowTitleCompactWebos6 : ''}`}>{title}</BodyText>
				</div>
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
		<div
			ref={rowRef}
			className={`${css.row} ${isLegacyCompactLayout ? css.rowCompactWebos6 : ''} ${variant === 'cinematic' ? css.rowCinematic : ''} ${variant === 'cinematic' && rowIndex === 0 ? css.rowCinematicFirst : ''}`}
			{...rest}
		>
			<div className={css.rowHeader}>
				<BodyText className={`${css.rowTitle} ${isLegacyCompactLayout ? css.rowTitleCompactWebos6 : ''}`}>{title}</BodyText>
				{typeof onMoreClick === 'function' ? (
					<SpottableDiv
						role="button"
						className={css.rowMoreButton}
						spotlightId={moreSpotlightId}
						onClick={handleMoreClick}
						aria-label={`View more ${title}`}
						title={`View more ${title}`}
					>
						<Icon className={css.rowMoreIcon}>arrowsmallright</Icon>
					</SpottableDiv>
				) : null}
			</div>
			<Container
				className={css.rowContent}
				onFocus={handleFocus}
			>
				<div className={`${css.cardContainer} ${isLegacyCompactLayout ? css.cardContainerCompactWebos6 : ''}`} ref={scrollerRef}>
					{items.map((item, index) => (
						<MediaCard
							key={buildMediaListItemKey(`home-row-${sectionKey || title}`, item, index)}
							item={item}
							imageCandidates={imagesActive
								? (getImageCandidates?.(item.Id, item) || (getImageUrl ? [getImageUrl(item.Id, item)] : []))
								: []}
							imageDeferred={!imagesActive}
							onClick={onItemClick}
							showEpisodeProgress={showEpisodeProgress}
							spotlightId={`${title}-${index}`}
							data-row-index={rowIndex}
							data-card-index={index}
							onCardKeyDown={onCardKeyDown}
							variant={variant}
						/>
					))}
				</div>
			</Container>
		</div>
	);
};

export default memo(MediaRow);
