import {useCallback, useEffect, useRef} from 'react';
import Spotlight from '@enact/spotlight';

import {KeyCodes} from '../../utils/keyCodes';
import {scrollElementIntoHorizontalView} from '../../utils/horizontalScroll';
import css from '../MediaDetailsPanel.module.less';

const SNAP_TOLERANCE_PX = 8;
const WHEEL_DELTA_THRESHOLD = 18;
const SNAP_THRESHOLD_RATIO = 0.45;
const FOCUS_SETTLE_TIMEOUT_MS = 420;
const SECTION_SWITCH_LOCK_MS = 760;
const HORIZONTAL_SCROLL_DELAY_MS = 45;

const INTRO_CONTROL_SELECTOR = '[data-md-nav="audio"], [data-md-nav="subtitle"], [data-md-nav="play"]';
const INTRO_ACTION_SELECTOR = '[data-md-nav="intro-action"]';
const SECTION_TWO_SELECTOR = [
    '[data-md-nav="cast-toggle"]',
    '[data-md-nav="cast"]',
    '[data-md-nav="episode-selector"]',
    '[data-md-nav="season"]',
    '[data-md-nav="episode"]'
];
const POINTER_FOCUS_SELECTOR = '[data-spotlight-id], .spottable, .bf-button, button, [role="button"]';

const focusNode = (node) => {
    if (!node?.focus) return false;
    try {
        node.focus({preventScroll: true});
    } catch (error) {
        node.focus();
    }
    return document.activeElement === node;
};

const stopEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
};

const blockEvent = (event) => {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
};

const navNode = (root, name, index, action) => {
    if (!root) return null;
    let selector = `[data-md-nav="${name}"]`;
    if (index !== undefined) selector += `[data-index="${index}"]`;
    if (action) selector += `[data-action="${action}"]`;
    return root.querySelector(selector);
};

const HORIZONTAL_SCROLL_OPTIONS = {
    cast: {scroller: css.castScroller, options: {minBuffer: 60, edgeRatio: 0.10, padding: 20}},
    season: {scroller: css.seasonCards, options: {minBuffer: 60, edgeRatio: 0.10}},
    episode: {scroller: css.episodeCardsSideways, options: {minBuffer: 70, edgeRatio: 0.12}}
};

export const findScrollElement = (container) => {
    if (!container) return null;
    const contentNode = container.closest('[id$="_content"]');
    if (contentNode && typeof contentNode.scrollTop === 'number') return contentNode;
    return container.closest('[data-webos-voice-intent="Scroll"]');
};

