import { useState, useRef, useCallback, useMemo } from 'react';
import { Panel } from '../components/BreezyPanels';
import Scroller from '../components/AppScroller';
import Icon from '@enact/sandstone/Icon';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import {
	getEpisodeAirDate,
	getEpisodeBadge,
	getEpisodeRuntime
} from './media-details-panel/utils/mediaDetailsHelpers';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useTrackPreferences } from '../hooks/useTrackPreferences';
import { useToastMessage } from '../hooks/useToastMessage';
import { useMapById } from '../hooks/useMapById';
import { useItemMetadata } from '../hooks/useItemMetadata';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { PANEL_TOAST_CONFIG } from '../constants/toast';
import { useMediaDetailsKeyboardShortcuts } from './media-details-panel/hooks/useMediaDetailsKeyboardShortcuts';
import { useMediaDetailsTrackOptions } from './media-details-panel/hooks/useMediaDetailsTrackOptions';
import { useMediaCredits } from './media-details-panel/hooks/useMediaCredits';
import { useMediaDetailsDisclosures } from './media-details-panel/hooks/useMediaDetailsDisclosures';
import { useMediaDetailsImages } from './media-details-panel/hooks/useMediaDetailsImages';
import { useMediaDetailsInteractionHandlers } from './media-details-panel/hooks/useMediaDetailsInteractionHandlers';
import { useMediaDetailsDataLoader } from './media-details-panel/hooks/useMediaDetailsDataLoader';
import { useMediaDetailsItemActions } from './media-details-panel/hooks/useMediaDetailsItemActions';
import { useMediaDetailsPickerHandlers } from './media-details-panel/hooks/useMediaDetailsPickerHandlers';
import { useMediaDetailsPrimaryActions } from './media-details-panel/hooks/useMediaDetailsPrimaryActions';
import { useMediaDetailsFocusDebug } from './media-details-panel/hooks/useMediaDetailsFocusDebug';
import { useMediaDetailsFocusOrchestrator } from './media-details-panel/hooks/useMediaDetailsFocusOrchestrator';
import { useMediaDetailsSectionNavigation } from './media-details-panel/hooks/useMediaDetailsSectionNavigation';
import { useMediaDetailsDomHelpers } from './media-details-panel/hooks/useMediaDetailsDomHelpers';
import { useMediaDetailsOverviewState } from './media-details-panel/hooks/useMediaDetailsOverviewState';
import { useMediaDetailsPanelSync } from './media-details-panel/hooks/useMediaDetailsPanelSync';
import { useMediaDetailsItemBootstrap } from './media-details-panel/hooks/useMediaDetailsItemBootstrap';
import MediaDetailsToast from './media-details-panel/components/MediaDetailsToast';
import MediaTrackPickerPopup from './media-details-panel/components/MediaTrackPickerPopup';
import MediaEpisodePickerPopup from './media-details-panel/components/MediaEpisodePickerPopup';
import MediaCastSection from './media-details-panel/components/MediaCastSection';
import MediaSeasonsSection from './media-details-panel/components/MediaSeasonsSection';
import MediaSeriesStickyControls from './media-details-panel/components/MediaSeriesStickyControls';
import MediaEpisodesSection from './media-details-panel/components/MediaEpisodesSection';
import MediaDetailsIntroSection from './media-details-panel/components/MediaDetailsIntroSection';

import css from './MediaDetailsPanel.module.less';
import imageLoadCss from '../components/ImageLoadReveal.module.less';

