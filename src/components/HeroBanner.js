import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Button from './BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import Heading from '@enact/sandstone/Heading';
import Marquee from '@enact/sandstone/Marquee';
import jellyfinService from '../services/jellyfinService';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import {applyImageFormatFallbackFromEvent} from '../utils/imageFormat';

import css from './HeroBanner.module.less';

const AUTO_ROTATE_INTERVAL_MS = 8000;
const TRANSITION_DURATION_MS = 420;
const HERO_PRELOAD_ADJACENT = 2;
const HERO_PRELOAD_CACHE_LIMIT = 48;
const heroBackdropPreloadCache = new Map();

const pruneHeroPreloadCache = () => {
	if (heroBackdropPreloadCache.size <= HERO_PRELOAD_CACHE_LIMIT) return;
	const entries = Array.from(heroBackdropPreloadCache.entries());
	entries.sort((a, b) => (a[1]?.lastUsedAt || 0) - (b[1]?.lastUsedAt || 0));
	while (entries.length && heroBackdropPreloadCache.size > HERO_PRELOAD_CACHE_LIMIT) {
		const [url] = entries.shift();
		heroBackdropPreloadCache.delete(url);
	}
};

const preloadHeroBackdrop = (url) => {
	if (!url) return;
	if (typeof window === 'undefined' || typeof window.Image !== 'function') return;

	const now = Date.now();
	const existing = heroBackdropPreloadCache.get(url);
	if (existing?.status === 'loaded' || existing?.status === 'loading') {
		existing.lastUsedAt = now;
		return;
	}

	const image = new window.Image();
	heroBackdropPreloadCache.set(url, {status: 'loading', lastUsedAt: now});
	pruneHeroPreloadCache();

	image.decoding = 'async';
	image.onload = () => {
		const entry = heroBackdropPreloadCache.get(url);
		if (entry) {
			entry.status = 'loaded';
			entry.lastUsedAt = Date.now();
		}
		image.onload = null;
		image.onerror = null;
	};
	image.onerror = () => {
		const entry = heroBackdropPreloadCache.get(url);
		if (entry) {
			entry.status = 'error';
			entry.lastUsedAt = Date.now();
		}
		image.onload = null;
		image.onerror = null;
	};
	image.src = url;
};

