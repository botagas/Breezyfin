import {useCallback} from 'react';
import {KeyCodes} from '../../../utils/keyCodes';
import {scrollElementIntoHorizontalView} from '../../../utils/horizontalScroll';

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
	focusNonSeriesSubtitleSelector,
	focusNonSeriesPrimaryPlay,
	focusNonSeriesAudioSelector,
	showEpisodeInfoButton,
	css
}) => {
	const handleCastCardFocus = useCallback((event) => {
		scrollCastIntoView(event.currentTarget);
	}, [scrollCastIntoView]);

	const handleCastCardKeyDown = useCallback((event) => {
		const cards = Array.from(castRowRef.current?.querySelectorAll(`.${css.castCard}`) || []);
		const index = cards.indexOf(event.currentTarget);
		if (event.keyCode === KeyCodes.LEFT && index > 0) {
			event.preventDefault();
			cards[index - 1].focus();
		} else if (event.keyCode === KeyCodes.RIGHT && index < cards.length - 1) {
			event.preventDefault();
			cards[index + 1].focus();
		}
	}, [castRowRef, css.castCard]);

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
			if (!focusTopHeaderAction()) {
				const card = event.currentTarget.closest(`.${css.seasonCard}`);
				if (card?.focus) card.focus();
			}
		}
	}, [css.seasonCard, focusTopHeaderAction]);

	const handleEpisodeSelectorKeyDown = useCallback((event) => {
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(0);
		}
	}, [focusEpisodeCardByIndex]);

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
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(index);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusEpisodeFavoriteButtonByIndex(index)) {
				focusEpisodeWatchedButtonByIndex(index);
			}
		} else if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(index);
		} else if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeSelector();
		} else if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusEpisodeInfoButtonByIndex(index + 1)) {
				focusEpisodeCardByIndex(index + 1);
			}
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (index === 0) {
				focusEpisodeSelector();
				return;
			}
			if (!focusEpisodeInfoButtonByIndex(index - 1)) {
				focusEpisodeCardByIndex(index - 1);
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

	const handleEpisodeFavoriteButtonKeyDown = useCallback((event) => {
		const index = Number(event.currentTarget.dataset.episodeIndex);
		if (!Number.isInteger(index)) return;
		if (event.keyCode === KeyCodes.LEFT) {
			event.preventDefault();
			event.stopPropagation();
			if (showEpisodeInfoButton && focusEpisodeInfoButtonByIndex(index)) return;
			focusEpisodeCardByIndex(index);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusEpisodeWatchedButtonByIndex(index)) {
				focusEpisodeCardByIndex(index + 1);
			}
		} else if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(index);
		} else if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeSelector();
		} else if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusEpisodeFavoriteButtonByIndex(index + 1)) {
				focusEpisodeCardByIndex(index + 1);
			}
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (index === 0) {
				focusEpisodeSelector();
				return;
			}
			if (!focusEpisodeFavoriteButtonByIndex(index - 1)) {
				focusEpisodeCardByIndex(index - 1);
			}
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
			event.preventDefault();
			event.stopPropagation();
			if (focusEpisodeFavoriteButtonByIndex(index)) return;
			if (showEpisodeInfoButton && focusEpisodeInfoButtonByIndex(index)) return;
			focusEpisodeCardByIndex(index);
		} else if (event.keyCode === KeyCodes.RIGHT) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(index + 1);
		} else if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeCardByIndex(index);
		} else if (isSidewaysEpisodeLayout && event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusEpisodeSelector();
		} else if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusEpisodeWatchedButtonByIndex(index + 1)) {
				focusEpisodeCardByIndex(index + 1);
			}
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (index === 0) {
				focusEpisodeSelector();
				return;
			}
			if (!focusEpisodeWatchedButtonByIndex(index - 1)) {
				focusEpisodeCardByIndex(index - 1);
			}
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
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusNonSeriesSubtitleSelector()) {
				focusNonSeriesPrimaryPlay();
			}
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			focusTopHeaderAction();
		}
	}, [focusNonSeriesPrimaryPlay, focusNonSeriesSubtitleSelector, focusTopHeaderAction]);

	const handleSubtitleSelectorKeyDown = useCallback((event) => {
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusNonSeriesPrimaryPlay();
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusNonSeriesAudioSelector()) {
				focusTopHeaderAction();
			}
		}
	}, [focusNonSeriesAudioSelector, focusNonSeriesPrimaryPlay, focusTopHeaderAction]);

	const handleNonSeriesPlayKeyDown = useCallback((event) => {
		if (event.keyCode === KeyCodes.DOWN) {
			event.preventDefault();
			event.stopPropagation();
			focusNonSeriesPrimaryPlay();
		} else if (event.keyCode === KeyCodes.UP) {
			event.preventDefault();
			event.stopPropagation();
			if (!focusNonSeriesSubtitleSelector()) {
				focusNonSeriesAudioSelector();
			}
		}
	}, [focusNonSeriesAudioSelector, focusNonSeriesPrimaryPlay, focusNonSeriesSubtitleSelector]);

	return {
		handleCastCardFocus,
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
