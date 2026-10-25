import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Icon from '@enact/sandstone/Icon';
import Spotlight from '@enact/spotlight';

import {Panel} from '../../components/BreezyPanels';
import Scroller from '../../components/AppScroller';
import BreezyLoadingOverlay from '../../components/BreezyLoadingOverlay';
import jellyfinService from '../../services/jellyfinService';
import {PANEL_TOAST_CONFIG} from '../../constants/toast';
import {useBreezyfinSettingsSync} from '../../hooks/useBreezyfinSettingsSync';
import {useItemMetadata} from '../../hooks/useItemMetadata';
import {usePanelBackHandler} from '../../hooks/usePanelBackHandler';
import {usePanelScrollState} from '../../hooks/usePanelScrollState';
import {useToastMessage} from '../../hooks/useToastMessage';
import {readIntegrationPreferences} from '../../utils/integrationPreferences';
import {KeyCodes} from '../../utils/keyCodes';
import {isPlayableMediaItem} from '../../utils/mediaItemUtils';
import {readBreezyfinSettings} from '../../utils/settingsStorage';
import imageLoadCss from '../../components/ImageLoadReveal.module.less';
import css from '../MediaDetailsPanel.module.less';
import MediaDetailsToast from '../media-details-panel/components/MediaDetailsToast';
import MediaEpisodePickerPopup from '../media-details-panel/components/MediaEpisodePickerPopup';
import MediaTrackPickerPopup from '../media-details-panel/components/MediaTrackPickerPopup';
import {useMediaCredits} from '../media-details-panel/hooks/useMediaCredits';
import {useMediaDetailsTrackOptions} from '../media-details-panel/hooks/useMediaDetailsTrackOptions';
import {
    getEpisodeActionBadge,
    isEpisodeInProgress,
    isEpisodePlayed
} from '../media-details-panel/utils/mediaDetailsHelpers';
import {useMediaDetailsData} from './useMediaDetailsData';
import {findScrollElement, useMediaDetailsNavigation} from './useMediaDetailsNavigation';
import IntroSection from './sections/IntroSection';
import CastSection from './sections/CastSection';
import SeasonsSection from './sections/SeasonsSection';
import SeriesControls from './sections/SeriesControls';
import EpisodesSection from './sections/EpisodesSection';
import pageCss from './MediaDetailsPage.module.less';

const REVEAL_FALLBACK_MS = 9000;
const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, KeyCodes.PLAY, 179];
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, [role="button"], [role="textbox"], [tabindex], .spottable, [data-spotlight-id]';

const TrackPicker = memo(MediaTrackPickerPopup);
const EpisodePicker = memo(MediaEpisodePickerPopup);

const toPageSettings = (settings = {}) => ({
    isElegantTheme: settings.navbarTheme !== 'classic',
    showSeasonImages: settings.showSeasonImages === true,
    useSidewaysEpisodeList: settings.useSidewaysEpisodeList !== false
});

const samePageSettings = (a, b) => (
    a.isElegantTheme === b.isElegantTheme &&
    a.showSeasonImages === b.showSeasonImages &&
    a.useSidewaysEpisodeList === b.useSidewaysEpisodeList
);

const getBackdropUrl = (item) => {
    if (item.BackdropImageTags?.length > 0) return jellyfinService.getBackdropUrl(item.Id, 0, 1920);
    if (item.SeriesId) return jellyfinService.getBackdropUrl(item.SeriesId, 0, 1920);
    return '';
};

const hasWatchHistory = (userData) => Boolean(userData) && (
    (userData.PlaybackPositionTicks || 0) > 0 ||
    (userData.PlayedPercentage || 0) > 0 ||
    userData.Played === true
);

