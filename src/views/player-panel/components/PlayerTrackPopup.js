import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Item from '@enact/sandstone/Item';
import Scroller from '../../../components/AppScroller';
import SelectionOptionContent, {selectionOptionSelectedClass} from '../../../components/SelectionOptionContent';
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
						<Item
							className={`${css.trackOption} ${offSelected ? selectionOptionSelectedClass : ''}`}
							data-track-index={-1}
							selected={offSelected}
							aria-current={offSelected ? 'true' : undefined}
							onClick={onTrackClick}
						>
							<SelectionOptionContent selected={offSelected}>
								{offLabel}
							</SelectionOptionContent>
						</Item>
					)}
					{tracks.map((track) => {
						const selected = currentTrack === track.Index;
						return (
							<Item
								key={track.Index}
								className={`${css.trackOption} ${selected ? selectionOptionSelectedClass : ''}`}
								data-track-index={track.Index}
								selected={selected}
								aria-current={selected ? 'true' : undefined}
								onClick={onTrackClick}
							>
								<SelectionOptionContent selected={selected}>
									{getTrackLabel(track)}
								</SelectionOptionContent>
							</Item>
						);
					})}
				</Scroller>
			</div>
		</Popup>
	);
};

export default PlayerTrackPopup;
