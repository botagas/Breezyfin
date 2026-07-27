import {useRef} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import {Header} from './BreezyPanels';
import PanelActionButton from './PanelActionButton';
import {usePopupInitialFocus} from '../hooks/usePopupInitialFocus';
import {popupShellCss} from '../styles/popupStyles';
import popupStyles from '../styles/popupStyles.module.less';
import {getProviderItemMetadata} from '../utils/providerItemMetadata';

import css from './ProviderItemPopup.module.less';

const ProviderItemPopup = ({
	open,
	title,
	detail,
	item,
	onClose,
	onHide,
	spotlightId = 'provider-item-close'
}) => {
	const contentRef = useRef(null);
	usePopupInitialFocus(open, contentRef);
	const metadata = getProviderItemMetadata(item);
	return (
		<Popup open={open} onClose={onClose} onHide={onHide} css={popupShellCss}>
			<div ref={contentRef} className={`${popupStyles.popupSurface} ${css.content}`}>
				<Header title={title} />
				{metadata.summary.length > 0 || metadata.rating || metadata.genres.length > 0 ? (
					<div
						className={css.summary}
						aria-label={[
							...metadata.summary,
							metadata.rating ? `Rating ${metadata.rating}` : '',
							...metadata.genres.map((genre) => `Genre ${genre}`)
						]
							.filter(Boolean)
							.join(', ')}
					>
						{metadata.summary.map((entry) => <span key={entry}>{entry}</span>)}
						{metadata.rating ? (
							<span className={css.rating}>
								<span className={css.ratingIcon} aria-hidden="true">★</span>
								{metadata.rating}
							</span>
						) : null}
						{metadata.genres.map((genre) => (
							<span key={`genre-${genre}`}>{genre}</span>
						))}
					</div>
				) : null}
				<BodyText className={css.detail}>{detail}</BodyText>
				{metadata.directors.length > 0 ? (
					<BodyText className={css.metadataLine}>
						<strong>Directed by:</strong> {metadata.directors.join(', ')}
					</BodyText>
				) : null}
				{metadata.writers.length > 0 ? (
					<BodyText className={css.metadataLine}>
						<strong>Written by:</strong> {metadata.writers.join(', ')}
					</BodyText>
				) : null}
				<div className={css.actions}>
					<PanelActionButton spotlightId={spotlightId} onClick={onClose}>Close</PanelActionButton>
				</div>
			</div>
		</Popup>
	);
};

export default ProviderItemPopup;
