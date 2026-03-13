import {useMemo} from 'react';
import {
	formatAudioCodecList,
	formatBitrateMbps,
	formatCapabilityTimestamp,
	formatYesNoUnknown
} from '../capabilityFormatting';

export const useRuntimeCapabilityLabels = (runtimeCapabilities) => {
	const runtimePlaybackCapabilities = runtimeCapabilities?.playback || {};
	const capabilityProbe = runtimeCapabilities?.capabilityProbe || null;

	const hasRuntimeVersionInfo = runtimeCapabilities?.version != null || runtimeCapabilities?.chrome != null;
	const webosVersionLabel = hasRuntimeVersionInfo
		? `${runtimeCapabilities?.version ?? 'Unknown'}${runtimeCapabilities?.chrome ? ` (Chrome ${runtimeCapabilities.chrome})` : ''}`
		: 'Unknown';

	const dynamicRangeLabel = useMemo(() => {
		const ranges = [];
		if (runtimePlaybackCapabilities.supportsDolbyVision === true) ranges.push('Dolby Vision');
		if (runtimePlaybackCapabilities.supportsHdr10 !== false) ranges.push('HDR10');
		if (runtimePlaybackCapabilities.supportsHlg !== false) ranges.push('HLG');
		if (ranges.length === 0) return 'SDR only';
		return ranges.join(', ');
	}, [
		runtimePlaybackCapabilities.supportsDolbyVision,
		runtimePlaybackCapabilities.supportsHdr10,
		runtimePlaybackCapabilities.supportsHlg
	]);

	const videoCodecsLabel = useMemo(() => {
		const codecs = ['H.264'];
		if (runtimePlaybackCapabilities.supportsHevc !== false) codecs.push('HEVC');
		if (runtimePlaybackCapabilities.supportsAv1 === true) codecs.push('AV1');
		if (runtimePlaybackCapabilities.supportsVp9 === true) codecs.push('VP9');
		return codecs.join(', ');
	}, [
		runtimePlaybackCapabilities.supportsAv1,
		runtimePlaybackCapabilities.supportsHevc,
		runtimePlaybackCapabilities.supportsVp9
	]);

	const audioCodecsLabel = useMemo(
		() => formatAudioCodecList(runtimePlaybackCapabilities.audioCodecs),
		[runtimePlaybackCapabilities.audioCodecs]
	);

	const capabilityProbeLabel = useMemo(() => {
		const sourceLabel = capabilityProbe?.source === 'cache' ? 'Cached probe' : 'Live probe';
		const checkedAtLabel = formatCapabilityTimestamp(capabilityProbe?.checkedAt);
		const ttlMs = Number(capabilityProbe?.ttlMs);
		if (!Number.isFinite(ttlMs) || ttlMs <= 0) return `${sourceLabel} | ${checkedAtLabel}`;
		const ttlDays = Math.max(1, Math.round(ttlMs / (24 * 60 * 60 * 1000)));
		return `${sourceLabel} | ${checkedAtLabel} | refresh ${ttlDays}d`;
	}, [capabilityProbe?.checkedAt, capabilityProbe?.source, capabilityProbe?.ttlMs]);

	return {
		webosVersionLabel,
		capabilityProbeLabel,
		dynamicRangeLabel,
		videoCodecsLabel,
		audioCodecsLabel,
		dolbyVisionMkvLabel: formatYesNoUnknown(runtimePlaybackCapabilities.supportsDolbyVisionInMkv),
		webpImageDecodeLabel: formatYesNoUnknown(runtimePlaybackCapabilities.supportsWebpImage),
		atmosLabel: formatYesNoUnknown(runtimePlaybackCapabilities.supportsAtmos),
		hdAudioLabel: `${formatYesNoUnknown(runtimePlaybackCapabilities.supportsDts)} / ${formatYesNoUnknown(runtimePlaybackCapabilities.supportsTrueHd)}`,
		maxAudioChannelsLabel: Number.isFinite(Number(runtimePlaybackCapabilities.maxAudioChannels))
			? `${runtimePlaybackCapabilities.maxAudioChannels} ch`
			: 'Unknown',
		maxStreamingBitrateLabel: formatBitrateMbps(runtimePlaybackCapabilities.maxStreamingBitrate)
	};
};
