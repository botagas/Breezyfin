import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Panel } from '../components/BreezyPanels';
import Scroller from '../components/AppScroller';
import Icon from '@enact/sandstone/Icon';
import jellyfinService from '../services/jellyfinService';
import BreezyLoadingOverlay from '../components/BreezyLoadingOverlay';
import {KeyCodes} from '../utils/keyCodes';
import {
	getEpisodeActionBadge,
	getEpisodeAirDate,
	getEpisodeBadge,
	getEpisodeImageUrl as resolveEpisodeImageUrl,
	getEpisodeRuntime,
	getSeasonImageUrl as resolveSeasonImageUrl,
	isEpisodeInProgress,
	isEpisodePlayed
} from './media-details-panel/utils/mediaDetailsHelpers';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { usePanelBackHandler } from '../hooks/usePanelBackHandler';
import { useDisclosureHandlers } from '../hooks/useDisclosureHandlers';
import { useTrackPreferences } from '../hooks/useTrackPreferences';
import { useToastMessage } from '../hooks/useToastMessage';
import { useImageErrorFallback } from '../hooks/useImageErrorFallback';
import { useDisclosureMap } from '../hooks/useDisclosureMap';
import { useMapById } from '../hooks/useMapById';
import { useItemMetadata } from '../hooks/useItemMetadata';
import { usePanelScrollState } from '../hooks/usePanelScrollState';
import { useMediaDetailsKeyboardShortcuts } from './media-details-panel/hooks/useMediaDetailsKeyboardShortcuts';
import { useMediaDetailsTrackOptions } from './media-details-panel/hooks/useMediaDetailsTrackOptions';
import { useMediaCredits } from './media-details-panel/hooks/useMediaCredits';
import { useMediaDetailsInteractionHandlers } from './media-details-panel/hooks/useMediaDetailsInteractionHandlers';
import { useMediaDetailsDataLoader } from './media-details-panel/hooks/useMediaDetailsDataLoader';
import { useMediaDetailsItemActions } from './media-details-panel/hooks/useMediaDetailsItemActions';
import { useMediaDetailsPickerHandlers } from './media-details-panel/hooks/useMediaDetailsPickerHandlers';
import { useMediaDetailsFocusDebug } from './media-details-panel/hooks/useMediaDetailsFocusDebug';
import { useMediaDetailsFocusOrchestrator } from './media-details-panel/hooks/useMediaDetailsFocusOrchestrator';
import { useMediaDetailsSectionNavigation } from './media-details-panel/hooks/useMediaDetailsSectionNavigation';
import MediaDetailsToast from './media-details-panel/components/MediaDetailsToast';
import MediaTrackPickerPopup from './media-details-panel/components/MediaTrackPickerPopup';
import MediaEpisodePickerPopup from './media-details-panel/components/MediaEpisodePickerPopup';
import MediaCastSection from './media-details-panel/components/MediaCastSection';
import MediaSeasonsSection from './media-details-panel/components/MediaSeasonsSection';
import MediaSeriesStickyControls from './media-details-panel/components/MediaSeriesStickyControls';
import MediaEpisodesSection from './media-details-panel/components/MediaEpisodesSection';
import MediaDetailsIntroSection from './media-details-panel/components/MediaDetailsIntroSection';

import css from './MediaDetailsPanel.module.less';

