import {useRef} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import {popupShellCss} from '../../../styles/popupStyles';
import popupStyles from '../../../styles/popupStyles.module.less';
import css from '../../PlayerPanel.module.less';

const PlayerSubtitleBurnInPrompt = ({
	open = false,
	prompt = null,
	onConfirm,
	onDecline,
	onBack,
	onHide
}) => {
	const contentRef = useRef(null);
	usePopupInitialFocus(open, contentRef);

	const type = prompt?.type || 'hdr-dv-burn-in';
	const reason = prompt?.reason || '';
	const copy = {
		'bitmap-burn-in-fragility': {
			title: 'Try image subtitle burn-in?',
			message: 'Image-based subtitles such as PGS/PGSSUB are fragile to burn in and may fail on servers using hardware transcoding such as NVENC/CUDA. Try server burn-in anyway?',
			confirm: 'Yes, try burn-in',
			decline: 'Back to details'
		},
		'no-subtitles': {
			title: 'Play without subtitles?',
			message: 'The selected subtitles could not be delivered with the current renderer or server configuration. Continue without subtitles, or go back?',
			confirm: 'Continue without subtitles',
			decline: 'Back to details'
		},
		'hdr-dv-burn-in': {
			title: 'Burn in subtitles?',
			message: 'These subtitles cannot currently be rendered on the TV. Burning them in may lose HDR/Dolby Vision quality and increases server load.',
			confirm: 'Yes, burn in subtitles',
			decline: 'No, play without subtitles'
		}
	}[type] || {
		title: 'Subtitle decision required',
		message: 'Breezyfin needs a subtitle fallback decision before continuing playback.',
		confirm: 'Continue',
		decline: 'Back to details'
	};

	return (
		<Popup open={open} onClose={onBack || onDecline} onHide={onHide} css={popupShellCss}>
			<div ref={contentRef} className={`${popupStyles.popupSurface} ${css.subtitleBurnInPrompt}`}>
				<BodyText className={css.subtitleBurnInPromptTitle}>{copy.title}</BodyText>
				<BodyText className={css.subtitleBurnInPromptMessage}>
					{copy.message}
				</BodyText>
				{reason ? (
					<BodyText className={css.subtitleBurnInPromptReason}>
						Reason: {reason}
					</BodyText>
				) : null}
				<div className={css.subtitleBurnInPromptActions}>
					<Button className={css.subtitleBurnInPromptButton} onClick={onConfirm}>
						{copy.confirm}
					</Button>
					<Button className={css.subtitleBurnInPromptButton} onClick={onDecline}>
						{copy.decline}
					</Button>
				</div>
			</div>
		</Popup>
	);
};

export default PlayerSubtitleBurnInPrompt;
