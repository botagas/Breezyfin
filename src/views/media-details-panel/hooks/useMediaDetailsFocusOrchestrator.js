import {useCallback, useEffect} from 'react';
import Spotlight from '@enact/spotlight';
import {scrollElementIntoHorizontalView} from '../../../utils/horizontalScroll';

export const useMediaDetailsFocusOrchestrator = ({
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
}) => {
	const focusSeasonWatchedButton = useCallback((seasonCard) => {
		const watchedTarget = seasonCard?.querySelector(
			`.${css.seasonWatchedButton}, .${css.seasonWatchedButton} .spottable, .${css.seasonWatchedButton} [tabindex], .${css.seasonWatchedButton} button`
		);
		if (watchedTarget?.focus) watchedTarget.focus();
	}, [css.seasonWatchedButton]);

	const scrollCastIntoView = useCallback((element) => {
		if (!element || !castScrollerRef.current) return;
		const scroller = castScrollerRef.current;
		if (castFocusScrollTimeoutRef.current) {
			window.clearTimeout(castFocusScrollTimeoutRef.current);
		}
		castFocusScrollTimeoutRef.current = window.setTimeout(() => {
			scrollElementIntoHorizontalView(scroller, element, {minBuffer: 60, edgeRatio: 0.10});
			castFocusScrollTimeoutRef.current = null;
		}, 45);
	}, [castFocusScrollTimeoutRef, castScrollerRef]);

	const scrollSeasonIntoView = useCallback((element) => {
		if (!element || !seasonScrollerRef.current) return;
		const scroller = seasonScrollerRef.current;
		if (seasonFocusScrollTimeoutRef.current) {
			window.clearTimeout(seasonFocusScrollTimeoutRef.current);
		}
		seasonFocusScrollTimeoutRef.current = window.setTimeout(() => {
			scrollElementIntoHorizontalView(scroller, element, {minBuffer: 60, edgeRatio: 0.10});
			seasonFocusScrollTimeoutRef.current = null;
		}, 45);
	}, [seasonFocusScrollTimeoutRef, seasonScrollerRef]);

	const focusSeasonCardByIndex = useCallback((index) => {
		const cards = Array.from(seasonScrollerRef.current?.querySelectorAll(`.${css.seasonCard}`) || []);
		if (index >= 0 && index < cards.length) {
			cards[index].focus();
			return true;
		}
		return false;
	}, [css.seasonCard, seasonScrollerRef]);

	const alignElementBelowPanelHeader = useCallback((element, behavior = 'smooth') => {
		const scrollEl = getDetailsScrollElement();
		if (!scrollEl || !element) return;
		const visualBuffer = 16;
		const headingStackElement = detailsContainerRef.current?.querySelector?.(`.${css.detailsHeadingStack}`);
		const topBarElement = detailsContainerRef.current?.querySelector?.(`.${css.detailsTopBar}`);
		let desiredTop = scrollEl.getBoundingClientRect().top + visualBuffer;
		if (headingStackElement) {
			desiredTop = headingStackElement.getBoundingClientRect().bottom + visualBuffer;
		} else if (topBarElement) {
			desiredTop = topBarElement.getBoundingClientRect().bottom + visualBuffer;
		} else {
			const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
			const panelHeaderOffset = 9 * rootFontSize;
			desiredTop = scrollEl.getBoundingClientRect().top + panelHeaderOffset + visualBuffer;
		}
		const elementTop = element.getBoundingClientRect().top;
		const delta = elementTop - desiredTop;
		if (Math.abs(delta) < 2) return;
		const nextTop = Math.max(0, scrollEl.scrollTop + delta);
		scrollEl.scrollTo({top: nextTop, behavior});
	}, [css.detailsHeadingStack, css.detailsTopBar, detailsContainerRef, getDetailsScrollElement]);

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
	}, [alignElementBelowPanelHeader, detailsScrollToRef, favoriteActionButtonRef, watchedActionButtonRef]);

	const focusEpisodeCardByIndex = useCallback((index) => {
		const cards = Array.from(episodesListRef.current?.querySelectorAll(`.${css.episodeCard}`) || []);
		if (index >= 0 && index < cards.length) {
			cards[index].focus();
		}
	}, [css.episodeCard, episodesListRef]);

	const focusEpisodeInfoButtonByIndex = useCallback((index) => {
		const cards = Array.from(episodesListRef.current?.querySelectorAll(`.${css.episodeCard}`) || []);
		if (index < 0 || index >= cards.length) return false;
		const infoButton = cards[index].querySelector(`.${css.episodeInfoButton}`);
		if (infoButton?.focus) {
			infoButton.focus();
			return true;
		}
		return false;
	}, [css.episodeCard, css.episodeInfoButton, episodesListRef]);

	const focusEpisodeWatchedButtonByIndex = useCallback((index) => {
		const cards = Array.from(episodesListRef.current?.querySelectorAll(`.${css.episodeCard}`) || []);
		if (index < 0 || index >= cards.length) return false;
		const watchedButton = cards[index].querySelector(`.${css.episodeWatchedButton}`);
		if (watchedButton?.focus) {
			watchedButton.focus();
			return true;
		}
		return false;
	}, [css.episodeCard, css.episodeWatchedButton, episodesListRef]);

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
	}, [episodeSelectorButtonRef]);

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
	}, [audioSelectorButtonRef]);

	const focusNonSeriesSubtitleSelector = useCallback(() => {
		const target = subtitleSelectorButtonRef.current?.nodeRef?.current || subtitleSelectorButtonRef.current;
		if (target?.focus) {
			target.focus({preventScroll: true});
			return true;
		}
		return false;
	}, [subtitleSelectorButtonRef]);

	const focusNonSeriesPrimaryPlay = useCallback(() => {
		const target = playPrimaryButtonRef.current?.nodeRef?.current || playPrimaryButtonRef.current;
		if (target?.focus) {
			focusNodeWithoutScroll(target);
			return true;
		}
		return false;
	}, [focusNodeWithoutScroll, playPrimaryButtonRef]);

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
	}, [favoriteActionButtonRef, focusNodeWithoutScroll, watchedActionButtonRef]);

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
		detailsContainerRef,
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
		detailsContainerRef,
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

	return {
		scrollCastIntoView,
		scrollSeasonIntoView,
		focusSeasonCardByIndex,
		focusSeasonWatchedButton,
		focusTopHeaderAction,
		focusEpisodeCardByIndex,
		focusEpisodeInfoButtonByIndex,
		focusEpisodeWatchedButtonByIndex,
		focusEpisodeSelector,
		focusBelowSeasons,
		focusNonSeriesAudioSelector,
		focusNonSeriesSubtitleSelector,
		focusNonSeriesPrimaryPlay,
		handleDetailsPointerDownCapture,
		handleDetailsPointerClickCapture
	};
};
