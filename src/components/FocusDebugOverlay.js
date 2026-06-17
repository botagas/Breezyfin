import {useCallback, useEffect, useMemo, useState} from 'react';
import Spotlight from '@enact/spotlight';
import {describeDomNode} from '../utils/domNodeDescription';
import css from './FocusDebugOverlay.module.less';

const MAX_RECENT_EVENTS = 12;

const getSpotlightModeLabel = () => {
	try {
		return Spotlight?.getPointerMode?.() ? 'pointer' : '5-way';
	} catch (_) {
		return '-';
	}
};

const getFocusSnapshot = () => {
	const activeElement = document.activeElement;
	const focusTarget = activeElement?.closest?.('[data-spotlight-id]') || activeElement;
	return {
		active: describeDomNode(activeElement),
		focusTarget: describeDomNode(focusTarget),
		spotlightId: focusTarget?.getAttribute?.('data-spotlight-id') || '-',
		role: focusTarget?.getAttribute?.('role') || '-',
		mode: getSpotlightModeLabel()
	};
};

const formatTime = () => {
	const now = new Date();
	const hh = String(now.getHours()).padStart(2, '0');
	const mm = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
};

const formatKeyLabel = (event) => {
	if (!event) return '-';
	const key = typeof event.key === 'string' ? event.key : '';
	const code = Number(event.keyCode || event.which || 0);
	if (key) return `${key} (${code})`;
	return code > 0 ? String(code) : '-';
};
const formatKeyDetail = (event) => {
	if (!event) return '-';
	const key = typeof event.key === 'string' && event.key ? event.key : '-';
	const code = Number(event.keyCode || event.which || 0);
	const codeName = event.code || '-';
	const target = describeDomNode(event.target);
	return `${key} code=${code} domCode=${codeName} target=${target}`;
};

const formatPointerLabel = (event) => {
	if (!event) return '-';
	const eventType = event.type || 'pointer';
	const target = event.target;
	const button = Number.isFinite(Number(event.button)) ? Number(event.button) : '-';
	const buttons = Number.isFinite(Number(event.buttons)) ? Number(event.buttons) : '-';
	return `${eventType}[b=${button} bs=${buttons}] -> ${describeDomNode(target)}`;
};

const formatFocusLabel = (event) => {
	if (!event) return '-';
	return describeDomNode(event.target);
};

const pushRecentEvent = (entries, nextEntry) => (
	[nextEntry, ...entries].slice(0, MAX_RECENT_EVENTS)
);

const formatNavigateDebug = (entry) => {
	if (!entry) return '-';
	const date = new Date(entry.at || Date.now());
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	const ss = String(date.getSeconds()).padStart(2, '0');
	const fromView = entry.fromView || '-';
	const targetView = entry.targetView || '-';
	const nextLibraryId = entry.nextLibraryId || '-';
	const currentLibraryId = entry.currentLibraryId || '-';
	const suffix = entry.ignored ? `ignored:${entry.reason || '-'}` : (entry.reason || 'dispatch');
	return `${hh}:${mm}:${ss} ${fromView} -> ${targetView} lib=${nextLibraryId} cur=${currentLibraryId} ${suffix}`;
};

