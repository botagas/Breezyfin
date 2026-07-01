export const SUBTITLE_RENDERER_IDS = Object.freeze({
	TEXT: 'client-text',
	ASS_LIGHTWEIGHT: 'client-ass-lightweight',
	ASS_LIBASS: 'client-ass-libass',
	ASS_LIBASS_MANUAL: 'client-ass-libass-manual',
	ASS_JASSUB: 'client-ass-jassub',
	ASS_JASSUB_MANUAL: 'client-ass-jassub-manual',
	ASS_ASSJS: 'client-ass-assjs'
});

export const EXTERNAL_ASS_RENDERER_IDS = new Set([
	SUBTITLE_RENDERER_IDS.ASS_LIBASS,
	SUBTITLE_RENDERER_IDS.ASS_LIBASS_MANUAL,
	SUBTITLE_RENDERER_IDS.ASS_JASSUB,
	SUBTITLE_RENDERER_IDS.ASS_JASSUB_MANUAL,
	SUBTITLE_RENDERER_IDS.ASS_ASSJS
]);

export const isExternalAssRendererId = (rendererId) => EXTERNAL_ASS_RENDERER_IDS.has(rendererId);
