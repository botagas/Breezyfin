import {useCallback, useEffect, useMemo, useRef} from 'react';
import {KeyCodes} from '../../../utils/keyCodes';

const SECTION_SNAP_TOLERANCE_PX = 8;
const SECTION_WHEEL_DELTA_THRESHOLD = 18;
const SECTION_SNAP_THRESHOLD_RATIO = 0.45;
const SECTION_FOCUS_SETTLE_TIMEOUT_MS = 420;

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
}) => {
	const introFocusRafRef = useRef(null);
	const introFocusTimeoutRef = useRef(null);

	const cancelPendingIntroFocus = useCallback(() => {
		if (introFocusRafRef.current !== null) {
			window.cancelAnimationFrame(introFocusRafRef.current);
			introFocusRafRef.current = null;
		}
		if (introFocusTimeoutRef.current !== null) {
			window.clearTimeout(introFocusTimeoutRef.current);
			introFocusTimeoutRef.current = null;
		}
	}, []);

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

	const focusBackNavigation = useCallback(() => {
		const backTarget = firstSectionRef.current?.querySelector('[data-bf-md-nav="back"]');
		if (!backTarget?.focus) return false;
		focusNodeWithoutScroll(backTarget);
		return true;
	}, [firstSectionRef, focusNodeWithoutScroll]);

	const focusSectionOnePrimary = useCallback(() => {
		if (focusNonSeriesAudioSelector()) return true;
		if (focusNonSeriesSubtitleSelector()) return true;
		if (focusNonSeriesPrimaryPlay()) return true;
		return focusBackNavigation();
	}, [
		focusBackNavigation,
		focusNonSeriesAudioSelector,
		focusNonSeriesPrimaryPlay,
		focusNonSeriesSubtitleSelector
	]);

	const focusSectionOneControls = useCallback(() => {
		const candidateTargets = [
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
			const controlsRoot = introRoot.querySelector(`.${css.introControlsRow}`);
			const fallbackTarget = controlsRoot?.querySelector(
				`.${css.compactSelectorButton}, .${css.trackSelectorPrimary}, .${css.primaryButton}, .bf-button, .spottable, button`
			);
			if (fallbackTarget?.focus) {
				focusNodeWithoutScroll(fallbackTarget);
				return true;
			}
		}
		return focusSectionOnePrimary();
	}, [
		audioSelectorButtonRef,
		css.compactSelectorButton,
		css.introControlsRow,
		css.primaryButton,
		css.trackSelectorPrimary,
		firstSectionRef,
		focusNodeWithoutScroll,
		focusSectionOnePrimary,
		playPrimaryButtonRef,
		subtitleSelectorButtonRef,
	]);

	const focusSectionOnePrimaryFromTopNav = useCallback(() => {
		return focusSectionOneControls();
	}, [focusSectionOneControls]);

	const focusSectionOnePrimaryFromIntroAction = useCallback(() => {
		return focusSectionOneControls();
	}, [focusSectionOneControls]);

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

	const focusFirstSectionAfterScrollSettles = useCallback((scrollEl) => {
		if (!scrollEl) return focusSectionOnePrimary();
		cancelPendingIntroFocus();

		const startedAt = Date.now();
		let lastTop = scrollEl.scrollTop;
		let stableFrames = 0;

		const finish = () => {
			cancelPendingIntroFocus();
			focusSectionOnePrimary();
		};

		const watchScrollSettle = () => {
			const currentTop = scrollEl.scrollTop;
			const nearIntroTop = currentTop <= SECTION_SNAP_TOLERANCE_PX;
			if (nearIntroTop) {
				finish();
				return;
			}
			const delta = Math.abs(currentTop - lastTop);
			stableFrames = delta < 0.5 ? stableFrames + 1 : 0;
			lastTop = currentTop;
			const timedOut = (Date.now() - startedAt) >= SECTION_FOCUS_SETTLE_TIMEOUT_MS;
			if (stableFrames >= 2 || timedOut) {
				finish();
				return;
			}
			introFocusRafRef.current = window.requestAnimationFrame(watchScrollSettle);
		};

		introFocusRafRef.current = window.requestAnimationFrame(watchScrollSettle);
		introFocusTimeoutRef.current = window.setTimeout(finish, SECTION_FOCUS_SETTLE_TIMEOUT_MS + 120);
		return true;
	}, [cancelPendingIntroFocus, focusSectionOnePrimary]);

	const focusAndShowFirstSection = useCallback(() => {
		const scrollEl = getDetailsScrollElement();
		if (!scrollEl) return focusSectionOnePrimary();
		if (scrollEl.scrollTop <= SECTION_SNAP_TOLERANCE_PX) {
			return focusSectionOnePrimary();
		}
		cancelPendingIntroFocus();
		scrollToDetailsSection('intro', {animate: true, focusTarget: false});
		return focusFirstSectionAfterScrollSettles(scrollEl);
	}, [
		cancelPendingIntroFocus,
		focusFirstSectionAfterScrollSettles,
		focusSectionOnePrimary,
		getDetailsScrollElement,
		scrollToDetailsSection
	]);

	const handleIntroActionKeyDown = useCallback((event) => {
		const code = event.keyCode || event.which;
		if (code !== KeyCodes.DOWN) return;
		if (!focusSectionOnePrimaryFromIntroAction()) return;
		event.preventDefault();
		event.stopPropagation();
	}, [focusSectionOnePrimaryFromIntroAction]);

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

	useEffect(() => () => {
		cancelPendingIntroFocus();
	}, [cancelPendingIntroFocus]);

	return {
		hasSecondarySection,
		focusSectionOnePrimary,
		focusAndShowFirstSection,
		focusAndShowSecondSection,
		focusIntroTopNavigation,
		handleIntroActionKeyDown,
		handleIntroTopNavKeyDown,
		handleSectionWheelCapture,
		handleDetailsScrollerScrollStop
	};
};
