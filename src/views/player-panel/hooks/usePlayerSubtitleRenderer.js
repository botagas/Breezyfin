import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import jellyfinService from '../../../services/jellyfinService';
import {getSubtitleTranscodePolicy} from '../../../services/jellyfin/playbackSelection';
import {toInteger} from '../../../utils/numberParsing';
import {
	findActiveSubtitleCues,
	normalizeSubtitleEvents
} from '../utils/subtitleRenderer';
import {
	getSubtitleBurnInFallbackStatus,
	normalizeSubtitleRendererFailureReason
} from '../utils/subtitleRendererStatus';

const SUBTITLE_EVENT_CACHE_LIMIT = 8;
const subtitleEventCache = new Map();

const getSubtitleTrack = (tracks, trackIndex) => {
	const index = toInteger(trackIndex);
	if (index === null || index < 0) return null;
	return (tracks || []).find((track) => toInteger(track?.Index) === index) || null;
};

const readSubtitleEventCache = (key) => {
	if (!key || !subtitleEventCache.has(key)) return null;
	const value = subtitleEventCache.get(key);
	subtitleEventCache.delete(key);
	subtitleEventCache.set(key, value);
	return value;
};

const writeSubtitleEventCache = (key, value) => {
	if (!key) return;
	subtitleEventCache.set(key, value);
	while (subtitleEventCache.size > SUBTITLE_EVENT_CACHE_LIMIT) {
		const firstKey = subtitleEventCache.keys().next().value;
		subtitleEventCache.delete(firstKey);
	}
};

