import {memo, useCallback, useEffect, useRef, useState} from 'react';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Icon from '@enact/sandstone/Icon';

import Button from '../../../components/BreezyButton';
import jellyfinService from '../../../services/jellyfinService';
import {KeyCodes} from '../../../utils/keyCodes';
import imageLoadCss from '../../../components/ImageLoadReveal.module.less';
import css from '../../MediaDetailsPanel.module.less';
import pageCss from '../MediaDetailsPage.module.less';
import {markImageLoaded} from '../imageReveal';
import PlaybackControls from './PlaybackControls';

const renderNames = (names) => names.map((name) => (
    <span key={name} className={css.creditNameItem}>{name}</span>
));

const getLogoUrl = (item) => {
    const logoItemId = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
    return logoItemId ? jellyfinService.getImageUrl(logoItemId, 'Logo', 1600) || '' : '';
};

const Overview = memo(({text, isElegantTheme}) => {
    const textRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
        if (!isElegantTheme) return undefined;
        let frame = 0;
        const measure = () => {
            const node = textRef.current;
            if (!node) return;
            const wasCollapsed = node.classList.contains(css.overviewCollapsed);
            node.classList.add(css.overviewCollapsed);
            const hasOverflow = node.scrollHeight - node.clientHeight > 1;
            if (!wasCollapsed) node.classList.remove(css.overviewCollapsed);
            setOverflows(hasOverflow);
        };
        const schedule = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(measure);
        };
        schedule();
        window.addEventListener('resize', schedule);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', schedule);
        };
    }, [isElegantTheme, text]);

    const interactive = isElegantTheme && overflows;
    const handleActivate = useCallback((event) => {
        if (!interactive) return;
        if (event.type === 'keydown') {
            const code = event.keyCode || event.which;
            if (code !== KeyCodes.ENTER && code !== KeyCodes.OK && code !== KeyCodes.SPACE) return;
            event.preventDefault();
            event.stopPropagation();
        }
        setExpanded((current) => !current);
    }, [interactive]);

    if (!text) {
        return (
            <BodyText className={`${css.overview} ${css.overviewMissing}`}>
                No description available.
            </BodyText>
        );
    }

    return (
        <div
            ref={textRef}
            className={`${css.overview} ${isElegantTheme && !expanded ? css.overviewCollapsed : ''} ${interactive ? css.overviewInteractive : ''}`}
            onClick={handleActivate}
            onKeyDown={handleActivate}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-expanded={interactive ? expanded : undefined}
            aria-label={interactive ? (expanded ? 'Collapse description' : 'Expand description') : undefined}
        >
            <span className={css.overviewText}>{text}</span>
        </div>
    );
});

const EpisodeBreadcrumb = memo(({item, onOpenSeries, onOpenEpisodePicker}) => (
    <div className={css.episodeBreadcrumb}>
        <div className={css.episodeNavActions}>
            <Button
                size="small"
                className={`${css.episodeNavButton} ${css.episodeSeriesButton}`}
                onClick={onOpenSeries}
                data-md-nav="breadcrumb"
            >
                {item.SeriesName}
            </Button>
            <span className={css.breadcrumbDivider} aria-hidden="true">/</span>
            {item.ParentIndexNumber != null && (
                <>
                    <Button
                        size="small"
                        className={css.episodeNavButton}
                        onClick={onOpenSeries}
                        data-md-nav="breadcrumb"
                    >
                        Season {item.ParentIndexNumber}
                    </Button>
                    <span className={css.breadcrumbDivider} aria-hidden="true">/</span>
                </>
            )}
            <Button
                size="small"
                className={`${css.episodeNavButton} ${css.episodeCurrentButton}`}
                onClick={onOpenEpisodePicker}
                data-md-nav="breadcrumb"
            >
                Episode {item.IndexNumber}
            </Button>
        </div>
    </div>
));