const HeroBanner = ({ items, onPlayClick }) => {
	const itemCount = items?.length || 0;
	const [currentIndex, setCurrentIndex] = useState(0);
	const [previousIndex, setPreviousIndex] = useState(null);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [imageErrors, setImageErrors] = useState({});
	const [performanceModeEnabled, setPerformanceModeEnabled] = useState(false);
	const [heroVisible, setHeroVisible] = useState(true);
	const heroRootRef = useRef(null);
	const reducedMotionMode = performanceModeEnabled;
	const backdropWidth = reducedMotionMode ? 1280 : 1920;
	const preloadAdjacentCount = reducedMotionMode ? 1 : HERO_PRELOAD_ADJACENT;
	const shouldAutoRotate = itemCount > 1 && heroVisible;

	const applyMotionSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		setPerformanceModeEnabled(settings.disableAnimations === true || settings.disableAllAnimations === true);
	}, []);
	useBreezyfinSettingsSync(applyMotionSettings);

	useEffect(() => {
		if (itemCount === 0) return;
		setCurrentIndex((prev) => (prev < itemCount ? prev : 0));
	}, [itemCount]);

	useEffect(() => {
		const node = heroRootRef.current;
		if (!node) return undefined;
		if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
			setHeroVisible(true);
			return undefined;
		}

		const observer = new window.IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry) return;
				setHeroVisible(entry.isIntersecting && entry.intersectionRatio >= 0.18);
			},
			{
				threshold: [0, 0.12, 0.18, 0.28, 0.5]
			}
		);

		observer.observe(node);
		return () => {
			observer.disconnect();
		};
	}, []);

	const changeIndex = useCallback((resolveNext) => {
		if (itemCount === 0) return;
		setCurrentIndex((prev) => {
			const resolved = typeof resolveNext === 'function' ? resolveNext(prev) : resolveNext;
			const next = ((resolved % itemCount) + itemCount) % itemCount;
			if (next === prev) return prev;
			setPreviousIndex(reducedMotionMode ? null : prev);
			return next;
		});
	}, [itemCount, reducedMotionMode]);

	useEffect(() => {
		if (!shouldAutoRotate) return undefined;

		const interval = setInterval(() => {
			changeIndex((prev) => prev + 1);
		}, AUTO_ROTATE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [changeIndex, shouldAutoRotate]);

	useEffect(() => {
		if (!reducedMotionMode) return;
		setIsTransitioning(false);
		setPreviousIndex(null);
	}, [reducedMotionMode]);

	useEffect(() => {
		if (reducedMotionMode || previousIndex === null || previousIndex === currentIndex) return undefined;
		setIsTransitioning(true);
		const timer = setTimeout(() => {
			setIsTransitioning(false);
			setPreviousIndex(null);
		}, TRANSITION_DURATION_MS);
		return () => clearTimeout(timer);
	}, [currentIndex, previousIndex, reducedMotionMode]);

	useEffect(() => {
		setImageErrors({});
	}, [items]);

	const backdropUrlsByIndex = useMemo(() => (
		(items || []).map((entry) => (
			entry?.Id ? jellyfinService.getBackdropUrl(entry.Id, 0, backdropWidth) : ''
		))
	), [backdropWidth, items]);

	useEffect(() => {
		if (itemCount === 0) return;

		const preloadIndexes = new Set();
		for (let delta = -preloadAdjacentCount; delta <= preloadAdjacentCount; delta += 1) {
			const normalized = ((currentIndex + delta) % itemCount + itemCount) % itemCount;
			preloadIndexes.add(normalized);
		}

		preloadIndexes.forEach((index) => {
			preloadHeroBackdrop(backdropUrlsByIndex[index]);
		});
	}, [backdropUrlsByIndex, currentIndex, itemCount, preloadAdjacentCount]);

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

	const handleImageError = useCallback((itemId, event) => {
		if (!itemId) return;
		if (applyImageFormatFallbackFromEvent(event)) return;
		setImageErrors((prev) => (prev[itemId] ? prev : { ...prev, [itemId]: true }));
	}, []);

	const handleCurrentImageError = useCallback((event) => {
		if (!currentItem?.Id) return;
		handleImageError(currentItem.Id, event);
	}, [currentItem?.Id, handleImageError]);

	const handlePreviousImageError = useCallback((event) => {
		if (!previousItem?.Id) return;
		handleImageError(previousItem.Id, event);
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

	const backdropUrl = backdropUrlsByIndex[currentIndex % itemCount] || '';
	const previousBackdropUrl = previousItem && previousIndex !== null
		? (backdropUrlsByIndex[((previousIndex % itemCount) + itemCount) % itemCount] || '')
		: '';
	const logoUrl = currentItem.ImageTags?.Logo
		? jellyfinService.getImageUrl(currentItem.Id, 'Logo', 600)
		: null;
	const showLogo = Boolean(logoUrl);
	const infoKey = reducedMotionMode ? 'hero-content-static' : `hero-content-${currentItem.Id}`;

	const currentHasImageError = Boolean(imageErrors[currentItem.Id]);
	const previousHasImageError = previousItem ? Boolean(imageErrors[previousItem.Id]) : false;

	return (
		<div
			ref={heroRootRef}
			className={css.heroBanner}
			data-bf-media-bar="true"
		>
			<div className={css.backdrop}>
				{!reducedMotionMode && isTransitioning && previousItem && (
					<div className={`${css.backdropLayer} ${css.backdropLayerOutgoing}`}>
						{!previousHasImageError ? (
							<img
								src={previousBackdropUrl}
								alt={previousItem.Name}
								loading="eager"
								decoding="async"
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
							loading="eager"
							decoding="async"
							onError={handleCurrentImageError}
						/>
					) : (
						<div className={css.backdropFallback} />
					)}
				</div>
				<div className={css.gradient} />
			</div>

			<div className={css.content}>
				<div className={`${css.info} ${css.infoTransition}`} key={infoKey}>
					<div className={css.logoWrapper}>
						{showLogo ? (
							<img
								src={logoUrl}
								alt={currentItem.Name}
								className={`${css.logo} ${css.logoTransition}`}
							/>
						) : (
							<Heading size="large" className={`${css.title} ${css.textTransition}`}>
								<Marquee marqueeOn={reducedMotionMode ? 'focus' : 'render'}>
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