const MEDIA_DETAILS_DISCLOSURE_KEYS = {
	AUDIO_PICKER: 'audioPickerPopup',
	SUBTITLE_PICKER: 'subtitlePickerPopup',
	EPISODE_PICKER: 'episodePickerPopup'
};
const INITIAL_MEDIA_DETAILS_DISCLOSURES = {
	[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER]: false,
	[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER]: false,
	[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER]: false
};
const MEDIA_DETAILS_DISCLOSURE_KEY_LIST = [
	MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER,
	MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER,
	MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER
];

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
		disclosures,
		openDisclosure,
		closeDisclosure
	} = useDisclosureMap(INITIAL_MEDIA_DETAILS_DISCLOSURES);
	const disclosureHandlers = useDisclosureHandlers(
		MEDIA_DETAILS_DISCLOSURE_KEY_LIST,
		openDisclosure,
		closeDisclosure
	);
	const showAudioPicker = disclosures[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER] === true;
	const showSubtitlePicker = disclosures[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER] === true;
	const showEpisodePicker = disclosures[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER] === true;
	const openAudioPicker = disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER].open;
	const closeAudioPicker = disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.AUDIO_PICKER].close;
	const openSubtitlePicker = disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER].open;
	const closeSubtitlePicker = disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.SUBTITLE_PICKER].close;
	const openEpisodePicker = disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER].open;
	const closeEpisodePicker = disclosureHandlers[MEDIA_DETAILS_DISCLOSURE_KEYS.EPISODE_PICKER].close;
	const [headerLogoUnavailable, setHeaderLogoUnavailable] = useState(false);
	const [episodeNavList, setEpisodeNavList] = useState([]);
	const [isFavorite, setIsFavorite] = useState(false);
	const [isWatched, setIsWatched] = useState(false);
	const [navbarTheme, setNavbarTheme] = useState('elegant');
	const [showSeasonImages, setShowSeasonImages] = useState(false);
	const [useSidewaysEpisodeList, setUseSidewaysEpisodeList] = useState(true);
	const [isCastCollapsed, setIsCastCollapsed] = useState(false);
	const [overviewExpanded, setOverviewExpanded] = useState(false);
	const [hasOverviewOverflow, setHasOverviewOverflow] = useState(false);
	const [backdropUnavailable, setBackdropUnavailable] = useState(false);
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
	} = useToastMessage({durationMs: 2050, fadeOutMs: 350});
	const getDetailsScrollElement = useCallback(() => {
		const container = detailsContainerRef.current;
		if (!container) return null;
		const contentNode = container.closest?.('[id$="_content"]');
		if (contentNode && typeof contentNode.scrollTop === 'number') return contentNode;
		return container.closest?.('[data-webos-voice-intent="Scroll"]') || null;
	}, []);
	const getScrollSnapshot = useCallback(() => {
		const scrollEl = getDetailsScrollElement();
		if (!scrollEl) return null;
		return {
			top: scrollEl.scrollTop,
			clientHeight: scrollEl.clientHeight,
			scrollHeight: scrollEl.scrollHeight
		};
	}, [getDetailsScrollElement]);
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
	const focusNodeWithoutScroll = useCallback((node) => {
		if (!node?.focus) return;
		try {
			node.focus({preventScroll: true});
		} catch (error) {
			node.focus();
		}
	}, []);
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

	useEffect(() => {
		setHeaderLogoUnavailable(false);
	}, [item?.Id, item?.SeriesId, item?.Type]);

	useEffect(() => {
		setBackdropUnavailable(false);
	}, [item?.Id, item?.SeriesId, item?.Type]);

	useEffect(() => {
		setOverviewExpanded(false);
		setIsCastCollapsed(false);
	}, [item?.Id, item?.SeriesId, item?.Type]);

	useEffect(() => {
		return () => {
			if (castFocusScrollTimeoutRef.current) {
				window.clearTimeout(castFocusScrollTimeoutRef.current);
				castFocusScrollTimeoutRef.current = null;
			}
			if (seasonFocusScrollTimeoutRef.current) {
				window.clearTimeout(seasonFocusScrollTimeoutRef.current);
				seasonFocusScrollTimeoutRef.current = null;
			}
			if (episodeFocusScrollTimeoutRef.current) {
				window.clearTimeout(episodeFocusScrollTimeoutRef.current);
				episodeFocusScrollTimeoutRef.current = null;
			}
		};
	}, []);

	const applyPanelSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		setNavbarTheme(settings.navbarTheme === 'classic' ? 'classic' : 'elegant');
		setShowSeasonImages(settings.showSeasonImages === true);
		setUseSidewaysEpisodeList(settings.useSidewaysEpisodeList !== false);
	}, []);

	useBreezyfinSettingsSync(applyPanelSettings);
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

	const handlePlay = useCallback(() => {
		const mediaSourceId = playbackInfo?.MediaSources?.[0]?.Id || null;
		const options = { mediaSourceId };
		if (Number.isInteger(selectedAudioTrack)) {
			options.audioStreamIndex = selectedAudioTrack;
		}
		if (selectedSubtitleTrack === -1 || Number.isInteger(selectedSubtitleTrack)) {
			options.subtitleStreamIndex = selectedSubtitleTrack;
		}

		if (item?.Type === 'Series') {
			if (selectedEpisode) {
				onPlay(selectedEpisode, options);
			} else {
				console.error('No episode selected');
			}
		} else {
			onPlay(item, options);
		}
	}, [item, onPlay, playbackInfo, selectedAudioTrack, selectedEpisode, selectedSubtitleTrack]);

	const handleBack = useCallback(() => {
		onBack();
	}, [onBack]);

	useEffect(() => {
		playbackInfoRequestRef.current += 1;
		episodesRequestRef.current += 1;
		seasonsRequestRef.current += 1;
		setPlaybackInfo(null);
		applyDefaultTracks(null);
		loadPlaybackInfo();
		if (item?.Type === 'Series') {
			loadSeasons();
		} else {
			setSeasons([]);
			setEpisodes([]);
			setSelectedSeason(null);
			setSelectedEpisode(null);
		}
		setIsFavorite(Boolean(item?.UserData?.IsFavorite));
		setIsWatched(Boolean(item?.UserData?.Played));
	}, [applyDefaultTracks, item, loadPlaybackInfo, loadSeasons]);

	const handleInternalBack = useCallback(() => {
		if (showEpisodePicker) {
			closeEpisodePicker();
			return true;
		}
		if (showAudioPicker) {
			closeAudioPicker();
			return true;
		}
		if (showSubtitlePicker) {
			closeSubtitlePicker();
			return true;
		}
		handleBack();
		return true;
	}, [closeAudioPicker, closeEpisodePicker, closeSubtitlePicker, handleBack, showAudioPicker, showEpisodePicker, showSubtitlePicker]);

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

	const backdropUrl = (() => {
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 1920);
		}
		if (item?.SeriesId) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 1920);
		}
		return '';
	})();
	const hasBackdropImage = Boolean(backdropUrl) && !backdropUnavailable;
	const isElegantTheme = navbarTheme === 'elegant';
	const shouldShowSeasonPosters = !isElegantTheme || showSeasonImages;
	const isSidewaysEpisodeLayout = isElegantTheme && useSidewaysEpisodeList;

	const headerLogoUrl = useMemo(() => {
		if (!item) return '';
		const logoItemId = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
		if (!logoItemId) return '';
		return jellyfinService.getImageUrl(logoItemId, 'Logo', 1600) || '';
	}, [item]);

	const useHeaderLogo = Boolean(headerLogoUrl) && !headerLogoUnavailable;
	const headerTitle = useHeaderLogo ? undefined : (item?.Name || 'Details');
	const pageTitle = item?.Name || item?.SeriesName || 'Details';
	const hasOverviewText = Boolean(item?.Overview && String(item.Overview).trim().length > 0);
	const handleHeaderLogoError = useImageErrorFallback(null, {
		onError: () => setHeaderLogoUnavailable(true)
	});
	const handleBackdropImageError = useImageErrorFallback(null, {
		onError: () => setBackdropUnavailable(true)
	});
	const handleCastImageError = useImageErrorFallback();
	const hideImageOnError = useImageErrorFallback();
	const getCastImageUrl = useCallback((personId) => {
		return jellyfinService.getImageUrl(personId, 'Primary', 240);
	}, []);
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

	const getSeasonImageUrl = useCallback((season) => {
		return resolveSeasonImageUrl(season, item, jellyfinService);
	}, [item]);

	const getEpisodeImageUrl = useCallback((episode) => {
		return resolveEpisodeImageUrl(episode, item, jellyfinService);
	}, [item]);

	useEffect(() => {
		if (!isElegantTheme || !hasOverviewText) {
			setHasOverviewOverflow(false);
			return undefined;
		}

		let frameId = 0;
		const measureOverviewOverflow = () => {
			const overviewElement = overviewTextRef.current;
			if (!overviewElement) {
				setHasOverviewOverflow(false);
				return;
			}
			const collapsedClass = css.overviewCollapsed;
			const hadCollapsedClass = overviewElement.classList.contains(collapsedClass);
			if (!hadCollapsedClass) {
				overviewElement.classList.add(collapsedClass);
			}
			const hasOverflow = (overviewElement.scrollHeight - overviewElement.clientHeight) > 1;
			if (!hadCollapsedClass) {
				overviewElement.classList.remove(collapsedClass);
			}
			setHasOverviewOverflow(hasOverflow);
		};
		const scheduleOverviewMeasurement = () => {
			window.cancelAnimationFrame(frameId);
			frameId = window.requestAnimationFrame(measureOverviewOverflow);
		};

		scheduleOverviewMeasurement();
		window.addEventListener('resize', scheduleOverviewMeasurement);
		return () => {
			window.cancelAnimationFrame(frameId);
			window.removeEventListener('resize', scheduleOverviewMeasurement);
		};
	}, [hasOverviewText, isElegantTheme, item?.Id]);

	const shouldShowContinue = useMemo(() => {
		if (item?.Type === 'Series') return false;
		if (!item?.UserData) return false;
		const playbackPosition = item?.UserData?.PlaybackPositionTicks || 0;
		if (playbackPosition > 0) return true;
		const percentage = item?.UserData?.PlayedPercentage || 0;
		return percentage > 0 && percentage < 100;
	}, [item]);

	const seriesHasWatchHistory = useMemo(() => {
		if (item?.Type !== 'Series') return false;
		if (episodes.some((episode) => isEpisodeInProgress(episode) || isEpisodePlayed(episode))) return true;
		const userData = item?.UserData;
		if (!userData) return false;
		if ((userData.PlaybackPositionTicks || 0) > 0) return true;
		if ((userData.PlayedPercentage || 0) > 0) return true;
		return userData.Played === true;
	}, [episodes, item]);

	const seriesPlayLabel = useMemo(() => {
		if (item?.Type !== 'Series') return 'Play';
		const targetEpisode =
			selectedEpisode ||
			episodes.find((episode) => !isEpisodePlayed(episode)) ||
			episodes[0] ||
			null;
		if (!targetEpisode) return 'Play';
		const badge = getEpisodeActionBadge(targetEpisode);
		const withBadge = (label) => (badge ? `${label} ${badge}` : label);
		if (isEpisodeInProgress(targetEpisode)) {
			return withBadge('Continue');
		}
		if (!isEpisodePlayed(targetEpisode) && seriesHasWatchHistory) {
			return withBadge('Next Up');
		}
		if (!isEpisodePlayed(targetEpisode)) {
			return withBadge('Play');
		}
		return withBadge('Play');
	}, [episodes, item?.Type, selectedEpisode, seriesHasWatchHistory]);

	const overviewPlayLabel = item?.Type === 'Series'
		? seriesPlayLabel
		: (shouldShowContinue ? 'Continue' : 'Play');

	const captureDetailsScrollTo = useCallback((fn) => {
		detailsScrollToRef.current = fn;
		captureDetailsScrollRestore(fn);
	}, [captureDetailsScrollRestore]);
	const {
		hasSecondarySection,
		focusSectionOnePrimary,
		focusAndShowSecondSection,
		focusIntroTopNavigation,
		handleIntroActionKeyDown,
		handleIntroTopNavKeyDown,
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
		favoriteActionButtonRef,
		watchedActionButtonRef,
		audioSelectorButtonRef,
		subtitleSelectorButtonRef,
		playPrimaryButtonRef,
		getDetailsScrollElement,
		handleDetailsScrollMemoryStop,
		focusNodeWithoutScroll,
		focusTopHeaderAction,
		focusNonSeriesPrimaryPlay,
		focusNonSeriesAudioSelector,
		focusNonSeriesSubtitleSelector,
		focusEpisodeSelector
	});

	const handleOpenEpisodeSeries = useCallback(() => {
		openSeriesFromEpisode(item?.SeasonId || null);
	}, [item?.SeasonId, openSeriesFromEpisode]);

	const handleToggleWatchedMain = useCallback(() => {
		handleToggleWatched();
	}, [handleToggleWatched]);

	const toggleCastCollapsed = useCallback(() => {
		setIsCastCollapsed((currentValue) => !currentValue);
	}, []);

	const handleOverviewActivate = useCallback((event) => {
		if (!isElegantTheme || !hasOverviewOverflow) return;
		if (event?.type === 'keydown') {
			const code = event.keyCode || event.which;
			if (code !== KeyCodes.ENTER && code !== KeyCodes.OK && code !== KeyCodes.SPACE) return;
			event.preventDefault();
			event.stopPropagation();
		}
		setOverviewExpanded((currentValue) => !currentValue);
	}, [hasOverviewOverflow, isElegantTheme]);

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
		focusTopHeaderAction,
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
		focusIntroTopNavigation,
		focusFirstSectionPrimary: focusSectionOnePrimary,
		focusSecondSectionPrimary: focusAndShowSecondSection,
		showEpisodeInfoButton: typeof onItemSelect === 'function',
		css
	});

	const handleSeasonImageError = useCallback((e) => {
		if (item?.ImageTags?.Primary) {
			e.target.src = jellyfinService.getImageUrl(item.Id, 'Primary', 500);
		} else {
			hideImageOnError(e);
		}
	}, [hideImageOnError, item]);
	const handleEpisodeImageError = useCallback((e) => {
		const imageElement = e.currentTarget;
		const fallbackStep = imageElement.dataset.fallbackStep || '0';
		if (fallbackStep === '0' && item?.BackdropImageTags?.length > 0) {
			imageElement.dataset.fallbackStep = '1';
			imageElement.src = jellyfinService.getBackdropUrl(item.Id, 0, 960);
			return;
		}
		if (fallbackStep !== '2' && item?.ImageTags?.Primary) {
			imageElement.dataset.fallbackStep = '2';
			imageElement.src = jellyfinService.getImageUrl(item.Id, 'Primary', 760);
			return;
		}
		hideImageOnError(e);
	}, [hideImageOnError, item]);

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
						className={`${css.detailsContainer} ${isElegantTheme ? css.elegantMode : ''} ${item.Type === 'Episode' ? css.episodeDetailsMode : ''}`}
						ref={detailsContainerRef}
						tabIndex={-1}
						onMouseDownCapture={handleDetailsPointerDownCapture}
						onClickCapture={handleDetailsPointerClickCapture}
						onWheelCapture={handleSectionWheelCapture}
				>
					{!loading && (
						<div className={`${css.backdrop} ${hasBackdropImage ? '' : css.backdropFallback} ${isElegantTheme ? css.backdropElegant : ''}`}>
							{hasBackdropImage && (
								<img
									src={backdropUrl}
									alt={item.Name}
									onError={handleBackdropImageError}
								/>
							)}
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