export const useMediaDetailsNavigation = ({
                                              containerRef,
                                              isActive,
                                              ready,
                                              pickerOpen,
                                              hasSecondarySection,
                                              isSeries,
                                              isSidewaysEpisodeLayout,
                                              initialScrollTop,
                                              onScrollStop
                                          }) => {
    const firstSectionRef = useRef(null);
    const contentSectionRef = useRef(null);
    const lockRef = useRef({active: false, targetTop: null, startedAt: 0, frame: null, timer: null});
    const introFocusRef = useRef({frame: null, timer: null});
    const horizontalScrollTimerRef = useRef(null);
    const seededRef = useRef(false);

    const getScrollElement = useCallback(() => findScrollElement(containerRef.current), [containerRef]);

    const getContentTop = useCallback(() => {
        const scrollEl = getScrollElement();
        const contentSection = contentSectionRef.current;
        if (!scrollEl || !contentSection) return null;
        const offset = contentSection.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top;
        return Math.max(0, scrollEl.scrollTop + offset);
    }, [getScrollElement]);

    const isIntroAligned = useCallback(() => {
        const scrollEl = getScrollElement();
        const firstSection = firstSectionRef.current;
        if (!scrollEl || !firstSection) return false;
        const offset = firstSection.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top;
        return Math.abs(offset) <= SNAP_TOLERANCE_PX;
    }, [getScrollElement]);

    const isLocked = useCallback(() => lockRef.current.active, []);

    const unlock = useCallback(() => {
        const lock = lockRef.current;
        if (lock.frame !== null) window.cancelAnimationFrame(lock.frame);
        if (lock.timer !== null) window.clearTimeout(lock.timer);
        lockRef.current = {active: false, targetTop: null, startedAt: 0, frame: null, timer: null};
        containerRef.current?.classList.remove(css.sectionSwitchLocked);
    }, [containerRef]);

    const lockUntilSettled = useCallback((scrollEl, targetTop) => {
        unlock();
        const lock = {active: true, targetTop, startedAt: Date.now(), frame: null, timer: null};
        lockRef.current = lock;
        containerRef.current?.classList.add(css.sectionSwitchLocked);
        const watch = () => {
            const nearTarget = Math.abs(scrollEl.scrollTop - targetTop) <= SNAP_TOLERANCE_PX;
            const timedOut = Date.now() - lock.startedAt >= SECTION_SWITCH_LOCK_MS;
            if (nearTarget || timedOut) {
                unlock();
                return;
            }
            lock.frame = window.requestAnimationFrame(watch);
        };
        lock.frame = window.requestAnimationFrame(watch);
        lock.timer = window.setTimeout(unlock, SECTION_SWITCH_LOCK_MS + 120);
    }, [containerRef, unlock]);

    const scrollToSection = useCallback((section) => {
        if (section === 'content' && !hasSecondarySection) return false;
        const scrollEl = getScrollElement();
        const contentTop = getContentTop();
        if (!scrollEl || contentTop === null) return false;
        const targetTop = section === 'content' ? contentTop : 0;
        if (section === 'intro' || Math.abs(scrollEl.scrollTop - targetTop) > 1) {
            lockUntilSettled(scrollEl, targetTop);
            scrollEl.scrollTo({top: targetTop, behavior: 'smooth'});
        }
        return true;
    }, [getContentTop, getScrollElement, hasSecondarySection, lockUntilSettled]);

    const introNode = useCallback((name) => navNode(firstSectionRef.current, name), []);

    const focusTopNav = useCallback(() => (
        focusNode(introNode('breadcrumb')) || focusNode(introNode('back'))
    ), [introNode]);

    const focusIntroControls = useCallback(() => (
        focusNode(introNode('audio')) ||
        focusNode(introNode('subtitle')) ||
        focusNode(introNode('play'))
    ), [introNode]);

    const focusIntroPrimary = useCallback(() => (
        focusIntroControls() || focusNode(introNode('back'))
    ), [focusIntroControls, introNode]);

    const focusSectionTwo = useCallback(() => {
        if (!hasSecondarySection) return false;
        const root = contentSectionRef.current;
        return SECTION_TWO_SELECTOR.some((selector) => focusNode(root?.querySelector(selector)));
    }, [hasSecondarySection]);

    const cancelIntroFocus = useCallback(() => {
        const pending = introFocusRef.current;
        if (pending.frame !== null) window.cancelAnimationFrame(pending.frame);
        if (pending.timer !== null) window.clearTimeout(pending.timer);
        introFocusRef.current = {frame: null, timer: null};
    }, []);

    const showIntro = useCallback((focusTarget = 'primary') => {
        if (isLocked()) return true;
        const focusTargetNode = () => (
            focusTarget === 'topNav' ? (focusTopNav() || focusIntroPrimary()) : focusIntroPrimary()
        );
        const scrollEl = getScrollElement();
        if (!scrollEl) return focusTargetNode();
        cancelIntroFocus();
        scrollToSection('intro');
        const startedAt = Date.now();
        let lastTop = scrollEl.scrollTop;
        let stableFrames = 0;
        const finish = () => {
            cancelIntroFocus();
            focusTargetNode();
        };
        const watch = () => {
            const currentTop = scrollEl.scrollTop;
            if (currentTop <= SNAP_TOLERANCE_PX || isIntroAligned()) {
                finish();
                return;
            }
            stableFrames = Math.abs(currentTop - lastTop) < 0.5 ? stableFrames + 1 : 0;
            lastTop = currentTop;
            if (stableFrames >= 2 || Date.now() - startedAt >= FOCUS_SETTLE_TIMEOUT_MS) {
                finish();
                return;
            }
            introFocusRef.current.frame = window.requestAnimationFrame(watch);
        };
        introFocusRef.current = {
            frame: window.requestAnimationFrame(watch),
            timer: window.setTimeout(finish, FOCUS_SETTLE_TIMEOUT_MS + 120)
        };
        return true;
    }, [cancelIntroFocus, focusIntroPrimary, focusTopNav, getScrollElement, isIntroAligned, isLocked, scrollToSection]);

    const showSectionTwo = useCallback(() => {
        if (isLocked()) return true;
        if (!focusSectionTwo()) return false;
        scrollToSection('content');
        return true;
    }, [focusSectionTwo, isLocked, scrollToSection]);

    const moveInIntroControls = useCallback((current, direction) => {
        const root = firstSectionRef.current;
        if (!root) return false;
        const controls = [
            ...root.querySelectorAll(INTRO_CONTROL_SELECTOR),
            ...root.querySelectorAll(INTRO_ACTION_SELECTOR)
        ];
        const index = controls.indexOf(current);
        const nextIndex = index < 0
            ? (direction === 'left' ? controls.length - 1 : 0)
            : index + (direction === 'left' ? -1 : 1);
        if (nextIndex < 0 || nextIndex >= controls.length || nextIndex === index) return false;
        return focusNode(controls[nextIndex]);
    }, []);

    const focusEpisodeSelector = useCallback(() => (
        focusNode(navNode(contentSectionRef.current, 'episode-selector'))
    ), []);

    const focusEpisode = useCallback((index) => (
        focusNode(navNode(contentSectionRef.current, 'episode', index))
    ), []);

    const focusEpisodeAction = useCallback((index, actions) => (
        actions.some((action) => focusNode(navNode(contentSectionRef.current, 'episode-action', index, action)))
    ), []);

    const focusSelectedSeason = useCallback(() => {
        const root = contentSectionRef.current;
        return focusNode(root?.querySelector(`[data-md-nav="season"].${css.selected}`)) ||
            focusNode(navNode(root, 'season'));
    }, []);

    const handleEpisodeActionVertical = useCallback((event, index, action) => {
        if (isSidewaysEpisodeLayout) {
            if (event.keyCode === KeyCodes.DOWN) return focusEpisode(index);
            return focusEpisodeSelector();
        }
        const nextIndex = event.keyCode === KeyCodes.DOWN ? index + 1 : index - 1;
        if (nextIndex < 0) return focusEpisodeSelector();
        return focusEpisodeAction(nextIndex, [action]) || focusEpisode(nextIndex);
    }, [focusEpisode, focusEpisodeAction, focusEpisodeSelector, isSidewaysEpisodeLayout]);

    const handleNavigationKey = useCallback((event, target, name) => {
        const {keyCode} = event;
        const index = Number(target.dataset.index);
        const isHorizontal = keyCode === KeyCodes.LEFT || keyCode === KeyCodes.RIGHT;
        const direction = keyCode === KeyCodes.LEFT ? 'left' : 'right';

        switch (name) {
            case 'back':
            case 'breadcrumb':
                return keyCode === KeyCodes.DOWN && focusIntroControls();
            case 'intro-action':
                if (keyCode === KeyCodes.DOWN) return focusIntroPrimary();
                if (keyCode === KeyCodes.UP) return focusTopNav();
                return isHorizontal && moveInIntroControls(target, direction);
            case 'audio':
            case 'subtitle':
            case 'play':
                if (isHorizontal) return moveInIntroControls(target, direction);
                if (keyCode === KeyCodes.UP) return focusTopNav();
                if (keyCode !== KeyCodes.DOWN) return false;
                if (showSectionTwo()) return true;
                if (name === 'play') return focusNode(introNode('subtitle')) || focusNode(introNode('audio'));
                if (name === 'subtitle') return focusNode(introNode('audio'));
                return true;
            case 'cast-toggle':
                if (keyCode === KeyCodes.UP) return showIntro('topNav');
                return keyCode === KeyCodes.DOWN && focusNode(navNode(contentSectionRef.current, 'cast'));
            case 'cast': {
                if (keyCode === KeyCodes.UP) return showIntro('topNav');
                if (!isHorizontal) return false;
                const sibling = keyCode === KeyCodes.LEFT ? target.previousElementSibling : target.nextElementSibling;
                return focusNode(sibling);
            }
            case 'season':
                if (isHorizontal) return focusNode(keyCode === KeyCodes.LEFT ? target.previousElementSibling : target.nextElementSibling) || true;
                if (keyCode === KeyCodes.UP) return focusNode(target.querySelector('[data-md-nav="season-watched"]'));
                return keyCode === KeyCodes.DOWN && (focusEpisodeSelector() || focusEpisode(0) || true);
            case 'season-watched':
                if (keyCode === KeyCodes.DOWN) return focusNode(target.closest('[data-md-nav="season"]'));
                if (keyCode !== KeyCodes.UP) return false;
                return focusNode(navNode(contentSectionRef.current, 'cast-toggle')) ||
                    focusNode(navNode(contentSectionRef.current, 'cast')) ||
                    showIntro();
            case 'episode-selector':
                if (keyCode === KeyCodes.DOWN) return focusEpisode(0);
                return keyCode === KeyCodes.UP && (focusSelectedSeason() || showIntro());
            case 'episode':
                if (!Number.isInteger(index)) return false;
                if (isSidewaysEpisodeLayout) {
                    if (isHorizontal) return focusEpisode(keyCode === KeyCodes.LEFT ? index - 1 : index + 1) || true;
                    if (keyCode === KeyCodes.UP) return focusEpisodeSelector();
                    return keyCode === KeyCodes.DOWN && (focusEpisodeAction(index, ['info', 'favorite', 'watched']) || true);
                }
                if (keyCode === KeyCodes.DOWN) return focusEpisode(index + 1) || true;
                if (keyCode === KeyCodes.UP) return index === 0 ? focusEpisodeSelector() : focusEpisode(index - 1);
                return keyCode === KeyCodes.RIGHT && (focusEpisodeAction(index, ['info', 'favorite', 'watched']) || true);
            case 'episode-action': {
                if (!Number.isInteger(index)) return false;
                const action = target.dataset.action;
                if (keyCode === KeyCodes.UP || keyCode === KeyCodes.DOWN) {
                    return handleEpisodeActionVertical(event, index, action) || true;
                }
                if (keyCode === KeyCodes.LEFT) {
                    const previous = action === 'watched' ? ['favorite', 'info'] : action === 'favorite' ? ['info'] : [];
                    return focusEpisodeAction(index, previous) || focusEpisode(index);
                }
                if (keyCode === KeyCodes.RIGHT) {
                    const next = action === 'info' ? ['favorite', 'watched'] : action === 'favorite' ? ['watched'] : [];
                    return focusEpisodeAction(index, next) || focusEpisode(index + 1) || true;
                }
                return false;
            }
            default:
                return false;
        }
    }, [
        focusEpisode,
        focusEpisodeAction,
        focusEpisodeSelector,
        focusIntroControls,
        focusIntroPrimary,
        focusSelectedSeason,
        focusTopNav,
        handleEpisodeActionVertical,
        introNode,
        isSidewaysEpisodeLayout,
        moveInIntroControls,
        showIntro,
        showSectionTwo
    ]);

    const handleKeyDownCapture = useCallback((event) => {
        if (isLocked()) blockEvent(event);
    }, [isLocked]);

    const handleKeyDown = useCallback((event) => {
        if (event.defaultPrevented) return;
        const {keyCode} = event;
        if (keyCode !== KeyCodes.UP && keyCode !== KeyCodes.DOWN && keyCode !== KeyCodes.LEFT && keyCode !== KeyCodes.RIGHT) return;
        const target = event.target.closest?.('[data-md-nav]');
        if (!target || !containerRef.current?.contains(target)) return;
        if (handleNavigationKey(event, target, target.dataset.mdNav)) stopEvent(event);
    }, [containerRef, handleNavigationKey]);

    const handleFocus = useCallback((event) => {
        const target = event.target;
        if (!isActive || pickerOpen || !target || target.nodeType !== 1) return;

        const navTarget = target.closest('[data-md-nav]');
        const horizontal = HORIZONTAL_SCROLL_OPTIONS[navTarget?.dataset.mdNav];
        if (horizontal && !Spotlight.getPointerMode()) {
            const scroller = navTarget.closest(`.${horizontal.scroller}`);
            if (scroller) {
                window.clearTimeout(horizontalScrollTimerRef.current);
                horizontalScrollTimerRef.current = window.setTimeout(() => {
                    scrollElementIntoHorizontalView(scroller, navTarget, horizontal.options);
                }, HORIZONTAL_SCROLL_DELAY_MS);
            }
        }

        if (!hasSecondarySection || isLocked()) return;
        const scrollEl = getScrollElement();
        const contentTop = getContentTop();
        if (!scrollEl || contentTop === null) return;
        if (firstSectionRef.current?.contains(target)) {
            if (!isIntroAligned()) scrollToSection('intro');
            return;
        }
        if (contentSectionRef.current?.contains(target) && scrollEl.scrollTop < contentTop - SNAP_TOLERANCE_PX) {
            scrollToSection('content');
        }
    }, [getContentTop, getScrollElement, hasSecondarySection, isActive, isIntroAligned, isLocked, pickerOpen, scrollToSection]);

    const handleWheelCapture = useCallback((event) => {
        if (!isActive || !hasSecondarySection || pickerOpen) return;
        if (isLocked()) {
            blockEvent(event);
            return;
        }
        const deltaY = Number(event.deltaY || 0);
        if (Math.abs(deltaY) < WHEEL_DELTA_THRESHOLD) return;
        const scrollEl = getScrollElement();
        const contentTop = getContentTop();
        if (!scrollEl || contentTop === null) return;
        const currentTop = scrollEl.scrollTop;
        if (deltaY > 0 && currentTop < contentTop - SNAP_TOLERANCE_PX) {
            stopEvent(event);
            scrollToSection('content');
        } else if (deltaY < 0 && currentTop <= contentTop + SNAP_TOLERANCE_PX) {
            stopEvent(event);
            scrollToSection('intro');
        }
    }, [getContentTop, getScrollElement, hasSecondarySection, isActive, isLocked, pickerOpen, scrollToSection]);

    const handleScrollStop = useCallback((event) => {
        onScrollStop(event);
        if (!hasSecondarySection) return;
        const scrollEl = getScrollElement();
        const contentTop = getContentTop();
        if (!scrollEl || contentTop === null) return;
        const currentTop = scrollEl.scrollTop;
        if (isLocked()) {
            if (Math.abs(currentTop - lockRef.current.targetTop) <= SNAP_TOLERANCE_PX) unlock();
            return;
        }
        if (currentTop <= SNAP_TOLERANCE_PX || currentTop >= contentTop) return;
        scrollEl.scrollTo({
            top: currentTop <= contentTop * SNAP_THRESHOLD_RATIO ? 0 : contentTop,
            behavior: 'smooth'
        });
    }, [getContentTop, getScrollElement, hasSecondarySection, isLocked, onScrollStop, unlock]);

    const handlePointerCapture = useCallback((event) => {
        if (isLocked()) {
            blockEvent(event);
            return;
        }
        if (!isActive || pickerOpen || !Spotlight.getPointerMode()) return;
        const target = event.target;
        if (!target || target.nodeType !== 1) return;
        const container = containerRef.current;
        const focusTarget = target.closest(POINTER_FOCUS_SELECTOR);
        if (!focusTarget || !container?.contains(focusTarget)) {
            blockEvent(event);
            if (document.activeElement === document.body) focusNode(container);
            return;
        }
        if (document.activeElement !== focusTarget) focusNode(focusTarget);
    }, [containerRef, isActive, isLocked, pickerOpen]);

    const seedFocus = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (seededRef.current && container.contains(document.activeElement)) return;
        const restoresContent = hasSecondarySection && !seededRef.current && initialScrollTop > 0;
        seededRef.current = true;
        if (restoresContent && focusSectionTwo()) return;
        if (focusIntroControls()) return;
        if (isSeries && (focusEpisodeSelector() || focusEpisode(0))) return;
        focusNode(introNode('back'));
    }, [containerRef, focusEpisode, focusEpisodeSelector, focusIntroControls, focusSectionTwo, hasSecondarySection, initialScrollTop, introNode, isSeries]);

    useEffect(() => {
        if (!isActive || !ready || pickerOpen) return undefined;
        const frame = window.requestAnimationFrame(seedFocus);
        return () => window.cancelAnimationFrame(frame);
    }, [isActive, pickerOpen, ready, seedFocus]);

    useEffect(() => () => {
        unlock();
        cancelIntroFocus();
        window.clearTimeout(horizontalScrollTimerRef.current);
    }, [cancelIntroFocus, unlock]);

    return {
        firstSectionRef,
        contentSectionRef,
        containerHandlers: {
            onKeyDownCapture: handleKeyDownCapture,
            onKeyDown: handleKeyDown,
            onFocus: handleFocus,
            onWheelCapture: handleWheelCapture,
            onMouseDownCapture: handlePointerCapture,
            onClickCapture: handlePointerCapture
        },
        handleScrollStop
    };
};
