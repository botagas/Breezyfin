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

const formatPointerLabel = (event) => {
	if (!event) return '-';
	const eventType = event.type || 'pointer';
	const target = event.target;
	return `${eventType} -> ${describeDomNode(target)}`;
};

const formatFocusLabel = (event) => {
	if (!event) return '-';
	return describeDomNode(event.target);
};

const pushRecentEvent = (entries, nextEntry) => (
	[nextEntry, ...entries].slice(0, MAX_RECENT_EVENTS)
);

const FocusDebugOverlay = ({enabled = false, currentView = '-', inputMode = '-'}) => {
	const [focusState, setFocusState] = useState(() => ({
		active: '(none)',
		focusTarget: '(none)',
		spotlightId: '-',
		role: '-',
		mode: getSpotlightModeLabel()
	}));
	const [lastKey, setLastKey] = useState('-');
	const [lastPointer, setLastPointer] = useState('-');
	const [lastFocus, setLastFocus] = useState('-');
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
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} keydown: ${keyLabel}`));
			syncFocusSnapshot();
		};

		const handlePointer = (event) => {
			const pointerLabel = formatPointerLabel(event);
			setLastPointer(pointerLabel);
			setRecentEvents((entries) => pushRecentEvent(entries, `${formatTime()} ${pointerLabel}`));
			syncFocusSnapshot();
		};

		const handleVisibility = () => {
			syncFocusSnapshot();
		};

		const poll = window.setInterval(syncFocusSnapshot, 500);

		document.addEventListener('focusin', handleFocusIn, true);
		document.addEventListener('keydown', handleKeyDown, true);
		document.addEventListener('pointerdown', handlePointer, true);
		document.addEventListener('mousedown', handlePointer, true);
		document.addEventListener('touchstart', handlePointer, true);
		document.addEventListener('visibilitychange', handleVisibility, true);

		return () => {
			window.clearInterval(poll);
			document.removeEventListener('focusin', handleFocusIn, true);
			document.removeEventListener('keydown', handleKeyDown, true);
			document.removeEventListener('pointerdown', handlePointer, true);
			document.removeEventListener('mousedown', handlePointer, true);
			document.removeEventListener('touchstart', handlePointer, true);
			document.removeEventListener('visibilitychange', handleVisibility, true);
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
		{label: 'Last Focus', value: lastFocus}
	], [
		currentView,
		focusState.active,
		focusState.focusTarget,
		focusState.mode,
		focusState.role,
		focusState.spotlightId,
		inputMode,
		lastFocus,
		lastKey,
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
