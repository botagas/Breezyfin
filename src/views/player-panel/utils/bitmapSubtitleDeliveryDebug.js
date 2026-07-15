import {SUBTITLE_RENDERER_IDS} from './subtitle-renderers/rendererIds';
import {redactSensitiveText, redactSensitiveUrl} from '../../../utils/sensitiveData';

export const BITMAP_SUBTITLE_RAW_FORMATS = ['sup', 'pgs', 'pgssub'];

export const getBitmapRendererSequence = (rendererMode) => {
	if (rendererMode === SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB) return [SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB];
	if (rendererMode === SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS) return [SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS];
	return [
		SUBTITLE_RENDERER_IDS.BITMAP_LIBBITSUB,
		SUBTITLE_RENDERER_IDS.BITMAP_LIBPGS
	];
};

export const redactSubtitleDebugValue = (value) => {
	if (!value) return '';
	const text = String(value);
	return /^https?:\/\//i.test(text)
		? redactSensitiveUrl(text)
		: redactSensitiveText(text);
};

export const getBitmapDeliveryCandidateDebugLocation = (candidate) => (
	candidate?.debugUrl || redactSubtitleDebugValue(candidate?.path) || '-'
);

export const summarizeBitmapDeliveryCandidate = (candidate) => {
	if (!candidate) return '';
	return [
		candidate.source || 'unknown',
		candidate.format || '-',
		getBitmapDeliveryCandidateDebugLocation(candidate)
	].join(':');
};

const summarizeBitmapProbeResult = (probe) => [
	probe.format,
	probe.ok ? 'ok' : 'failed',
	probe.byteLength ? `${probe.byteLength}b` : '',
	probe.pgsMagic ? 'PG' : '',
	probe.error || ''
].filter(Boolean).join(':');

export const buildBitmapDeliveryFetchDebug = ({
	baseDebug,
	selectedCandidate,
	binaryResult,
	deliveryCandidates,
	probeResults,
	fetchMs
}) => {
	const selectedCandidateDebugPath = getBitmapDeliveryCandidateDebugLocation(selectedCandidate);
	const binaryResultDebugPath = binaryResult?.debugUrl || redactSubtitleDebugValue(binaryResult?.path);

	return {
		...(baseDebug || {}),
		path: selectedCandidate ? selectedCandidateDebugPath : binaryResultDebugPath,
		rawPath: binaryResultDebugPath || (selectedCandidate ? selectedCandidateDebugPath : ''),
		rawFormat: binaryResult?.format || selectedCandidate?.format || '',
		rawShape: binaryResult?.rawShape || (binaryResult ? 'binary' : 'url'),
		rawContentType: binaryResult?.contentType || '',
		fetchMs,
		bitmapBytes: binaryResult?.byteLength ?? binaryResult?.data?.byteLength ?? null,
		bitmapPgsMagic: binaryResult?.pgsMagic ?? null,
		bitmapFirstBytes: binaryResult?.firstBytes || '',
		bitmapDeliverySource: selectedCandidate?.source || '',
		bitmapDeliveryFormat: selectedCandidate?.format || '',
		bitmapDeliveryUrl: selectedCandidate?.debugUrl || '',
		bitmapDeliveryCandidates: (deliveryCandidates || []).map(summarizeBitmapDeliveryCandidate).join(','),
		bitmapDeliveryCandidateCount: (deliveryCandidates || []).length,
		bitmapProbeResults: (probeResults || []).map(summarizeBitmapProbeResult).join(',')
	};
};