const getSeriesPlayLabel = (item, episodes, selectedEpisode) => {
    const target = selectedEpisode || episodes.find((episode) => !isEpisodePlayed(episode)) || episodes[0];
    if (!target) return 'Play';
    const badge = getEpisodeActionBadge(target);
    const withBadge = (label) => (badge ? `${label} ${badge}` : label);
    if (isEpisodeInProgress(target)) return withBadge('Continue');
    const seriesStarted = hasWatchHistory(item.UserData) ||
        episodes.some((episode) => isEpisodeInProgress(episode) || isEpisodePlayed(episode));
    if (!isEpisodePlayed(target) && seriesStarted) return withBadge('Next Up');
    return withBadge('Play');
};

const getItemPlayLabel = (item) => {
    const userData = item.UserData;
    if (!userData) return 'Play';
    if ((userData.PlaybackPositionTicks || 0) > 0) return 'Continue';
    const percentage = userData.PlayedPercentage || 0;
    return percentage > 0 && percentage < 100 ? 'Continue' : 'Play';
};

const MediaDetailsContent = ({
                                 item,
                                 onBack,
                                 onPlay,
                                 onItemSelect,
                                 isActive,
                                 cachedState,
                                 onCacheState,
                                 registerBackHandler,
                                 ...rest
                             }) => {
    const isSeries = item.Type === 'Series';
    const [settings, setSettings] = useState(() => toPageSettings(readBreezyfinSettings()));
    const [showWatchlistAction] = useState(() => (
        ['Movie', 'Series'].includes(item.Type) && readIntegrationPreferences(jellyfinService).watchlistEnabled
    ));
    const [backdropUrl] = useState(() => getBackdropUrl(item));
    const [initialScrollTop] = useState(() => Number(cachedState?.scrollTop) || 0);
    const [picker, setPicker] = useState(null);
    const [revealed, setRevealed] = useState(false);
    const settledRef = useRef({data: false, backdrop: !backdropUrl, logo: false});
    const backdropRef = useRef(null);
    const {toastMessage, toastVisible, setToastMessage} = useToastMessage(PANEL_TOAST_CONFIG);

    const applySettings = useCallback((nextSettings) => {
        const next = toPageSettings(nextSettings);
        setSettings((current) => (samePageSettings(current, next) ? current : next));
    }, []);
    useBreezyfinSettingsSync(applySettings, {enabled: isActive, applyOnMount: false});

    const {
        captureScrollTo,
        handleScroll,
        handleScrollStop: handleScrollMemoryStop,
        commitScrollTop
    } = usePanelScrollState({
        cachedState,
        isActive,
        onCacheState,
        cacheKey: item.Id,
        requireCacheKey: true,
        restoreReady: revealed
    });

    const containerRef = useRef(null);
    const commitScroll = useCallback(() => {
        const scrollEl = findScrollElement(containerRef.current);
        if (scrollEl) commitScrollTop(scrollEl.scrollTop);
    }, [commitScrollTop]);

    const selectItem = useCallback((nextItem, fromItem) => {
        if (typeof onItemSelect !== 'function') return;
        commitScroll();
        onItemSelect(nextItem, fromItem);
    }, [commitScroll, onItemSelect]);

    const {
        state,
        selectedEpisode,
        selectEpisode,
        selectSeason,
        selectTrack,
        toggleFavorite,
        toggleWatched,
        toggleWatchlist,
        openSeriesFromEpisode
    } = useMediaDetailsData({item, onItemSelect: selectItem, showToast: setToastMessage});
    const {loading, seasons, episodes, selectedSeasonId, episodeNavList} = state;

    const seasonMetadata = useItemMetadata(selectedSeasonId, {
        enabled: isSeries && Boolean(selectedSeasonId),
        errorContext: 'season metadata'
    });
    const episodeMetadata = useItemMetadata(selectedEpisode?.Id, {
        enabled: isSeries && Boolean(selectedEpisode?.Id),
        errorContext: 'selected episode metadata'
    });
    const {cast, directorNames, writerNames} = useMediaCredits({
        detailPeople: state.details?.People,
        seasonPeople: seasonMetadata?.People,
        episodePeople: episodeMetadata?.People,
        itemPeople: item.People
    });
    const {audioTracks, subtitleTracks, audioSummary, subtitleSummary} = useMediaDetailsTrackOptions({
        playbackInfo: state.playbackInfo,
        selectedAudioTrack: state.audioTrack,
        selectedSubtitleTrack: state.subtitleTrack
    });

    const hasSecondarySection = cast.length > 0 || (isSeries && (seasons.length > 0 || episodes.length > 0));
    const playLabel = useMemo(() => (
        isSeries ? getSeriesPlayLabel(item, episodes, selectedEpisode) : getItemPlayLabel(item)
    ), [episodes, isSeries, item, selectedEpisode]);

    const navigation = useMediaDetailsNavigation({
        containerRef,
        isActive,
        ready: revealed,
        pickerOpen: picker !== null,
        hasSecondarySection,
        isSeries,
        isSidewaysEpisodeLayout: settings.isElegantTheme && settings.useSidewaysEpisodeList,
        initialScrollTop,
        onScrollStop: handleScrollMemoryStop
    });

    const revealIfSettled = useCallback(() => {
        const {data, backdrop, logo} = settledRef.current;
        if (data && backdrop && logo) setRevealed(true);
    }, []);

    useEffect(() => {
        if (loading) return undefined;
        settledRef.current.data = true;
        const frame = window.requestAnimationFrame(revealIfSettled);
        const timer = window.setTimeout(() => setRevealed(true), REVEAL_FALLBACK_MS);
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [loading, revealIfSettled]);

    const handleLogoSettled = useCallback(() => {
        settledRef.current.logo = true;
        revealIfSettled();
    }, [revealIfSettled]);

    const handleBackdropLoad = useCallback((event) => {
        event.currentTarget.classList.remove(css.backdropImageHidden);
        backdropRef.current?.querySelector(`.${css.backdropLoadingHint}`)?.classList.add(imageLoadCss.imageLoadingHintHidden);
        settledRef.current.backdrop = true;
        revealIfSettled();
    }, [revealIfSettled]);

    const handleBackdropError = useCallback((event) => {
        event.currentTarget.style.display = 'none';
        backdropRef.current?.classList.add(css.backdropFallback);
        backdropRef.current?.querySelector(`.${css.backdropLoadingHint}`)?.classList.add(imageLoadCss.imageLoadingHintHidden);
        settledRef.current.backdrop = true;
        revealIfSettled();
    }, [revealIfSettled]);

    const latestRef = useRef(null);
    useEffect(() => {
        latestRef.current = {state, selectedEpisode, picker, episodeNavList, episodes};
    });

    const handlePlay = useCallback(() => {
        const {state: latest, selectedEpisode: episode} = latestRef.current;
        const target = isSeries ? episode : (isPlayableMediaItem(item) ? item : null);
        if (!target) return;
        const options = {mediaSourceId: null};
        if (latest.playbackItemId === target.Id) {
            options.mediaSourceId = latest.playbackInfo?.MediaSources?.[0]?.Id || null;
            if (Number.isInteger(latest.audioTrack)) options.audioStreamIndex = latest.audioTrack;
            if (latest.subtitleTrack === -1 || Number.isInteger(latest.subtitleTrack)) {
                options.subtitleStreamIndex = latest.subtitleTrack;
            }
        }
        onPlay(target, options);
    }, [isSeries, item, onPlay]);

    const handleBack = useCallback(() => {
        commitScroll();
        onBack();
    }, [commitScroll, onBack]);

    const handleInternalBack = useCallback(() => {
        if (latestRef.current?.picker) {
            setPicker(null);
            return true;
        }
        handleBack();
        return true;
    }, [handleBack]);
    usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

    useEffect(() => {
        if (!isActive) return undefined;
        const handleKeyDown = (event) => {
            const code = event.keyCode || event.which;
            if (BACK_KEYS.includes(code)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                handleInternalBack();
                return;
            }
            if (!PLAY_KEYS.includes(code) || Spotlight.getPointerMode()) return;
            if (event.target?.closest?.(INTERACTIVE_SELECTOR)) return;
            event.preventDefault();
            handlePlay();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleInternalBack, handlePlay, isActive]);

    const openAudioPicker = useCallback(() => setPicker('audio'), []);
    const openSubtitlePicker = useCallback(() => setPicker('subtitle'), []);
    const openEpisodePicker = useCallback(() => setPicker('episode'), []);
    const closePicker = useCallback(() => setPicker(null), []);

    const handleTrackSelect = useCallback((event) => {
        const {trackKey, trackType} = event.currentTarget.dataset;
        const key = Number(trackKey);
        if (!Number.isFinite(key)) return;
        selectTrack(trackType, key);
        setPicker(null);
    }, [selectTrack]);

    const handleEpisodePickerSelect = useCallback((event) => {
        const {episodeId} = event.currentTarget.dataset;
        setPicker(null);
        if (isSeries) {
            selectEpisode(episodeId);
            return;
        }
        const episode = latestRef.current.episodeNavList.find((entry) => String(entry.Id) === episodeId);
        if (episode) selectItem(episode, item);
    }, [isSeries, item, selectEpisode, selectItem]);

    const handleToggleFavorite = useCallback(() => toggleFavorite(), [toggleFavorite]);
    const handleToggleWatched = useCallback(() => toggleWatched(), [toggleWatched]);
    const handleOpenEpisode = useCallback((episode) => selectItem(episode, item), [item, selectItem]);

    const showPlaybackControls = isSeries ? Boolean(selectedEpisode) : isPlayableMediaItem(item);
    const {isElegantTheme} = settings;
    const isSideways = isElegantTheme && settings.useSidewaysEpisodeList;
    const containerClassName = [
        css.detailsContainer,
        isElegantTheme ? css.elegantMode : '',
        item.Type === 'Episode' ? css.episodeDetailsMode : ''
    ].join(' ');

    return (
        <Panel {...rest}>
            <MediaDetailsToast message={toastMessage} visible={toastVisible}/>
            <Scroller
                className={`${css.scroller} ${isElegantTheme ? css.scrollerElegant : ''}`}
                cbScrollTo={captureScrollTo}
                onScroll={handleScroll}
                onScrollStop={navigation.handleScrollStop}
            >
                <div
                    className={containerClassName}
                    ref={containerRef}
                    tabIndex={-1}
                    {...navigation.containerHandlers}
                >
                    <div
                        ref={backdropRef}
                        className={`${css.backdrop} ${backdropUrl ? '' : css.backdropFallback} ${isElegantTheme ? css.backdropElegant : ''}`}
                    >
                        {backdropUrl && (
                            <>
                                <img
                                    src={backdropUrl}
                                    alt=""
                                    className={`${css.backdropImage} ${css.backdropImageHidden}`}
                                    onLoad={handleBackdropLoad}
                                    onError={handleBackdropError}
                                    decoding="async"
                                    draggable={false}
                                />
                                <div className={`${imageLoadCss.imageLoadingHint} ${css.backdropLoadingHint}`}
                                     aria-hidden="true"/>
                            </>
                        )}
                        <div className={`${css.gradient} ${isElegantTheme ? css.gradientElegant : ''}`}/>
                    </div>
                    {!revealed && (
                        <div className={pageCss.loadingOverlay}>
                            <BreezyLoadingOverlay/>
                        </div>
                    )}
                    <div className={`${css.content} ${isElegantTheme ? css.contentElegant : ''}`}>
                        <IntroSection
                            item={item}
                            sectionRef={navigation.firstSectionRef}
                            isElegantTheme={isElegantTheme}
                            revealed={revealed}
                            directorNames={directorNames}
                            writerNames={writerNames}
                            isFavorite={state.isFavorite}
                            isWatched={state.isWatched}
                            isWatchlisted={state.isWatchlisted}
                            showWatchlistAction={showWatchlistAction}
                            showPlaybackControls={showPlaybackControls && !loading}
                            showSectionHint={hasSecondarySection}
                            audioTracks={audioTracks}
                            subtitleTracks={subtitleTracks}
                            audioSummary={audioSummary}
                            subtitleSummary={subtitleSummary}
                            playLabel={playLabel}
                            onLogoSettled={handleLogoSettled}
                            onBack={handleBack}
                            onOpenSeries={openSeriesFromEpisode}
                            onOpenEpisodePicker={openEpisodePicker}
                            onToggleFavorite={handleToggleFavorite}
                            onToggleWatchlist={toggleWatchlist}
                            onToggleWatched={handleToggleWatched}
                            onOpenAudioPicker={openAudioPicker}
                            onOpenSubtitlePicker={openSubtitlePicker}
                            onPlay={handlePlay}
                        />
                        {!loading && (
                            <div
                                className={`${css.contentSection} ${revealed ? css.contentRevealVisible : css.contentRevealHidden} ${pageCss.revealDelayContent}`}
                                ref={navigation.contentSectionRef}
                            >
                                {hasSecondarySection && (
                                    <div className={css.sectionSwitchRow}>
                                        <div className={css.sectionHint}>
                                            <Icon className={css.sectionHintArrow}>arrowsmallup</Icon>
                                            Overview
                                        </div>
                                    </div>
                                )}
                                <CastSection cast={cast}/>
                                {isSeries && seasons.length > 0 && (
                                    <div className={css.seriesContent}>
                                        <SeasonsSection
                                            seasons={seasons}
                                            series={item}
                                            selectedSeasonId={selectedSeasonId}
                                            showPosters={!isElegantTheme || settings.showSeasonImages}
                                            onSelect={selectSeason}
                                            onToggleWatched={toggleWatched}
                                        />
                                        {selectedEpisode && (
                                            <SeriesControls
                                                episode={selectedEpisode}
                                                isSideways={isSideways}
                                                audioTracks={audioTracks}
                                                subtitleTracks={subtitleTracks}
                                                audioSummary={audioSummary}
                                                subtitleSummary={subtitleSummary}
                                                playLabel={playLabel}
                                                onOpenEpisodePicker={openEpisodePicker}
                                                onOpenAudioPicker={openAudioPicker}
                                                onOpenSubtitlePicker={openSubtitlePicker}
                                                onPlay={handlePlay}
                                            />
                                        )}
                                        <EpisodesSection
                                            episodes={episodes}
                                            series={item}
                                            selectedEpisodeId={selectedEpisode?.Id}
                                            isSideways={isSideways}
                                            isElegantTheme={isElegantTheme}
                                            showInfoButton={typeof onItemSelect === 'function'}
                                            onSelect={selectEpisode}
                                            onOpen={handleOpenEpisode}
                                            onToggleFavorite={toggleFavorite}
                                            onToggleWatched={toggleWatched}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Scroller>
            <TrackPicker
                open={picker === 'audio'}
                onClose={closePicker}
                type="audio"
                tracks={audioTracks}
                selectedKey={state.audioTrack}
                onTrackSelect={handleTrackSelect}
            />
            <TrackPicker
                open={picker === 'subtitle'}
                onClose={closePicker}
                type="subtitle"
                tracks={subtitleTracks}
                selectedKey={state.subtitleTrack}
                onTrackSelect={handleTrackSelect}
            />
            <EpisodePicker
                open={picker === 'episode'}
                onClose={closePicker}
                isSeriesMode={isSeries}
                episodes={isSeries ? episodes : episodeNavList}
                selectedEpisodeId={selectedEpisode?.Id}
                currentItemId={item.Id}
                onSelect={handleEpisodePickerSelect}
            />
        </Panel>
    );
};

const MediaDetailsPage = ({item, isActive = false, cachedState = null, onCacheState = null, ...rest}) => {
    if (!item) return null;
    return (
        <MediaDetailsContent
            item={item}
            isActive={isActive}
            cachedState={cachedState}
            onCacheState={onCacheState}
            {...rest}
        />
    );
};

export default MediaDetailsPage;
