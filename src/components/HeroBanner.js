import { useState, useEffect, useCallback, useMemo } from 'react';
import Button from './BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import Heading from '@enact/sandstone/Heading';
import Marquee from '@enact/sandstone/Marquee';
import jellyfinService from '../services/jellyfinService';

import css from './HeroBanner.module.less';

const AUTO_ROTATE_INTERVAL_MS = 8000;
const TRANSITION_DURATION_MS = 420;

const HeroBanner = ({ items, onPlayClick }) => {
	const itemCount = items?.length || 0;
	const [currentIndex, setCurrentIndex] = useState(0);
	const [previousIndex, setPreviousIndex] = useState(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [imageErrors, setImageErrors] = useState({});

	useEffect(() => {
		if (itemCount === 0) return;
		setCurrentIndex((prev) => (prev < itemCount ? prev : 0));
	}, [itemCount]);

	const changeIndex = useCallback((resolveNext) => {
		if (itemCount === 0) return;
		setCurrentIndex((prev) => {
			const resolved = typeof resolveNext === 'function' ? resolveNext(prev) : resolveNext;
			const next = ((resolved % itemCount) + itemCount) % itemCount;
			if (next === prev) return prev;
			setPreviousIndex(prev);
			return next;
		});
	}, [itemCount]);

	useEffect(() => {
		if (itemCount === 0) return undefined;

		const interval = setInterval(() => {
			changeIndex((prev) => prev + 1);
		}, AUTO_ROTATE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [changeIndex, itemCount]);

	useEffect(() => {
		if (previousIndex === null || previousIndex === currentIndex) return undefined;
		setIsTransitioning(true);
		const timer = setTimeout(() => {
			setIsTransitioning(false);
			setPreviousIndex(null);
		}, TRANSITION_DURATION_MS);
		return () => clearTimeout(timer);
	}, [currentIndex, previousIndex]);

	useEffect(() => {
		setImageErrors({});
	}, [items]);

	const currentItem = useMemo(() => (
		itemCount > 0 ? items[currentIndex % itemCount] : null
	), [currentIndex, itemCount, items]);

	const previousItem = useMemo(() => (
		previousIndex === null || itemCount === 0 ? null : items[((previousIndex % itemCount) + itemCount) % itemCount]
	), [itemCount, items, previousIndex]);

	const handlePrevious = useCallback(() => {
		changeIndex((prev) => prev - 1);
	}, [changeIndex]);

	const handleNext = useCallback(() => {
		changeIndex((prev) => prev + 1);
	}, [changeIndex]);

	const handleImageError = useCallback((itemId) => {
		if (!itemId) return;
		setImageErrors((prev) => (prev[itemId] ? prev : { ...prev, [itemId]: true }));
	}, []);

	const handleCurrentImageError = useCallback(() => {
		if (!currentItem?.Id) return;
		handleImageError(currentItem.Id);
	}, [currentItem?.Id, handleImageError]);

	const handlePreviousImageError = useCallback(() => {
		if (!previousItem?.Id) return;
		handleImageError(previousItem.Id);
	}, [handleImageError, previousItem?.Id]);

	const handlePlay = useCallback(() => {
		if (!currentItem) return;
		onPlayClick(currentItem);
	}, [currentItem, onPlayClick]);

	const handleMoreInfo = useCallback(() => {
		if (!currentItem) return;
		onPlayClick(currentItem, true);
	}, [currentItem, onPlayClick]);

	const handleIndicatorClick = useCallback((event) => {
		const nextIndex = Number(event.currentTarget.dataset.index);
		if (!Number.isInteger(nextIndex)) return;
		changeIndex(nextIndex);
	}, [changeIndex]);

	if (!currentItem) return null;

	const backdropUrl = jellyfinService.getBackdropUrl(currentItem.Id, 0, 1920);
	const previousBackdropUrl = previousItem ? jellyfinService.getBackdropUrl(previousItem.Id, 0, 1920) : '';
	const logoUrl = currentItem.ImageTags?.Logo
		? jellyfinService.getImageUrl(currentItem.Id, 'Logo', 600)
		: null;
	const showLogo = Boolean(logoUrl);

	const currentHasImageError = Boolean(imageErrors[currentItem.Id]);
	const previousHasImageError = previousItem ? Boolean(imageErrors[previousItem.Id]) : false;

	return (
		<div className={css.heroBanner} data-bf-media-bar="true">
			<div className={css.backdrop}>
				{isTransitioning && previousItem && (
					<div className={`${css.backdropLayer} ${css.backdropLayerOutgoing}`}>
						{!previousHasImageError ? (
							<img
								src={previousBackdropUrl}
								alt={previousItem.Name}
								onError={handlePreviousImageError}
							/>
						) : (
							<div className={css.backdropFallback} />
						)}
					</div>
				)}
				<div className={`${css.backdropLayer} ${isTransitioning ? css.backdropLayerIncoming : css.backdropLayerCurrent}`}>
					{!currentHasImageError ? (
						<img
							src={backdropUrl}
							alt={currentItem.Name}
							onError={handleCurrentImageError}
						/>
					) : (
						<div className={css.backdropFallback} />
					)}
				</div>
				<div className={css.gradient} />
			</div>

			<div className={css.content}>
				<div className={`${css.info} ${css.infoTransition}`} key={`hero-content-${currentItem.Id}`}>
					<div className={css.logoWrapper}>
						{showLogo ? (
							<img
								src={logoUrl}
								alt={currentItem.Name}
								className={`${css.logo} ${css.logoTransition}`}
							/>
						) : (
							<Heading size="large" className={`${css.title} ${css.textTransition}`}>
								<Marquee marqueeOn="render">
									{currentItem.Name}
								</Marquee>
							</Heading>
						)}
					</div>

					{currentItem.Overview && (
						<>
							<div className={`${css.metadata} ${css.textTransition}`}>
								{currentItem.ProductionYear && (
									<div className={css.metadataItem}>{currentItem.ProductionYear}</div>
								)}
								{currentItem.OfficialRating && (
									<div className={css.metadataItem}>{currentItem.OfficialRating}</div>
								)}
								{currentItem.CommunityRating && (
									<div className={css.metadataItem}>
										Rating {currentItem.CommunityRating.toFixed(1)}
									</div>
								)}
							</div>
							<BodyText className={`${css.overview} ${css.textTransition}`}>
								{currentItem.Overview.length > 200
									? currentItem.Overview.substring(0, 200) + '...'
									: currentItem.Overview
								}
							</BodyText>
						</>
					)}
					<div className={`${css.controls} ${css.textTransition}`}>
						<div className={css.buttons}>
							<Button
								size="small"
								onClick={handlePlay}
								icon="play"
								className={css.heroBannerButton}
							>
								Play
							</Button>
							<Button
								size="small"
								onClick={handleMoreInfo}
								className={css.heroBannerButton}
							>
								More Info
							</Button>
						</div>
						<div className={css.indicators}>
							<Button
								size="small"
								icon="arrowlargeleft"
								onClick={handlePrevious}
								className={css.navButton}
							/>
							{items.map((_, index) => (
								<div
									key={index}
									data-index={index}
									className={`${css.indicator} ${index === currentIndex ? css.active : ''}`}
									onClick={handleIndicatorClick}
								/>
							))}
							<Button
								size="small"
								icon="arrowlargeright"
								onClick={handleNext}
								className={css.navButton}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default HeroBanner;
