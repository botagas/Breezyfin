import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Icon from '@enact/sandstone/Icon';
import Spottable from '@enact/spotlight/Spottable';
import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';

const SpottableDiv = Spottable('div');

const MediaEpisodesSection = ({
	episodes,
	selectedEpisodeId,
	isSidewaysEpisodeLayout,
	isElegantTheme,
	episodesListRef,
	getEpisodeBadge,
	getEpisodeImageUrl,
	getEpisodeRuntime,
	getEpisodeAirDate,
	onEpisodeCardClick,
	onEpisodeCardFocus,
	onEpisodeCardKeyDown,
	onEpisodeImageError,
	onEpisodeInfoClick,
	onEpisodeInfoButtonKeyDown,
	onEpisodeFavoriteClick,
	onEpisodeFavoriteButtonKeyDown,
	onEpisodeWatchedClick,
	onEpisodeWatchedButtonKeyDown,
	showEpisodeInfoButton
}) => {
	if (!Array.isArray(episodes) || episodes.length === 0) return null;

	return (
		<div className={css.episodesSection}>
			<Heading size="medium" className={css.sectionHeading}>Episodes</Heading>
			<div className={`${css.episodeCards} ${isSidewaysEpisodeLayout ? css.episodeCardsSideways : ''}`} ref={episodesListRef}>
				{episodes.map((episode, index) => (
					<SpottableDiv
						key={episode.Id}
						data-episode-id={episode.Id}
						data-episode-index={index}
						className={`${css.episodeCard} ${selectedEpisodeId === episode.Id ? css.selected : ''} ${episode.UserData?.Played ? css.episodePlayed : ''} ${isSidewaysEpisodeLayout ? css.episodeCardSideways : ''}`}
						onClick={onEpisodeCardClick}
						onFocus={onEpisodeCardFocus}
						onKeyDown={onEpisodeCardKeyDown}
					>
						<div className={css.episodeImageContainer}>
							<div className={css.episodeBadge}>{getEpisodeBadge(episode)}</div>
							<img
								src={getEpisodeImageUrl(episode)}
								alt={episode.Name}
								className={css.episodeImage}
								onError={onEpisodeImageError}
								loading="lazy"
								decoding="async"
							/>
							{(episode.UserData?.IsFavorite === true || episode.UserData?.Played) && (
								<div className={css.episodeStatusBadges}>
									{episode.UserData?.IsFavorite === true && (
										<div className={css.episodeFavoriteBadge}>{'\u2665'}</div>
									)}
									{episode.UserData?.Played && (
										<div className={css.episodeWatchedBadge}>{'\u2713'}</div>
									)}
								</div>
							)}
							{!isElegantTheme && (
								<div className={css.episodeImageMetaBadges}>
									{episode.CommunityRating && (
										<div className={`${css.episodeImageMetaBadge} ${css.episodeImageMetaBadgeRating}`}>
											<Icon size="small" className={css.episodeImageMetaStar}>star</Icon>
											{episode.CommunityRating.toFixed(1)}
										</div>
									)}
									{episode.RunTimeTicks && (
										<div className={css.episodeImageMetaBadge}>{getEpisodeRuntime(episode)}</div>
									)}
									{episode.PremiereDate && (
										<div className={css.episodeImageMetaBadge}>{getEpisodeAirDate(episode)}</div>
									)}
								</div>
							)}
						</div>
						<div className={css.episodeInfo}>
							<div className={css.episodeMetaTop}>
								<BodyText className={css.episodeNumber}>Episode {episode.IndexNumber}</BodyText>
								{isElegantTheme && episode.PremiereDate && (
									<BodyText className={css.episodeDate}>{getEpisodeAirDate(episode)}</BodyText>
								)}
							</div>
							<BodyText className={css.episodeName}>{episode.Name}</BodyText>
							{isElegantTheme && (
								<div className={css.episodeStatRow}>
									{episode.CommunityRating && (
										<BodyText className={css.episodeStat}>
											<Icon size="small" className={css.ratingStar}>star</Icon> {episode.CommunityRating.toFixed(1)}
										</BodyText>
									)}
									{episode.RunTimeTicks && (
										<BodyText className={css.episodeStat}>{getEpisodeRuntime(episode)}</BodyText>
									)}
								</div>
							)}
							{episode.Overview && (
								<BodyText className={css.episodeOverview}>{episode.Overview}</BodyText>
							)}
						</div>
						<div className={`${css.episodeActions} ${isSidewaysEpisodeLayout ? css.episodeActionsRow : ''}`}>
							{showEpisodeInfoButton && (
								<Button
									size="small"
									icon="info"
									data-episode-id={episode.Id}
									data-episode-index={index}
									className={css.episodeInfoButton}
									onClick={onEpisodeInfoClick}
									onKeyDown={onEpisodeInfoButtonKeyDown}
								/>
							)}
							<Button
								size="small"
								icon="heart"
								data-episode-id={episode.Id}
								data-episode-index={index}
								selected={episode.UserData?.IsFavorite === true}
								className={`${css.episodeFavoriteButton} ${episode.UserData?.IsFavorite ? css.episodeFavoriteButtonActive : ''}`}
								onClick={onEpisodeFavoriteClick}
								onKeyDown={onEpisodeFavoriteButtonKeyDown}
							/>
							<Button
								size="small"
								icon="check"
								data-episode-id={episode.Id}
								data-episode-index={index}
								selected={episode.UserData?.Played === true}
								className={`${css.episodeWatchedButton} ${episode.UserData?.Played ? css.episodeWatchedButtonActive : ''}`}
								onClick={onEpisodeWatchedClick}
								onKeyDown={onEpisodeWatchedButtonKeyDown}
							/>
						</div>
					</SpottableDiv>
				))}
			</div>
		</div>
	);
};

export default MediaEpisodesSection;