export const usePlayerSubtitleRenderer = ({
	item,
	mediaSourceData,
	subtitleTracks,
	currentSubtitleTrack,
	currentTime,
	playbackSettingsRef,
	onBurnInFallback,
	setToastMessage
}) => {
	const requestIdRef = useRef(0);
	const fallbackAttemptedKeysRef = useRef(new Set());
	const [events, setEvents] = useState([]);
	const [state, setState] = useState({
		renderer: 'off',
		status: 'off',
		error: '',
		fallbackReason: '',
		eventCount: 0,
		cueCount: 0,
		activeCueCount: 0,
		debug: null
	});

	const selectedSubtitleTrack = useMemo(
		() => getSubtitleTrack(subtitleTracks, currentSubtitleTrack),
		[currentSubtitleTrack, subtitleTracks]
	);
	const subtitlePolicy = useMemo(() => {
		if (!(Number.isInteger(currentSubtitleTrack) && currentSubtitleTrack >= 0)) {
			return mediaSourceData?.__debugSubtitlePolicy || null;
		}
		const settings = playbackSettingsRef?.current || {};
		return getSubtitleTranscodePolicy(mediaSourceData, currentSubtitleTrack, {
			smartSubtitleTranscoding: settings.smartSubtitleTranscoding,
			enableSubtitleBurnIn: settings.enableSubtitleBurnIn,
			allowSubtitleBurnInOnHdr: settings.forceSubtitleBurnInOnHdr === true || settings.forceSubtitleBurnIn === true,
			subtitleBurnInTextCodecs: settings.subtitleBurnInTextCodecs
		});
	}, [currentSubtitleTrack, mediaSourceData, playbackSettingsRef]);
	const shouldUseClientRenderer =
		Number.isInteger(currentSubtitleTrack) &&
		currentSubtitleTrack >= 0 &&
		subtitlePolicy?.renderer === 'client' &&
		subtitlePolicy?.clientRender === true;
	const subtitleKey = shouldUseClientRenderer
		? `${item?.Id || ''}:${mediaSourceData?.Id || ''}:${currentSubtitleTrack}`
		: '';

	useEffect(() => {
		fallbackAttemptedKeysRef.current = new Set();
	}, [item?.Id, mediaSourceData?.Id]);

	const fallbackToBurnIn = useCallback((reason) => {
		const fallbackAllowed = subtitlePolicy?.fallbackBurnInAllowed === true;
		const fallbackAlreadyStarted = !subtitleKey || fallbackAttemptedKeysRef.current.has(subtitleKey);
		if (!subtitleKey || fallbackAttemptedKeysRef.current.has(subtitleKey)) {
			return getSubtitleBurnInFallbackStatus({
				fallbackAllowed,
				fallbackAlreadyStarted
			});
		}
		if (!fallbackAllowed) {
			setToastMessage('Subtitle renderer failed. Preserving HDR/DV without subtitle burn-in.');
			return getSubtitleBurnInFallbackStatus({fallbackAllowed});
		}
		fallbackAttemptedKeysRef.current.add(subtitleKey);
		setToastMessage('Subtitle renderer failed. Retrying with subtitle burn-in...');
		if (typeof onBurnInFallback !== 'function') {
			return getSubtitleBurnInFallbackStatus({
				fallbackAllowed,
				hasFallbackHandler: false
			});
		}
		onBurnInFallback({
			subtitleStreamIndex: currentSubtitleTrack,
			reason
		});
		return getSubtitleBurnInFallbackStatus({
			fallbackAllowed,
			hasFallbackHandler: true
		});
	}, [currentSubtitleTrack, onBurnInFallback, setToastMessage, subtitleKey, subtitlePolicy?.fallbackBurnInAllowed]);

	useEffect(() => {
		requestIdRef.current += 1;
		const requestId = requestIdRef.current;
		if (!shouldUseClientRenderer) {
			setEvents([]);
			setState({
				renderer: currentSubtitleTrack === -1
					? 'off'
					: (subtitlePolicy?.renderer || 'native'),
				status: currentSubtitleTrack === -1 ? 'off' : (subtitlePolicy?.renderer || 'native'),
				error: '',
				fallbackReason: '',
				eventCount: 0,
				cueCount: 0,
				activeCueCount: 0,
				debug: null
			});
			return undefined;
		}
		if (!item?.Id || !mediaSourceData?.Id || !selectedSubtitleTrack) {
			const fallbackStatus = fallbackToBurnIn('missing-subtitle-context');
			setEvents([]);
			setState({
				renderer: 'client',
				status: fallbackStatus,
				error: 'missing-subtitle-context',
				fallbackReason: 'missing-subtitle-context',
				eventCount: 0,
				cueCount: 0,
				activeCueCount: 0,
				debug: {cacheKey: subtitleKey || '', cacheHit: false}
			});
			return undefined;
		}

		const cachedEvents = readSubtitleEventCache(subtitleKey);
		if (cachedEvents) {
			setEvents(cachedEvents.events);
			setState({
				renderer: 'client',
				status: 'ready',
				error: '',
				fallbackReason: '',
				eventCount: cachedEvents.events.length,
				cueCount: cachedEvents.events.length,
				activeCueCount: 0,
				debug: {
					...cachedEvents.debug,
					cacheHit: true,
					cacheKey: subtitleKey
				}
			});
			return undefined;
		}

		let cancelled = false;
		setEvents([]);
		setState({
			renderer: 'client',
			status: 'loading',
			error: '',
			fallbackReason: '',
			eventCount: 0,
			cueCount: 0,
			activeCueCount: 0,
			debug: {
				cacheKey: subtitleKey,
				cacheHit: false
			}
		});

		const fetchStartedAt = Date.now();
		jellyfinService.getSubtitleEvents(item.Id, mediaSourceData.Id, currentSubtitleTrack)
			.then((result) => {
				if (cancelled || requestId !== requestIdRef.current) return;
				const fetchMs = Date.now() - fetchStartedAt;
				const resultDebug = {
					cacheKey: subtitleKey,
					cacheHit: false,
					path: result?.path || '',
					rawShape: result?.rawShape || 'unknown',
					fetchMs
				};
				if (result?.ok !== true) {
					const reason = normalizeSubtitleRendererFailureReason(result?.error);
					const fallbackStatus = fallbackToBurnIn(reason);
					setEvents([]);
					setState({
						renderer: 'client',
						status: fallbackStatus,
						error: reason,
						fallbackReason: reason,
						eventCount: 0,
						cueCount: 0,
						activeCueCount: 0,
						debug: resultDebug
					});
					return;
				}
				const normalizedEvents = normalizeSubtitleEvents(result.events);
				if (normalizedEvents.length === 0) {
					const reason = 'empty-events';
					const fallbackStatus = fallbackToBurnIn(reason);
					setEvents([]);
					setState({
						renderer: 'client',
						status: fallbackStatus,
						error: reason,
						fallbackReason: reason,
						eventCount: 0,
						cueCount: 0,
						activeCueCount: 0,
						debug: resultDebug
					});
					return;
				}
				writeSubtitleEventCache(subtitleKey, {
					events: normalizedEvents,
					debug: resultDebug
				});
				setEvents(normalizedEvents);
				setState({
					renderer: 'client',
					status: 'ready',
					error: '',
					fallbackReason: '',
					eventCount: normalizedEvents.length,
					cueCount: normalizedEvents.length,
					activeCueCount: 0,
					debug: resultDebug
				});
			})
			.catch((error) => {
				if (cancelled || requestId !== requestIdRef.current) return;
				const reason = normalizeSubtitleRendererFailureReason(error?.message, 'fetch-failed');
				const fallbackStatus = fallbackToBurnIn(reason);
				setEvents([]);
				setState({
					renderer: 'client',
					status: fallbackStatus,
					error: 'fetch-failed',
					fallbackReason: reason,
					eventCount: 0,
					cueCount: 0,
					activeCueCount: 0,
					debug: {
						cacheKey: subtitleKey,
						cacheHit: false,
						fetchMs: Date.now() - fetchStartedAt
					}
				});
			});

		return () => {
			cancelled = true;
		};
	}, [
		currentSubtitleTrack,
		fallbackToBurnIn,
		item?.Id,
		mediaSourceData?.Id,
		selectedSubtitleTrack,
		shouldUseClientRenderer,
		subtitleKey,
		subtitlePolicy?.renderer
	]);

	const activeSubtitle = useMemo(() => {
		if (!shouldUseClientRenderer || state.status !== 'ready') {
			return {
				cues: [],
				text: '',
				activeCount: 0
			};
		}
		const active = findActiveSubtitleCues(events, currentTime);
		return {
			...active,
			text: active.cues.map((cue) => cue.lines.join('\n')).join('\n')
		};
	}, [currentTime, events, shouldUseClientRenderer, state.status]);

	useEffect(() => {
		setState((current) => {
			if (current.activeCueCount === activeSubtitle.activeCount) return current;
			return {
				...current,
				activeCueCount: activeSubtitle.activeCount
			};
		});
	}, [activeSubtitle.activeCount]);

	return {
		subtitleText: activeSubtitle.text,
		subtitleCues: activeSubtitle.cues,
		subtitleRendererPolicy: subtitlePolicy,
		subtitleRendererState: state
	};
};
