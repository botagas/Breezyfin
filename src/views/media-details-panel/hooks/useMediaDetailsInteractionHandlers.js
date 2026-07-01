import {useCallback} from 'react';
import {KeyCodes} from '../../../utils/keyCodes';
import {scrollElementIntoHorizontalView} from '../../../utils/horizontalScroll';

const stopHandledKeyEvent = (event) => {
	event.preventDefault();
	event.stopPropagation();
};

const handleEpisodeActionVerticalKeyDown = ({
	event,
	index,
	isSidewaysEpisodeLayout,
	focusEpisodeCardByIndex,
	focusEpisodeSelector,
	focusActionButtonByIndex
}) => {
	if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.DOWN) {
		stopHandledKeyEvent(event);
		focusEpisodeCardByIndex(index);
		return true;
	}
	if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.UP) {
		stopHandledKeyEvent(event);
		focusEpisodeSelector();
		return true;
	}
	if (event.keyCode === KeyCodes.DOWN) {
		stopHandledKeyEvent(event);
		if (!focusActionButtonByIndex(index + 1)) {
			focusEpisodeCardByIndex(index + 1);
		}
		return true;
	}
	if (event.keyCode === KeyCodes.UP) {
		stopHandledKeyEvent(event);
		if (index === 0) {
			focusEpisodeSelector();
			return true;
		}
		if (!focusActionButtonByIndex(index - 1)) {
			focusEpisodeCardByIndex(index - 1);
		}
		return true;
	}
	return false;
};

const handleFirstSectionHorizontalKeyDown = ({
	event,
	focusFirstSectionControlByDirection
}) => {
	const direction = event.keyCode === KeyCodes.RIGHT
		? 'right'
		: event.keyCode === KeyCodes.LEFT
			? 'left'
			: null;
	if (!direction || typeof focusFirstSectionControlByDirection !== 'function') return false;
	if (!focusFirstSectionControlByDirection(event.currentTarget, direction)) return false;
	stopHandledKeyEvent(event);
	return true;
};

