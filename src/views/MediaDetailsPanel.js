import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Panel } from '../components/BreezyPanels';
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
import popupStyles from '../styles/popupStyles.module.less';
import {popupShellCss} from '../styles/popupStyles';

const SpottableDiv = Spottable('div');

const LANGUAGE_NAME_MAP = {
	eng: 'English',
	en: 'English',
	spa: 'Spanish',
	es: 'Spanish',
	fra: 'French',
	fr: 'French',
	deu: 'German',
	de: 'German',
	ita: 'Italian',
	it: 'Italian',
	jpn: 'Japanese',
	ja: 'Japanese',
	kor: 'Korean',
	ko: 'Korean',
	por: 'Portuguese',
	pt: 'Portuguese',
	rus: 'Russian',
	ru: 'Russian',
	ara: 'Arabic',
	ar: 'Arabic',
	zho: 'Chinese',
	zh: 'Chinese'
};

const toLanguageDisplayName = (language) => {
	if (!language) return 'Unknown';
	const normalized = String(language).trim().toLowerCase();
	if (!normalized) return 'Unknown';
	if (LANGUAGE_NAME_MAP[normalized]) return LANGUAGE_NAME_MAP[normalized];
	if (normalized.length === 2 || normalized.length === 3) {
		return normalized.toUpperCase();
	}
	return String(language);
};

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
	const [detailMetadata, setDetailMetadata] = useState(null);
	const [isFavorite, setIsFavorite] = useState(false);
	const [isWatched, setIsWatched] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [toastVisible, setToastVisible] = useState(false);
	const castRowRef = useRef(null);
	const castScrollerRef = useRef(null);
	const seasonScrollerRef = useRef(null);
	const episodesListRef = useRef(null);
	const episodeSelectorButtonRef = useRef(null);
	const detailsContainerRef = useRef(null);
	const detailsScrollToRef = useRef(null);
	const favoriteActionButtonRef = useRef(null);
	const watchedActionButtonRef = useRef(null);
	const audioSelectorButtonRef = useRef(null);
	const subtitleSelectorButtonRef = useRef(null);
	const playPrimaryButtonRef = useRef(null);
	const debugLastScrollTopRef = useRef(null);
	const debugLastScrollTimeRef = useRef(0);
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
	// Opt-in debug tracing for focus/scroll issues. Enable via `?bfFocusDebug=1`
	// or `localStorage.setItem('breezyfinFocusDebug', '1')`.
	const detailsDebugEnabled = useMemo(() => {
		if (typeof window === 'undefined') return false;
		try {
			const params = new URLSearchParams(window.location.search);
			if (params.get('bfFocusDebug') === '1') return true;
			return localStorage.getItem('breezyfinFocusDebug') === '1';
		} catch (_) {
			return false;
		}
	}, []);
	const describeNode = useCallback((node) => {
		if (!node || typeof node !== 'object') return '(none)';
		const element = node;
		const tag = element.tagName ? element.tagName.toLowerCase() : 'node';
		const idPart = element.id ? `#${element.id}` : '';
		const className = typeof element.className === 'string' ? element.className.trim() : '';
		const classPart = className ? `.${className.split(/\s+/).slice(0, 2).join('.')}` : '';
		const spotlightId = element.getAttribute?.('data-spotlight-id');
		const role = element.getAttribute?.('role');
		const spotlightPart = spotlightId ? ` [spotlight=${spotlightId}]` : '';
		const rolePart = role ? ` [role=${role}]` : '';
		return `${tag}${idPart}${classPart}${spotlightPart}${rolePart}`;
	}, []);
	const logDetailsDebug = useCallback((message, payload = null) => {
		if (!detailsDebugEnabled) return;
		if (payload) {
			console.log('[MediaDetailsFocusDebug]', message, payload);
			return;
		}
		console.log('[MediaDetailsFocusDebug]', message);
	}, [detailsDebugEnabled]);
	const focusNodeWithoutScroll = useCallback((node) => {
		if (!node?.focus) return;
		try {
			node.focus({preventScroll: true});
		} catch (error) {
			node.focus();
		}
	}, []);
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

	useEffect(() => {
		let cancelled = false;

		const loadDetailMetadata = async () => {
			if (!item?.Id) {
				setDetailMetadata(null);
				return;
			}
			try {
				const detailed = await jellyfinService.getItem(item.Id);
				if (!cancelled) {
					setDetailMetadata(detailed || null);
				}
			} catch (error) {
				console.error('Failed to load item metadata:', error);
				if (!cancelled) {
					setDetailMetadata(null);
				}
			}
		};

		loadDetailMetadata();
		return () => {
			cancelled = true;
		};
	}, [item?.Id]);

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
			const isBack = BACK_KEYS.includes(code);
			const isPlay = PLAY_KEYS.includes(code);

			if ((isBack || isPlay) && detailsDebugEnabled) {
				logDetailsDebug('keydown', {
					code,
					isBack,
					isPlay,
					target: describeNode(e.target),
					active: describeNode(document.activeElement),
					pointerMode: Spotlight?.getPointerMode?.(),
					scroll: getScrollSnapshot()
				});
			}

			if (isBack) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation?.();
				handleInternalBack();
				return;
			}

			if (isPlay) {
				// In pointer mode, let native click/spotlight handling route ENTER/OK.
				if (Spotlight?.getPointerMode?.()) {
					logDetailsDebug('play-key-skipped-pointer-mode', {
						target: describeNode(e.target),
						active: describeNode(document.activeElement),
						scroll: getScrollSnapshot()
					});
					return;
				}

				// Avoid triggering play when user is interacting with another control
				const target = e.target;
				const interactiveTarget = target?.closest?.(
					'button, input, select, textarea, [role=\"button\"], [role=\"textbox\"], [tabindex], .spottable, [data-spotlight-id]'
				);
				const isInteractive = !!interactiveTarget;
				if (isInteractive) {
					logDetailsDebug('play-key-ignored-interactive-target', {
						target: describeNode(target),
						interactiveTarget: describeNode(interactiveTarget),
						active: describeNode(document.activeElement)
					});
					return;
				}
				e.preventDefault();
				logDetailsDebug('play-key-trigger-handlePlay', {
					target: describeNode(target),
					active: describeNode(document.activeElement),
					scroll: getScrollSnapshot()
				});
				handlePlay();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [describeNode, detailsDebugEnabled, getScrollSnapshot, handleInternalBack, handlePlay, isActive, logDetailsDebug]);

	useEffect(() => {
		if (typeof registerBackHandler !== 'function') return undefined;
		registerBackHandler(handleInternalBack);
		return () => registerBackHandler(null);
	}, [handleInternalBack, registerBackHandler]);

	// Auto-hide toast after a short delay with a fade-out phase
	useEffect(() => {
		if (!toastMessage) {
			setToastVisible(false);
			return undefined;
		}
		setToastVisible(false);
		const frame = window.requestAnimationFrame(() => setToastVisible(true));
		const hideTimer = setTimeout(() => setToastVisible(false), 1700);
		const clearTimer = setTimeout(() => setToastMessage(''), 2050);
		return () => {
			window.cancelAnimationFrame(frame);
			clearTimeout(hideTimer);
			clearTimeout(clearTimer);
		};
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
	const hasBackdropImage = Boolean(backdropUrl);

	const headerLogoUrl = useMemo(() => {
		if (!item) return '';
		const logoItemId = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
		if (!logoItemId) return '';
		return jellyfinService.getImageUrl(logoItemId, 'Logo', 1600) || '';
	}, [item]);

	const useHeaderLogo = Boolean(headerLogoUrl) && !headerLogoUnavailable;
	const headerTitle = useHeaderLogo ? undefined : (item?.Name || 'Details');
	const handleHeaderLogoError = useCallback(() => {
		setHeaderLogoUnavailable(true);
	}, []);

	const audioTracks = playbackInfo?.MediaSources?.[0]?.MediaStreams
		.filter(s => s.Type === 'Audio')
		.map((track) => ({
			children: `${toLanguageDisplayName(track.Language)} - ${track.DisplayTitle || track.Codec}`,
			summary: toLanguageDisplayName(track.Language),
			key: track.Index
		})) || [];

	const subtitleTracks = [
		{ children: 'None', summary: 'None', key: -1 },
		...(playbackInfo?.MediaSources?.[0]?.MediaStreams
			.filter(s => s.Type === 'Subtitle')
			.map((track) => ({
				children: `${toLanguageDisplayName(track.Language)} - ${track.DisplayTitle || 'Subtitle'}`,
				summary: toLanguageDisplayName(track.Language),
				key: track.Index
			})) || [])
	];

	const people = detailMetadata?.People || item?.People || [];
	const cast = people.filter(p => p.Type === 'Actor');
	const directors = people.filter(p => p.Type === 'Director');
	const writers = people.filter(p => p.Type === 'Writer');
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

	useEffect(() => {
		if (!isActive || !detailsDebugEnabled) return undefined;

		const handleFocusIn = (event) => {
			logDetailsDebug('focusin', {
				target: describeNode(event.target),
				active: describeNode(document.activeElement),
				pointerMode: Spotlight?.getPointerMode?.(),
				scroll: getScrollSnapshot()
			});
		};

		const scrollEl = getDetailsScrollElement();
		if (scrollEl) {
			debugLastScrollTopRef.current = scrollEl.scrollTop;
		}

		const handleScroll = () => {
			if (!scrollEl) return;
			const top = scrollEl.scrollTop;
			const previous = debugLastScrollTopRef.current;
			if (previous !== null && Math.abs(top - previous) < 4) return;
			const now = Date.now();
			if (now - debugLastScrollTimeRef.current < 80) return;
			debugLastScrollTimeRef.current = now;
			debugLastScrollTopRef.current = top;
			logDetailsDebug('scroll', {
				top,
				clientHeight: scrollEl.clientHeight,
				scrollHeight: scrollEl.scrollHeight,
				active: describeNode(document.activeElement)
			});
		};

		document.addEventListener('focusin', handleFocusIn, true);
		scrollEl?.addEventListener('scroll', handleScroll, {passive: true});
		logDetailsDebug('debug-attached', {
			itemId: item?.Id,
			itemType: item?.Type,
			pointerMode: Spotlight?.getPointerMode?.(),
			active: describeNode(document.activeElement),
			scroll: getScrollSnapshot()
		});

		return () => {
			document.removeEventListener('focusin', handleFocusIn, true);
			scrollEl?.removeEventListener('scroll', handleScroll);
			logDetailsDebug('debug-detached', {itemId: item?.Id});
		};
	}, [
		describeNode,
		detailsDebugEnabled,
		getDetailsScrollElement,
		getScrollSnapshot,
		isActive,
		item?.Id,
		item?.Type,
		logDetailsDebug
	]);

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

	const focusEpisodeInfoButtonByIndex = useCallback((index) => {
		const cards = Array.from(episodesListRef.current?.querySelectorAll(`.${css.episodeCard}`) || []);
		if (index < 0 || index >= cards.length) return false;
		const infoButton = cards[index].querySelector(`.${css.episodeInfoButton}`);
		if (infoButton?.focus) {
			infoButton.focus();
			return true;
		}
		return false;
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

	const focusNonSeriesAudioSelector = useCallback(() => {
		const target = audioSelectorButtonRef.current?.nodeRef?.current || audioSelectorButtonRef.current;
		if (target?.focus) {
			target.focus({preventScroll: true});
			return true;
		}
		return false;
	}, []);

	const focusNonSeriesSubtitleSelector = useCallback(() => {
		const target = subtitleSelectorButtonRef.current?.nodeRef?.current || subtitleSelectorButtonRef.current;
		if (target?.focus) {
			target.focus({preventScroll: true});
			return true;
		}
		return false;
	}, []);

	const focusNonSeriesPrimaryPlay = useCallback(() => {
		const target = playPrimaryButtonRef.current?.nodeRef?.current || playPrimaryButtonRef.current;
		if (target?.focus) {
			focusNodeWithoutScroll(target);
			return true;
		}
		return false;
	}, [focusNodeWithoutScroll]);

	const focusHeaderActionNoScroll = useCallback(() => {
		const favoriteTarget = document.querySelector('[data-spotlight-id="details-favorite-action"]') ||
			favoriteActionButtonRef.current?.nodeRef?.current ||
			favoriteActionButtonRef.current;
		const watchedTarget = document.querySelector('[data-spotlight-id="details-watched-action"]') ||
			watchedActionButtonRef.current?.nodeRef?.current ||
			watchedActionButtonRef.current;

		if (favoriteTarget?.focus) {
			focusNodeWithoutScroll(favoriteTarget);
			return true;
		}
		if (watchedTarget?.focus) {
			focusNodeWithoutScroll(watchedTarget);
			return true;
		}
		return false;
	}, [focusNodeWithoutScroll]);

	const focusInitialDetailsControl = useCallback(() => {
		const container = detailsContainerRef.current;
		const activeElement = document.activeElement;
		if (container && activeElement && container.contains(activeElement)) {
			logDetailsDebug('focus-seed-skip-already-inside', {
				active: describeNode(activeElement),
				scroll: getScrollSnapshot()
			});
			return true;
		}

		if (item?.Type === 'Series') {
			if (focusHeaderActionNoScroll()) {
				logDetailsDebug('focus-seed-series-header-action', {
					active: describeNode(document.activeElement),
					scroll: getScrollSnapshot()
				});
				return true;
			}
			if (focusEpisodeSelector()) {
				logDetailsDebug('focus-seed-series-episode-selector', {
					active: describeNode(document.activeElement),
					scroll: getScrollSnapshot()
				});
				return true;
			}
			focusEpisodeCardByIndex(0);
			logDetailsDebug('focus-seed-series-first-episode-card', {
				active: describeNode(document.activeElement),
				scroll: getScrollSnapshot()
			});
			return true;
		}

		if (focusNonSeriesPrimaryPlay()) {
			logDetailsDebug('focus-seed-primary-play', {
				active: describeNode(document.activeElement),
				scroll: getScrollSnapshot()
			});
			return true;
		}
		if (focusNonSeriesAudioSelector()) {
			logDetailsDebug('focus-seed-audio-selector', {
				active: describeNode(document.activeElement),
				scroll: getScrollSnapshot()
			});
			return true;
		}
		const subtitleFocused = focusNonSeriesSubtitleSelector();
		logDetailsDebug('focus-seed-subtitle-selector', {
			focused: subtitleFocused,
			active: describeNode(document.activeElement),
			scroll: getScrollSnapshot()
		});
		return subtitleFocused;
	}, [
		describeNode,
		focusEpisodeCardByIndex,
		focusEpisodeSelector,
		focusHeaderActionNoScroll,
		focusNonSeriesAudioSelector,
		focusNonSeriesPrimaryPlay,
		focusNonSeriesSubtitleSelector,
		getScrollSnapshot,
		item?.Type,
		logDetailsDebug
	]);

	const syncPointerFocusToTarget = useCallback((event) => {
		if (!isActive || showEpisodePicker || showAudioPicker || showSubtitlePicker) return;
		if (!Spotlight?.getPointerMode?.()) return;
		const target = event.target;
		if (!target || target.nodeType !== 1) return;
		const targetElement = target;
		const beforeScroll = getScrollSnapshot();

		const focusTarget = targetElement.closest(
			'[data-spotlight-id], .spottable, .bf-button, button, [role="button"]'
		);
		if (!focusTarget || !detailsContainerRef.current?.contains(focusTarget)) {
			logDetailsDebug('pointer-no-focus-target', {
				eventType: event.type,
				target: describeNode(targetElement),
				active: describeNode(document.activeElement),
				scroll: beforeScroll
			});
			// Prevent Spotlight from selecting an arbitrary fallback control (which can scroll the page).
			if (event.cancelable) {
				event.preventDefault();
			}
			event.stopPropagation();
			event.stopImmediatePropagation?.();
			if (document.activeElement === document.body && detailsContainerRef.current?.focus) {
				focusNodeWithoutScroll(detailsContainerRef.current);
				logDetailsDebug('pointer-anchor-focused-details-container', {
					eventType: event.type,
					activeAfter: describeNode(document.activeElement),
					scrollAfter: getScrollSnapshot()
				});
			}
			return;
		}
		if (document.activeElement === focusTarget) {
			logDetailsDebug('pointer-target-already-active', {
				eventType: event.type,
				target: describeNode(targetElement),
				focusTarget: describeNode(focusTarget),
				scroll: beforeScroll
			});
			return;
		}

		logDetailsDebug('pointer-focus-target', {
			eventType: event.type,
			target: describeNode(targetElement),
			focusTarget: describeNode(focusTarget),
			activeBefore: describeNode(document.activeElement),
			scrollBefore: beforeScroll
		});

		focusNodeWithoutScroll(focusTarget);
		window.requestAnimationFrame(() => {
			const afterScroll = getScrollSnapshot();
			if (!beforeScroll || !afterScroll) return;
			const delta = afterScroll.top - beforeScroll.top;
			if (Math.abs(delta) < 1) return;
			logDetailsDebug('pointer-scroll-delta-after-focus', {
				eventType: event.type,
				delta,
				scrollBefore: beforeScroll,
				scrollAfter: afterScroll,
				activeAfter: describeNode(document.activeElement)
			});
		});
	}, [
		describeNode,
		focusNodeWithoutScroll,
		getScrollSnapshot,
		isActive,
		logDetailsDebug,
		showAudioPicker,
		showEpisodePicker,
		showSubtitlePicker
	]);

	const handleDetailsPointerDownCapture = useCallback((event) => {
		syncPointerFocusToTarget(event);
	}, [syncPointerFocusToTarget]);

	const handleDetailsPointerClickCapture = useCallback((event) => {
		syncPointerFocusToTarget(event);
	}, [syncPointerFocusToTarget]);

	const getAudioLabel = () => {
		const track = audioTracks.find(t => t.key === selectedAudioTrack);
		return track?.children || 'Default';
	};

	const getAudioSummary = () => {
		const track = audioTracks.find(t => t.key === selectedAudioTrack);
		return track?.summary || 'Default';
	};

	const getSubtitleLabel = () => {
		if (selectedSubtitleTrack === -1) return 'None';
		const track = subtitleTracks.find(t => t.key === selectedSubtitleTrack);
		return track?.children || 'Default';
	};

	const getSubtitleSummary = () => {
		if (selectedSubtitleTrack === -1) return 'None';
		const track = subtitleTracks.find(t => t.key === selectedSubtitleTrack);
		return track?.summary || 'Default';
	};

	const renderToast = () => {
		if (!toastMessage) return null;
		return (
			<div
				className={`${css.toast} ${toastVisible ? css.toastVisible : ''}`}
				role="status"
				aria-live="polite"
			>
				{toastMessage}
			</div>
		);
	};

	const getSeasonImageUrl = (season) => {
		if (season?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(season.Id, 'Primary', 360);
		}
		if (season?.ImageTags?.Thumb) {
			return jellyfinService.getImageUrl(season.Id, 'Thumb', 360);
		}
		// Fallback to series backdrop if available
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 640);
		}
		// Fallback to series primary
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 360);
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

	const handleEpisodeInfoClick = useCallback((e) => {
		e.stopPropagation();
		const episodeId = e.currentTarget.dataset.episodeId;
		const episode = episodesById.get(episodeId);
		if (!episode || typeof onItemSelect !== 'function') return;
		onItemSelect(episode, item);
	}, [episodesById, item, onItemSelect]);

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
		} else if (e.keyCode === KeyCodes.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			focusEpisodeInfoButtonByIndex(index);
		}
	}, [focusEpisodeCardByIndex, focusEpisodeInfoButtonByIndex, focusEpisodeSelector]);

	const handleEpisodeInfoButtonKeyDown = useCallback((e) => {
		const index = Number(e.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (e.keyCode === KeyCodes.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			focusEpisodeCardByIndex(index);
		} else if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			if (!focusEpisodeInfoButtonByIndex(index + 1)) {
				focusEpisodeCardByIndex(index + 1);
			}
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (index === 0) {
				focusEpisodeSelector();
				return;
			}
			if (!focusEpisodeInfoButtonByIndex(index - 1)) {
				focusEpisodeCardByIndex(index - 1);
			}
		}
	}, [focusEpisodeCardByIndex, focusEpisodeInfoButtonByIndex, focusEpisodeSelector]);

	const handleAudioSelectorKeyDown = useCallback((e) => {
		if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			if (!focusNonSeriesSubtitleSelector()) {
				focusNonSeriesPrimaryPlay();
			}
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			focusTopHeaderAction();
		}
	}, [focusNonSeriesPrimaryPlay, focusNonSeriesSubtitleSelector, focusTopHeaderAction]);

	const handleSubtitleSelectorKeyDown = useCallback((e) => {
		if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			focusNonSeriesPrimaryPlay();
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (!focusNonSeriesAudioSelector()) {
				focusTopHeaderAction();
			}
		}
	}, [focusNonSeriesAudioSelector, focusNonSeriesPrimaryPlay, focusTopHeaderAction]);

	const handleNonSeriesPlayKeyDown = useCallback((e) => {
		if (e.keyCode === KeyCodes.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			focusNonSeriesPrimaryPlay();
		} else if (e.keyCode === KeyCodes.UP) {
			e.preventDefault();
			e.stopPropagation();
			if (!focusNonSeriesSubtitleSelector()) {
				focusNonSeriesAudioSelector();
			}
		}
	}, [focusNonSeriesAudioSelector, focusNonSeriesPrimaryPlay, focusNonSeriesSubtitleSelector]);

	useEffect(() => {
		if (!isActive || loading) return undefined;
		if (showEpisodePicker || showAudioPicker || showSubtitlePicker) return undefined;

		logDetailsDebug('focus-seed-scheduled', {
			itemId: item?.Id,
			itemType: item?.Type,
			active: describeNode(document.activeElement),
			scroll: getScrollSnapshot()
		});

		const frame = window.requestAnimationFrame(() => {
			focusInitialDetailsControl();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [
		describeNode,
		focusInitialDetailsControl,
		getScrollSnapshot,
		isActive,
		item?.Id,
		item?.Type,
		loading,
		logDetailsDebug,
		showAudioPicker,
		showEpisodePicker,
		showSubtitlePicker
	]);

	const renderTrackPopup = (type) => {
		const isAudio = type === 'audio';
		const tracks = isAudio ? audioTracks : subtitleTracks;
		const selectedKey = isAudio ? selectedAudioTrack : selectedSubtitleTrack;

		return (
			<Popup
				open={isAudio ? showAudioPicker : showSubtitlePicker}
				onClose={isAudio ? closeAudioPicker : closeSubtitlePicker}
				noAutoDismiss
				css={popupShellCss}
			>
				<div className={`${popupStyles.popupSurface} ${css.popupSurface}`}>
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
				</div>
			</Popup>
		);
	};

	const renderEpisodePopup = () => {
		const isSeriesMode = item.Type === 'Series';
		const popupEpisodes = isSeriesMode ? episodes : episodeNavList;
		if (!popupEpisodes?.length) return null;
		return (
			<Popup open={showEpisodePicker} onClose={closeEpisodePicker} noAutoDismiss css={popupShellCss}>
				<div className={`${popupStyles.popupSurface} ${css.popupSurface}`}>
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
				</div>
			</Popup>
		);
	};

	if (!item) return null;

	return (
		<Panel {...rest}>
			{renderToast()}
			{!loading && (
				<div className={`${css.backdrop} ${hasBackdropImage ? '' : css.backdropFallback}`}>
					{hasBackdropImage && <img src={backdropUrl} alt={item.Name} />}
					<div className={css.gradient} />
				</div>
			)}
				<Scroller
					className={css.scroller}
					cbScrollTo={captureDetailsScrollTo}
				>
				<div
					className={css.detailsContainer}
					ref={detailsContainerRef}
					tabIndex={-1}
					onMouseDownCapture={handleDetailsPointerDownCapture}
					onClickCapture={handleDetailsPointerClickCapture}
				>
					{loading ? (
						<div className={css.loading}>
							<Spinner />
						</div>
					) : (
						<>
							<div className={css.content}>
								{item.Type === 'Episode' && (
									<div className={css.episodeBreadcrumb}>
										<div className={css.episodeNavActions}>
											<Button
												size="small"
												className={`${css.episodeNavButton} ${css.episodeSeriesButton}`}
												onClick={handleOpenEpisodeSeries}
											>
												{item.SeriesName}
											</Button>
											<span className={css.breadcrumbDivider} aria-hidden="true">/</span>
											{item.ParentIndexNumber !== undefined && item.ParentIndexNumber !== null && (
												<>
													<Button
														size="small"
														className={css.episodeNavButton}
														onClick={handleOpenEpisodeSeries}
													>
														Season {item.ParentIndexNumber}
													</Button>
													<span className={css.breadcrumbDivider} aria-hidden="true">/</span>
												</>
											)}
											<Button
												size="small"
												className={`${css.episodeNavButton} ${css.episodeCurrentButton}`}
												onClick={openEpisodePicker}
											>
												Episode {item.IndexNumber}
											</Button>
										</div>
									</div>
								)}
								<div className={css.pageHeader}>
									{useHeaderLogo ? (
										<div className={css.headerLogoWrap}>
											<img
												src={headerLogoUrl}
												alt={item?.Name || 'Details'}
												className={css.headerLogo}
												onError={handleHeaderLogoError}
											/>
										</div>
									) : (
										<Heading size="large" className={css.pageHeaderTitle}>
											{headerTitle}
										</Heading>
									)}
								</div>
								<div className={css.header}>
									<div className={css.metadataRow}>
										<div className={css.metadata}>
											{item.ProductionYear && (
												<div className={css.metadataItem}>{item.ProductionYear}</div>
											)}
											{item.OfficialRating && (
												<div className={`${css.metadataItem} ${css.metadataRating}`}>{item.OfficialRating}</div>
											)}
											{item.CommunityRating && (
												<div className={`${css.metadataItem} ${css.metadataScore}`}>
													<Icon size="small" className={css.ratingStar}>star</Icon> {item.CommunityRating.toFixed(1)}
												</div>
											)}
											{item.RunTimeTicks && (
												<div className={css.metadataItem}>
													{Math.floor(item.RunTimeTicks / 600000000)} min
												</div>
											)}
											{item.Genres && item.Genres.length > 0 && (
												<div className={`${css.metadataItem} ${css.metadataItemWide}`}>
													{item.Genres.join(', ')}
												</div>
											)}
										</div>
										<div className={css.actionsRow}>
											<Button
												size="small"
												icon={isFavorite ? 'heart' : 'hearthollow'}
												onClick={handleToggleFavorite}
												css={{icon: css.actionIcon}}
												componentRef={favoriteActionButtonRef}
												spotlightId="details-favorite-action"
												className={`${css.actionButton} ${css.favoriteAction} ${isFavorite ? css.favoriteActive : ''}`}
												title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
											/>
											<Button
												size="small"
												icon="check"
												onClick={handleToggleWatchedMain}
												css={{icon: css.actionIcon}}
												componentRef={watchedActionButtonRef}
												spotlightId="details-watched-action"
												className={`${css.actionButton} ${css.watchedAction} ${isWatched ? css.watchedActive : ''}`}
												title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
											/>
										</div>
									</div>
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
																		loading="lazy"
																		decoding="async"
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
															<div className={css.seasonPosterWrap}>
																<img
																	src={getSeasonImageUrl(season)}
																	alt={season.Name}
																	className={css.seasonPoster}
																	onError={handleSeasonImageError}
																	loading="lazy"
																	decoding="async"
																/>
															</div>
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
												<div className={css.controlsMain}>
													<Button
														size="large"
														onClick={openEpisodePicker}
														className={`${css.dropdown} ${css.episodeSelectorButton}`}
														componentRef={episodeSelectorButtonRef}
														spotlightId="episode-selector-button"
														onKeyDown={handleEpisodeSelectorKeyDown}
													>
														Episode {selectedEpisode.IndexNumber}: {selectedEpisode.Name}
													</Button>
												</div>

												<div className={css.controlsActions}>
													{audioTracks.length > 0 && (
														<Button
															size="small"
															onClick={openAudioPicker}
															className={css.compactSelectorButton}
														>
															Audio: {getAudioSummary()}
														</Button>
													)}

													{subtitleTracks.length > 1 && (
														<Button
															size="small"
															onClick={openSubtitlePicker}
															className={css.compactSelectorButton}
														>
															Subtitles: {getSubtitleSummary()}
														</Button>
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
																	loading="lazy"
																	decoding="async"
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
															{typeof onItemSelect === 'function' && (
																<div className={css.episodeActions}>
																	<Button
																		size="small"
																		icon="info"
																		data-episode-id={episode.Id}
																		data-episode-index={index}
																		className={css.episodeInfoButton}
																		onClick={handleEpisodeInfoClick}
																		onKeyDown={handleEpisodeInfoButtonKeyDown}
																	/>
																</div>
															)}
														</SpottableDiv>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{item.Type !== 'Series' && (
									<>
										<div className={css.trackSelectors}>
											{audioTracks.length > 0 && (
												<div className={css.trackSection}>
													<BodyText className={css.trackLabel}>Audio Track</BodyText>
												<Button
													size="large"
													onClick={openAudioPicker}
													className={css.dropdown}
													componentRef={audioSelectorButtonRef}
													onKeyDown={handleAudioSelectorKeyDown}
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
													componentRef={subtitleSelectorButtonRef}
													onKeyDown={handleSubtitleSelectorKeyDown}
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
												componentRef={playPrimaryButtonRef}
												onKeyDown={handleNonSeriesPlayKeyDown}
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

