import css from '../../PlayerPanel.module.less';
import {
	getSubtitleClipLayerStyle,
	getSubtitleCueTextStyle,
	getSubtitleCueRunStyle,
	getSubtitleDrawingSvgStyle,
	getSubtitleDrawingClipPath,
	getSubtitleCueTransformLayerStyle,
	getSubtitleOverlayAttributes,
	getSubtitleOverlayStyle,
	getSubtitleTextStyle,
	groupSubtitleCuesByPlacement,
	isAbsoluteSubtitleCue,
	isClippedSubtitleCue,
	isDrawingSubtitleCue,
	SUBTITLE_ALIGN_KEYS,
	SUBTITLE_REGION_KEYS
} from '../utils/subtitleOverlaySettings';

const getCueKey = (cue, cueIndex) => ([
	cue.placement || 'bottom',
	cue.horizontalAlign || 'center',
	Number.isFinite(cue.absolutePosition?.xPercent) ? cue.absolutePosition.xPercent.toFixed(2) : 'x',
	Number.isFinite(cue.absolutePosition?.yPercent) ? cue.absolutePosition.yPercent.toFixed(2) : 'y',
	Number.isFinite(cue.startTicks) ? cue.startTicks : 'start',
	Number.isFinite(cue.endTicks) ? cue.endTicks : 'end',
	cueIndex
].join('-'));

const getDrawingPathTransform = (path = {}) => {
	const baselineOffset = Number(path.baselineOffset);
	return Number.isFinite(baselineOffset) && baselineOffset !== 0
		? `translate(0 ${baselineOffset.toFixed(3)})`
		: undefined;
};

const renderCue = (cue, cueIndex, textStyle, className = css.subtitleText) => {
	const cueKey = getCueKey(cue, cueIndex);
	const cueTextStyle = getSubtitleCueTextStyle(textStyle, cue);
	const runLines = Array.isArray(cue.runLines) ? cue.runLines : null;
	const drawing = isDrawingSubtitleCue(cue) ? cue.drawing : null;
	const drawingClipPath = getSubtitleDrawingClipPath(cue);
	const drawingClipId = drawingClipPath ? `bf-subtitle-drawing-clip-${cueKey}` : '';
	return (
		<div
			className={className}
			key={cueKey}
			style={cueTextStyle}
		>
			{drawing ? (
				<svg
					className={css.subtitleDrawingSvg}
					focusable="false"
					viewBox={drawing.viewBox.value}
					style={getSubtitleDrawingSvgStyle(cue)}
				>
					{drawingClipPath ? (
						<defs>
							<clipPath id={drawingClipId} clipPathUnits="userSpaceOnUse">
								<path
									clipRule={drawingClipPath.inverted ? 'evenodd' : undefined}
									d={drawingClipPath.d}
									fillRule={drawingClipPath.inverted ? 'evenodd' : undefined}
								/>
							</clipPath>
						</defs>
					) : null}
					<g clipPath={drawingClipId ? `url(#${drawingClipId})` : undefined}>
						{drawing.paths.map((path, pathIndex) => (
							<path
								d={path.d}
								fill={path.fill || 'currentColor'}
								fillRule="evenodd"
								key={`${cueKey}-drawing-${pathIndex}`}
								stroke={path.stroke || 'none'}
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={Number(path.strokeWidth) || 0}
								transform={getDrawingPathTransform(path)}
							/>
						))}
					</g>
				</svg>
			) : null}
			{runLines ? (
				runLines.map((runs, lineIndex) => (
					<div key={`${cueKey}-${lineIndex}`}>
						{runs.map((run, runIndex) => (
							<span
								key={`${cueKey}-${lineIndex}-${runIndex}`}
								style={getSubtitleCueRunStyle(run)}
							>
								{run.text}
							</span>
						))}
					</div>
				))
			) : (
				(cue.lines || []).map((line, lineIndex) => (
					<div
						key={`${cueKey}-${lineIndex}`}
						// eslint-disable-next-line react/no-danger
						dangerouslySetInnerHTML={{__html: line}}
					/>
				))
			)}
		</div>
	);
};

