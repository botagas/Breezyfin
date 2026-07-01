import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';

const ASS_KARAOKE_PATTERN = /\\(k|K|kf|ko)\s*([0-9]+(?:\.\d+)?)/ig;

const normalizeKaraokeNumber = (value) => {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const numberValue = Number(raw);
	return Number.isFinite(numberValue) ? numberValue : null;
};

export const buildAssKaraokeFromBlock = (block, state = {}, startOffsetMs = 0) => {
	let karaoke = null;
	for (const match of String(block || '').matchAll(ASS_KARAOKE_PATTERN)) {
		const durationCs = normalizeKaraokeNumber(match[2]);
		if (durationCs === null || durationCs < 0) continue;
		karaoke = {
			mode: match[1] === 'K' ? 'kf' : match[1].toLowerCase(),
			startOffsetMs,
			durationMs: durationCs * 10,
			...(state.textColor ? {primaryColor: state.textColor} : {}),
			...(state.secondaryColor ? {secondaryColor: state.secondaryColor} : {})
		};
	}
	return karaoke;
};

const decorateAssKaraokeRun = (run, elapsedMs) => {
	const karaoke = run?.karaoke;
	if (!karaoke) return run;
	const startMs = Number(karaoke.startOffsetMs);
	const durationMs = Math.max(0, Number(karaoke.durationMs) || 0);
	if (!Number.isFinite(startMs)) return run;
	const endMs = startMs + durationMs;
	const progress = durationMs > 0
		? Math.max(0, Math.min(1, (elapsedMs - startMs) / durationMs))
		: (elapsedMs >= startMs ? 1 : 0);
	const secondaryColor = karaoke.secondaryColor;
	const primaryColor = karaoke.primaryColor || run.style?.color;
	const isFuture = elapsedMs < startMs;
	const isCurrent = elapsedMs >= startMs && elapsedMs < endMs;
	const color = isFuture && secondaryColor ? secondaryColor : primaryColor;
	const isSweepMode = karaoke.mode === 'kf';
	const sweepPercent = (isCurrent && isSweepMode && primaryColor && secondaryColor)
		? `${(progress * 100).toFixed(2)}%`
		: null;
	return {
		...run,
		karaoke: {
			...karaoke,
			progress,
			active: isCurrent
		},
		...(color || sweepPercent ? {
			style: {
				...(run.style || {}),
				...(color ? {color} : {}),
				...(sweepPercent ? {
					backgroundImage: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${sweepPercent}, ${secondaryColor} ${sweepPercent}, ${secondaryColor} 100%)`,
					backgroundClip: 'text',
					display: 'inline-block',
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent'
				} : {})
			}
		} : {})
	};
};

export const decorateAssKaraokeRuns = (event, currentTicks) => {
	if (!Array.isArray(event?.runLines)) return null;
	const elapsedMs = ((currentTicks - event.startTicks) / JELLYFIN_TICKS_PER_SECOND) * 1000;
	let changed = false;
	const runLines = event.runLines.map((line) => line.map((run) => {
		const decoratedRun = decorateAssKaraokeRun(run, elapsedMs);
		if (decoratedRun !== run) changed = true;
		return decoratedRun;
	}));
	return changed ? runLines : null;
};
