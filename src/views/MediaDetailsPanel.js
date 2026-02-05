import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Heading from '@enact/sandstone/Heading';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import Icon from '@enact/sandstone/Icon';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';
import {KeyCodes} from '../utils/keyCodes';

import css from './MediaDetailsPanel.module.less';

const SpottableDiv = Spottable('div');

const MediaDetailsPanel = ({ item, onBack, onPlay, onItemSelect, isActive = false, registerBackHandler, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [playbackInfo, setPlaybackInfo] = useState(null);
	const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
	const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);
	const [seasons, setSeasons] = useState([]);
	const [episodes, setEpisodes] = useState([]);
	const [selectedSeason, setSelectedSeason] = useState(null);
	const [selectedEpisode, setSelectedEpisode] = useState(null);
	const [showAudioPicker, setShowAudioPicker] = useState(false);
	const [showSubtitlePicker, setShowSubtitlePicker] = useState(false);
	const [showEpisodePicker, setShowEpisodePicker] = useState(false);
	const [headerLogoUnavailable, setHeaderLogoUnavailable] = useState(false);
	const [episodeNavList, setEpisodeNavList] = useState([]);
	const [isFavorite, setIsFavorite] = useState(false);
	const [isWatched, setIsWatched] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const castRowRef = useRef(null);
	const castScrollerRef = useRef(null);
	const seasonScrollerRef = useRef(null);
	const episodesListRef = useRef(null);
	const episodeSelectorButtonRef = useRef(null);
	const detailsContainerRef = useRef(null);
	const detailsScrollToRef = useRef(null);
	const favoriteActionButtonRef = useRef(null);
	const watchedActionButtonRef = useRef(null);
	const seasonsById = useMemo(() => {
		const map = new Map();
		seasons.forEach((season) => {
			map.set(String(season.Id), season);
		});
		return map;
	}, [seasons]);
	const episodesById = useMemo(() => {
		const map = new Map();
		episodes.forEach((episode) => {
			map.set(String(episode.Id), episode);
		});
		return map;
	}, [episodes]);
	const popupEpisodesById = useMemo(() => {
		const map = new Map();
		episodes.forEach((episode) => {
			map.set(String(episode.Id), episode);
		});
		episodeNavList.forEach((episode) => {
			map.set(String(episode.Id), episode);
		});
		return map;
	}, [episodeNavList, episodes]);

	useEffect(() => {
		let cancelled = false;
		const loadEpisodeNavList = async () => {
			if (item?.Type !== 'Episode' || !item.SeriesId || !item.SeasonId) {
				setEpisodeNavList([]);
				return;
			}
			try {
				const seasonEpisodes = await jellyfinService.getEpisodes(item.SeriesId, item.SeasonId);
				if (!cancelled) {
					setEpisodeNavList(seasonEpisodes || []);
				}
			} catch (error) {
				console.error('Failed to load episode navigation list:', error);
				if (!cancelled) {
					setEpisodeNavList([]);
				}
			}
		};
		loadEpisodeNavList();
		return () => {
			cancelled = true;
		};
	}, [item]);

	useEffect(() => {
		setHeaderLogoUnavailable(false);
	}, [item?.Id, item?.SeriesId, item?.Type]);

	// Pick sensible defaults based on the media streams we got back
	const applyDefaultTracks = useCallback((mediaStreams) => {
		if (!mediaStreams) return;
		const defaultAudio = mediaStreams.find(s => s.Type === 'Audio' && s.IsDefault);
		const firstAudio = mediaStreams.find(s => s.Type === 'Audio');
		const defaultSubtitle = mediaStreams.find(s => s.Type === 'Subtitle' && s.IsDefault);

		setSelectedAudioTrack((defaultAudio ?? firstAudio)?.Index ?? null);
		setSelectedSubtitleTrack(defaultSubtitle?.Index ?? -1);
	}, []);

	const loadPlaybackInfo = useCallback(async () => {
		if (!item) return;

		// Don't load playback info for Series - only for playable items
		if (item.Type === 'Series') {
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const info = await jellyfinService.getPlaybackInfo(item.Id);
			setPlaybackInfo(info);
			applyDefaultTracks(info.MediaSources?.[0]?.MediaStreams);
		} catch (error) {
			console.error('Failed to load playback info:', error);
		} finally {
			setLoading(false);
		}
	}, [applyDefaultTracks, item]);

	const loadEpisodes = useCallback(async (seasonId) => {
		if (!item || !seasonId) return;
		try {
			const episodesData = await jellyfinService.getEpisodes(item.Id, seasonId);
			setEpisodes(episodesData);
			if (episodesData.length > 0) {
				setSelectedEpisode(episodesData[0]);
				// Load playback info for first episode
				const info = await jellyfinService.getPlaybackInfo(episodesData[0].Id);
				setPlaybackInfo(info);
				applyDefaultTracks(info.MediaSources?.[0]?.MediaStreams);
			}
		} catch (error) {
			console.error('Failed to load episodes:', error);
		}
	}, [applyDefaultTracks, item]);

	const loadSeasons = useCallback(async () => {
		if (!item) return;
		setLoading(true);
		try {
			const seasonsData = await jellyfinService.getSeasons(item.Id);
			setSeasons(seasonsData);
			if (seasonsData.length > 0) {
				const preferredSeasonId = item?.__initialSeasonId || null;
				const initialSeason = (preferredSeasonId && seasonsData.find(s => s.Id === preferredSeasonId)) || seasonsData[0];
				setSelectedSeason(initialSeason);
				await loadEpisodes(initialSeason.Id);
			}
		} catch (error) {
			console.error('Failed to load seasons:', error);
		} finally {
			setLoading(false);
		}
	}, [item, loadEpisodes]);

	const openSeriesFromEpisode = useCallback(async (seasonId = null) => {
		if (item?.Type !== 'Episode' || !item.SeriesId || !onItemSelect) return false;
		try {
			const series = await jellyfinService.getItem(item.SeriesId);
			if (!series) return false;
			const target = seasonId ? {...series, __initialSeasonId: seasonId} : series;
			onItemSelect(target, item);
			return true;
		} catch (error) {
			console.error('Error opening series from episode details:', error);
			return false;
		}
	}, [item, onItemSelect]);

	const handlePlay = useCallback(() => {
		const mediaSourceId = playbackInfo?.MediaSources?.[0]?.Id || null;
		const options = { mediaSourceId };
		if (Number.isInteger(selectedAudioTrack)) {
			options.audioStreamIndex = selectedAudioTrack;
		}
		if (selectedSubtitleTrack === -1 || Number.isInteger(selectedSubtitleTrack)) {
			options.subtitleStreamIndex = selectedSubtitleTrack;
		}

		// If this is a series, play the selected episode
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

	const handleSeasonClick = useCallback(async (season) => {
		setSelectedSeason(season);
		setEpisodes([]);
		setSelectedEpisode(null);
		await loadEpisodes(season.Id);
	}, [loadEpisodes]);

	// Keep "Back" behavior consistent with other panels; series jump is exposed explicitly.
	const handleBack = useCallback(() => {
		onBack();
	}, [onBack]);

	useEffect(() => {
		loadPlaybackInfo();
		if (item?.Type === 'Series') {
			loadSeasons();
		} else {
			setSeasons([]);
			setEpisodes([]);
			setSelectedSeason(null);
			setSelectedEpisode(null);
		}
		// Initialize favorite and watched status
		if (item?.UserData) {
			setIsFavorite(item.UserData.IsFavorite || false);
			setIsWatched(item.UserData.Played || false);
		}
	}, [item, loadPlaybackInfo, loadSeasons]);

	const handleInternalBack = useCallback(() => {
		if (showEpisodePicker) {
			setShowEpisodePicker(false);
			return true;
		}
		if (showAudioPicker) {
			setShowAudioPicker(false);
			return true;
		}
		if (showSubtitlePicker) {
			setShowSubtitlePicker(false);
			return true;
		}
		handleBack();
		return true;
	}, [handleBack, showAudioPicker, showEpisodePicker, showSubtitlePicker]);

	const handleEpisodeClick = useCallback(async (episode) => {
		setSelectedEpisode(episode);
		// Load playback info for selected episode
		try {
			const info = await jellyfinService.getPlaybackInfo(episode.Id);
			setPlaybackInfo(info);
			applyDefaultTracks(info.MediaSources?.[0]?.MediaStreams);
		} catch (error) {
			console.error('Failed to load episode playback info:', error);
		}
	}, [applyDefaultTracks]);

	const handleToggleFavorite = useCallback(async () => {
		if (!item) return;
		try {
			const newStatus = await jellyfinService.toggleFavorite(item.Id, isFavorite);
			setIsFavorite(newStatus);
			// Refresh user data so UI stays in sync
			const updated = await jellyfinService.getItem(item.Id);
			if (updated?.UserData) {
				setIsWatched(updated.UserData.Played || false);
			}
			setToastMessage(newStatus ? 'Added to favorites' : 'Removed from favorites');
		} catch (error) {
			console.error('Failed to toggle favorite:', error);
			setToastMessage('Failed to update favorite');
		}
	}, [isFavorite, item]);

	const handleToggleWatched = useCallback(async (itemId, currentWatchedState) => {
		// If called with parameters (from episode list), use those
		const targetId = itemId || item?.Id;
		const targetWatchedState = currentWatchedState !== undefined ? currentWatchedState : isWatched;

		if (!targetId) return;
		try {
			await jellyfinService.toggleWatched(targetId, targetWatchedState);

			// If this is the main item, update the state
			if (!itemId || itemId === item?.Id) {
				setIsWatched(!targetWatchedState);
			}

			// If it's an episode, refresh the episode list
			if (itemId && item?.Type === 'Series' && selectedSeason) {
				const updatedEpisodes = await jellyfinService.getSeasonEpisodes(item.Id, selectedSeason.Id);
				setEpisodes(updatedEpisodes);
			} else {
				// Refresh main item user data
				const refreshed = await jellyfinService.getItem(targetId);
				if (refreshed?.UserData && (!itemId || itemId === item?.Id)) {
					setIsWatched(refreshed.UserData.Played || false);
				}
			}
			setToastMessage(!targetWatchedState ? 'Marked as watched' : 'Marked as unwatched');
		} catch (error) {
			console.error('Error toggling watched status:', error);
			setToastMessage('Failed to update watched status');
		}
	}, [isWatched, item, selectedSeason]);

	// Map remote back/play keys when this panel is active
	useEffect(() => {
		if (!isActive) return undefined;

		const handleKeyDown = (e) => {
			const code = e.keyCode || e.which;
			const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
			const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, KeyCodes.PLAY, 179];

			if (BACK_KEYS.includes(code)) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation?.();
				handleInternalBack();
				return;
			}

			if (PLAY_KEYS.includes(code)) {
				// Avoid triggering play when user is interacting with another control
				const target = e.target;
				const interactiveTarget = target?.closest?.(
					'button, input, select, textarea, [role=\"button\"], [role=\"textbox\"], [tabindex], .spottable, [data-spotlight-id]'
				);
				const isInteractive = !!interactiveTarget;
				if (isInteractive) {
					return;
				}
				e.preventDefault();
				handlePlay();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [handleInternalBack, handlePlay, isActive]);

	useEffect(() => {
		if (typeof registerBackHandler !== 'function') return undefined;
		registerBackHandler(handleInternalBack);
		return () => registerBackHandler(null);
	}, [handleInternalBack, registerBackHandler]);

	// Auto-hide toast after a short delay
	useEffect(() => {
		if (!toastMessage) return undefined;
		const t = setTimeout(() => setToastMessage(''), 2000);
		return () => clearTimeout(t);
	}, [toastMessage]);

	const backdropUrl = (() => {
		// Prefer backdrop if available
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 1920);
		}
		// For episodes/series, try series backdrop
		if (item?.SeriesId) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 1920);
		}
		// Fallback to primary image to avoid 404s
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 1920);
		}
		return '';
	})();

	const headerLogoUrl = useMemo(() => {
		if (!item) return '';
		const logoItemId = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
		if (!logoItemId) return '';
		return jellyfinService.getImageUrl(logoItemId, 'Logo', 800) || '';
	}, [item]);

	const useHeaderLogo = Boolean(headerLogoUrl) && !headerLogoUnavailable;
	const handleHeaderLogoError = useCallback(() => {
		setHeaderLogoUnavailable(true);
	}, []);

	const audioTracks = playbackInfo?.MediaSources?.[0]?.MediaStreams
		.filter(s => s.Type === 'Audio')
		.map((track) => ({
			children: `${track.Language || 'Unknown'} - ${track.DisplayTitle || track.Codec}`,
			key: track.Index
		})) || [];

	const subtitleTracks = [
		{ children: 'None', key: -1 },
		...(playbackInfo?.MediaSources?.[0]?.MediaStreams
			.filter(s => s.Type === 'Subtitle')
			.map((track) => ({
				children: `${track.Language || 'Unknown'} - ${track.DisplayTitle || 'Subtitle'}`,
				key: track.Index
			})) || [])
	];

	const cast = item?.People?.filter(p => p.Type === 'Actor') || [];
	const directors = (item?.People || []).filter(p => p.Type === 'Director');
	const writers = (item?.People || []).filter(p => p.Type === 'Writer');
	const focusSeasonWatchedButton = (seasonCard) => {
		const watchedTarget = seasonCard?.querySelector(
			`.${css.seasonWatchedButton} .spottable, .${css.seasonWatchedButton} [tabindex], .${css.seasonWatchedButton} button`
		);
		if (watchedTarget?.focus) watchedTarget.focus();
	};

	const scrollCastIntoView = useCallback((element) => {
		if (!element || !castScrollerRef.current) return;
		const scroller = castScrollerRef.current;
		scrollElementIntoHorizontalView(scroller, element, {minBuffer: 60, edgeRatio: 0.10});
	}, []);

	const scrollSeasonIntoView = useCallback((element) => {
		if (!element || !seasonScrollerRef.current) return;
		const scroller = seasonScrollerRef.current;
		scrollElementIntoHorizontalView(scroller, element, {minBuffer: 60, edgeRatio: 0.10});
	}, []);

	const focusSeasonCardByIndex = (index) => {
		const cards = Array.from(seasonScrollerRef.current?.querySelectorAll(`.${css.seasonCard}`) || []);
		if (index >= 0 && index < cards.length) {
			cards[index].focus();
			return true;
		}
		return false;
	};

	const getDetailsScrollElement = useCallback(() => {
		const container = detailsContainerRef.current;
		if (!container) return null;
		const contentNode = container.closest?.('[id$="_content"]');
		if (contentNode && typeof contentNode.scrollTop === 'number') return contentNode;
		return container.closest?.('[data-webos-voice-intent="Scroll"]') || null;
	}, []);

	const alignElementBelowPanelHeader = useCallback((element, behavior = 'smooth') => {
		const scrollEl = getDetailsScrollElement();
		if (!scrollEl || !element) return;
		const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
		const panelHeaderOffset = 9 * rootFontSize;
		const visualBuffer = 16;
		const desiredTop = scrollEl.getBoundingClientRect().top + panelHeaderOffset + visualBuffer;
		const elementTop = element.getBoundingClientRect().top;
		const delta = elementTop - desiredTop;
		if (Math.abs(delta) < 2) return;
		const nextTop = Math.max(0, scrollEl.scrollTop + delta);
		scrollEl.scrollTo({top: nextTop, behavior});
	}, [getDetailsScrollElement]);

	const focusTopHeaderAction = useCallback(() => {
		const favoriteTarget = document.querySelector('[data-spotlight-id="details-favorite-action"]') ||
			favoriteActionButtonRef.current?.nodeRef?.current ||
			favoriteActionButtonRef.current;
		const watchedTarget = document.querySelector('[data-spotlight-id="details-watched-action"]') ||
			watchedActionButtonRef.current?.nodeRef?.current ||
			watchedActionButtonRef.current;
		const primaryTarget = favoriteTarget || watchedTarget;

		if (primaryTarget?.focus) {
			primaryTarget.focus({preventScroll: true});
		}
		if (typeof detailsScrollToRef.current === 'function') {
			detailsScrollToRef.current({align: 'top', animate: true});
		}
		alignElementBelowPanelHeader(primaryTarget, 'smooth');
		window.requestAnimationFrame(() => {
			alignElementBelowPanelHeader(primaryTarget, 'auto');
		});
		if (favoriteTarget?.focus) {
			favoriteTarget.focus({preventScroll: true});
			return true;
		}
		if (Spotlight?.focus?.('details-favorite-action')) return true;
		if (favoriteTarget?.focus) {
			favoriteTarget.focus({preventScroll: true});
			return true;
		}
		if (watchedTarget?.focus) {
			watchedTarget.focus({preventScroll: true});
			return true;
		}
		if (Spotlight?.focus?.('details-watched-action')) return true;
		return false;
	}, [alignElementBelowPanelHeader]);

	const focusEpisodeCardByIndex = useCallback((index) => {
		const cards = Array.from(episodesListRef.current?.querySelectorAll(`.${css.episodeCard}`) || []);
		if (index >= 0 && index < cards.length) {
			cards[index].focus();
		}
	}, []);

	const focusEpisodeSelector = useCallback(() => {
		if (Spotlight?.focus?.('episode-selector-button')) return true;
		const spotlightTarget = document.querySelector('[data-spotlight-id="episode-selector-button"]');
		if (spotlightTarget?.focus) {
			spotlightTarget.focus({preventScroll: true});
			return true;
		}
		const selector = episodeSelectorButtonRef.current?.nodeRef?.current || episodeSelectorButtonRef.current;
		if (selector?.focus) {
			selector.focus({preventScroll: true});
			return true;
		}
		return false;
	}, []);

	const focusBelowSeasons = useCallback(() => {
		if (focusEpisodeSelector()) return;
		focusEpisodeCardByIndex(0);
	}, [focusEpisodeCardByIndex, focusEpisodeSelector]);

	const getAudioLabel = () => {
		const track = audioTracks.find(t => t.key === selectedAudioTrack);
		return track?.children || 'Default';
	};

	const getSubtitleLabel = () => {
		if (selectedSubtitleTrack === -1) return 'None';
		const track = subtitleTracks.find(t => t.key === selectedSubtitleTrack);
		return track?.children || 'Default';
	};

	const renderToast = () => {
		if (!toastMessage) return null;
		return (
			<div className={css.toast} role="status">
				{toastMessage}
			</div>
		);
	};

	const getSeasonImageUrl = (season) => {
		if (season?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(season.Id, 'Primary', 500);
		}
		if (season?.ImageTags?.Thumb) {
			return jellyfinService.getImageUrl(season.Id, 'Thumb', 500);
		}
		// Fallback to series backdrop if available
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 800);
		}
		// Fallback to series primary
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 500);
		}
		return '';
	};

	const closeAudioPicker = useCallback(() => {
		setShowAudioPicker(false);
	}, []);

	const openAudioPicker = useCallback(() => {
		setShowAudioPicker(true);
	}, []);

	const closeSubtitlePicker = useCallback(() => {
		setShowSubtitlePicker(false);
	}, []);

	const openSubtitlePicker = useCallback(() => {
		setShowSubtitlePicker(true);
	}, []);

	const closeEpisodePicker = useCallback(() => {
		setShowEpisodePicker(false);
	}, []);

	const openEpisodePicker = useCallback(() => {
		setShowEpisodePicker(true);
	}, []);

	const captureDetailsScrollTo = useCallback((fn) => {
		detailsScrollToRef.current = fn;
	}, []);

	const handleOpenEpisodeSeries = useCallback(() => {
		openSeriesFromEpisode(item?.SeasonId || null);
	}, [item?.SeasonId, openSeriesFromEpisode]);

	const handleToggleWatchedMain = useCallback(() => {
		handleToggleWatched();
	}, [handleToggleWatched]);

	const handleTrackSelect = useCallback((event) => {
		const trackKey = Number(event.currentTarget.dataset.trackKey);
		if (!Number.isFinite(trackKey)) return;
		if (event.currentTarget.dataset.trackType === 'audio') {
			setSelectedAudioTrack(trackKey);
			closeAudioPicker();
		} else {
			setSelectedSubtitleTrack(trackKey);
			closeSubtitlePicker();
		}
	}, [closeAudioPicker, closeSubtitlePicker]);

	const handleEpisodePopupSelect = useCallback((event) => {
		const episodeId = event.currentTarget.dataset.episodeId;
		const episode = popupEpisodesById.get(episodeId);
		if (!episode) return;
		const isSeriesMode = event.currentTarget.dataset.seriesMode === '1';
		if (isSeriesMode) {
			handleEpisodeClick(episode);
		} else if (onItemSelect) {
			onItemSelect(episode, item);
		}
		setShowEpisodePicker(false);
	}, [handleEpisodeClick, item, onItemSelect, popupEpisodesById]);

	const handleCastCardFocus = useCallback((e) => {
		scrollCastIntoView(e.currentTarget);
	}, [scrollCastIntoView]);

	const handleCastCardKeyDown = useCallback((e) => {
		const cards = Array.from(castRowRef.current?.querySelectorAll(`.${css.castCard}`) || []);
		const idx = cards.indexOf(e.currentTarget);
		if (e.keyCode === KeyCodes.LEFT && idx > 0) {
			e.preventDefault();
			cards[idx - 1].focus();
		} else if (e.keyCode === KeyCodes.RIGHT && idx < cards.length - 1) {
			e.preventDefault();
			cards[idx + 1].focus();
		}
	}, []);

	const handleCastImageError = useCallback((e) => {
		e.target.style.display = 'none';
	}, []);

	const handleSeasonCardClick = useCallback((e) => {
		const seasonId = e.currentTarget.dataset.seasonId;
		const season = seasonsById.get(seasonId);
		if (!season) return;
		handleSeasonClick(season);
	}, [handleSeasonClick, seasonsById]);

	const handleSeasonCardFocus = useCallback((e) => {
		scrollSeasonIntoView(e.currentTarget);
	}, [scrollSeasonIntoView]);

	const handleSeasonCardKeyDown = useCallback((e) => {
		const cards = Array.from(seasonScrollerRef.current?.querySelectorAll(`.${css.seasonCard}`) || []);
		const currentIndex = cards.indexOf(e.currentTarget);
		const seasonId = e.currentTarget.dataset.seasonId;
		const season = seasonsById.get(seasonId);
		if (e.keyCode === KeyCodes.ENTER || e.keyCode === KeyCodes.OK) {
			e.preventDefault();
			e.stopPropagation();
			if (season) {
				handleSeasonClick(season);
			}
		} else if (e.keyCode === KeyCodes.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			focusSeasonCardByIndex(currentIndex - 1);
		} else if (e.keyCode === KeyCodes.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			focusSeasonCardByIndex(currentIndex + 1);
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			focusSeasonWatchedButton(e.currentTarget);
		} else if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			focusBelowSeasons();
		}
	}, [focusBelowSeasons, handleSeasonClick, seasonsById]);

	const handleSeasonWatchedToggleClick = useCallback((e) => {
		e.stopPropagation();
		const seasonId = e.currentTarget.dataset.seasonId;
		const season = seasonsById.get(seasonId);
		if (!season) return;
		handleToggleWatched(season.Id, season.UserData?.Played);
	}, [handleToggleWatched, seasonsById]);

	const handleSeasonWatchedButtonKeyDown = useCallback((e) => {
		if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			const card = e.currentTarget.closest(`.${css.seasonCard}`);
			if (card?.focus) card.focus();
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (!focusTopHeaderAction()) {
				const card = e.currentTarget.closest(`.${css.seasonCard}`);
				if (card?.focus) card.focus();
			}
		}
	}, [focusTopHeaderAction]);

	const handleSeasonImageError = useCallback((e) => {
		if (item?.ImageTags?.Primary) {
			e.target.src = jellyfinService.getImageUrl(item.Id, 'Primary', 500);
		} else {
			e.target.style.display = 'none';
		}
	}, [item]);

	const handleEpisodeSelectorKeyDown = useCallback((e) => {
		if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			focusEpisodeCardByIndex(0);
		}
	}, [focusEpisodeCardByIndex]);

	const handleEpisodeCardClick = useCallback((e) => {
		const episodeId = e.currentTarget.dataset.episodeId;
		const episode = episodesById.get(episodeId);
		if (!episode) return;
		handleEpisodeClick(episode);
	}, [episodesById, handleEpisodeClick]);

	const handleEpisodeCardKeyDown = useCallback((e) => {
		const index = Number(e.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			focusEpisodeCardByIndex(index + 1);
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (index === 0) {
				focusEpisodeSelector();
				return;
			}
			focusEpisodeCardByIndex(index - 1);
		}
	}, [focusEpisodeCardByIndex, focusEpisodeSelector]);

	const renderTrackPopup = (type) => {
		const isAudio = type === 'audio';
		const tracks = isAudio ? audioTracks : subtitleTracks;
		const selectedKey = isAudio ? selectedAudioTrack : selectedSubtitleTrack;

		return (
			<Popup
				open={isAudio ? showAudioPicker : showSubtitlePicker}
				onClose={isAudio ? closeAudioPicker : closeSubtitlePicker}
				noAutoDismiss
			>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					Select {isAudio ? 'Audio' : 'Subtitle'} Track
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>
							{tracks.map(track => (
								<Button
									key={track.key}
									data-track-key={track.key}
									data-track-type={type}
									size="large"
									selected={track.key === selectedKey}
									onClick={handleTrackSelect}
									className={css.popupButton}
								>
								{track.children}
							</Button>
						))}
					</div>
				</Scroller>
			</Popup>
		);
	};

	const renderEpisodePopup = () => {
		const isSeriesMode = item.Type === 'Series';
		const popupEpisodes = isSeriesMode ? episodes : episodeNavList;
		if (!popupEpisodes?.length) return null;
		return (
			<Popup open={showEpisodePicker} onClose={closeEpisodePicker} noAutoDismiss>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					Select Episode
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>
							{popupEpisodes.map(ep => (
								<Button
									key={ep.Id}
									data-episode-id={ep.Id}
									data-series-mode={isSeriesMode ? '1' : '0'}
									size="large"
									selected={isSeriesMode ? selectedEpisode?.Id === ep.Id : item?.Id === ep.Id}
									onClick={handleEpisodePopupSelect}
									className={css.popupButton}
								>
								Episode {ep.IndexNumber}: {ep.Name}
							</Button>
						))}
					</div>
				</Scroller>
			</Popup>
		);
	};

	if (!item) return null;

	return (
		<Panel {...rest}>
			<Header title={useHeaderLogo ? '' : (item?.Name || 'Details')}>
				{useHeaderLogo && (
					<slotBefore>
						<div className={css.headerLogoWrap}>
							<img
								src={headerLogoUrl}
								alt={item?.Name || 'Details'}
								className={css.headerLogo}
								onError={handleHeaderLogoError}
							/>
						</div>
					</slotBefore>
				)}
			</Header>
			{renderToast()}
			{!loading && (
				<div className={css.backdrop}>
					<img src={backdropUrl} alt={item.Name} />
					<div className={css.gradient} />
				</div>
			)}
				<Scroller
					className={css.scroller}
					cbScrollTo={captureDetailsScrollTo}
				>
				<div className={css.detailsContainer} ref={detailsContainerRef}>
					{loading ? (
						<div className={css.loading}>
							<Spinner />
						</div>
					) : (
						<>
							<div className={css.content}>
								<div className={css.header}>
									<Heading size="large" className={css.title}>
										{item.Name}
									</Heading>

									{item.Type === 'Episode' && (
										<div className={css.episodeInfo}>
											<div className={css.episodeNavActions}>
												<Button
													size="small"
													className={css.episodeNavButton}
													onClick={handleOpenEpisodeSeries}
												>
													{item.SeriesName}
												</Button>
												{item.ParentIndexNumber !== undefined && item.ParentIndexNumber !== null && (
													<Button
														size="small"
														className={css.episodeNavButton}
														onClick={handleOpenEpisodeSeries}
													>
														Season {item.ParentIndexNumber}
													</Button>
												)}
												<Button
													size="small"
													className={css.episodeNavButton}
													onClick={openEpisodePicker}
												>
													Episode {item.IndexNumber}
												</Button>
											</div>
										</div>
									)}

									<div className={css.metadata}>
										{item.ProductionYear && (
											<div className={css.metadataItem}>{item.ProductionYear}</div>
										)}
										{item.OfficialRating && (
											<div className={css.metadataItem}>{item.OfficialRating}</div>
										)}
										{item.CommunityRating && (
											<div className={css.metadataItem}>
												<Icon size="small">star</Icon> {item.CommunityRating.toFixed(1)}
											</div>
										)}
										{item.RunTimeTicks && (
											<div className={css.metadataItem}>
												{Math.floor(item.RunTimeTicks / 600000000)} min
											</div>
										)}
										<div className={css.actionsRow}>
											<Button
												size="small"
												icon={isFavorite ? 'heart' : 'hearthollow'}
												onClick={handleToggleFavorite}
												componentRef={favoriteActionButtonRef}
												spotlightId="details-favorite-action"
												className={`${css.actionButton} ${isFavorite ? css.activeAction : ''}`}
											/>
												<Button
													size="small"
													icon="check"
													selected={isWatched}
													onClick={handleToggleWatchedMain}
													componentRef={watchedActionButtonRef}
													spotlightId="details-watched-action"
													className={`${css.actionButton} ${isWatched ? css.activeAction : ''}`}
											/>
										</div>
									</div>
									{item.Genres && item.Genres.length > 0 && (
										<div className={css.metadataItem}>
											{item.Genres.join(', ')}
										</div>
									)}
									{item.Overview && (
										<BodyText className={css.overview}>
											{item.Overview}
										</BodyText>
									)}
								</div>

								{(directors.length > 0 || writers.length > 0 || cast.length > 0) && (
									<div className={css.richMeta}>
										{directors.length > 0 && (
											<div className={css.metaGroup}>
												<BodyText className={css.metaLabel}>Director</BodyText>
												<BodyText className={css.metaValue}>{directors.map(d => d.Name).join(', ')}</BodyText>
											</div>
										)}
										{writers.length > 0 && (
											<div className={css.metaGroup}>
												<BodyText className={css.metaLabel}>Writer</BodyText>
												<BodyText className={css.metaValue}>{writers.map(w => w.Name).join(', ')}</BodyText>
											</div>
										)}
									</div>
								)}

								{cast.length > 0 && (
									<div className={css.castSection}>
										<Heading size="medium" className={css.sectionHeading}>Cast</Heading>
										<div className={css.castScroller} ref={castScrollerRef}>
											<div className={css.castRow} ref={castRowRef}>
													{cast.map(person => (
														<div
															key={person.Id}
															className={css.castCard}
															tabIndex={0}
															onFocus={handleCastCardFocus}
															onKeyDown={handleCastCardKeyDown}
														>
														<div className={css.castAvatar}>
															{person.PrimaryImageTag ? (
																	<img
																		src={jellyfinService.getImageUrl(person.Id, 'Primary', 240)}
																		alt={person.Name}
																		onError={handleCastImageError}
																	/>
															) : (
																<div className={css.castInitial}>{person.Name?.charAt(0) || '?'}</div>
															)}
														</div>
														<BodyText className={css.castName}>{person.Name}</BodyText>
														{person.Role && (
															<BodyText className={css.castRole}>{person.Role}</BodyText>
														)}
													</div>
												))}
											</div>
										</div>
									</div>
								)}
										{item.Type === 'Series' && seasons.length > 0 && (
											<div className={css.seriesContent}>
											<div className={css.seasonsSection}>
												<Heading size="medium" className={css.sectionHeading}>Seasons</Heading>
												<div className={css.seasonCards} ref={seasonScrollerRef}>
													{seasons.map(season => (
														<SpottableDiv
															key={season.Id}
															data-season-id={season.Id}
															className={`${css.seasonCard} ${selectedSeason?.Id === season.Id ? css.selected : ''}`}
															onClick={handleSeasonCardClick}
															onFocus={handleSeasonCardFocus}
															onKeyDown={handleSeasonCardKeyDown}
														>
														<div
															className={css.seasonWatchedButton}
															data-season-id={season.Id}
															onClick={handleSeasonWatchedToggleClick}
														>
															<Button
																size="small"
																icon="check"
																selected={season.UserData?.Played}
																backgroundOpacity="transparent"
																onKeyDown={handleSeasonWatchedButtonKeyDown}
															/>
														</div>
															<img
																src={getSeasonImageUrl(season)}
																alt={season.Name}
																className={css.seasonPoster}
																onError={handleSeasonImageError}
															/>
														<BodyText className={css.seasonName}>{season.Name}</BodyText>
														{season.ChildCount && (
															<BodyText className={css.episodeCount}>{season.ChildCount} Episodes</BodyText>
														)}
													</SpottableDiv>
												))}
											</div>
										</div>

										{episodes.length > 0 && selectedEpisode && (
											<div className={css.stickyControls}>
												<div className={css.controlsTitle}>
														<Button
															size="large"
															onClick={openEpisodePicker}
															className={css.dropdown}
															componentRef={episodeSelectorButtonRef}
															spotlightId="episode-selector-button"
															onKeyDown={handleEpisodeSelectorKeyDown}
														>
														Episode {selectedEpisode.IndexNumber}: {selectedEpisode.Name}
													</Button>
												</div>

												<div className={css.trackSelectors}>
													{audioTracks.length > 0 && (
														<div className={css.trackSection}>
															<BodyText className={css.trackLabel}>Audio Track</BodyText>
																<Button
																	size="large"
																	onClick={openAudioPicker}
																	className={css.dropdown}
																>
																{getAudioLabel()}
															</Button>
														</div>
													)}

													{subtitleTracks.length > 1 && (
														<div className={css.trackSection}>
															<BodyText className={css.trackLabel}>Subtitle Track</BodyText>
																<Button
																	size="large"
																	onClick={openSubtitlePicker}
																	className={css.dropdown}
																>
																{getSubtitleLabel()}
															</Button>
														</div>
													)}
												</div>

													<Button
														size="small"
														icon="play"
														className={css.primaryButton}
														onClick={handlePlay}
													>
														Play
													</Button>
											</div>
										)}

										{episodes.length > 0 && (
											<div className={css.episodesSection}>
												<Heading size="medium" className={css.sectionHeading}>Episodes</Heading>
												<div className={css.episodeCards} ref={episodesListRef}>
														{episodes.map((episode, index) => (
															<SpottableDiv
																key={episode.Id}
																data-episode-id={episode.Id}
																data-episode-index={index}
																className={`${css.episodeCard} ${selectedEpisode?.Id === episode.Id ? css.selected : ''}`}
																onClick={handleEpisodeCardClick}
																onKeyDown={handleEpisodeCardKeyDown}
															>
															<div className={css.episodeImageContainer}>
																<img
																	src={jellyfinService.getImageUrl(episode.Id, 'Primary', 400)}
																	alt={episode.Name}
																	className={css.episodeImage}
																/>
															</div>
															<div className={css.episodeInfo}>
																<BodyText className={css.episodeNumber}>Episode {episode.IndexNumber}</BodyText>
																<BodyText className={css.episodeName}>{episode.Name}</BodyText>
																{episode.Overview && (
																	<BodyText className={css.episodeOverview}>{episode.Overview}</BodyText>
																)}
																{episode.RunTimeTicks && (
																	<BodyText className={css.runtime}>
																		{Math.floor(episode.RunTimeTicks / 600000000)} min
																	</BodyText>
																)}
															</div>
														</SpottableDiv>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{item.Type !== 'Series' && (
									<>
										<div className={`${css.trackSelectors} ${css.movieTracks}`}>
											{audioTracks.length > 0 && (
												<div className={css.trackSection}>
													<BodyText className={css.trackLabel}>Audio Track</BodyText>
														<Button
															size="large"
															onClick={openAudioPicker}
															className={css.dropdown}
														>
														{getAudioLabel()}
													</Button>
												</div>
											)}

											{subtitleTracks.length > 1 && (
												<div className={css.trackSection}>
													<BodyText className={css.trackLabel}>Subtitle Track</BodyText>
														<Button
															size="large"
															onClick={openSubtitlePicker}
															className={css.dropdown}
														>
														{getSubtitleLabel()}
													</Button>
												</div>
											)}
										</div>

										<div className={css.buttons}>
											<Button
												size="small"
												icon="play"
												className={css.primaryButton}
												onClick={handlePlay}
											>
												Play
											</Button>
										</div>
										</>
								)}

							</div>
						</>
					)}
				</div>
			</Scroller>
			{renderTrackPopup('audio')}
			{renderTrackPopup('subtitle')}
			{renderEpisodePopup()}
		</Panel>
	);
};

export default MediaDetailsPanel;
