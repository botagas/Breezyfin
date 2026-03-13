import {useCallback, useEffect, useState} from 'react';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';
import imageLoadCss from '../../../components/ImageLoadReveal.module.less';

const SpottableDiv = Spottable('div');

const MediaSeasonsSection = ({
	seasons,
	selectedSeasonId,
	shouldShowSeasonPosters,
	seasonScrollerRef,
	onSeasonCardClick,
	onSeasonCardFocus,
	onSeasonCardKeyDown,
	onSeasonWatchedToggleClick,
	onSeasonWatchedButtonKeyDown,
	onSeasonImageError,
	getSeasonImageUrl
}) => {
	const [loadedSeasonImageKeys, setLoadedSeasonImageKeys] = useState(() => new Set());
	const seasonKeysSignature = Array.isArray(seasons)
		? seasons.map((season) => String(season?.Id || '?')).join('|')
		: '';

	useEffect(() => {
		setLoadedSeasonImageKeys(new Set());
	}, [seasonKeysSignature]);

	const markSeasonImageLoaded = useCallback((seasonImageKey) => {
		setLoadedSeasonImageKeys((currentKeys) => {
			if (currentKeys.has(seasonImageKey)) return currentKeys;
			const nextKeys = new Set(currentKeys);
			nextKeys.add(seasonImageKey);
			return nextKeys;
		});
	}, []);

	const handleSeasonImageLoad = useCallback((event) => {
		const seasonImageKey = event.currentTarget?.dataset?.seasonImageKey;
		if (!seasonImageKey) return;
		markSeasonImageLoaded(seasonImageKey);
	}, [markSeasonImageLoaded]);

	const handleSeasonImageLoadError = useCallback((event) => {
		const seasonImageKey = event.currentTarget?.dataset?.seasonImageKey;
		if (typeof onSeasonImageError === 'function') {
			onSeasonImageError(event);
		}
		if (seasonImageKey) {
			markSeasonImageLoaded(seasonImageKey);
		}
	}, [markSeasonImageLoaded, onSeasonImageError]);

	if (!Array.isArray(seasons) || seasons.length === 0) return null;

	return (
		<div className={css.seasonsSection}>
			<Heading size="medium" className={css.sectionHeading}>Seasons</Heading>
			<div className={css.seasonCards} ref={seasonScrollerRef}>
				{seasons.map((season) => {
					const seasonImageKey = String(season?.Id || '?');
					const imageLoaded = loadedSeasonImageKeys.has(seasonImageKey);
					return (
						<SpottableDiv
							key={season.Id}
							data-season-id={season.Id}
							className={`${css.seasonCard} ${selectedSeasonId === season.Id ? css.selected : ''} ${!shouldShowSeasonPosters ? css.seasonCardNoImage : ''}`}
							onClick={onSeasonCardClick}
							onFocus={onSeasonCardFocus}
							onKeyDown={onSeasonCardKeyDown}
						>
							<Button
								size="small"
								icon="check"
								selected={season.UserData?.Played === true}
								backgroundOpacity="transparent"
								className={css.seasonWatchedButton}
								data-season-id={season.Id}
								onClick={onSeasonWatchedToggleClick}
								onKeyDown={onSeasonWatchedButtonKeyDown}
								aria-label={season.UserData?.Played ? 'Mark season as unwatched' : 'Mark season as watched'}
							/>
							{shouldShowSeasonPosters && (
								<div className={css.seasonPosterWrap}>
									<img
										src={getSeasonImageUrl(season)}
										alt={season.Name}
										data-season-image-key={seasonImageKey}
										className={`${css.seasonPoster} ${imageLoadCss.imageReveal} ${imageLoaded ? imageLoadCss.imageRevealLoaded : ''}`}
										onLoad={handleSeasonImageLoad}
										onError={handleSeasonImageLoadError}
										loading="lazy"
										decoding="async"
									/>
									{!imageLoaded ? (
										<div className={`${imageLoadCss.imageLoadingHint} ${css.seasonPosterLoadingHint}`} aria-hidden="true" />
									) : null}
								</div>
							)}
							<BodyText className={css.seasonName}>{season.Name}</BodyText>
							{season.ChildCount && (
								<BodyText className={css.episodeCount}>{season.ChildCount} Episodes</BodyText>
							)}
						</SpottableDiv>
					);
				})}
			</div>
		</div>
	);
};

export default MediaSeasonsSection;
