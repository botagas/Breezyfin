import {useLayoutEffect, useRef} from 'react';
import css from '../../PlayerPanel.module.less';
import {
	getSubtitleClipLayerStyle,
	getSubtitleAbsolutePositionStyle,
	getSubtitleCueTextStyle,
	getSubtitleCueRunStyle,
	getSubtitleDrawingSvgStyle,
	getSubtitleCueTransformLayerStyle,
	getSubtitleOverlayAttributes,
	getSubtitleOverlayStyle,
	getSubtitleTextStyle,
	groupSubtitleCuesByPlacement,
	groupSubtitleCuesByLayer,
	isAbsoluteSubtitleCue,
	isClippedSubtitleCue,
	isDrawingSubtitleCue,
	SUBTITLE_ALIGN_KEYS,
	SUBTITLE_REGION_KEYS
} from '../utils/subtitleOverlaySettings';
import {
	getAssCoordinatePlane,
	getAssCueContainment,
	getSubtitleVideoMetrics,
	getSubtitleVideoStageGeometry,
	isSourceAuthoredAssCue
} from '../utils/subtitleRendererAssStage';

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

const getCueTextSignature = (cue = {}) => {
	if (Array.isArray(cue.runLines)) {
		return cue.runLines.map((runs) => runs.map((run) => run.text).join('')).join('\n');
	}
	return Array.isArray(cue.lines) ? cue.lines.join('\n') : String(cue.text || '');
};

const updateCueFitDiagnostics = (node, enabled, containment, plane) => {
	if (!node) return;
	if (!enabled) {
		delete node.dataset.assFitScale;
		delete node.dataset.assFitReason;
		delete node.dataset.assPlane;
		return;
	}
	node.dataset.assFitScale = containment.scale.toFixed(3);
	node.dataset.assFitReason = containment.reason;
	node.dataset.assPlane = `${plane.playResX}x${plane.playResY}:${plane.scaleX.toFixed(3)}x${plane.scaleY.toFixed(3)}`;
};

