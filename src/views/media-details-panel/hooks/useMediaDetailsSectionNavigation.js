import {useCallback, useEffect, useMemo} from 'react';
import {KeyCodes} from '../../../utils/keyCodes';

const SECTION_SNAP_TOLERANCE_PX = 8;
const SECTION_WHEEL_DELTA_THRESHOLD = 18;
const SECTION_SNAP_THRESHOLD_RATIO = 0.45;

export const useMediaDetailsSectionNavigation = ({
	itemType,
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
}) => {
	const hasSecondarySection = useMemo(() => {
		if (Array.isArray(cast) && cast.length > 0) return true;
		if (itemType === 'Series') return seasons.length > 0 || episodes.length > 0;
		return false;
	}, [cast, episodes.length, itemType, seasons.length]);

	const getContentSectionTop = useCallback(() => {
		const scrollEl = getDetailsScrollElement();
		const contentSection = contentSectionRef.current;
		if (!scrollEl || !contentSection) return null;
		const scrollRect = scrollEl.getBoundingClientRect();
		const contentRect = contentSection.getBoundingClientRect();
		return Math.max(0, scrollEl.scrollTop + (contentRect.top - scrollRect.top));
	}, [contentSectionRef, getDetailsScrollElement]);

	const focusSectionOnePrimary = useCallback(() => {
		if (focusTopHeaderAction()) return true;
		if (focusNonSeriesPrimaryPlay()) return true;
		if (focusNonSeriesAudioSelector()) return true;
		return focusNonSeriesSubtitleSelector();
	}, [
		focusNonSeriesAudioSelector,
		focusNonSeriesPrimaryPlay,
		focusNonSeriesSubtitleSelector,
		focusTopHeaderAction
	]);

	const focusSectionOnePrimaryFromTopNav = useCallback(() => {
		const candidateTargets = [
			favoriteActionButtonRef.current?.nodeRef?.current || favoriteActionButtonRef.current,
			watchedActionButtonRef.current?.nodeRef?.current || watchedActionButtonRef.current,
			audioSelectorButtonRef.current?.nodeRef?.current || audioSelectorButtonRef.current,
			subtitleSelectorButtonRef.current?.nodeRef?.current || subtitleSelectorButtonRef.current,
			playPrimaryButtonRef.current?.nodeRef?.current || playPrimaryButtonRef.current
		];
		for (const target of candidateTargets) {
			if (!target?.focus) continue;
			focusNodeWithoutScroll(target);
			return true;
		}
		const introRoot = firstSectionRef.current;
		if (introRoot) {
			const fallbackTarget = introRoot.querySelector(
				`.${css.actionButton}, .${css.trackSelectorPrimary}, .${css.primaryButton}, .bf-button, .spottable`
			);
			if (fallbackTarget?.focus) {
				focusNodeWithoutScroll(fallbackTarget);
				return true;
			}
		}
		return focusSectionOnePrimary();
	}, [
		audioSelectorButtonRef,
		css.actionButton,
		css.primaryButton,
		css.trackSelectorPrimary,
		favoriteActionButtonRef,
		firstSectionRef,
		focusNodeWithoutScroll,
		focusSectionOnePrimary,
		playPrimaryButtonRef,
		subtitleSelectorButtonRef,
		watchedActionButtonRef
	]);

	const focusIntroTopNavigation = useCallback(() => {
		const introRoot = firstSectionRef.current;
		if (!introRoot) return false;
		const breadcrumbTarget = introRoot.querySelector('[data-bf-md-nav="breadcrumb"]');
		if (breadcrumbTarget?.focus) {
			focusNodeWithoutScroll(breadcrumbTarget);
			return true;
		}
		const backTarget = introRoot.querySelector('[data-bf-md-nav="back"]');
		if (backTarget?.focus) {
			focusNodeWithoutScroll(backTarget);
			return true;
		}
		return false;
	}, [firstSectionRef, focusNodeWithoutScroll]);

	const focusSectionTwoPrimary = useCallback(() => {
		if (!hasSecondarySection) return false;
		const castTarget = contentSectionRef.current?.querySelector?.(`.${css.castToggleRow}, .${css.castCard}`);
		if (castTarget?.focus) {
			focusNodeWithoutScroll(castTarget);
			return true;
		}
		if (focusEpisodeSelector()) return true;
		const seasonTarget = contentSectionRef.current?.querySelector?.(`.${css.seasonCard}`);
		if (seasonTarget?.focus) {
			focusNodeWithoutScroll(seasonTarget);
			return true;
		}
		const episodeTarget = contentSectionRef.current?.querySelector?.(`.${css.episodeCard}`);
		if (episodeTarget?.focus) {
			focusNodeWithoutScroll(episodeTarget);
			return true;
		}
		return false;
	}, [
		contentSectionRef,
		css.castCard,
		css.castToggleRow,
		css.episodeCard,
		css.seasonCard,
		focusEpisodeSelector,
		focusNodeWithoutScroll,
		hasSecondarySection
	]);

	const scrollToDetailsSection = useCallback((sectionKey, options = {}) => {
		const {
			animate = true,
			focusTarget = false
		} = options;
		if (sectionKey === 'content' && !hasSecondarySection) return false;
		const scrollEl = getDetailsScrollElement();
		if (!scrollEl) return false;
		const sectionTwoTop = getContentSectionTop();
		if (sectionTwoTop === null) return false;
		const nextTop = sectionKey === 'content' ? sectionTwoTop : 0;
		if (Math.abs(scrollEl.scrollTop - nextTop) > 1) {
			scrollEl.scrollTo({top: nextTop, behavior: animate ? 'smooth' : 'auto'});
		}
		if (focusTarget) {
			window.requestAnimationFrame(() => {
				if (sectionKey === 'content') {
					focusSectionTwoPrimary();
				} else {
					focusSectionOnePrimary();
				}
			});
		}
		return true;
	}, [
		focusSectionOnePrimary,
		focusSectionTwoPrimary,
		getContentSectionTop,
		getDetailsScrollElement,
		hasSecondarySection
	]);

	const focusAndShowSecondSection = useCallback(() => {
		if (!focusSectionTwoPrimary()) return false;
		scrollToDetailsSection('content', {animate: true, focusTarget: false});
		return true;
	}, [focusSectionTwoPrimary, scrollToDetailsSection]);

	const handleIntroActionKeyDown = useCallback((event) => {
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.DOWN) return;
		if (!focusAndShowSecondSection()) return;
		event.preventDefault();
		event.stopPropagation();
	}, [focusAndShowSecondSection]);

	const handleIntroTopNavKeyDown = useCallback((event) => {
		if (event.defaultPrevented) return;
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.DOWN) return;
		event.preventDefault();
		event.stopPropagation();
		if (focusSectionOnePrimaryFromTopNav()) return;
		window.requestAnimationFrame(() => {
			focusSectionOnePrimaryFromTopNav();
		});
	}, [focusSectionOnePrimaryFromTopNav]);

	const handleSectionWheelCapture = useCallback((event) => {
		if (!isActive || !hasSecondarySection) return;
		if (showAudioPicker || showSubtitlePicker || showEpisodePicker) return;
		const scrollEl = getDetailsScrollElement();
		const sectionTwoTop = getContentSectionTop();
		if (!scrollEl || sectionTwoTop === null) return;
		const deltaY = Number(event.deltaY || 0);
		if (Math.abs(deltaY) < SECTION_WHEEL_DELTA_THRESHOLD) return;
		const currentTop = scrollEl.scrollTop;
		if (deltaY > 0 && currentTop < (sectionTwoTop - SECTION_SNAP_TOLERANCE_PX)) {
			event.preventDefault();
			event.stopPropagation();
			scrollToDetailsSection('content');
		} else if (deltaY < 0 && currentTop <= (sectionTwoTop + SECTION_SNAP_TOLERANCE_PX)) {
			event.preventDefault();
			event.stopPropagation();
			scrollToDetailsSection('intro');
		}
	}, [
		getContentSectionTop,
		getDetailsScrollElement,
		hasSecondarySection,
		isActive,
		scrollToDetailsSection,
		showAudioPicker,
		showEpisodePicker,
		showSubtitlePicker
	]);

	useEffect(() => {
		if (!isActive || !hasSecondarySection || loading) return undefined;
		if (showAudioPicker || showSubtitlePicker || showEpisodePicker) return undefined;

		const handleFocusIn = (event) => {
			const target = event.target;
			if (!target || target.nodeType !== 1) return;
			const targetNode = target;
			const scrollEl = getDetailsScrollElement();
			const sectionTwoTop = getContentSectionTop();
			if (!scrollEl || sectionTwoTop === null) return;

			if (firstSectionRef.current?.contains(targetNode)) {
				if (scrollEl.scrollTop > SECTION_SNAP_TOLERANCE_PX) {
					scrollToDetailsSection('intro');
				}
				return;
			}
			if (!contentSectionRef.current?.contains(targetNode)) return;
			if (scrollEl.scrollTop < (sectionTwoTop - SECTION_SNAP_TOLERANCE_PX)) {
				scrollToDetailsSection('content');
			}
		};

		document.addEventListener('focusin', handleFocusIn, true);
		return () => document.removeEventListener('focusin', handleFocusIn, true);
	}, [
		contentSectionRef,
		firstSectionRef,
		getContentSectionTop,
		getDetailsScrollElement,
		hasSecondarySection,
		isActive,
		loading,
		scrollToDetailsSection,
		showAudioPicker,
		showEpisodePicker,
		showSubtitlePicker
	]);

	const handleDetailsScrollerScrollStop = useCallback((event) => {
		handleDetailsScrollMemoryStop(event);
		if (!hasSecondarySection) return;
		const scrollEl = getDetailsScrollElement();
		const sectionTwoTop = getContentSectionTop();
		if (!scrollEl || sectionTwoTop === null) return;
		const currentTop = scrollEl.scrollTop;
		if (currentTop <= SECTION_SNAP_TOLERANCE_PX || currentTop >= sectionTwoTop) return;
		const snapThreshold = sectionTwoTop * SECTION_SNAP_THRESHOLD_RATIO;
		scrollEl.scrollTo({
			top: currentTop <= snapThreshold ? 0 : sectionTwoTop,
			behavior: 'smooth'
		});
	}, [getContentSectionTop, getDetailsScrollElement, handleDetailsScrollMemoryStop, hasSecondarySection]);

	return {
		hasSecondarySection,
		focusSectionOnePrimary,
		focusAndShowSecondSection,
		focusIntroTopNavigation,
		handleIntroActionKeyDown,
		handleIntroTopNavKeyDown,
		handleSectionWheelCapture,
		handleDetailsScrollerScrollStop
	};
};
