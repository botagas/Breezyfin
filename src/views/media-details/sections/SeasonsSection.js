import {memo, useCallback} from 'react';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';

import Button from '../../../components/BreezyButton';
import jellyfinService from '../../../services/jellyfinService';
import {KeyCodes} from '../../../utils/keyCodes';
import imageLoadCss from '../../../components/ImageLoadReveal.module.less';
import css from '../../MediaDetailsPanel.module.less';
import {getSeasonImageUrl} from '../../media-details-panel/utils/mediaDetailsHelpers';
import {handleRevealImageLoad, tryFallbackSources} from '../imageReveal';

const SpottableDiv = Spottable('div');
const SELECT_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE];

const SeasonCard = memo(({season, series, selected, showPoster, onSelect, onToggleWatched}) => {
    const played = season.UserData?.Played === true;

    const handleSelect = useCallback(() => onSelect(season.Id), [onSelect, season.Id]);
    const handleToggleWatched = useCallback((event) => {
        event.stopPropagation();
        onToggleWatched(season.Id, played);
    }, [onToggleWatched, played, season.Id]);
    const stopSelectKeys = useCallback((event) => {
        if (SELECT_KEYS.includes(event.keyCode)) event.stopPropagation();
    }, []);
    const handlePosterError = useCallback((event) => {
        const fallback = series?.ImageTags?.Primary ? [jellyfinService.getImageUrl(series.Id, 'Primary', 500)] : [];
        tryFallbackSources(event, fallback);
    }, [series]);

    return (
        <SpottableDiv
            className={`${css.seasonCard} ${selected ? css.selected : ''} ${showPoster ? '' : css.seasonCardNoImage}`}
            onClick={handleSelect}
            data-md-nav="season"
        >
            <Button
                size="small"
                icon="check"
                selected={played}
                backgroundOpacity="transparent"
                className={css.seasonWatchedButton}
                onClick={handleToggleWatched}
                onKeyDown={stopSelectKeys}
                aria-label={played ? 'Mark season as unwatched' : 'Mark season as watched'}
                data-md-nav="season-watched"
            />
            {showPoster && (
                <div className={css.seasonPosterWrap}>
                    <img
                        src={getSeasonImageUrl(season, series, jellyfinService)}
                        alt={season.Name}
                        className={`${css.seasonPoster} ${imageLoadCss.imageReveal}`}
                        onLoad={handleRevealImageLoad}
                        onError={handlePosterError}
                        loading="lazy"
                        decoding="async"
                    />
                    <div className={`${imageLoadCss.imageLoadingHint} ${css.seasonPosterLoadingHint}`}
                         aria-hidden="true"/>
                </div>
            )}
            <BodyText className={css.seasonName}>{season.Name}</BodyText>
            {season.ChildCount && (
                <BodyText className={css.episodeCount}>{season.ChildCount} Episodes</BodyText>
            )}
        </SpottableDiv>
    );
});

const SeasonsSection = ({seasons, series, selectedSeasonId, showPosters, onSelect, onToggleWatched}) => {
    if (seasons.length === 0) return null;
    return (
        <div className={css.seasonsSection}>
            <Heading size="medium" className={css.sectionHeading}>Seasons</Heading>
            <div className={css.seasonCards}>
                {seasons.map((season) => (
                    <SeasonCard
                        key={season.Id}
                        season={season}
                        series={series}
                        selected={season.Id === selectedSeasonId}
                        showPoster={showPosters}
                        onSelect={onSelect}
                        onToggleWatched={onToggleWatched}
                    />
                ))}
            </div>
        </div>
    );
};

export default memo(SeasonsSection);
