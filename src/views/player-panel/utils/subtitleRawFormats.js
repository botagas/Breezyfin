const TEXT_SUBTITLE_RAW_FORMATS_BY_CODEC = {
	srt: ['vtt', 'srt'],
	subrip: ['vtt', 'srt'],
	vtt: ['vtt'],
	webvtt: ['vtt'],
	ass: ['ass', 'ssa'],
	ssa: ['ssa', 'ass'],
	advancedsubstationalpha: ['ass', 'ssa'],
	substationalpha: ['ssa', 'ass']
};

const ASS_SUBTITLE_CODECS = new Set([
	'ass',
	'ssa',
	'advancedsubstationalpha',
	'substationalpha'
]);

export const getRawSubtitleFormats = (codec) => (
	TEXT_SUBTITLE_RAW_FORMATS_BY_CODEC[String(codec || '').trim().toLowerCase()] || ['vtt', 'srt']
);

export const shouldPreferRawSubtitleDocument = ({codec, renderer}) => (
	renderer === 'client-ass-lightweight' &&
	ASS_SUBTITLE_CODECS.has(String(codec || '').trim().toLowerCase())
);
