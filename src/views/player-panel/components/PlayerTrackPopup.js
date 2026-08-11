import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../../../components/AppScroller';
import SelectionOptionButton from '../../../components/SelectionOptionButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import css from '../../PlayerPanel.module.less';
import popupStyles from '../../../styles/popupStyles.module.less';
import {popupShellCss} from '../../../styles/popupStyles';

const PlayerTrackPopup = ({
	open,
	onClose,
	title,
	tracks,
	currentTrack,
	onTrackClick,
	getTrackLabel,
	includeOffOption = false,
	offLabel = 'Off'
}) => {
	const popupContentRef = useRef(null);
	usePopupInitialFocus(open, popupContentRef);
	const offSelected = currentTrack === -1;

	return (
		<Popup
			open={open}
			onClose={onClose}
			position="center"
			css={popupShellCss}
		>
			<div
				ref={popupContentRef}
				className={`${popupStyles.popupSurface} ${css.trackPopup}`}
				data-popup-focus-scope="true"
			>
				<BodyText className={css.popupTitle}>{title}</BodyText>
				<Scroller className={css.trackList}>
					{includeOffOption && (
						<SelectionOptionButton
							className={css.trackOption}
							data-track-index={-1}
							selected={offSelected}
							onClick={onTrackClick}
						>
							{offLabel}
						</SelectionOptionButton>
					)}
					{tracks.map((track) => {
						const selected = currentTrack === track.Index;
						return (
							<SelectionOptionButton
								key={track.Index}
								className={css.trackOption}
								data-track-index={track.Index}
								selected={selected}
								onClick={onTrackClick}
							>
								{getTrackLabel(track)}
							</SelectionOptionButton>
						);
					})}
				</Scroller>
			</div>
		</Popup>
	);
};

export default PlayerTrackPopup;