const IntroSection = ({
                          item,
                          sectionRef,
                          isElegantTheme,
                          revealed,
                          directorNames,
                          writerNames,
                          isFavorite,
                          isWatched,
                          isWatchlisted,
                          showWatchlistAction,
                          showPlaybackControls,
                          showSectionHint,
                          audioTracks,
                          subtitleTracks,
                          audioSummary,
                          subtitleSummary,
                          playLabel,
                          onLogoSettled,
                          onBack,
                          onOpenSeries,
                          onOpenEpisodePicker,
                          onToggleFavorite,
                          onToggleWatchlist,
                          onToggleWatched,
                          onOpenAudioPicker,
                          onOpenSubtitlePicker,
                          onPlay
                      }) => {
    const [logoUrl] = useState(() => getLogoUrl(item));
    const [logoFailed, setLogoFailed] = useState(!logoUrl);
    const revealClass = revealed ? css.contentRevealVisible : css.contentRevealHidden;

    useEffect(() => {
        if (!logoUrl) onLogoSettled();
    }, [logoUrl, onLogoSettled]);

    const handleLogoLoad = useCallback((event) => {
        markImageLoaded(event.currentTarget);
        onLogoSettled();
    }, [onLogoSettled]);

    const handleLogoError = useCallback(() => {
        setLogoFailed(true);
        onLogoSettled();
    }, [onLogoSettled]);

    const overviewText = item.Overview && String(item.Overview).trim() ? item.Overview : '';

    return (
        <div className={css.firstSection} ref={sectionRef}>
            <div className={`${css.detailsHeadingStack} ${revealClass} ${pageCss.revealDelayTitle}`}>
                <div className={css.detailsTopBar}>
                    <Button
                        size="small"
                        icon="arrowsmallleft"
                        onClick={onBack}
                        className={css.detailsBackButton}
                        aria-label="Back"
                        data-md-nav="back"
                    />
                    <BodyText className={css.detailsTopTitle}>{item.Name || item.SeriesName || 'Details'}</BodyText>
                </div>
                {item.Type === 'Episode' && (
                    <EpisodeBreadcrumb
                        item={item}
                        onOpenSeries={onOpenSeries}
                        onOpenEpisodePicker={onOpenEpisodePicker}
                    />
                )}
            </div>
            <div className={`${css.introSection} ${isElegantTheme ? css.introSectionElegant : ''}`}>
                <div className={css.introContent}>
                    <div className={css.introTopSpacer}/>
                    <div className={`${css.introHeaderRow} ${revealClass}`}>
                        <div className={css.pageHeader}>
                            {logoFailed ? (
                                <Heading size="large" className={css.pageHeaderTitle}>
                                    {item.Name || 'Details'}
                                </Heading>
                            ) : (
                                <div className={css.headerLogoWrap}>
                                    <img
                                        src={logoUrl}
                                        alt={item.Name || 'Details'}
                                        className={`${css.headerLogo} ${imageLoadCss.imageReveal}`}
                                        onLoad={handleLogoLoad}
                                        onError={handleLogoError}
                                        decoding="async"
                                        draggable={false}
                                    />
                                </div>
                            )}
                        </div>
                        {(directorNames.length > 0 || writerNames.length > 0) && (
                            <div className={css.introCredits}>
                                {directorNames.length > 0 && (
                                    <BodyText className={css.creditLine}>
                                        <span className={css.creditLabel}>Directed by</span>
                                        <span className={css.creditNames}>{renderNames(directorNames)}</span>
                                    </BodyText>
                                )}
                                {writerNames.length > 0 && (
                                    <BodyText className={css.creditLine}>
                                        <span className={css.creditLabel}>Written by</span>
                                        <span className={css.creditNames}>{renderNames(writerNames)}</span>
                                    </BodyText>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`${css.header} ${revealClass} ${pageCss.revealDelayContent}`}>
                        <div className={css.metadataRow}>
                            <div className={css.metadata}>
                                {item.ProductionYear && (
                                    <div className={css.metadataItem}>{item.ProductionYear}</div>
                                )}
                                {item.OfficialRating && (
                                    <div
                                        className={`${css.metadataItem} ${css.metadataRating}`}>{item.OfficialRating}</div>
                                )}
                                {item.CommunityRating && (
                                    <div className={`${css.metadataItem} ${css.metadataScore}`}>
                                        <Icon size="small"
                                              className={css.ratingStar}>star</Icon> {item.CommunityRating.toFixed(1)}
                                    </div>
                                )}
                                {item.RunTimeTicks && (
                                    <div className={css.metadataItem}>
                                        {Math.floor(item.RunTimeTicks / 600000000)} min
                                    </div>
                                )}
                                {item.Genres?.length > 0 && (
                                    <div className={`${css.metadataItem} ${css.metadataItemWide}`}>
                                        {item.Genres.join(', ')}
                                    </div>
                                )}
                            </div>
                            <div className={css.actionsRow}>
                                <Button
                                    size="small"
                                    icon={isFavorite ? 'heart' : 'hearthollow'}
                                    onClick={onToggleFavorite}
                                    css={{icon: css.actionIcon}}
                                    spotlightId="details-favorite-action"
                                    className={`${css.actionButton} ${css.favoriteAction} ${isFavorite ? css.favoriteActive : ''}`}
                                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                    data-md-nav="intro-action"
                                />
                                {showWatchlistAction && (
                                    <Button
                                        size="small"
                                        icon="list"
                                        onClick={onToggleWatchlist}
                                        css={{icon: css.actionIcon}}
                                        spotlightId="details-watchlist-action"
                                        className={`${css.actionButton} ${isWatchlisted ? css.favoriteActive : ''}`}
                                        title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                                        data-md-nav="intro-action"
                                    />
                                )}
                                <Button
                                    size="small"
                                    icon="check"
                                    onClick={onToggleWatched}
                                    css={{icon: css.actionIcon}}
                                    spotlightId="details-watched-action"
                                    className={`${css.actionButton} ${css.watchedAction} ${isWatched ? css.watchedActive : ''}`}
                                    title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                                    data-md-nav="intro-action"
                                />
                            </div>
                        </div>
                        <div className={css.overviewBlock}>
                            <Overview text={overviewText} isElegantTheme={isElegantTheme}/>
                            {showPlaybackControls && (
                                <div className={css.introControlsRow}>
                                    <PlaybackControls
                                        withNavigation
                                        audioTracks={audioTracks}
                                        subtitleTracks={subtitleTracks}
                                        audioSummary={audioSummary}
                                        subtitleSummary={subtitleSummary}
                                        playLabel={playLabel}
                                        playClassName={`${css.overviewPlayButton} ${css.introPlayButton}`}
                                        onOpenAudioPicker={onOpenAudioPicker}
                                        onOpenSubtitlePicker={onOpenSubtitlePicker}
                                        onPlay={onPlay}
                                    />
                                    {showSectionHint && (
                                        <div className={css.sectionHint}>
                                            More
                                            <Icon className={css.sectionHintArrow}>arrowsmalldown</Icon>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(IntroSection);
