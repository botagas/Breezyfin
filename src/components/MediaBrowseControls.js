import Input from '@enact/sandstone/Input';

import Button from './BreezyButton';
import {focusSpotlightTarget} from '../utils/gridFocus';
import {getBrowseControlNavigationTarget} from '../utils/browseSearch';

import css from './MediaBrowseControls.module.less';

const consumeNavigationEvent = (event) => {
	event.preventDefault?.();
	event.stopPropagation?.();
	event.stopImmediatePropagation?.();
};

const MediaBrowseControls = ({
	searchVisible = false,
	searchExpanded = true,
	searchValue = '',
	searchPlaceholder = 'Search...',
	searchSpotlightId,
	filterSpotlightId,
	activeFilterCount = 0,
	onSearchReveal,
	onSearchChange,
	onSearchBlur,
	onFilterClick,
	filterLabel = 'Filters'
}) => {
	const handleControlKeyDown = (source) => (event) => {
		const targetSpotlightId = getBrowseControlNavigationTarget({
			keyCode: event.keyCode || event.which,
			source,
			searchVisible,
			searchSpotlightId,
			filterSpotlightId
		});
		if (!targetSpotlightId || !focusSpotlightTarget(targetSpotlightId)) return;
		consumeNavigationEvent(event);
	};

	return (
		<div className={css.browseControls}>
		{searchVisible && searchExpanded ? (
			<div className={css.searchFieldShell}>
				<Input
					className={`bf-input-trigger ${css.searchInput}`}
					placeholder={searchPlaceholder}
					value={searchValue}
					onChange={onSearchChange}
					onBlur={onSearchBlur}
					onKeyDown={handleControlKeyDown('search')}
					dismissOnEnter
					size="small"
					spotlightId={searchSpotlightId}
				/>
			</div>
		) : searchVisible ? (
			<Button
				className={css.iconTriggerButton}
				onClick={onSearchReveal}
				onKeyDown={handleControlKeyDown('search')}
				selected={Boolean(String(searchValue).trim())}
				size="small"
				minWidth={false}
				icon="search"
				spotlightId={searchSpotlightId}
				aria-label={searchValue ? 'Show search, search active' : 'Show search'}
			/>
		) : null}
		<div className={css.iconTriggerWrap}>
			<Button
				className={css.iconTriggerButton}
				onClick={onFilterClick}
				onKeyDown={handleControlKeyDown('filter')}
				size="small"
				minWidth={false}
				icon="edit"
				spotlightId={filterSpotlightId}
				aria-label={`${filterLabel}${activeFilterCount ? `, ${activeFilterCount} applied` : ''}`}
				title={`${filterLabel}${activeFilterCount ? `, ${activeFilterCount} applied` : ''}`}
			/>
			{activeFilterCount > 0 ? (
				<span className={css.filterAppliedBadge}>{activeFilterCount}</span>
			) : null}
		</div>
		</div>
	);
};

export default MediaBrowseControls;
