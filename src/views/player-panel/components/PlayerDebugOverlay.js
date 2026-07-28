import {useCallback, useEffect, useMemo, useState} from 'react';
import Spotlight from '@enact/spotlight';
import Button from '../../../components/BreezyButton';
import {describeDomNode} from '../../../utils/domNodeDescription';
import {toInteger} from '../../../utils/numberParsing';
import {redactSensitiveUrl} from '../../../utils/sensitiveData';

import css from '../../PlayerPanel.module.less';

const READY_STATE_LABELS = {
	0: 'HAVE_NOTHING',
	1: 'HAVE_METADATA',
	2: 'HAVE_CURRENT_DATA',
	3: 'HAVE_FUTURE_DATA',
	4: 'HAVE_ENOUGH_DATA'
};

const NETWORK_STATE_LABELS = {
	0: 'NETWORK_EMPTY',
	1: 'NETWORK_IDLE',
	2: 'NETWORK_LOADING',
	3: 'NETWORK_NO_SOURCE'
};

const DEBUG_TABS = [
	{id: 'overview', label: 'Overview'},
	{id: 'playback', label: 'Playback'},
	{id: 'subtitles', label: 'Subtitles'},
	{id: 'runtime', label: 'Runtime'},
	{id: 'diagnostics', label: 'Diagnostics'}
];

const pickStreamByType = (mediaSource, streamType) => {
	const streams = mediaSource?.MediaStreams;
	if (!Array.isArray(streams)) return null;
	return streams.find((stream) => stream?.Type === streamType) || null;
};

const pickTrackByIndex = (mediaSource, streamType, index) => {
	const streamIndex = toInteger(index);
	if (streamIndex === null || streamIndex < 0) return null;
	const streams = mediaSource?.MediaStreams;
	if (!Array.isArray(streams)) return null;
	return streams.find((stream) => stream?.Type === streamType && toInteger(stream?.Index) === streamIndex) || null;
};

const getBufferedAheadSeconds = (video) => {
	if (!video?.buffered || video.buffered.length === 0) return 0;
	try {
		const current = Number(video.currentTime) || 0;
		for (let index = 0; index < video.buffered.length; index += 1) {
			const start = video.buffered.start(index);
			const end = video.buffered.end(index);
			if (current >= start && current <= end) {
				return Math.max(0, end - current);
			}
		}
		const tail = video.buffered.end(video.buffered.length - 1);
		return Math.max(0, tail - current);
	} catch (_) {
		return 0;
	}
};

const shortenUrl = (value) => {
	if (!value) return '(none)';
	return redactSensitiveUrl(value, {includeOrigin: false});
};

const formatBitrateMbps = (value) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) return '-';
	return `${(numeric / 1000000).toFixed(1)} Mbps`;
};

const formatNumber = (value) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return '-';
	return String(Math.round(numeric));
};

const joinInfo = (...parts) => {
	return parts
		.map((part) => String(part || '').trim())
		.filter(Boolean)
		.join(' | ');
};

const getAssFitSummary = () => {
	if (typeof document === 'undefined') return '-';
	const cues = Array.from(document.querySelectorAll('[data-ass-fit-scale]')).slice(0, 4);
	if (cues.length === 0) return '-';
	return cues.map((cue, index) => joinInfo(
		`cue=${index + 1}`,
		`scale=${cue.dataset.assFitScale || '-'}`,
		`reason=${cue.dataset.assFitReason || '-'}`,
		`plane=${cue.dataset.assPlane || '-'}`
	)).join(' ; ');
};

const formatBooleanFlag = (value) => (value ? 'yes' : 'no');