const SubtitleCue = ({
	className,
	cue,
	cueIndex,
	diagnosticsEnabled,
	stageGeometry,
	stageRef,
	textStyle
}) => {
	const cueKey = getCueKey(cue, cueIndex);
	const cueTextStyle = getSubtitleCueTextStyle(textStyle, cue, stageGeometry);
	const runLines = Array.isArray(cue.runLines) ? cue.runLines : null;
	const drawing = isDrawingSubtitleCue(cue) ? cue.drawing : null;
	const textRef = useRef(null);
	const cueRef = useRef(cue);
	const stageGeometryRef = useRef(stageGeometry);
	cueRef.current = cue;
	stageGeometryRef.current = stageGeometry;
	const sourceAuthored = isSourceAuthoredAssCue(cue);
	const measurementKey = [
		cueKey,
		getCueTextSignature(cue),
		stageGeometry.width,
		stageGeometry.height,
		cueTextStyle.fontSize || '',
		cueTextStyle.fontFamily || '',
		cueTextStyle.fontWeight || '',
		cueTextStyle.lineHeight || ''
	].join('|');

	useLayoutEffect(() => {
		const node = textRef.current;
		const stageNode = stageRef.current;
		if (!node || !stageNode || typeof window === 'undefined') return undefined;
		const currentCue = cueRef.current;
		const currentStageGeometry = stageGeometryRef.current;
		const plane = getAssCoordinatePlane(currentCue, currentStageGeometry);
		if (sourceAuthored) {
			node.style.fontSize = cueTextStyle.fontSize || '';
			node.style.transform = cueTextStyle.transform || '';
			updateCueFitDiagnostics(node, diagnosticsEnabled, {
				scale: 1,
				reason: 'source-authored'
			}, plane);
			return undefined;
		}

		let firstFrame = 0;
		let secondFrame = 0;
		let disposed = false;
		const baseTransform = cueTextStyle.transform || '';
		const baseFontSize = cueTextStyle.fontSize || '';
		node.style.transform = baseTransform;
		if (baseFontSize) node.style.fontSize = baseFontSize;

		const finalizeContainment = (fitScale) => {
			if (disposed || !textRef.current || !stageRef.current) return;
			const containment = getAssCueContainment({
				cueRect: textRef.current.getBoundingClientRect(),
				stageRect: stageRef.current.getBoundingClientRect(),
				sourceAuthored: false
			});
			const transformParts = [];
			if (baseTransform) transformParts.push(baseTransform);
			if (Math.abs(containment.offsetX) > 0.01 || Math.abs(containment.offsetY) > 0.01) {
				transformParts.push(`translate(${containment.offsetX.toFixed(3)}px, ${containment.offsetY.toFixed(3)}px)`);
			}
			textRef.current.style.transform = transformParts.join(' ');
			updateCueFitDiagnostics(textRef.current, diagnosticsEnabled, {
				...containment,
				scale: fitScale,
				reason: fitScale < 0.999 ? 'fit-and-contain' : containment.reason
			}, plane);
		};

		firstFrame = window.requestAnimationFrame(() => {
			if (disposed || !textRef.current || !stageRef.current) return;
			const containment = getAssCueContainment({
				cueRect: textRef.current.getBoundingClientRect(),
				stageRect: stageRef.current.getBoundingClientRect(),
				sourceAuthored: false
			});
			if (containment.scale >= 0.999) {
				finalizeContainment(1);
				return;
			}
			const computedFontSize = Number.parseFloat(window.getComputedStyle(textRef.current).fontSize);
			if (Number.isFinite(computedFontSize) && computedFontSize > 0) {
				textRef.current.style.fontSize = `${Math.max(8, computedFontSize * containment.scale).toFixed(3)}px`;
			}
			secondFrame = window.requestAnimationFrame(() => finalizeContainment(containment.scale));
		});

		return () => {
			disposed = true;
			window.cancelAnimationFrame(firstFrame);
			window.cancelAnimationFrame(secondFrame);
		};
	}, [
		cueTextStyle.fontSize,
		cueTextStyle.transform,
		diagnosticsEnabled,
		measurementKey,
		sourceAuthored,
		stageRef
	]);

	return (
		<div
			className={className}
			key={cueKey}
			ref={textRef}
			style={cueTextStyle}
		>
			{drawing ? (
				<svg
					className={css.subtitleDrawingSvg}
					focusable="false"
					viewBox={drawing.viewBox.value}
					style={getSubtitleDrawingSvgStyle(cue, stageGeometry)}
				>
					<g>
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
								style={getSubtitleCueRunStyle(run, stageGeometry, cue)}
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

const renderCue = (
	cue,
	cueIndex,
	textStyle,
	stageGeometry,
	stageRef,
	diagnosticsEnabled,
	className = css.subtitleText
) => (
	<SubtitleCue
		className={className}
		cue={cue}
		cueIndex={cueIndex}
		diagnosticsEnabled={diagnosticsEnabled}
		key={getCueKey(cue, cueIndex)}
		stageGeometry={stageGeometry}
		stageRef={stageRef}
		textStyle={textStyle}
	/>
);

const renderAbsoluteCue = (cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled) => {
	const cueKey = getCueKey(cue, cueIndex);
	const align = SUBTITLE_ALIGN_KEYS.includes(cue.horizontalAlign) ? cue.horizontalAlign : 'center';
	const region = SUBTITLE_REGION_KEYS.includes(cue.placement) ? cue.placement : 'middle';
	const absoluteCue = (
		<div
			className={css.subtitleAbsoluteCue}
			data-align={align}
			data-region={region}
			key={cueKey}
			style={getSubtitleAbsolutePositionStyle(cue, stageGeometry)}
		>
			{renderCue(cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled)}
		</div>
	);
	const transformLayerStyle = getSubtitleCueTransformLayerStyle(cue, stageGeometry);
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

const renderRegionCue = (cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled) => {
	const cueKey = getCueKey(cue, cueIndex);
	const align = SUBTITLE_ALIGN_KEYS.includes(cue.horizontalAlign) ? cue.horizontalAlign : 'center';
	const region = SUBTITLE_REGION_KEYS.includes(cue.placement) ? cue.placement : 'bottom';
	return (
		<div className={css.subtitleRegion} data-region={region} key={`${cueKey}-region`}>
			<div className={css.subtitleAlignGroup} data-align={align}>
				{renderCue(cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled)}
			</div>
		</div>
	);
};

const renderClippedCue = (cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled) => {
	const cueKey = getCueKey(cue, cueIndex);
	return (
		<div
			className={css.subtitleClipLayer}
			key={`${cueKey}-clip`}
			style={getSubtitleClipLayerStyle(cue, stageGeometry)}
		>
			{isAbsoluteSubtitleCue(cue)
				? renderAbsoluteCue(cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled)
				: renderRegionCue(cue, cueIndex, textStyle, stageGeometry, stageRef, diagnosticsEnabled)}
		</div>
	);
};

const PlayerSubtitleOverlay = ({
	controlsVisible = false,
	cues = [],
	diagnosticsEnabled = false,
	mediaSource = null,
	settings = {},
	videoElement = null,
	visible = true
}) => {
	const stageRef = useRef(null);
	if (!visible || !Array.isArray(cues) || cues.length === 0) return null;
	const overlayAttributes = getSubtitleOverlayAttributes(settings, controlsVisible);
	const overlayStyle = getSubtitleOverlayStyle(settings);
	const textStyle = getSubtitleTextStyle(settings);
	const stageGeometry = getSubtitleVideoStageGeometry(
		getSubtitleVideoMetrics({videoElement, mediaSource})
	);
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
			<div className={css.subtitleStage} ref={stageRef} style={stageGeometry.style}>
				{clippedCues.map((cue, cueIndex) => renderClippedCue(
					cue,
					cueIndex,
					textStyle,
					stageGeometry,
					stageRef,
					diagnosticsEnabled
				))}
				{absoluteCues.map((cue, cueIndex) => renderAbsoluteCue(
					cue,
					cueIndex,
					textStyle,
					stageGeometry,
					stageRef,
					diagnosticsEnabled
				))}
				{SUBTITLE_REGION_KEYS.map((region) => (
					SUBTITLE_ALIGN_KEYS.some((align) => cuesByPlacement[region][align].length > 0) ? (
						<div className={css.subtitleRegion} data-region={region} key={region}>
							{SUBTITLE_ALIGN_KEYS.map((align) => (
								cuesByPlacement[region][align].length > 0 ? (
									<div className={css.subtitleAlignGroup} data-align={align} key={`${region}-${align}`}>
										{groupSubtitleCuesByLayer(cuesByPlacement[region][align]).map((layerGroup) => (
											<div
												className={css.subtitleCollisionLayer}
												key={`${region}-${align}-layer-${layerGroup.layer}`}
												style={{zIndex: layerGroup.layer}}
											>
												{layerGroup.cues.map((cue, cueIndex) => (
													renderCue(
														cue,
														cueIndex,
														textStyle,
														stageGeometry,
														stageRef,
														diagnosticsEnabled
													)
												))}
											</div>
										))}
									</div>
								) : null
							))}
						</div>
					) : null
				))}
			</div>
		</div>
	);
};

export default PlayerSubtitleOverlay;
