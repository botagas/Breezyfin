import { useState, useEffect } from 'react';
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

	if (!items || items.length === 0) return null;

	const currentItem = items[currentIndex];
	const backdropUrl = jellyfinService.getBackdropUrl(currentItem.Id, 0, 1920);
	const logoUrl = currentItem.ImageTags?.Logo
		? jellyfinService.getImageUrl(currentItem.Id, 'Logo', 600)
		: null;

	const handlePrevious = () => {
		setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
		setImageError(false);
	};

	const handleNext = () => {
		setCurrentIndex((prev) => (prev + 1) % items.length);
		setImageError(false);
	};

	const handleImageError = () => {
		setImageError(true);
	};

	const handlePlay = () => {
		onPlayClick(currentItem);
	};

	const handleMoreInfo = () => {
		onPlayClick(currentItem, true);
	};

	const handleIndicatorClick = (index) => {
		setCurrentIndex(index);
		setImageError(false);
	};	return (
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
						{items.map((_, index) => {
							const handleClick = () => handleIndicatorClick(index);
							return (
								<div
									key={index}
									className={`${css.indicator} ${index === currentIndex ? css.active : ''}`}
									onClick={handleClick}
								/>
							);
						})}
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
