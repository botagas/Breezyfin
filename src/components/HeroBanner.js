import { useState, useEffect, useCallback } from 'react';
import Button from '@enact/sandstone/Button';
import BodyText from '@enact/sandstone/BodyText';
import Heading from '@enact/sandstone/Heading';
import Marquee from '@enact/sandstone/Marquee';
import jellyfinService from '../services/jellyfinService';

import css from './HeroBanner.module.less';

const HeroBanner = ({ items, onPlayClick }) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [imageError, setImageError] = useState(false);

	useEffect(() => {
		if (!items || items.length === 0) return;

		const interval = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % items.length);
			setImageError(false);
		}, 8000); // Change slide every 8 seconds

		return () => clearInterval(interval);
	}, [items]);

	const itemCount = items?.length || 0;
	const currentItem = itemCount > 0 ? items[currentIndex % itemCount] : null;

	const handlePrevious = useCallback(() => {
		if (itemCount === 0) return;
		setCurrentIndex((prev) => (prev - 1 + itemCount) % itemCount);
		setImageError(false);
	}, [itemCount]);

	const handleNext = useCallback(() => {
		if (itemCount === 0) return;
		setCurrentIndex((prev) => (prev + 1) % itemCount);
		setImageError(false);
	}, [itemCount]);

	const handleImageError = useCallback(() => {
		setImageError(true);
	}, []);

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
		setCurrentIndex(nextIndex);
		setImageError(false);
	}, []);

	if (!currentItem) return null;

	const backdropUrl = jellyfinService.getBackdropUrl(currentItem.Id, 0, 1920);
	const logoUrl = currentItem.ImageTags?.Logo
		? jellyfinService.getImageUrl(currentItem.Id, 'Logo', 600)
		: null;

	return (
		<div className={css.heroBanner}>
			<div className={css.backdrop}>
				{!imageError ? (
					<img
						src={backdropUrl}
						alt={currentItem.Name}
						onError={handleImageError}
					/>
				) : (
					<div className={css.backdropFallback} />
				)}
				<div className={css.gradient} />
			</div>

			<div className={css.content}>
				<div className={css.info}>
					<div className={css.logoWrapper}>
						{logoUrl ? (
							<img
								src={logoUrl}
								alt={currentItem.Name}
								className={css.logo}
							/>
						) : (
							<Heading size="large" className={css.title}>
								<Marquee marqueeOn="render">
									{currentItem.Name}
								</Marquee>
							</Heading>
						)}
					</div>

						{currentItem.Overview && (
							<>
								<div className={css.metadata}>
									{currentItem.ProductionYear && (
										<div className={css.metadataItem}>{currentItem.ProductionYear}</div>
									)}
									{currentItem.OfficialRating && (
										<div className={css.metadataItem}>{currentItem.OfficialRating}</div>
									)}
									{currentItem.CommunityRating && (
										<div className={css.metadataItem}>
											★ {currentItem.CommunityRating.toFixed(1)}
										</div>
									)}
								</div>
								<BodyText className={css.overview}>
									{currentItem.Overview.length > 200
										? currentItem.Overview.substring(0, 200) + '...'
										: currentItem.Overview
									}
								</BodyText>
							</>
						)}
						<div className={css.controls}>
							<div className={css.buttons}>
								<Button
									size="large"
									onClick={handlePlay}
									icon="play"
									className={css.heroBannerButton}
								>
									Play
								</Button>
								<Button
									size="large"
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