const PlayerDebugOverlay = ({
	enabled = false,
	onClose,
	item,
	mediaSourceData,
	playbackSession,
	videoRef,
	hlsRef,
	loading,
	error,
	playing,
	showControls,
	currentTime,
	duration,
	currentAudioTrack,
	currentSubtitleTrack,
	subtitleRendererPolicy,
	subtitleRendererState,
	runtimeDiagnostics = [],
	isCurrentTranscoding,
	skipOverlayVisible,
	showNextEpisodePrompt
}) => {
	const [activeTab, setActiveTab] = useState('overview');
	const [runtimeSnapshot, setRuntimeSnapshot] = useState({
		activeElement: '(none)',
		pointerMode: 'unknown',
		readyState: 0,
		networkState: 0,
		paused: true,
		seeking: false,
		videoWidth: 0,
		videoHeight: 0,
		bufferedAheadSeconds: 0,
		droppedFrames: null,
		totalFrames: null,
		currentSrc: '(none)',
		hlsLevel: null,
		hlsBandwidth: null,
		assFitSummary: '-'
	});

	useEffect(() => {
		if (!enabled) return undefined;

		const updateSnapshot = () => {
			const video = videoRef?.current;
			const hls = hlsRef?.current;
			const playbackQuality = typeof video?.getVideoPlaybackQuality === 'function'
				? video.getVideoPlaybackQuality()
				: null;
			setRuntimeSnapshot({
				activeElement: typeof document === 'undefined' ? '(none)' : describeDomNode(document.activeElement),
				pointerMode: Spotlight?.getPointerMode?.() ? 'pointer' : '5-way',
				readyState: Number(video?.readyState) || 0,
				networkState: Number(video?.networkState) || 0,
				paused: Boolean(video?.paused ?? true),
				seeking: Boolean(video?.seeking ?? false),
				videoWidth: Number(video?.videoWidth) || 0,
				videoHeight: Number(video?.videoHeight) || 0,
				bufferedAheadSeconds: getBufferedAheadSeconds(video),
				droppedFrames: Number.isFinite(playbackQuality?.droppedVideoFrames)
					? playbackQuality.droppedVideoFrames
					: null,
				totalFrames: Number.isFinite(playbackQuality?.totalVideoFrames)
					? playbackQuality.totalVideoFrames
					: null,
				currentSrc: shortenUrl(video?.currentSrc || mediaSourceData?.__debugVideoUrl || ''),
				hlsLevel: Number.isFinite(hls?.currentLevel) ? hls.currentLevel : null,
				hlsBandwidth: Number.isFinite(hls?.bandwidthEstimate) ? hls.bandwidthEstimate : null,
				assFitSummary: getAssFitSummary()
			});
		};

		updateSnapshot();
		const intervalId = window.setInterval(updateSnapshot, 250);
		return () => window.clearInterval(intervalId);
	}, [enabled, hlsRef, mediaSourceData?.__debugVideoUrl, videoRef]);

	const videoStream = useMemo(
		() => pickStreamByType(mediaSourceData, 'Video'),
		[mediaSourceData]
	);
	const selectedAudioStream = useMemo(
		() => pickTrackByIndex(mediaSourceData, 'Audio', currentAudioTrack),
		[currentAudioTrack, mediaSourceData]
	);
	const selectedSubtitleStream = useMemo(() => {
		if (currentSubtitleTrack === -1) return null;
		return pickTrackByIndex(mediaSourceData, 'Subtitle', currentSubtitleTrack);
	}, [currentSubtitleTrack, mediaSourceData]);
	const handleTabClick = useCallback((event) => {
		const tabId = event.currentTarget?.dataset?.tabId;
		if (tabId) setActiveTab(tabId);
	}, []);

	if (!enabled) return null;

	const readyLabel = READY_STATE_LABELS[runtimeSnapshot.readyState] || `STATE_${runtimeSnapshot.readyState}`;
	const networkLabel = NETWORK_STATE_LABELS[runtimeSnapshot.networkState] || `STATE_${runtimeSnapshot.networkState}`;
	const videoResolution = runtimeSnapshot.videoWidth > 0 && runtimeSnapshot.videoHeight > 0
		? `${runtimeSnapshot.videoWidth}x${runtimeSnapshot.videoHeight}`
		: '-';
	const sourceResolution = videoStream?.Width && videoStream?.Height
		? `${videoStream.Width}x${videoStream.Height}`
		: '-';
	const frameDropLabel = (runtimeSnapshot.totalFrames != null && runtimeSnapshot.droppedFrames != null)
		? `${runtimeSnapshot.droppedFrames}/${runtimeSnapshot.totalFrames}`
		: '-';
	const dynamicRangeLabel = mediaSourceData?.__dynamicRangeLabel || videoStream?.VideoRangeType || '-';
	const transportLabel = mediaSourceData?.__debugIsHls ? 'HLS' : 'Progressive/Static';
	const availableSources = Array.isArray(mediaSourceData?.__debugAvailableSources)
		? mediaSourceData.__debugAvailableSources
		: [];
	const selectedSourceId = mediaSourceData?.__debugSelectedSourceId || mediaSourceData?.Id || '';
	const sourceSummary = availableSources.length > 0
		? availableSources
			.map((source, index) => {
				const marker = source.id && source.id === selectedSourceId ? '*' : `${index + 1}`;
				const range = source.videoRangeType || source.videoRange || '-';
				const container = source.container || '-';
				return `${marker}:${range}/${container}`;
			})
			.join(', ')
		: '(none)';
	const requestDebug = mediaSourceData?.__debugRequest || null;
	const decisionDebug = mediaSourceData?.__debugDecision || null;
	const subtitlePolicy = subtitleRendererPolicy || mediaSourceData?.__debugSubtitlePolicy || null;
	const playbackDiagnostics = [
		...(Array.isArray(mediaSourceData?.__debugDiagnostics) ? mediaSourceData.__debugDiagnostics : []),
		...(Array.isArray(runtimeDiagnostics) ? runtimeDiagnostics : [])
	];
	const diagnosticsSummary = playbackDiagnostics.length > 0
		? playbackDiagnostics
			.slice(-10)
			.map((entry) => joinInfo(
				`${entry?.scope || 'playback'}/${entry?.stage || 'unknown'}=${entry?.status || 'info'}`,
				entry?.reason || '',
				entry?.message || ''
			))
			.join(' ; ')
		: '-';
	const requestSummary = requestDebug
		? joinInfo(
			`hevcRange=${requestDebug.hevcVideoRangeTypes || '-'}`,
			`h264Range=${requestDebug.h264VideoRangeTypes || '-'}`,
			`profiles=${requestDebug.videoDirectPlayContainers || '-'}`,
			`dp=${requestDebug.enableDirectPlay ? 'yes' : 'no'}`,
			`ds=${requestDebug.enableDirectStream ? 'yes' : 'no'}`,
			`tc=${requestDebug.enableTranscoding ? 'yes' : 'no'}`,
			`sources=${requestDebug.mediaSourceCount ?? '-'}`
		)
		: '-';
	const decisionSummary = decisionDebug
		? joinInfo(
			decisionDebug.playMethod || '-',
			`source=${decisionDebug.selectedMediaSourceId || '-'}`,
			`sourceRange=${decisionDebug.dynamicRangeId || '-'}`,
			`container=${decisionDebug.container || '-'}`,
			`reqA=${decisionDebug.requestedAudioStreamIndex ?? '-'}`,
			`selA=${decisionDebug.selectedAudioStreamIndex ?? '-'}`,
			`selS=${decisionDebug.selectedSubtitleStreamIndex ?? '-'}`,
			`clientS=${decisionDebug.clientRenderedSubtitleStreamIndex ?? '-'}`,
			`origRange=${decisionDebug.originalDynamicRangeId || '-'}`,
			`cap=${decisionDebug.dynamicRangeCap || 'auto'}`,
			`fmp4=${decisionDebug.fmp4HlsPreference?.forced ? 'force' : (decisionDebug.fmp4HlsPreference?.enabled ? 'on' : 'off')}`,
			`vCopy=${decisionDebug.payload?.allowVideoStreamCopy ? 'yes' : 'no'}`,
			`aCopy=${decisionDebug.payload?.allowAudioStreamCopy ? 'yes' : 'no'}`,
			decisionDebug.disableDirectPlay ? 'dpOff=yes' : '',
			decisionDebug.forceDolbyVision ? 'forceDV=yes' : '',
			decisionDebug.avoidDolbyVision ? 'avoidDV=yes' : '',
			decisionDebug.forceSubtitleBurnIn ? 'subBurn=yes' : '',
			decisionDebug.safeSubtitleBurnInProfile ? 'safeSubBurn=yes' : '',
			decisionDebug.safeSdrFallbackProfile ? 'safeSDR=yes' : ''
		)
		: '-';

	const subtitleDebug = subtitleRendererState?.debug || {};
	const debugSections = {
		overview: [
			{label: 'Item', value: `${item?.Id || '-'} (${item?.Type || '-'})`},
			{
				label: 'State',
				value: joinInfo(
					`loading=${loading ? 'yes' : 'no'}`,
					`playing=${playing ? 'yes' : 'no'}`,
					`controls=${showControls ? 'yes' : 'no'}`,
					`error=${error ? 'yes' : 'no'}`
				)
			},
			{
				label: 'Session',
				value: joinInfo(
					playbackSession?.playMethod || mediaSourceData?.__selectedPlayMethod || '-',
					`session=${playbackSession?.playSessionId || '-'}`,
					`source=${playbackSession?.mediaSourceId || mediaSourceData?.Id || '-'}`
				)
			},
			{label: 'Sources', value: sourceSummary},
			{
				label: 'Position',
				value: joinInfo(
					`${formatNumber(currentTime)} / ${formatNumber(duration)} sec`,
					`hlsLvl=${runtimeSnapshot.hlsLevel ?? '-'}`,
					`hlsBw=${formatBitrateMbps(runtimeSnapshot.hlsBandwidth)}`
				)
			},
			{
				label: 'Overlays',
				value: joinInfo(
					`skip=${skipOverlayVisible ? 'yes' : 'no'}`,
					`nextEpisode=${showNextEpisodePrompt ? 'yes' : 'no'}`
				)
			}
		],
		playback: [
			{label: 'Request', value: requestSummary},
			{label: 'Decision', value: decisionSummary},
			{
				label: 'Stream',
				value: joinInfo(
					`container=${mediaSourceData?.Container || '-'}`,
					`transport=${transportLabel}`,
					`engine=${mediaSourceData?.__debugHlsEngine || '-'}`,
					`transcoding=${isCurrentTranscoding ? 'yes' : 'no'}`
				)
			},
			{label: 'URL', value: runtimeSnapshot.currentSrc},
			{
				label: 'Video',
				value: joinInfo(
					videoStream?.Codec || '-',
					videoStream?.Profile || '-',
					`lvl=${videoStream?.Level ?? '-'}`,
					`src=${sourceResolution}`,
					`el=${videoResolution}`,
					`br=${formatBitrateMbps(videoStream?.BitRate)}`
				)
			},
			{
				label: 'Signal',
				value: joinInfo(
					`transfer=${videoStream?.ColorTransfer || '-'}`,
					`primaries=${videoStream?.ColorPrimaries || '-'}`,
					`space=${videoStream?.ColorSpace || '-'}`,
					`depth=${videoStream?.BitDepth ?? '-'}`,
					`codecTag=${videoStream?.CodecTag || '-'}`
				)
			},
			{
				label: 'Range',
				value: joinInfo(
					`requestedOutput=${dynamicRangeLabel}`,
					`sourceType=${videoStream?.VideoRangeType || '-'}`,
					`sourceRange=${videoStream?.VideoRange || '-'}`,
					`cap=${mediaSourceData?.__requestedDynamicRangeCap || 'auto'}`,
					mediaSourceData?.__safeSdrFallbackProfile ? 'safeSDR=yes' : ''
				)
			},
			{
				label: 'Audio',
				value: joinInfo(
					`idx=${toInteger(currentAudioTrack) ?? '-'}`,
					selectedAudioStream?.Codec || '-',
					selectedAudioStream?.ChannelLayout || `ch=${selectedAudioStream?.Channels ?? '-'}`,
					selectedAudioStream?.DisplayTitle || '-'
				)
			},
			{
				label: 'Server',
				value: joinInfo(
					`dp=${formatBooleanFlag(mediaSourceData?.SupportsDirectPlay)}`,
					`ds=${formatBooleanFlag(mediaSourceData?.SupportsDirectStream)}`,
					`tc=${formatBooleanFlag(mediaSourceData?.SupportsTranscoding)}`,
					`tcUrl=${mediaSourceData?.TranscodingUrl ? 'yes' : 'no'}`
				)
			}
		],
		subtitles: [
			{
				label: 'Track',
				value: currentSubtitleTrack === -1
					? 'off'
					: joinInfo(
						`idx=${toInteger(currentSubtitleTrack) ?? '-'}`,
						selectedSubtitleStream?.Codec || '-',
						selectedSubtitleStream?.DisplayTitle || '-'
					)
			},
			{
				label: 'Policy',
				value: subtitlePolicy
					? joinInfo(
						`mode=${subtitlePolicy.mode || '-'}`,
						`burn=${subtitlePolicy.forceBurnIn || subtitlePolicy.requiresBurnIn ? 'yes' : 'no'}`,
						`renderer=${subtitlePolicy.renderer || '-'}`,
						`codec=${subtitlePolicy.codec || '-'}`,
						`reason=${subtitlePolicy.reason || '-'}`
					)
					: '-'
			},
			{
				label: 'Renderer',
				value: subtitleRendererState
					? joinInfo(
						`renderer=${subtitleRendererState.renderer || '-'}`,
						`status=${subtitleRendererState.status || '-'}`,
						`events=${subtitleRendererState.eventCount ?? subtitleRendererState.cueCount ?? '-'}`,
						`cues=${subtitleRendererState.cueCount ?? '-'}`,
						`active=${subtitleRendererState.activeCueCount ?? '-'}`,
						subtitleRendererState.fallbackReason ? `fallback=${subtitleRendererState.fallbackReason}` : '',
						subtitleRendererState.error ? `error=${subtitleRendererState.error}` : ''
					)
					: '-'
			},
			{label: 'ASS Fit', value: runtimeSnapshot.assFitSummary},
			{
				label: 'Engine',
				value: joinInfo(
					subtitleDebug.engine ? `engine=${subtitleDebug.engine}` : '',
					subtitleDebug.requestedRenderer ? `requested=${subtitleDebug.requestedRenderer}` : '',
						subtitleDebug.externalStatus ? `external=${subtitleDebug.externalStatus}` : '',
						subtitleDebug.readyStatus ? `ready=${subtitleDebug.readyStatus}` : '',
						subtitleDebug.readyWaitMs >= 0 ? `readyWait=${subtitleDebug.readyWaitMs}ms` : '',
						subtitleDebug.fallbackRenderer ? `fallbackRenderer=${subtitleDebug.fallbackRenderer}` : '',
						subtitleDebug.mode ? `mode=${subtitleDebug.mode}` : '',
						subtitleDebug.libassStatus ? `libass=${subtitleDebug.libassStatus}` : ''
				) || '-'
			},
			{
				label: 'JASSUB Track',
				value: joinInfo(
					subtitleDebug.jassubTrackStatus ? `track=${subtitleDebug.jassubTrackStatus}` : '',
					subtitleDebug.jassubEventStatus ? `events=${subtitleDebug.jassubEventStatus}` : '',
					subtitleDebug.jassubStyleStatus ? `styles=${subtitleDebug.jassubStyleStatus}` : '',
					subtitleDebug.jassubEventCount >= 0 ? `eventCount=${subtitleDebug.jassubEventCount}` : '',
					subtitleDebug.jassubStyleCount >= 0 ? `styleCount=${subtitleDebug.jassubStyleCount}` : '',
					subtitleDebug.jassubActiveEventsAssMs >= 0 ? `activeSource=${subtitleDebug.jassubActiveEventsAssMs}` : '',
					subtitleDebug.jassubActiveEventsAssCs >= 0 ? `activeCs=${subtitleDebug.jassubActiveEventsAssCs}` : '',
					subtitleDebug.jassubCurrentTimeSeconds >= 0 ? `at=${subtitleDebug.jassubCurrentTimeSeconds}s` : '',
					subtitleDebug.jassubTrackDiagnosticAgeMs >= 0 ? `age=${subtitleDebug.jassubTrackDiagnosticAgeMs}ms` : '',
					subtitleDebug.jassubTrackError ? `error=${subtitleDebug.jassubTrackError}` : ''
				) || '-'
			},
			{
				label: 'JASSUB Data',
				value: joinInfo(
					subtitleDebug.jassubOptions ? `options=${subtitleDebug.jassubOptions}` : '',
					subtitleDebug.jassubFirstStyle ? `style=${subtitleDebug.jassubFirstStyle}` : '',
					subtitleDebug.jassubActiveEvent ? `active=${subtitleDebug.jassubActiveEvent}` : '',
					subtitleDebug.jassubFirstEvent ? `first=${subtitleDebug.jassubFirstEvent}` : ''
				) || '-'
			},
			{
				label: 'Bitmap',
				value: joinInfo(
					subtitleDebug.bitmapBackend ? `backend=${subtitleDebug.bitmapBackend}` : '',
					subtitleDebug.bitmapSource ? `source=${subtitleDebug.bitmapSource}` : '',
					subtitleDebug.bitmapDeliverySource ? `delivery=${subtitleDebug.bitmapDeliverySource}` : '',
					subtitleDebug.bitmapDeliveryFormat ? `format=${subtitleDebug.bitmapDeliveryFormat}` : '',
					Number.isFinite(subtitleDebug.bitmapDeliveryCandidateCount) ? `candidates=${subtitleDebug.bitmapDeliveryCandidateCount}` : '',
					Number.isFinite(subtitleDebug.bitmapBytes) ? `bytes=${subtitleDebug.bitmapBytes}` : '',
					subtitleDebug.bitmapPgsMagic !== null && subtitleDebug.bitmapPgsMagic !== undefined ? `pg=${subtitleDebug.bitmapPgsMagic ? 'yes' : 'no'}` : '',
					Number.isFinite(subtitleDebug.bitmapCueCount) ? `cues=${subtitleDebug.bitmapCueCount}` : '',
					subtitleDebug.bitmapScreen ? `screen=${subtitleDebug.bitmapScreen}` : '',
					Number.isFinite(subtitleDebug.bitmapCurrentCue) ? `cue=${subtitleDebug.bitmapCurrentCue}` : '',
					subtitleDebug.bitmapCache ? `cache=${subtitleDebug.bitmapCache}` : '',
					subtitleDebug.bitmapWorker ? `worker=${subtitleDebug.bitmapWorker}` : '',
					Number.isFinite(subtitleDebug.bitmapFrames) ? `frames=${subtitleDebug.bitmapFrames}` : '',
					Number.isFinite(subtitleDebug.bitmapDropped) ? `dropped=${subtitleDebug.bitmapDropped}` : '',
					subtitleDebug.bitmapLastStatus ? `last=${subtitleDebug.bitmapLastStatus}` : '',
					subtitleDebug.bitmapDiagnosticError ? `diagError=${subtitleDebug.bitmapDiagnosticError}` : ''
				) || '-'
			},
			{
				label: 'Bitmap Delivery',
				value: joinInfo(
					subtitleDebug.bitmapDeliveryUrl ? `url=${subtitleDebug.bitmapDeliveryUrl}` : '',
					subtitleDebug.bitmapDeliveryCandidates ? `candidates=${subtitleDebug.bitmapDeliveryCandidates}` : '',
					subtitleDebug.bitmapProbeResults ? `probes=${subtitleDebug.bitmapProbeResults}` : '',
					subtitleDebug.bitmapFirstBytes ? `bytes=${subtitleDebug.bitmapFirstBytes}` : ''
				) || '-'
			},
			{
				label: 'Timing',
				value: joinInfo(
					subtitleDebug.videoPhase ? `phase=${subtitleDebug.videoPhase}` : '',
					subtitleDebug.videoState ? `video=${subtitleDebug.videoState}` : '',
					subtitleDebug.videoFrameCallback ? `rvfc=${subtitleDebug.videoFrameCallback}` : '',
					subtitleDebug.renderMode ? `render=${subtitleDebug.renderMode}` : '',
					subtitleDebug.targetFps ? `fps=${subtitleDebug.targetFps}` : '',
					subtitleDebug.rendererLastRenderTime ? `lastRender=${subtitleDebug.rendererLastRenderTime}` : '',
					subtitleDebug.rendererFrameId ? `frame=${subtitleDebug.rendererFrameId}` : '',
					subtitleDebug.rendererDemandMediaTime ? `media=${subtitleDebug.rendererDemandMediaTime}` : '',
					subtitleDebug.rendererBusy ? `busy=${subtitleDebug.rendererBusy}` : ''
				) || '-'
			},
			{
				label: 'Manual Sync',
				value: joinInfo(
					subtitleDebug.manualSyncIntervalMs ? `syncEvery=${subtitleDebug.manualSyncIntervalMs}ms` : '',
					subtitleDebug.rendererManualSyncCount ? `syncs=${subtitleDebug.rendererManualSyncCount}` : '',
					subtitleDebug.rendererManualSyncAgeMs >= 0 ? `syncAge=${subtitleDebug.rendererManualSyncAgeMs}ms` : '',
					subtitleDebug.manualRenderStatus ? `manualRender=${subtitleDebug.manualRenderStatus}` : '',
					subtitleDebug.manualRenderAgeMs >= 0 ? `renderAge=${subtitleDebug.manualRenderAgeMs}ms` : '',
					subtitleDebug.manualRenderTimeoutMs ? `timeout=${subtitleDebug.manualRenderTimeoutMs}ms` : '',
					subtitleDebug.manualRenderError ? `renderError=${subtitleDebug.manualRenderError}` : ''
				) || '-'
			},
			{
				label: 'Layer',
				value: joinInfo(
					subtitleDebug.layerChildren >= 0 ? `children=${subtitleDebug.layerChildren}` : '',
					subtitleDebug.layerBox ? `layer=${subtitleDebug.layerBox}` : '',
					subtitleDebug.layerHitTest ? `hit=${subtitleDebug.layerHitTest}` : '',
					subtitleDebug.assBox ? `assBox=${subtitleDebug.assBox}` : '',
					subtitleDebug.assDialogueCount >= 0 ? `assNodes=${subtitleDebug.assDialogueCount}` : ''
				) || '-'
			},
			{
				label: 'Canvas',
				value: joinInfo(
					subtitleDebug.canvasMode ? `mode=${subtitleDebug.canvasMode}` : '',
					subtitleDebug.canvasParent ? `parent=${subtitleDebug.canvasParent}` : '',
					subtitleDebug.canvasBox ? `box=${subtitleDebug.canvasBox}` : '',
					subtitleDebug.canvasBackingStore ? `store=${subtitleDebug.canvasBackingStore}` : '',
					subtitleDebug.canvasParentBox ? `parentBox=${subtitleDebug.canvasParentBox}` : '',
					subtitleDebug.canvasPixels ? `pixels=${subtitleDebug.canvasPixels}` : '',
					subtitleDebug.canvasAlphaSamples > 0 ? `alpha=${subtitleDebug.canvasAlphaSamples}` : '',
					subtitleDebug.canvasMaxAlpha > 0 ? `maxA=${subtitleDebug.canvasMaxAlpha}` : ''
				) || '-'
			},
			{
				label: 'Fetch',
				value: joinInfo(
					subtitleDebug.cacheHit === true ? 'cache=yes' : '',
					subtitleDebug.fetchMs >= 0 ? `fetch=${subtitleDebug.fetchMs}ms` : '',
					subtitleDebug.rawShape ? `shape=${subtitleDebug.rawShape}` : '',
					subtitleDebug.rawFormat ? `raw=${subtitleDebug.rawFormat}` : '',
					subtitleDebug.rawTried ? `tried=${subtitleDebug.rawTried}` : '',
					subtitleDebug.path ? `path=${subtitleDebug.path}` : '',
					subtitleDebug.rawPath ? `rawPath=${subtitleDebug.rawPath}` : ''
				) || '-'
			}
		],
		runtime: [
			{
				label: 'Element',
				value: joinInfo(
					readyLabel,
					networkLabel,
					`paused=${runtimeSnapshot.paused ? 'yes' : 'no'}`,
					`seeking=${runtimeSnapshot.seeking ? 'yes' : 'no'}`,
					`buffer=${runtimeSnapshot.bufferedAheadSeconds.toFixed(1)}s`,
					`drop=${frameDropLabel}`
				)
			},
			{
				label: 'Focus',
				value: joinInfo(
					`mode=${runtimeSnapshot.pointerMode}`,
					runtimeSnapshot.activeElement
				)
			},
			{label: 'Video Src', value: runtimeSnapshot.currentSrc}
		],
		diagnostics: [
			{label: 'Playback', value: diagnosticsSummary},
			{
				label: 'Subtitle Diag',
				value: subtitleDebug.diagnosticAtMs ? `diag=${subtitleDebug.diagnosticAtMs}` : '-'
			},
			{
				label: 'Worker',
				value: subtitleDebug.workerUrl ? `worker=${subtitleDebug.workerUrl}` : '-'
			},
			{
					label: 'Video Source',
					value: joinInfo(
						subtitleDebug.videoSourceStatus ? `videoSource=${subtitleDebug.videoSourceStatus}` : '',
						subtitleDebug.videoSourceWaitMs >= 0 ? `videoWait=${subtitleDebug.videoSourceWaitMs}ms` : '',
						subtitleDebug.videoReadyState >= 0 ? `readyState=${subtitleDebug.videoReadyState}` : '',
						subtitleDebug.videoNetworkState >= 0 ? `network=${subtitleDebug.videoNetworkState}` : '',
						subtitleDebug.videoHasCurrentSrc ? 'currentSrc=yes' : '',
						subtitleDebug.videoHasSrc ? 'src=yes' : '',
						subtitleDebug.videoHasSrcObject ? 'srcObject=yes' : ''
					) || '-'
				}
		]
	};
	const activeRows = debugSections[activeTab] || debugSections.overview;

	return (
		<div className={css.debugOverlay} aria-hidden>
			<div className={css.debugOverlayHeader}>
				<div className={css.debugOverlayTitle}>Extended Debug Metrics</div>
				{typeof onClose === 'function' ? (
					<Button size="small" onClick={onClose} className={css.debugOverlayCloseButton}>
						Hide
					</Button>
				) : null}
			</div>
			<div className={css.debugOverlayTabs}>
				{DEBUG_TABS.map((tab) => (
					<Button
						key={tab.id}
						size="small"
						onClick={handleTabClick}
						className={css.debugOverlayTabButton}
						data-active={activeTab === tab.id}
						data-tab-id={tab.id}
					>
						{tab.label}
					</Button>
				))}
			</div>
			<div className={css.debugOverlayRows}>
				{activeRows.map((row) => (
					<div key={row.label} className={css.debugOverlayRow}>
						<span className={css.debugOverlayLabel}>{row.label}</span>
						<span className={css.debugOverlayValue}>{row.value}</span>
					</div>
				))}
			</div>
		</div>
	);
};

export default PlayerDebugOverlay;
