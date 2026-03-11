import {useEffect, useMemo, useState} from 'react';
import Spotlight from '@enact/spotlight';
import Button from '../../../components/BreezyButton';
import {describeDomNode} from '../../../utils/domNodeDescription';
import {toInteger} from '../../../utils/numberParsing';

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
	try {
		const url = new URL(value, window.location.origin);
		return `${url.pathname}${url.search}`;
	} catch (_) {
		return String(value);
	}
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
	isCurrentTranscoding,
	skipOverlayVisible,
	showNextEpisodePrompt
}) => {
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
		hlsBandwidth: null
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
				hlsBandwidth: Number.isFinite(hls?.bandwidthEstimate) ? hls.bandwidthEstimate : null
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

	const rows = [
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
		{
			label: 'Sources',
			value: sourceSummary
		},
		{
			label: 'Request',
			value: requestSummary
		},
		{
			label: 'Stream',
			value: joinInfo(
				`container=${mediaSourceData?.Container || '-'}`,
				`transport=${transportLabel}`,
				`engine=${mediaSourceData?.__debugHlsEngine || '-'}`,
				`transcoding=${isCurrentTranscoding ? 'yes' : 'no'}`,
				`url=${runtimeSnapshot.currentSrc}`
			)
		},
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
				`label=${dynamicRangeLabel}`,
				`type=${videoStream?.VideoRangeType || '-'}`,
				`range=${videoStream?.VideoRange || '-'}`,
				`cap=${mediaSourceData?.__requestedDynamicRangeCap || 'auto'}`
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
			label: 'Subtitle',
			value: currentSubtitleTrack === -1
				? 'off'
				: joinInfo(
					`idx=${toInteger(currentSubtitleTrack) ?? '-'}`,
					selectedSubtitleStream?.Codec || '-',
					selectedSubtitleStream?.DisplayTitle || '-'
				)
		},
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
			label: 'Server',
			value: joinInfo(
				`dp=${formatBooleanFlag(mediaSourceData?.SupportsDirectPlay)}`,
				`ds=${formatBooleanFlag(mediaSourceData?.SupportsDirectStream)}`,
				`tc=${formatBooleanFlag(mediaSourceData?.SupportsTranscoding)}`,
				`tcUrl=${mediaSourceData?.TranscodingUrl ? 'yes' : 'no'}`
			)
		},
		{
			label: 'Position',
			value: joinInfo(
				`${formatNumber(currentTime)} / ${formatNumber(duration)} sec`,
				`hlsLvl=${runtimeSnapshot.hlsLevel ?? '-'}`,
				`hlsBw=${formatBitrateMbps(runtimeSnapshot.hlsBandwidth)}`
			)
		},
		{
			label: 'Focus',
			value: joinInfo(
				`mode=${runtimeSnapshot.pointerMode}`,
				runtimeSnapshot.activeElement
			)
		},
		{
			label: 'Overlays',
			value: joinInfo(
				`skip=${skipOverlayVisible ? 'yes' : 'no'}`,
				`nextEpisode=${showNextEpisodePrompt ? 'yes' : 'no'}`
			)
		}
	];

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
			{rows.map((row) => (
				<div key={row.label} className={css.debugOverlayRow}>
					<span className={css.debugOverlayLabel}>{row.label}</span>
					<span className={css.debugOverlayValue}>{row.value}</span>
				</div>
			))}
		</div>
	);
};

export default PlayerDebugOverlay;
