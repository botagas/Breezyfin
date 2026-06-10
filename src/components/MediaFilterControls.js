import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import Button from './BreezyButton';
import {MEDIA_FILTER_OPTIONS} from '../utils/mediaFilters';
import {popupShellCss} from '../styles/popupStyles';

import searchCss from '../views/SearchPanel.module.less';
import popupStyles from '../styles/popupStyles.module.less';

const MediaFilterControls = ({
	title,
	triggerSpotlightId,
	activeFilterCount = 0,
	filterPopupOpen = false,
	filterPopupContentRef,
	draftFilterIds = ['all'],
	filterOptions = MEDIA_FILTER_OPTIONS,
	onTrigger,
	onClose,
	onReset,
	onApply,
	onDraftSelect
}) => (
	<>
		<div className={searchCss.searchControls}>
			<Button
				size="small"
				icon="edit"
				spotlightId={triggerSpotlightId}
				onClick={onTrigger}
				className={searchCss.filterTriggerButton}
				aria-label={`${title} filters${activeFilterCount > 0 ? `, ${activeFilterCount} applied` : ''}`}
				title={`${title} filters${activeFilterCount > 0 ? `, ${activeFilterCount} applied` : ''}`}
			/>
			{activeFilterCount > 0 && (
				<span className={searchCss.filterAppliedBadge}>{activeFilterCount}</span>
			)}
		</div>
		<Popup open={filterPopupOpen} onClose={onClose} css={popupShellCss}>
			<div
				ref={filterPopupContentRef}
				className={`${popupStyles.popupSurface} ${searchCss.filterPopupContent}`}
				role="dialog"
				aria-label={`${title} filters`}
			>
				<BodyText className={searchCss.filterPopupTitle}>{title} Filters</BodyText>
				<div className={searchCss.filterPopupActions}>
					<Button size="small" onClick={onReset} className={searchCss.filterPopupActionButton}>
						Reset
					</Button>
					<Button size="small" onClick={onApply} className={searchCss.filterPopupActionButton}>
						Done
					</Button>
				</div>
				<div className={searchCss.filterPopupOptions}>
					{filterOptions.map((option) => (
						<Button
							key={option.id}
							data-filter-id={option.id}
							selected={draftFilterIds.includes(option.id)}
							onClick={onDraftSelect}
							className={`${searchCss.filterPopupOptionButton} ${draftFilterIds.includes(option.id) ? searchCss.filterPopupOptionButtonSelected : ''}`}
						>
							{option.label}
						</Button>
					))}
				</div>
			</div>
		</Popup>
	</>
);

export default MediaFilterControls;