export const useMediaDetailsInteractionHandlers = ({
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
	handleToggleFavoriteById,
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
	focusNonSeriesSubtitleSelector,
	focusNonSeriesPrimaryPlay,
	focusNonSeriesAudioSelector,
	focusFirstSectionControlByDirection,
	focusNodeWithoutScroll,
	focusIntroTopNavigation,
	focusFirstSectionPrimary,
	focusSecondSectionPrimary,
	showEpisodeInfoButton,
	css
}) => {
	const handleCastCardFocus = useCallback((event) => {
		scrollCastIntoView(event.currentTarget);
	}, [scrollCastIntoView]);

	const focusFirstSectionFromCast = useCallback(() => {
		if (typeof focusFirstSectionPrimary === 'function' && focusFirstSectionPrimary({
			forceScroll: true,
			focusTarget: 'topNav'
		})) return;
		if (typeof focusIntroTopNavigation === 'function') {
			focusIntroTopNavigation();
		}
	}, [focusFirstSectionPrimary, focusIntroTopNavigation]);

	const focusCastCardWithoutScroll = useCallback((card) => {
		if (!card?.focus) return false;
		if (typeof focusNodeWithoutScroll === 'function') {
			focusNodeWithoutScroll(card);
			return true;
		}
		try {
			card.focus({preventScroll: true});
		} catch (_) {
			card.focus();
		}
		return true;
	}, [focusNodeWithoutScroll]);

	const handleCastToggleKeyDown = useCallback((event) => {
		if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusFirstSectionFromCast();
		} else if (event.keyCode === KeyCodes.DOWN) {
			const firstCastCard = castRowRef.current?.querySelector(`.${css.castCard}`);
			if (firstCastCard?.focus && focusCastCardWithoutScroll(firstCastCard)) {
				event.preventDefault();
				event.stopPropagation();
			}
		}
	}, [castRowRef, css.castCard, focusCastCardWithoutScroll, focusFirstSectionFromCast]);

	const handleCastCardKeyDown = useCallback((event) => {
		const cards = Array.from(castRowRef.current?.querySelectorAll(`.${css.castCard}`) || []);
		const index = cards.indexOf(event.currentTarget);
		if (event.keyCode === KeyCodes.LEFT && index > 0) {
			event.preventDefault();
			event.stopPropagation();
			focusCastCardWithoutScroll(cards[index - 1]);
		} else if (event.keyCode === KeyCodes.RIGHT && index < cards.length - 1) {
			event.preventDefault();
			event.stopPropagation();
			focusCastCardWithoutScroll(cards[index + 1]);
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusFirstSectionFromCast();
		}
	}, [castRowRef, css.castCard, focusCastCardWithoutScroll, focusFirstSectionFromCast]);

	const handleSeasonCardClick = useCallback((event) => {
		const seasonId = event.currentTarget.dataset.seasonId;
		const season = seasonsById.get(seasonId);
		if (!season) return;
		handleSeasonClick(season);
	}, [handleSeasonClick, seasonsById]);

	const handleSeasonCardFocus = useCallback((event) => {
		scrollSeasonIntoView(event.currentTarget);
	}, [scrollSeasonIntoView]);

	const handleSeasonCardKeyDown = useCallback((event) => {
		const cards = Array.from(seasonScrollerRef.current?.querySelectorAll(`.${css.seasonCard}`) || []);
		const currentIndex = cards.indexOf(event.currentTarget);
		const seasonId = event.currentTarget.dataset.seasonId;
		const season = seasonsById.get(seasonId);
		if (event.keyCode === KeyCodes.ENTER || event.keyCode === KeyCodes.OK) {
			event.preventDefault();
			event.stopPropagation();
			if (season) {
				handleSeasonClick(season);
			}
		} else if (event.keyCode === KeyCodes.LEFT) {
			event.preventDefault();
			event.stopPropagation();
			focusSeasonCardByIndex(currentIndex - 1);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			focusSeasonCardByIndex(currentIndex + 1);
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusSeasonWatchedButton(event.currentTarget);
		} else if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusBelowSeasons();
		}
	}, [
		css.seasonCard,
		focusBelowSeasons,
		focusSeasonCardByIndex,
		focusSeasonWatchedButton,
		handleSeasonClick,
		seasonScrollerRef,
		seasonsById
	]);

	const handleSeasonWatchedToggleClick = useCallback((event) => {
		event.stopPropagation();
		const seasonId = event.currentTarget.dataset.seasonId;
		const season = seasonsById.get(seasonId);
		if (!season) return;
		handleToggleWatched(season.Id, season.UserData?.Played);
	}, [handleToggleWatched, seasonsById]);

	const handleSeasonWatchedButtonKeyDown = useCallback((event) => {
		if (event.keyCode === KeyCodes.ENTER || event.keyCode === KeyCodes.OK || event.keyCode === KeyCodes.SPACE) {
			event.stopPropagation();
		} else if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			const card = event.currentTarget.closest(`.${css.seasonCard}`);
			if (card?.focus) card.focus();
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof focusSecondSectionPrimary === 'function' && focusSecondSectionPrimary()) return;
			if (typeof focusFirstSectionPrimary === 'function' && focusFirstSectionPrimary({forceScroll: true})) return;
			if (typeof focusIntroTopNavigation === 'function' && focusIntroTopNavigation()) return;
			const card = event.currentTarget.closest(`.${css.seasonCard}`);
			if (card?.focus) card.focus();
		}
	}, [css.seasonCard, focusFirstSectionPrimary, focusIntroTopNavigation, focusSecondSectionPrimary]);

	const focusSeasonFromEpisodeSelector = useCallback(() => {
		const seasonRoot = seasonScrollerRef.current;
		if (seasonRoot) {
			const selectedSeasonCard = seasonRoot.querySelector(`.${css.seasonCard}.${css.selected}`);
			const firstSeasonCard = selectedSeasonCard || seasonRoot.querySelector(`.${css.seasonCard}`);
			if (firstSeasonCard?.focus) {
				if (typeof focusNodeWithoutScroll === 'function') {
					focusNodeWithoutScroll(firstSeasonCard);
				} else {
					firstSeasonCard.focus();
				}
				return true;
			}
		}
		if (typeof focusSeasonCardByIndex === 'function') {
			return focusSeasonCardByIndex(0);
		}
		return false;
	}, [css.seasonCard, css.selected, focusNodeWithoutScroll, focusSeasonCardByIndex, seasonScrollerRef]);

	const handleEpisodeSelectorKeyDown = useCallback((event) => {
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(0);
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (focusSeasonFromEpisodeSelector()) return;
			if (typeof focusFirstSectionPrimary === 'function') {
				focusFirstSectionPrimary({forceScroll: true});
			}
		}
	}, [focusEpisodeCardByIndex, focusFirstSectionPrimary, focusSeasonFromEpisodeSelector]);

	const handleEpisodeCardClick = useCallback((event) => {
		const episodeId = event.currentTarget.dataset.episodeId;
		const episode = episodesById.get(episodeId);
		if (!episode) return;
		handleEpisodeClick(episode);
	}, [episodesById, handleEpisodeClick]);

	const handleEpisodeCardFocus = useCallback((event) => {
		if (!isSidewaysEpisodeLayout || !episodesListRef.current) return;
		const scroller = episodesListRef.current;
		const card = event.currentTarget;
		if (episodeFocusScrollTimeoutRef.current) {
			window.clearTimeout(episodeFocusScrollTimeoutRef.current);
		}
		episodeFocusScrollTimeoutRef.current = window.setTimeout(() => {
			scrollElementIntoHorizontalView(scroller, card, {minBuffer: 70, edgeRatio: 0.12});
			episodeFocusScrollTimeoutRef.current = null;
		}, 45);
	}, [episodeFocusScrollTimeoutRef, episodesListRef, isSidewaysEpisodeLayout]);

	const handleEpisodeInfoClick = useCallback((event) => {
		event.stopPropagation();
		const episodeId = event.currentTarget.dataset.episodeId;
		const episode = episodesById.get(episodeId);
		if (!episode || typeof onItemSelect !== 'function') return;
		onItemSelect(episode, item);
	}, [episodesById, item, onItemSelect]);

	const handleEpisodeWatchedClick = useCallback((event) => {
		event.stopPropagation();
		const episodeId = event.currentTarget.dataset.episodeId;
		const episode = episodesById.get(episodeId);
		if (!episode) return;
		handleToggleWatched(episode.Id, episode.UserData?.Played);
	}, [episodesById, handleToggleWatched]);

	const handleEpisodeFavoriteClick = useCallback((event) => {
		event.stopPropagation();
		const episodeId = event.currentTarget.dataset.episodeId;
		const episode = episodesById.get(episodeId);
		if (!episode) return;
		handleToggleFavoriteById(episode.Id, episode.UserData?.IsFavorite === true);
	}, [episodesById, handleToggleFavoriteById]);

	const handleEpisodeCardKeyDown = useCallback((event) => {
		const index = Number(event.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (isSidewaysEpisodeLayout) {
			if (event.keyCode === KeyCodes.RIGHT) {
				event.preventDefault();
				event.stopPropagation();
				focusEpisodeCardByIndex(index + 1);
			} else if (event.keyCode === KeyCodes.LEFT) {
				event.preventDefault();
				event.stopPropagation();
				focusEpisodeCardByIndex(index - 1);
			} else if (event.keyCode === KeyCodes.UP) {
				event.preventDefault();
				event.stopPropagation();
				focusEpisodeSelector();
			} else if (event.keyCode === KeyCodes.DOWN) {
				event.preventDefault();
				event.stopPropagation();
				if (!focusEpisodeInfoButtonByIndex(index) && !focusEpisodeFavoriteButtonByIndex(index)) {
					focusEpisodeWatchedButtonByIndex(index);
				}
			}
			return;
		}
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(index + 1);
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (index === 0) {
				focusEpisodeSelector();
				return;
			}
			focusEpisodeCardByIndex(index - 1);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusEpisodeInfoButtonByIndex(index) && !focusEpisodeFavoriteButtonByIndex(index)) {
				focusEpisodeWatchedButtonByIndex(index);
			}
		}
	}, [
		focusEpisodeCardByIndex,
		focusEpisodeFavoriteButtonByIndex,
		focusEpisodeInfoButtonByIndex,
		focusEpisodeSelector,
		focusEpisodeWatchedButtonByIndex,
		isSidewaysEpisodeLayout
	]);

	const handleEpisodeInfoButtonKeyDown = useCallback((event) => {
		const index = Number(event.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (event.keyCode === KeyCodes.LEFT) {
			stopHandledKeyEvent(event);
			focusEpisodeCardByIndex(index);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			stopHandledKeyEvent(event);
			if (!focusEpisodeFavoriteButtonByIndex(index)) {
				focusEpisodeWatchedButtonByIndex(index);
			}
		} else {
			handleEpisodeActionVerticalKeyDown({
				event,
				index,
				isSidewaysEpisodeLayout,
				focusEpisodeCardByIndex,
				focusEpisodeSelector,
				focusActionButtonByIndex: focusEpisodeInfoButtonByIndex
			});
		}
	}, [
		focusEpisodeCardByIndex,
		focusEpisodeFavoriteButtonByIndex,
		focusEpisodeInfoButtonByIndex,
		focusEpisodeSelector,
		focusEpisodeWatchedButtonByIndex,
		isSidewaysEpisodeLayout
	]);

	const handleEpisodeFavoriteButtonKeyDown = useCallback((event) => {
		const index = Number(event.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (event.keyCode === KeyCodes.LEFT) {
			stopHandledKeyEvent(event);
			if (showEpisodeInfoButton && focusEpisodeInfoButtonByIndex(index)) return;
			focusEpisodeCardByIndex(index);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			stopHandledKeyEvent(event);
			if (!focusEpisodeWatchedButtonByIndex(index)) {
				focusEpisodeCardByIndex(index + 1);
			}
		} else {
			handleEpisodeActionVerticalKeyDown({
				event,
				index,
				isSidewaysEpisodeLayout,
				focusEpisodeCardByIndex,
				focusEpisodeSelector,
				focusActionButtonByIndex: focusEpisodeFavoriteButtonByIndex
			});
		}
	}, [
		focusEpisodeCardByIndex,
		focusEpisodeFavoriteButtonByIndex,
		focusEpisodeInfoButtonByIndex,
		focusEpisodeSelector,
		focusEpisodeWatchedButtonByIndex,
		isSidewaysEpisodeLayout,
		showEpisodeInfoButton
	]);

	const handleEpisodeWatchedButtonKeyDown = useCallback((event) => {
		const index = Number(event.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (event.keyCode === KeyCodes.LEFT) {
			stopHandledKeyEvent(event);
			if (focusEpisodeFavoriteButtonByIndex(index)) return;
			if (showEpisodeInfoButton && focusEpisodeInfoButtonByIndex(index)) return;
			focusEpisodeCardByIndex(index);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			stopHandledKeyEvent(event);
			focusEpisodeCardByIndex(index + 1);
		} else {
			handleEpisodeActionVerticalKeyDown({
				event,
				index,
				isSidewaysEpisodeLayout,
				focusEpisodeCardByIndex,
				focusEpisodeSelector,
				focusActionButtonByIndex: focusEpisodeWatchedButtonByIndex
			});
		}
	}, [
		focusEpisodeCardByIndex,
		focusEpisodeFavoriteButtonByIndex,
		focusEpisodeInfoButtonByIndex,
		focusEpisodeSelector,
		focusEpisodeWatchedButtonByIndex,
		isSidewaysEpisodeLayout,
		showEpisodeInfoButton
	]);

	const handleAudioSelectorKeyDown = useCallback((event) => {
		if (handleFirstSectionHorizontalKeyDown({event, focusFirstSectionControlByDirection})) return;
		if (event.keyCode === KeyCodes.DOWN) {
			if (typeof focusSecondSectionPrimary === 'function' && focusSecondSectionPrimary()) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			if (!focusNonSeriesSubtitleSelector()) {
				focusNonSeriesPrimaryPlay();
			}
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof focusIntroTopNavigation === 'function') {
				focusIntroTopNavigation();
			}
		}
	}, [
		focusNonSeriesPrimaryPlay,
		focusNonSeriesSubtitleSelector,
		focusFirstSectionControlByDirection,
		focusIntroTopNavigation,
		focusSecondSectionPrimary
	]);

	const handleSubtitleSelectorKeyDown = useCallback((event) => {
		if (handleFirstSectionHorizontalKeyDown({event, focusFirstSectionControlByDirection})) return;
		if (event.keyCode === KeyCodes.DOWN) {
			if (typeof focusSecondSectionPrimary === 'function' && focusSecondSectionPrimary()) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			focusNonSeriesPrimaryPlay();
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof focusIntroTopNavigation === 'function' && focusIntroTopNavigation()) return;
			focusNonSeriesAudioSelector();
		}
	}, [
		focusIntroTopNavigation,
		focusNonSeriesAudioSelector,
		focusNonSeriesPrimaryPlay,
		focusFirstSectionControlByDirection,
		focusSecondSectionPrimary
	]);

	const handleNonSeriesPlayKeyDown = useCallback((event) => {
		if (handleFirstSectionHorizontalKeyDown({event, focusFirstSectionControlByDirection})) return;
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof focusSecondSectionPrimary === 'function' && focusSecondSectionPrimary()) return;
			focusNonSeriesPrimaryPlay();
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof focusIntroTopNavigation === 'function' && focusIntroTopNavigation()) return;
			if (!focusNonSeriesSubtitleSelector()) focusNonSeriesAudioSelector();
		}
	}, [
		focusIntroTopNavigation,
		focusNonSeriesAudioSelector,
		focusNonSeriesPrimaryPlay,
		focusNonSeriesSubtitleSelector,
		focusFirstSectionControlByDirection,
		focusSecondSectionPrimary
	]);

	return {
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
	};
};
