import css from '../../PlayerPanel.module.less';
import {
	getSubtitleOverlayAttributes,
	groupSubtitleCuesByPlacement,
	SUBTITLE_ALIGN_KEYS,
	SUBTITLE_REGION_KEYS
} from '../utils/subtitleOverlaySettings';

const getCueKey = (cue, cueIndex) => ([
	cue.placement || 'bottom',
	cue.horizontalAlign || 'center',
	Number.isFinite(cue.startTicks) ? cue.startTicks : 'start',
	Number.isFinite(cue.endTicks) ? cue.endTicks : 'end',
	cueIndex
].join('-'));

const renderCue = (cue, cueIndex) => {
	const cueKey = getCueKey(cue, cueIndex);
	return (
		<div
			className={css.subtitleText}
			key={cueKey}
		>
			{(cue.lines || []).map((line, lineIndex) => (
				<div
					key={`${cueKey}-${lineIndex}`}
					// eslint-disable-next-line react/no-danger
					dangerouslySetInnerHTML={{__html: line}}
				/>
			))}
		</div>
	);
};

const PlayerSubtitleOverlay = ({controlsVisible = false, cues = [], settings = {}, visible = true}) => {
	if (!visible || !Array.isArray(cues) || cues.length === 0) return null;
	const overlayAttributes = getSubtitleOverlayAttributes(settings, controlsVisible);
	const cuesByPlacement = groupSubtitleCuesByPlacement(cues);
	return (
		<div
			className={css.subtitleOverlay}
			{...overlayAttributes}
			aria-hidden
		>
			{SUBTITLE_REGION_KEYS.map((region) => (
				SUBTITLE_ALIGN_KEYS.some((align) => cuesByPlacement[region][align].length > 0) ? (
					<div className={css.subtitleRegion} data-region={region} key={region}>
						{SUBTITLE_ALIGN_KEYS.map((align) => (
							cuesByPlacement[region][align].length > 0 ? (
								<div className={css.subtitleAlignGroup} data-align={align} key={`${region}-${align}`}>
									{cuesByPlacement[region][align].map(renderCue)}
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