const renderAbsoluteCue = (cue, cueIndex, textStyle) => {
	const cueKey = getCueKey(cue, cueIndex);
	const xPercent = Math.min(100, Math.max(0, cue.absolutePosition.xPercent));
	const yPercent = Math.min(100, Math.max(0, cue.absolutePosition.yPercent));
	const align = SUBTITLE_ALIGN_KEYS.includes(cue.horizontalAlign) ? cue.horizontalAlign : 'center';
	const region = SUBTITLE_REGION_KEYS.includes(cue.placement) ? cue.placement : 'middle';
	const absoluteCue = (
		<div
			className={css.subtitleAbsoluteCue}
			data-align={align}
			data-region={region}
			key={cueKey}
			style={{
				'--bf-player-subtitle-absolute-x': `${xPercent}%`,
				'--bf-player-subtitle-absolute-y': `${yPercent}%`
			}}
		>
			{renderCue(cue, cueIndex, textStyle)}
		</div>
	);
	const transformLayerStyle = getSubtitleCueTransformLayerStyle(cue);
	return Object.keys(transformLayerStyle).length > 0 ? (
		<div
			className={css.subtitleTransformLayer}
			key={`${cueKey}-transform`}
			style={transformLayerStyle}
		>
			{absoluteCue}
		</div>
	) : absoluteCue;
};

const renderRegionCue = (cue, cueIndex, textStyle) => {
	const cueKey = getCueKey(cue, cueIndex);
	const align = SUBTITLE_ALIGN_KEYS.includes(cue.horizontalAlign) ? cue.horizontalAlign : 'center';
	const region = SUBTITLE_REGION_KEYS.includes(cue.placement) ? cue.placement : 'bottom';
	return (
		<div className={css.subtitleRegion} data-region={region} key={`${cueKey}-region`}>
			<div className={css.subtitleAlignGroup} data-align={align}>
				{renderCue(cue, cueIndex, textStyle)}
			</div>
		</div>
	);
};

const renderClippedCue = (cue, cueIndex, textStyle) => {
	const cueKey = getCueKey(cue, cueIndex);
	return (
		<div
			className={css.subtitleClipLayer}
			key={`${cueKey}-clip`}
			style={getSubtitleClipLayerStyle(cue)}
		>
			{isAbsoluteSubtitleCue(cue)
				? renderAbsoluteCue(cue, cueIndex, textStyle)
				: renderRegionCue(cue, cueIndex, textStyle)}
		</div>
	);
};

const PlayerSubtitleOverlay = ({controlsVisible = false, cues = [], settings = {}, visible = true}) => {
	if (!visible || !Array.isArray(cues) || cues.length === 0) return null;
	const overlayAttributes = getSubtitleOverlayAttributes(settings, controlsVisible);
	const overlayStyle = getSubtitleOverlayStyle(settings);
	const textStyle = getSubtitleTextStyle(settings);
	const clippedCues = cues.filter(isClippedSubtitleCue);
	const absoluteCues = cues.filter((cue) => isAbsoluteSubtitleCue(cue) && !isClippedSubtitleCue(cue));
	const cuesByPlacement = groupSubtitleCuesByPlacement(cues);
	return (
		<div
			className={css.subtitleOverlay}
			{...overlayAttributes}
			style={overlayStyle}
			aria-hidden
		>
			{clippedCues.map((cue, cueIndex) => renderClippedCue(cue, cueIndex, textStyle))}
			{absoluteCues.map((cue, cueIndex) => renderAbsoluteCue(cue, cueIndex, textStyle))}
			{SUBTITLE_REGION_KEYS.map((region) => (
				SUBTITLE_ALIGN_KEYS.some((align) => cuesByPlacement[region][align].length > 0) ? (
					<div className={css.subtitleRegion} data-region={region} key={region}>
						{SUBTITLE_ALIGN_KEYS.map((align) => (
							cuesByPlacement[region][align].length > 0 ? (
								<div className={css.subtitleAlignGroup} data-align={align} key={`${region}-${align}`}>
									{cuesByPlacement[region][align].map((cue, cueIndex) => renderCue(cue, cueIndex, textStyle))}
								</div>
							) : null
						))}
					</div>
				) : null
			))}
		</div>
	);
};

export default PlayerSubtitleOverlay;
