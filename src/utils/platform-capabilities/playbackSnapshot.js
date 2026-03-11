import {mapChromeToWebOSVersion} from './versionParsing';
import {
	detectCodecSupport,
	detectImageFormatSupport
} from './mediaDetection';

export const buildPlaybackCapabilitySnapshot = ({
	webos,
	version,
	chrome,
	hasChromeVersion
}, lunaCapabilityOverrides = null) => {
	const webosVersion = Number.isFinite(version) ? version : (hasChromeVersion ? mapChromeToWebOSVersion(chrome) : null);
	const versionBucket = Number.isFinite(webosVersion) ? webosVersion : 0;
	const webos25Plus = webos && (
		versionBucket >= 25 ||
		(hasChromeVersion && chrome >= 120)
	);
	const hevcProbe = detectCodecSupport([
		'video/mp4; codecs="hvc1.1.6.L93.B0"',
		'video/mp4; codecs="hev1.1.6.L93.B0"',
		'video/mp4; codecs="hvc1"'
	]);
	const av1Probe = detectCodecSupport([
		'video/mp4; codecs="av01.0.08M.08"',
		'video/webm; codecs="av01.0.08M.08"'
	]);
	const vp9Probe = detectCodecSupport([
		'video/webm; codecs="vp9"',
		'video/mp4; codecs="vp09.00.10.08"'
	]);
	const ac3Probe = detectCodecSupport([
		'audio/mp4; codecs="ac-3"',
		'audio/mp4; codecs="ac3"'
	]);
	const eac3Probe = detectCodecSupport([
		'audio/mp4; codecs="ec-3"',
		'audio/mp4; codecs="dec3"'
	]);
	const atmosProbe = detectCodecSupport([
		'audio/mp4; codecs="ec+3"'
	]);
	const webpImageProbe = detectImageFormatSupport('image/webp');
	const dolbyVisionProbe = detectCodecSupport([
		'video/mp4; codecs="dvh1.05.06"',
		'video/mp4; codecs="dvhe.05.06"',
		'video/mp4; codecs="dvh1"',
		'video/mp4; codecs="dvhe"'
	]);
	const hasDolbyVisionOverride = typeof lunaCapabilityOverrides?.supportsDolbyVision === 'boolean';
	const hasHdr10Override = typeof lunaCapabilityOverrides?.supportsHdr10 === 'boolean';
	const hasHlgOverride = typeof lunaCapabilityOverrides?.supportsHlg === 'boolean';

	const supportsHevc = hevcProbe != null ? hevcProbe : (webos && versionBucket >= 4);
	const supportsAv1 = av1Probe != null ? av1Probe : (webos && versionBucket >= 5);
	const supportsVp9 = vp9Probe != null ? vp9Probe : (webos && versionBucket >= 4);
	const supportsAc3 = ac3Probe != null ? ac3Probe : webos;
	const supportsEac3 = eac3Probe != null ? eac3Probe : webos;
	const supportsDolbyVision = hasDolbyVisionOverride
		? lunaCapabilityOverrides.supportsDolbyVision
		: Boolean(dolbyVisionProbe || webos25Plus);
	const supportsAtmos = atmosProbe != null ? atmosProbe : null;
	const supportsOpus = webos && versionBucket >= 24;
	const supportsHdr10 = hasHdr10Override
		? lunaCapabilityOverrides.supportsHdr10
		: (webos && versionBucket >= 4);
	const supportsHlg = hasHlgOverride
		? lunaCapabilityOverrides.supportsHlg
		: (webos && versionBucket >= 4);

	const commonAudioCodecs = ['aac', 'mp3', 'mp2'];
	if (supportsAc3) commonAudioCodecs.push('ac3');
	if (supportsEac3) commonAudioCodecs.push('eac3');
	const pcmAudioCodecs = ['pcm_s16le', 'pcm_s24le'];
	const mkvAudioCodecs = supportsOpus
		? [...commonAudioCodecs, ...pcmAudioCodecs, 'flac', 'opus']
		: [...commonAudioCodecs, ...pcmAudioCodecs, 'flac'];
	const mp4AudioCodecs = [...commonAudioCodecs];
	const tsAudioCodecs = supportsOpus
		? [...commonAudioCodecs, ...pcmAudioCodecs, 'opus']
		: [...commonAudioCodecs, ...pcmAudioCodecs];

	return {
		webosVersion,
		webos25Plus,
		supportsHevc,
		supportsAv1,
		supportsVp9,
		supportsAc3,
		supportsEac3,
		supportsAtmos,
		supportsHdr10,
		supportsHlg,
		supportsDolbyVision,
		supportsDolbyVisionInMkv: supportsDolbyVision ? webos25Plus : false,
		supportsWebpImage: webpImageProbe,
		supportsDts: false,
		supportsTrueHd: false,
		nativeHls: webos,
		nativeHlsFmp4: webos && versionBucket >= 5,
		maxAudioChannels: webos25Plus ? 8 : 6,
		maxStreamingBitrate: webos && versionBucket >= 24 ? 120000000 : 100000000,
		audioCodecs: Array.from(new Set([...commonAudioCodecs, ...pcmAudioCodecs, ...(supportsOpus ? ['opus'] : []), 'flac'])),
		audioCodecsByContainer: {
			mp4: mp4AudioCodecs,
			m4v: mp4AudioCodecs,
			mov: mp4AudioCodecs,
			mkv: mkvAudioCodecs,
			ts: tsAudioCodecs,
			mpegts: tsAudioCodecs,
			hls: tsAudioCodecs
		},
		capabilitySignals: {
			supportsDolbyVision: hasDolbyVisionOverride
				? 'luna-config'
				: (dolbyVisionProbe != null ? 'codec-probe' : 'heuristic'),
			supportsHdr10: hasHdr10Override ? 'luna-config' : 'heuristic',
			supportsHlg: hasHlgOverride ? 'luna-config' : 'heuristic'
		}
	};
};
