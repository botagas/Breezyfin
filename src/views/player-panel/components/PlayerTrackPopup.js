import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Item from '@enact/sandstone/Item';
import Scroller from '../../../components/AppScroller';
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
						<Item
							className={css.trackOption}
							data-track-index={-1}
							selected={currentTrack === -1}
							onClick={onTrackClick}
						>
							{offLabel}
						</Item>
					)}
					{tracks.map((track) => (
						<Item
							key={track.Index}
							className={css.trackOption}
							data-track-index={track.Index}
							selected={currentTrack === track.Index}
							onClick={onTrackClick}
						>
							{getTrackLabel(track)}
						</Item>
					))}
				</Scroller>
			</div>
		</Popup>
	);
};

export default PlayerTrackPopup;
