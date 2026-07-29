import BodyText from '@enact/sandstone/BodyText';
import Popup from '@enact/sandstone/Popup';
import Button from './BreezyButton';
import MediaBrowseControls from './MediaBrowseControls';
import {MEDIA_FILTER_OPTIONS} from '../utils/mediaFilters';
import {popupShellCss} from '../styles/popupStyles';

import browseCss from './MediaBrowseControls.module.less';
import popupStyles from '../styles/popupStyles.module.less';

const MediaFilterControls = ({
	title,
	triggerSpotlightId,
	activeFilterCount = 0,
	filterPopupOpen = false,
	filterPopupContentRef,
	draftFilterIds = ['all'],
	filterOptions = MEDIA_FILTER_OPTIONS,
	searchVisible = false,
	searchExpanded = true,
	searchValue = '',
	searchPlaceholder,
	searchSpotlightId,
	onSearchReveal,
	onSearchChange,
	onSearchBlur,
	onTrigger,
	onClose,
	onHide,
	onReset,
	onApply,
	onDraftSelect
}) => (
	<>
		<MediaBrowseControls
			searchVisible={searchVisible}
			searchExpanded={searchExpanded}
			searchValue={searchValue}
			searchPlaceholder={searchPlaceholder}
			searchSpotlightId={searchSpotlightId}
			onSearchReveal={onSearchReveal}
			onSearchChange={onSearchChange}
			onSearchBlur={onSearchBlur}
			filterSpotlightId={triggerSpotlightId}
			activeFilterCount={activeFilterCount}
			onFilterClick={onTrigger}
			filterLabel={`${title} filters`}
		/>
		<Popup open={filterPopupOpen} onClose={onClose} onHide={onHide} css={popupShellCss}>
				<div
					ref={filterPopupContentRef}
					className={`${popupStyles.popupSurface} ${browseCss.filterPopupContent}`}
					data-popup-focus-scope="true"
					role="dialog"
					aria-label={`${title} filters`}
				>
					<BodyText className={browseCss.filterPopupTitle}>{title} Filters</BodyText>
					<div className={browseCss.filterPopupActions}>
					<Button
						size="small"
						spotlightId={`${triggerSpotlightId}-reset`}
						onClick={onReset}
						className={browseCss.filterPopupActionButton}
					>
							Reset
						</Button>
					<Button
						size="small"
						spotlightId={`${triggerSpotlightId}-apply`}
						onClick={onApply}
						className={browseCss.filterPopupActionButton}
					>
							Done
						</Button>
					</div>
					<div className={browseCss.filterPopupOptions}>
						{filterOptions.map((option) => (
							<Button
								key={option.id}
								spotlightId={`${triggerSpotlightId}-option-${option.id}`}
								data-filter-id={option.id}
							selected={draftFilterIds.includes(option.id)}
							onClick={onDraftSelect}
							className={`${browseCss.filterPopupOptionButton} ${draftFilterIds.includes(option.id) ? browseCss.filterPopupOptionButtonSelected : ''}`}
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
