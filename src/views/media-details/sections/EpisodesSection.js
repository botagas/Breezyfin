import {memo, useCallback} from 'react';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Icon from '@enact/sandstone/Icon';
import Spottable from '@enact/spotlight/Spottable';

import Button from '../../../components/BreezyButton';
import jellyfinService from '../../../services/jellyfinService';
import imageLoadCss from '../../../components/ImageLoadReveal.module.less';
import css from '../../MediaDetailsPanel.module.less';
import {
    getEpisodeAirDate,
    getEpisodeBadge,
    getEpisodeImageUrl,
    getEpisodeRuntime
} from '../../media-details-panel/utils/mediaDetailsHelpers';
import {handleRevealImageLoad, tryFallbackSources} from '../imageReveal';

const SpottableDiv = Spottable('div');

const EpisodeCard = memo(({
                              episode,
                              index,
                              series,
                              selected,
                              isSideways,
                              isElegantTheme,
                              showInfoButton,
                              onSelect,
                              onOpen,
                              onToggleFavorite,
                              onToggleWatched
                          }) => {
    const played = episode.UserData?.Played === true;
    const favorite = episode.UserData?.IsFavorite === true;
    const runtime = getEpisodeRuntime(episode);
    const airDate = getEpisodeAirDate(episode);
    const rating = episode.CommunityRating ? episode.CommunityRating.toFixed(1) : '';

    const handleSelect = useCallback(() => onSelect(episode.Id), [episode.Id, onSelect]);
    const handleOpen = useCallback((event) => {
        event.stopPropagation();
        onOpen(episode);
    }, [episode, onOpen]);
    const handleToggleFavorite = useCallback((event) => {
        event.stopPropagation();
        onToggleFavorite(episode.Id, favorite);
    }, [episode.Id, favorite, onToggleFavorite]);
    const handleToggleWatched = useCallback((event) => {
        event.stopPropagation();
        onToggleWatched(episode.Id, played);
    }, [episode.Id, onToggleWatched, played]);
    const handleImageError = useCallback((event) => {
        const fallback = [];
        if (series?.BackdropImageTags?.length > 0) fallback.push(jellyfinService.getBackdropUrl(series.Id, 0, 960));
        if (series?.ImageTags?.Primary) fallback.push(jellyfinService.getImageUrl(series.Id, 'Primary', 760));
        tryFallbackSources(event, fallback);
    }, [series]);

    return (
        <SpottableDiv
            className={`${css.episodeCard} ${selected ? css.selected : ''} ${played ? css.episodePlayed : ''} ${isSideways ? css.episodeCardSideways : ''}`}
            onClick={handleSelect}
            data-md-nav="episode"
            data-index={index}
        >
            <div className={css.episodeImageContainer}>
                <div className={css.episodeBadge}>{getEpisodeBadge(episode)}</div>
                <img
                    src={getEpisodeImageUrl(episode, series, jellyfinService)}
                    alt={episode.Name}
                    className={`${css.episodeImage} ${imageLoadCss.imageReveal}`}
                    onLoad={handleRevealImageLoad}
                    onError={handleImageError}
                    loading="lazy"
                    decoding="async"
                />
                <div className={`${imageLoadCss.imageLoadingHint} ${css.episodeImageLoadingHint}`} aria-hidden="true"/>
                {(favorite || played) && (
                    <div className={css.episodeStatusBadges}>
                        {favorite && <div className={css.episodeFavoriteBadge}>{'♥'}</div>}
                        {played && <div className={css.episodeWatchedBadge}>{'✓'}</div>}
                    </div>
                )}
                {!isElegantTheme && (
                    <div className={css.episodeImageMetaBadges}>
                        {rating && (
                            <div className={`${css.episodeImageMetaBadge} ${css.episodeImageMetaBadgeRating}`}>
                                <Icon size="small" className={css.episodeImageMetaStar}>star</Icon>
                                {rating}
                            </div>
                        )}
                        {runtime && <div className={css.episodeImageMetaBadge}>{runtime}</div>}
                        {airDate && <div className={css.episodeImageMetaBadge}>{airDate}</div>}
                    </div>
                )}
            </div>
            <div className={css.episodeInfo}>
                <div className={css.episodeMetaTop}>
                    <BodyText className={css.episodeNumber}>Episode {episode.IndexNumber}</BodyText>
                    {isElegantTheme && airDate && <BodyText className={css.episodeDate}>{airDate}</BodyText>}
                </div>
                <BodyText className={css.episodeName}>{episode.Name}</BodyText>
                {isElegantTheme && (
                    <div className={css.episodeStatRow}>
                        {rating && (
                            <BodyText className={css.episodeStat}>
                                <Icon size="small" className={css.ratingStar}>star</Icon> {rating}
                            </BodyText>
                        )}
                        {runtime && <BodyText className={css.episodeStat}>{runtime}</BodyText>}
                    </div>
                )}
                {episode.Overview && <BodyText className={css.episodeOverview}>{episode.Overview}</BodyText>}
            </div>
            <div className={`${css.episodeActions} ${isSideways ? css.episodeActionsRow : ''}`}>
                {showInfoButton && (
                    <Button
                        size="small"
                        icon="info"
                        className={css.episodeInfoButton}
                        onClick={handleOpen}
                        data-md-nav="episode-action"
                        data-action="info"
                        data-index={index}
                    />
                )}
                <Button
                    size="small"
                    icon="heart"
                    selected={favorite}
                    className={`${css.episodeFavoriteButton} ${favorite ? css.episodeFavoriteButtonActive : ''}`}
                    onClick={handleToggleFavorite}
                    data-md-nav="episode-action"
                    data-action="favorite"
                    data-index={index}
                />
                <Button
                    size="small"
                    icon="check"
                    selected={played}
                    className={`${css.episodeWatchedButton} ${played ? css.episodeWatchedButtonActive : ''}`}
                    onClick={handleToggleWatched}
                    data-md-nav="episode-action"
                    data-action="watched"
                    data-index={index}
                />
            </div>
        </SpottableDiv>
    );
});

const EpisodesSection = ({
                             episodes,
                             series,
                             selectedEpisodeId,
                             isSideways,
                             isElegantTheme,
                             showInfoButton,
                             onSelect,
                             onOpen,
                             onToggleFavorite,
                             onToggleWatched
                         }) => {
    if (episodes.length === 0) return null;
    return (
        <div className={css.episodesSection}>
            <Heading size="medium" className={css.sectionHeading}>Episodes</Heading>
            <div className={`${css.episodeCards} ${isSideways ? css.episodeCardsSideways : ''}`}>
                {episodes.map((episode, index) => (
                    <EpisodeCard
                        key={episode.Id}
                        episode={episode}
                        index={index}
                        series={series}
                        selected={episode.Id === selectedEpisodeId}
                        isSideways={isSideways}
                        isElegantTheme={isElegantTheme}
                        showInfoButton={showInfoButton}
                        onSelect={onSelect}
                        onOpen={onOpen}
                        onToggleFavorite={onToggleFavorite}
                        onToggleWatched={onToggleWatched}
                    />
                ))}
            </div>
        </div>
    );
};

export default memo(EpisodesSection);
