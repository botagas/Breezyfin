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

export const getRawSubtitleFormats = (codec) => (
	TEXT_SUBTITLE_RAW_FORMATS_BY_CODEC[String(codec || '').trim().toLowerCase()] || ['vtt', 'srt']
);