const MediaDetailsPanel = ({
	item,
	onBack,
	onPlay,
	onItemSelect,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	registerBackHandler,
	...rest
}) => {
	const [loading, setLoading] = useState(true);
	const [playbackInfo, setPlaybackInfo] = useState(null);
	const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
	const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);
	const [seasons, setSeasons] = useState([]);
	const [episodes, setEpisodes] = useState([]);
	const [selectedSeason, setSelectedSeason] = useState(null);
	const [selectedEpisode, setSelectedEpisode] = useState(null);
	const {
		showAudioPicker,
		showSubtitlePicker,
		showEpisodePicker,
		openAudioPicker,
		closeAudioPicker,
		openSubtitlePicker,
		closeSubtitlePicker,
		openEpisodePicker,
		closeEpisodePicker
	} = useMediaDetailsDisclosures();
	const [episodeNavList, setEpisodeNavList] = useState([]);
	const [isFavorite, setIsFavorite] = useState(false);
	const [isWatched, setIsWatched] = useState(false);
	const [navbarTheme, setNavbarTheme] = useState('elegant');
	const [showSeasonImages, setShowSeasonImages] = useState(false);
	const [useSidewaysEpisodeList, setUseSidewaysEpisodeList] = useState(true);
	const [isCastCollapsed, setIsCastCollapsed] = useState(false);
	const [overviewExpanded, setOverviewExpanded] = useState(false);
	const detailMetadata = useItemMetadata(item?.Id, {
		enabled: Boolean(item?.Id),
		errorContext: 'item metadata'
	});
	const seasonMetadata = useItemMetadata(selectedSeason?.Id, {
		enabled: item?.Type === 'Series' && Boolean(selectedSeason?.Id),
		errorContext: 'season metadata'
	});
	const selectedEpisodeMetadata = useItemMetadata(selectedEpisode?.Id, {
		enabled: item?.Type === 'Series' && Boolean(selectedEpisode?.Id),
		errorContext: 'selected episode metadata'
	});
	const {
		captureScrollTo: captureDetailsScrollRestore,
		handleScrollStop: handleDetailsScrollMemoryStop
	} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState,
		cacheKey: item?.Id || null,
		requireCacheKey: true
	});
	const castRowRef = useRef(null);
	const castScrollerRef = useRef(null);
	const seasonScrollerRef = useRef(null);
	const episodesListRef = useRef(null);
	const overviewTextRef = useRef(null);
	const episodeSelectorButtonRef = useRef(null);
	const detailsContainerRef = useRef(null);
	const detailsScrollToRef = useRef(null);
	const favoriteActionButtonRef = useRef(null);
	const watchedActionButtonRef = useRef(null);
	const audioSelectorButtonRef = useRef(null);
	const subtitleSelectorButtonRef = useRef(null);
	const playPrimaryButtonRef = useRef(null);
	const firstSectionRef = useRef(null);
	const contentSectionRef = useRef(null);
	const debugLastScrollTopRef = useRef(null);
	const debugLastScrollTimeRef = useRef(0);
	const playbackInfoRequestRef = useRef(0);
	const episodesRequestRef = useRef(0);
	const seasonsRequestRef = useRef(0);
	const seriesItemCacheRef = useRef(new Map());
	const seasonsCacheRef = useRef(new Map());
	const episodesCacheRef = useRef(new Map());
	const castFocusScrollTimeoutRef = useRef(null);
	const seasonFocusScrollTimeoutRef = useRef(null);
	const episodeFocusScrollTimeoutRef = useRef(null);
	const {
		resolveDefaultTrackSelection,
		saveAudioSelection,
		saveSubtitleSelection
	} = useTrackPreferences();
	const {
		toastMessage,
		toastVisible,
		setToastMessage
	} = useToastMessage(PANEL_TOAST_CONFIG);
	const {
		getDetailsScrollElement,
		getScrollSnapshot,
		focusNodeWithoutScroll
	} = useMediaDetailsDomHelpers({detailsContainerRef});
	const {
		detailsDebugEnabled,
		describeNode,
		logDetailsDebug
	} = useMediaDetailsFocusDebug({
		isActive,
		item,
		getDetailsScrollElement,
		getScrollSnapshot,
		debugLastScrollTopRef,
		debugLastScrollTimeRef
	});
	const seasonsById = useMapById(seasons);
	const episodesById = useMapById(episodes);
	const popupEpisodesById = useMemo(() => {
		const map = new Map(episodesById);
		episodeNavList.forEach((episode) => {
			if (!episode?.Id) return;
			map.set(String(episode.Id), episode);
		});
		return map;
	}, [episodeNavList, episodesById]);
	const isElegantTheme = navbarTheme === 'elegant';
	const hasOverviewText = Boolean(item?.Overview && String(item.Overview).trim().length > 0);

	useMediaDetailsPanelSync({
		item,
		setOverviewExpanded,
		setIsCastCollapsed,
		castFocusScrollTimeoutRef,
		seasonFocusScrollTimeoutRef,
		episodeFocusScrollTimeoutRef,
		setNavbarTheme,
		setShowSeasonImages,
		setUseSidewaysEpisodeList
	});
	const {
		applyDefaultTracks,
		loadPlaybackInfo,
		loadSeasons,
		openSeriesFromEpisode,
		handleSeasonClick,
		handleEpisodeClick
	} = useMediaDetailsDataLoader({
		item,
		onItemSelect,
		resolveDefaultTrackSelection,
		setSelectedAudioTrack,
		setSelectedSubtitleTrack,
		setPlaybackInfo,
		setLoading,
		setSeasons,
		setEpisodes,
		setSelectedSeason,
		setSelectedEpisode,
		setEpisodeNavList,
		playbackInfoRequestRef,
		episodesRequestRef,
		seasonsRequestRef,
		seriesItemCacheRef,
		seasonsCacheRef,
		episodesCacheRef
	});

	useMediaDetailsItemBootstrap({
		item,
		playbackInfoRequestRef,
		episodesRequestRef,
		seasonsRequestRef,
		setPlaybackInfo,
		applyDefaultTracks,
		loadPlaybackInfo,
		loadSeasons,
		setSeasons,
		setEpisodes,
		setSelectedSeason,
		setSelectedEpisode,
		setIsFavorite,
		setIsWatched
	});

	const {
		handleToggleFavorite,
		handleToggleFavoriteById,
		handleToggleWatched
	} = useMediaDetailsItemActions({
		item,
		isFavorite,
		isWatched,
		selectedSeason,
		selectedEpisode,
		setIsFavorite,
		setIsWatched,
		setEpisodes,
		setSelectedEpisode,
		setToastMessage
	});
	const {
		hasOverviewOverflow,
		seriesPlayLabel,
		overviewPlayLabel
	} = useMediaDetailsOverviewState({
		item,
		episodes,
		selectedEpisode,
		isElegantTheme,
		hasOverviewText,
		overviewTextRef,
		overviewCollapsedClass: css.overviewCollapsed
	});

	const {
		handlePlay,
		handleBack,
		handleInternalBack,
		handleOpenEpisodeSeries,
		handleToggleWatchedMain,
		toggleCastCollapsed,
		handleOverviewActivate
	} = useMediaDetailsPrimaryActions({
		item,
		onPlay,
		onBack,
		playbackInfo,
		selectedAudioTrack,
		selectedSubtitleTrack,
		selectedEpisode,
		showEpisodePicker,
		closeEpisodePicker,
		showAudioPicker,
		closeAudioPicker,
		showSubtitlePicker,
		closeSubtitlePicker,
		openSeriesFromEpisode,
		handleToggleWatched,
		setIsCastCollapsed,
		isElegantTheme,
		hasOverviewOverflow,
		setOverviewExpanded
	});

	useMediaDetailsKeyboardShortcuts({
		isActive,
		detailsDebugEnabled,
		logDetailsDebug,
		describeNode,
		getScrollSnapshot,
		handleInternalBack,
		handlePlay
	});

	usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

	const {
		backdropUrl,
		hasBackdropImage,
		isBackdropImageLoaded,
		headerLogoUrl,
		useHeaderLogo,
		headerTitle,
		handleHeaderLogoError,
		handleBackdropImageError,
		handleBackdropImageLoad,
		handleCastImageError,
		getCastImageUrl,
		getSeasonImageUrl,
		getEpisodeImageUrl,
		handleSeasonImageError,
		handleEpisodeImageError
	} = useMediaDetailsImages({item});
	const shouldShowSeasonPosters = !isElegantTheme || showSeasonImages;
	const isSidewaysEpisodeLayout = isElegantTheme && useSidewaysEpisodeList;
	const pageTitle = item?.Name || item?.SeriesName || 'Details';
	const {
		audioTracks,
		subtitleTracks,
		audioSummary,
		subtitleSummary
	} = useMediaDetailsTrackOptions({
		playbackInfo,
		selectedAudioTrack,
		selectedSubtitleTrack
	});
	const {
		cast,
		directorNames,
		writerNames,
		hasCreatorCredits
	} = useMediaCredits({
		detailPeople: detailMetadata?.People,
		seasonPeople: seasonMetadata?.People,
		episodePeople: selectedEpisodeMetadata?.People,
		itemPeople: item?.People
	});
	const renderCreditNames = useCallback((names, typeKey) => (
		names.map((name, index) => (
			<span key={`${typeKey}-${name}-${index}`} className={css.creditNameItem}>
				{name}
			</span>
		))
	), []);
	const {
		scrollCastIntoView,
		scrollSeasonIntoView,
		focusSeasonCardByIndex,
		focusSeasonWatchedButton,
		focusTopHeaderAction,
		focusEpisodeCardByIndex,
		focusEpisodeInfoButtonByIndex,
		focusEpisodeFavoriteButtonByIndex,
		focusEpisodeWatchedButtonByIndex,
		focusEpisodeSelector,
		focusBelowSeasons,
		focusNonSeriesAudioSelector,
		focusNonSeriesSubtitleSelector,
		focusNonSeriesPrimaryPlay,
		handleDetailsPointerDownCapture,
		handleDetailsPointerClickCapture
	} = useMediaDetailsFocusOrchestrator({
		item,
		isActive,
		loading,
		showEpisodePicker,
		showAudioPicker,
		showSubtitlePicker,
		css,
		getDetailsScrollElement,
		getScrollSnapshot,
		describeNode,
		logDetailsDebug,
		focusNodeWithoutScroll,
		detailsContainerRef,
		detailsScrollToRef,
		favoriteActionButtonRef,
		watchedActionButtonRef,
		audioSelectorButtonRef,
		subtitleSelectorButtonRef,
		playPrimaryButtonRef,
		episodeSelectorButtonRef,
		castScrollerRef,
		seasonScrollerRef,
		episodesListRef,
		castFocusScrollTimeoutRef,
		seasonFocusScrollTimeoutRef
	});

	const captureDetailsScrollTo = useCallback((fn) => {
		detailsScrollToRef.current = fn;
		captureDetailsScrollRestore(fn);
	}, [captureDetailsScrollRestore]);
	const {
		hasSecondarySection,
		sectionSwitchInProgress,
		isSectionSwitchInProgress,
		focusAndShowFirstSection,
		focusAndShowSecondSection,
		focusIntroTopNavigation,
		handleIntroActionKeyDown,
		handleIntroTopNavKeyDown,
		handleSectionSwitchKeyDownCapture,
		handleSectionWheelCapture,
		handleDetailsScrollerScrollStop
	} = useMediaDetailsSectionNavigation({
		itemType: item?.Type,
		cast,
		seasons,
		episodes,
		isActive,
		loading,
		showAudioPicker,
		showSubtitlePicker,
		showEpisodePicker,
		css,
		firstSectionRef,
		contentSectionRef,
		audioSelectorButtonRef,
		subtitleSelectorButtonRef,
		playPrimaryButtonRef,
		getDetailsScrollElement,
		handleDetailsScrollMemoryStop,
		focusNodeWithoutScroll,
		focusNonSeriesPrimaryPlay,
		focusNonSeriesAudioSelector,
		focusNonSeriesSubtitleSelector,
		focusEpisodeSelector
	});
	const handleSectionSwitchPointerCapture = useCallback((event) => {
		if (!isSectionSwitchInProgress()) return false;
		if (event.cancelable) {
			event.preventDefault();
		}
		event.stopPropagation();
		event.stopImmediatePropagation?.();
		return true;
	}, [isSectionSwitchInProgress]);
	const handleDetailsMouseDownCapture = useCallback((event) => {
		if (handleSectionSwitchPointerCapture(event)) return;
		handleDetailsPointerDownCapture(event);
	}, [handleDetailsPointerDownCapture, handleSectionSwitchPointerCapture]);
	const handleDetailsClickCapture = useCallback((event) => {
		if (handleSectionSwitchPointerCapture(event)) return;
		handleDetailsPointerClickCapture(event);
	}, [handleDetailsPointerClickCapture, handleSectionSwitchPointerCapture]);

	const {
		handleTrackSelect,
		handleEpisodePopupSelect
	} = useMediaDetailsPickerHandlers({
		playbackInfo,
		saveAudioSelection,
		saveSubtitleSelection,
		setSelectedAudioTrack,
		setSelectedSubtitleTrack,
		closeAudioPicker,
		closeSubtitlePicker,
		popupEpisodesById,
		handleEpisodeClick,
		onItemSelect,
		item,
		closeEpisodePicker
	});
	const {
		handleCastCardFocus,
		handleCastToggleKeyDown,
		handleCastCardKeyDown,
		handleSeasonCardClick,
		handleSeasonCardFocus,
		handleSeasonCardKeyDown,
		handleSeasonWatchedToggleClick,
		handleSeasonWatchedButtonKeyDown,
		handleEpisodeSelectorKeyDown,
		handleEpisodeCardClick,
		handleEpisodeCardFocus,
		handleEpisodeInfoClick,
		handleEpisodeFavoriteClick,
		handleEpisodeWatchedClick,
		handleEpisodeCardKeyDown,
		handleEpisodeInfoButtonKeyDown,
		handleEpisodeFavoriteButtonKeyDown,
		handleEpisodeWatchedButtonKeyDown,
		handleAudioSelectorKeyDown,
		handleSubtitleSelectorKeyDown,
		handleNonSeriesPlayKeyDown
	} = useMediaDetailsInteractionHandlers({
		item,
		onItemSelect,
		castRowRef,
		scrollCastIntoView,
		seasonsById,
		handleSeasonClick,
		scrollSeasonIntoView,
		seasonScrollerRef,
		focusSeasonCardByIndex,
		focusSeasonWatchedButton,
		focusBelowSeasons,
		handleToggleWatched,
		episodesById,
		handleEpisodeClick,
		isSidewaysEpisodeLayout,
			episodesListRef,
			episodeFocusScrollTimeoutRef,
			focusEpisodeCardByIndex,
			focusEpisodeInfoButtonByIndex,
			focusEpisodeFavoriteButtonByIndex,
			focusEpisodeWatchedButtonByIndex,
			focusEpisodeSelector,
			handleToggleFavoriteById,
			focusNonSeriesSubtitleSelector,
			focusNonSeriesPrimaryPlay,
			focusNonSeriesAudioSelector,
			focusNodeWithoutScroll,
			focusIntroTopNavigation,
			focusTopHeaderAction,
			focusFirstSectionPrimary: focusAndShowFirstSection,
			focusSecondSectionPrimary: focusAndShowSecondSection,
			showEpisodeInfoButton: typeof onItemSelect === 'function',
			css
		});

	if (!item) return null;
	const isSeriesMode = item.Type === 'Series';
	const showEpisodeInfoButton = typeof onItemSelect === 'function';
	const popupEpisodes = isSeriesMode ? episodes : episodeNavList;
	const introDetails = {
		item,
		pageTitle,
		isElegantTheme,
		useHeaderLogo,
		headerLogoUrl,
		headerTitle,
		hasCreatorCredits,
		directorNames,
		writerNames,
		isFavorite,
		isWatched,
		hasOverviewText,
		overviewExpanded,
		hasOverviewOverflow,
		overviewPlayLabel
	};
	const introMedia = {
		audioTracks,
		subtitleTracks,
		audioSummary,
		subtitleSummary
	};
	const introActions = {
		onBack: handleBack,
		onOpenEpisodeSeries: handleOpenEpisodeSeries,
		onOpenEpisodePicker: openEpisodePicker,
		onHeaderLogoError: handleHeaderLogoError,
		renderCreditNames,
		onToggleFavorite: handleToggleFavorite,
		onToggleWatchedMain: handleToggleWatchedMain,
		onOverviewActivate: handleOverviewActivate,
		onOpenAudioPicker: openAudioPicker,
		onOpenSubtitlePicker: openSubtitlePicker,
		onAudioSelectorKeyDown: handleAudioSelectorKeyDown,
		onSubtitleSelectorKeyDown: handleSubtitleSelectorKeyDown,
		onPlay: handlePlay,
		onNonSeriesPlayKeyDown: handleNonSeriesPlayKeyDown,
		showSectionHints: hasSecondarySection,
		onIntroActionKeyDown: handleIntroActionKeyDown,
		onIntroTopNavKeyDown: handleIntroTopNavKeyDown
	};
	const introRefs = {
		firstSectionRef,
		favoriteActionButtonRef,
		watchedActionButtonRef,
		overviewTextRef,
		audioSelectorButtonRef,
		subtitleSelectorButtonRef,
		playPrimaryButtonRef
	};

	return (
		<Panel {...rest}>
			<MediaDetailsToast message={toastMessage} visible={toastVisible} />
				<Scroller
					className={`${css.scroller} ${isElegantTheme ? css.scrollerElegant : ''}`}
					cbScrollTo={captureDetailsScrollTo}
					onScrollStop={handleDetailsScrollerScrollStop}
				>
					<div
						className={`${css.detailsContainer} ${isElegantTheme ? css.elegantMode : ''} ${item.Type === 'Episode' ? css.episodeDetailsMode : ''} ${sectionSwitchInProgress ? css.sectionSwitchLocked : ''}`}
						ref={detailsContainerRef}
						tabIndex={-1}
						onKeyDownCapture={handleSectionSwitchKeyDownCapture}
						onMouseDownCapture={handleDetailsMouseDownCapture}
						onClickCapture={handleDetailsClickCapture}
						onWheelCapture={handleSectionWheelCapture}
				>
					{!loading && (
						<div className={`${css.backdrop} ${hasBackdropImage ? '' : css.backdropFallback} ${isElegantTheme ? css.backdropElegant : ''}`}>
							{hasBackdropImage && (
								<img
									src={backdropUrl}
									data-bf-src-key={backdropUrl}
									alt={item.Name}
									className={`${css.backdropImage} ${isBackdropImageLoaded ? '' : css.backdropImageHidden}`}
									onLoad={handleBackdropImageLoad}
									onError={handleBackdropImageError}
									loading="lazy"
									decoding="async"
									draggable={false}
								/>
							)}
							{hasBackdropImage && !isBackdropImageLoaded ? (
								<div className={`${imageLoadCss.imageLoadingHint} ${css.backdropLoadingHint}`} aria-hidden="true" />
							) : null}
							<div className={`${css.gradient} ${isElegantTheme ? css.gradientElegant : ''}`} />
						</div>
					)}
					{loading ? (
						<div className={css.loading}>
							<BreezyLoadingOverlay />
						</div>
					) : (
						<>
									<div className={`${css.content} ${isElegantTheme ? css.contentElegant : ''}`}>
										<MediaDetailsIntroSection
											details={introDetails}
											media={introMedia}
											actions={introActions}
											refs={introRefs}
										/>

										<div className={css.contentSection} ref={contentSectionRef}>
											{hasSecondarySection && (
												<div className={css.sectionSwitchRow}>
													<div className={css.sectionHint}>
														<Icon className={css.sectionHintArrow}>arrowsmallup</Icon>
														Overview
													</div>
												</div>
											)}
									<MediaCastSection
										cast={cast}
										isCastCollapsed={isCastCollapsed}
										onToggleCastCollapsed={toggleCastCollapsed}
										onCastToggleKeyDown={handleCastToggleKeyDown}
										castScrollerRef={castScrollerRef}
										castRowRef={castRowRef}
										onCastCardFocus={handleCastCardFocus}
										onCastCardKeyDown={handleCastCardKeyDown}
										onCastImageError={handleCastImageError}
										getCastImageUrl={getCastImageUrl}
									/>
									{item.Type === 'Series' && seasons.length > 0 && (
										<div className={css.seriesContent}>
											<MediaSeasonsSection
												seasons={seasons}
												selectedSeasonId={selectedSeason?.Id}
												shouldShowSeasonPosters={shouldShowSeasonPosters}
												seasonScrollerRef={seasonScrollerRef}
												onSeasonCardClick={handleSeasonCardClick}
												onSeasonCardFocus={handleSeasonCardFocus}
												onSeasonCardKeyDown={handleSeasonCardKeyDown}
												onSeasonWatchedToggleClick={handleSeasonWatchedToggleClick}
												onSeasonWatchedButtonKeyDown={handleSeasonWatchedButtonKeyDown}
												onSeasonImageError={handleSeasonImageError}
												getSeasonImageUrl={getSeasonImageUrl}
											/>
											<MediaSeriesStickyControls
												showControls={episodes.length > 0 && Boolean(selectedEpisode)}
												isSidewaysEpisodeLayout={isSidewaysEpisodeLayout}
												selectedEpisode={selectedEpisode}
												onOpenEpisodePicker={openEpisodePicker}
												episodeSelectorButtonRef={episodeSelectorButtonRef}
												onEpisodeSelectorKeyDown={handleEpisodeSelectorKeyDown}
												audioTracks={audioTracks}
												subtitleTracks={subtitleTracks}
												onOpenAudioPicker={openAudioPicker}
												onOpenSubtitlePicker={openSubtitlePicker}
												audioSummary={audioSummary}
												subtitleSummary={subtitleSummary}
												onPlay={handlePlay}
												seriesPlayLabel={seriesPlayLabel}
											/>
											<MediaEpisodesSection
												episodes={episodes}
												selectedEpisodeId={selectedEpisode?.Id}
												isSidewaysEpisodeLayout={isSidewaysEpisodeLayout}
												isElegantTheme={isElegantTheme}
												episodesListRef={episodesListRef}
												getEpisodeBadge={getEpisodeBadge}
												getEpisodeImageUrl={getEpisodeImageUrl}
												getEpisodeRuntime={getEpisodeRuntime}
												getEpisodeAirDate={getEpisodeAirDate}
												onEpisodeCardClick={handleEpisodeCardClick}
												onEpisodeCardFocus={handleEpisodeCardFocus}
												onEpisodeCardKeyDown={handleEpisodeCardKeyDown}
												onEpisodeImageError={handleEpisodeImageError}
												onEpisodeInfoClick={handleEpisodeInfoClick}
												onEpisodeInfoButtonKeyDown={handleEpisodeInfoButtonKeyDown}
												onEpisodeFavoriteClick={handleEpisodeFavoriteClick}
												onEpisodeFavoriteButtonKeyDown={handleEpisodeFavoriteButtonKeyDown}
												onEpisodeWatchedClick={handleEpisodeWatchedClick}
												onEpisodeWatchedButtonKeyDown={handleEpisodeWatchedButtonKeyDown}
												showEpisodeInfoButton={showEpisodeInfoButton}
											/>
										</div>
									)}

									</div>

								</div>
						</>
					)}
				</div>
			</Scroller>
			<MediaTrackPickerPopup
				open={showAudioPicker}
				onClose={closeAudioPicker}
				type="audio"
				tracks={audioTracks}
				selectedKey={selectedAudioTrack}
				onTrackSelect={handleTrackSelect}
			/>
			<MediaTrackPickerPopup
				open={showSubtitlePicker}
				onClose={closeSubtitlePicker}
				type="subtitle"
				tracks={subtitleTracks}
				selectedKey={selectedSubtitleTrack}
				onTrackSelect={handleTrackSelect}
			/>
			<MediaEpisodePickerPopup
				open={showEpisodePicker}
				onClose={closeEpisodePicker}
				isSeriesMode={isSeriesMode}
				episodes={popupEpisodes}
				selectedEpisodeId={selectedEpisode?.Id}
				currentItemId={item?.Id}
				onSelect={handleEpisodePopupSelect}
			/>
		</Panel>
	);
};

export default MediaDetailsPanel;
