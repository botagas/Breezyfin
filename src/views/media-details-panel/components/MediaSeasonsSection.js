import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';

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
	if (!Array.isArray(seasons) || seasons.length === 0) return null;

	return (
		<div className={css.seasonsSection}>
			<Heading size="medium" className={css.sectionHeading}>Seasons</Heading>
			<div className={css.seasonCards} ref={seasonScrollerRef}>
				{seasons.map((season) => (
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
									className={css.seasonPoster}
									onError={onSeasonImageError}
									loading="lazy"
									decoding="async"
								/>
							</div>
						)}
						<BodyText className={css.seasonName}>{season.Name}</BodyText>
						{season.ChildCount && (
							<BodyText className={css.episodeCount}>{season.ChildCount} Episodes</BodyText>
						)}
					</SpottableDiv>
				))}
			</div>
		</div>
	);
};

export default MediaSeasonsSection;