const FocusDebugOverlay = ({enabled = false, currentView = '-', inputMode = '-', lastNavigateDebug = null}) => {
	const [focusState, setFocusState] = useState(() => ({
		active: '(none)',
		focusTarget: '(none)',
		spotlightId: '-',
		role: '-',
		mode: getSpotlightModeLabel()
	}));
	const [lastKey, setLastKey] = useState('-');
	const [lastPointer, setLastPointer] = useState('-');
	const [lastClick, setLastClick] = useState('-');
	const [lastFocus, setLastFocus] = useState('-');
	const [lastKeyDetail, setLastKeyDetail] = useState('-');
	const [lastScrollerDebug, setLastScrollerDebug] = useState('-');
	const [lastLibraryClick, setLastLibraryClick] = useState('-');
	const [lastItemSelect, setLastItemSelect] = useState('-');
	const [recentEvents, setRecentEvents] = useState([]);

	const syncFocusSnapshot = useCallback(() => {
		setFocusState(getFocusSnapshot());
	}, []);

	useEffect(() => {
		if (!enabled) return undefined;
		syncFocusSnapshot();

		const handleFocusIn = (event) => {
			const focusLabel = formatFocusLabel(event);
			setLastFocus(focusLabel);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} focusin: ${focusLabel}`));
			syncFocusSnapshot();
		};

		const handleKeyDown = (event) => {
			const keyLabel = formatKeyLabel(event);
			setLastKey(keyLabel);
			const keyDetail = formatKeyDetail(event);
			setLastKeyDetail(keyDetail);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} keydown: ${keyDetail}`));
			syncFocusSnapshot();
		};

		const handlePointer = (event) => {
			const pointerLabel = formatPointerLabel(event);
			setLastPointer(pointerLabel);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} ${pointerLabel}`));
			syncFocusSnapshot();
		};
		const handleClick = (event) => {
			const clickLabel = formatPointerLabel(event);
			setLastClick(clickLabel);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} click: ${clickLabel}`));
			syncFocusSnapshot();
		};
		const handleDomScroll = (event) => {
			const target = event?.target;
			const scrollerHost = target?.closest?.('[data-bf-scroller-id]') || target;
			const scrollerId = scrollerHost?.getAttribute?.('data-bf-scroller-id');
			if (!scrollerId) return;
			const top = Number.isFinite(Number(target?.scrollTop)) ? Number(target.scrollTop) : '-';
			const snapshot = getFocusSnapshot();
			const label = `${scrollerId} scrollTop=${top} target=${describeDomNode(target)} active=${snapshot.active} focusTarget=${snapshot.focusTarget} spotlight=${snapshot.spotlightId}`;
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} dom-scroll: ${label}`));
		};

		const handleVisibility = () => {
			syncFocusSnapshot();
		};
		const handleScrollerDebug = (event) => {
			const detail = event?.detail || {};
			const phase = detail.phase || '-';
			const type = detail.type || '-';
			const rawTop = detail.rawTop;
			const targetTop = detail.targetTop;
			const topLabel = Number.isFinite(Number(rawTop))
				? `raw=${Number(rawTop)}`
				: (Number.isFinite(Number(targetTop)) ? `target=${Number(targetTop)}` : 'top=-');
			const edgeLabel = (phase === 'stop')
				? ` edge[t:${detail.reachedTop ? '1' : '0'} b:${detail.reachedBottom ? '1' : '0'}]`
				: '';
			const entry = `${phase}/${type} ${topLabel}${edgeLabel}`;
			setLastScrollerDebug(entry);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} scroller: ${entry}`));
		};
		const handleLibraryDebug = (event) => {
			const detail = event?.detail || {};
			if (detail.type !== 'cardClick') return;
			const itemId = detail.itemId || '-';
			const top = Number.isFinite(Number(detail.scrollTop)) ? Number(detail.scrollTop) : '-';
			const entry = `cardClick item=${itemId} scrollTop=${top}`;
			setLastLibraryClick(entry);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} library: ${entry}`));
		};
		const handleItemSelectDebug = (event) => {
			const detail = event?.detail || {};
			const itemId = detail.itemId || '-';
			const itemType = detail.itemType || '-';
			const fromView = detail.fromView || '-';
			const entry = `item=${itemId} type=${itemType} from=${fromView}`;
			setLastItemSelect(entry);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} item-select: ${entry}`));
		};

		const poll = window.setInterval(syncFocusSnapshot, 500);

		document.addEventListener('focusin', handleFocusIn, true);
		document.addEventListener('keydown', handleKeyDown, true);
		document.addEventListener('pointerdown', handlePointer, true);
		document.addEventListener('mousedown', handlePointer, true);
		document.addEventListener('mouseup', handlePointer, true);
		document.addEventListener('touchstart', handlePointer, true);
		document.addEventListener('click', handleClick, true);
		document.addEventListener('scroll', handleDomScroll, true);
		document.addEventListener('visibilitychange', handleVisibility, true);
		window.addEventListener('breezyfin:scroller-debug', handleScrollerDebug, true);
		window.addEventListener('breezyfin:library-debug', handleLibraryDebug, true);
		window.addEventListener('breezyfin:item-select-debug', handleItemSelectDebug, true);

		return () => {
			window.clearInterval(poll);
			document.removeEventListener('focusin', handleFocusIn, true);
			document.removeEventListener('keydown', handleKeyDown, true);
			document.removeEventListener('pointerdown', handlePointer, true);
			document.removeEventListener('mousedown', handlePointer, true);
			document.removeEventListener('mouseup', handlePointer, true);
			document.removeEventListener('touchstart', handlePointer, true);
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('scroll', handleDomScroll, true);
			document.removeEventListener('visibilitychange', handleVisibility, true);
			window.removeEventListener('breezyfin:scroller-debug', handleScrollerDebug, true);
			window.removeEventListener('breezyfin:library-debug', handleLibraryDebug, true);
			window.removeEventListener('breezyfin:item-select-debug', handleItemSelectDebug, true);
		};
	}, [enabled, syncFocusSnapshot]);

	const rows = useMemo(() => [
		{label: 'View', value: currentView || '-'},
		{label: 'Input', value: inputMode || '-'},
		{label: 'Spotlight', value: focusState.mode},
		{label: 'Active', value: focusState.active},
		{label: 'Focus Target', value: focusState.focusTarget},
		{label: 'Spotlight ID', value: focusState.spotlightId},
		{label: 'Role', value: focusState.role},
		{label: 'Last Key', value: lastKey},
		{label: 'Last Pointer', value: lastPointer},
		{label: 'Last Click', value: lastClick},
		{label: 'Last Focus', value: lastFocus},
		{label: 'Last Key Detail', value: lastKeyDetail},
		{label: 'Last Scroller', value: lastScrollerDebug},
		{label: 'Last Library Click', value: lastLibraryClick},
		{label: 'Last Item Select', value: lastItemSelect},
		{label: 'Last Navigate', value: formatNavigateDebug(lastNavigateDebug)}
	], [
		currentView,
		focusState.active,
		focusState.focusTarget,
		focusState.mode,
		focusState.role,
		focusState.spotlightId,
		inputMode,
		lastClick,
		lastFocus,
		lastKeyDetail,
		lastKey,
		lastItemSelect,
		lastLibraryClick,
		lastNavigateDebug,
		lastScrollerDebug,
		lastPointer
	]);

	if (!enabled) return null;

	return (
		<div className={css.overlay} aria-hidden>
			<div className={css.header}>Focus Debug Overlay</div>
			<div className={css.rows}>
				{rows.map((row) => (
					<div key={row.label} className={css.row}>
						<span className={css.label}>{row.label}</span>
						<span className={css.value}>{row.value}</span>
					</div>
				))}
			</div>
			<div className={css.eventsTitle}>Recent Events</div>
			<div className={css.events}>
				{recentEvents.length > 0 ? recentEvents.map((entry, index) => (
					<div key={`${entry}-${index}`} className={css.eventRow}>{entry}</div>
				)) : <div className={css.eventRow}>No events yet.</div>}
			</div>
		</div>
	);
};

export default FocusDebugOverlay;
