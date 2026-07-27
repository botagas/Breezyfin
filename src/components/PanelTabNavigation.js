import {useCallback} from 'react';
import Button from './BreezyButton';

import css from './PanelTabNavigation.module.less';

const PanelTabNavigation = ({
	activeId,
	ariaLabel,
	onSelect,
	spotlightIdPrefix = 'panel-tab',
	tabs
}) => {
	const handleTabClick = useCallback((event) => {
		const tabId = event.currentTarget.dataset.panelTab;
		if (tabId) onSelect?.(tabId, event);
	}, [onSelect]);

	return (
		<div className={css.row}>
			<div className={css.tabs} role="tablist" aria-label={ariaLabel}>
				{tabs.map((tab) => {
					const isSelected = tab.id === activeId;
					return (
						<Button
							key={tab.id}
							size="small"
							minWidth={false}
							className={`${css.tabButton} ${isSelected ? css.tabButtonSelected : ''}`}
							spotlightId={`${spotlightIdPrefix}-${tab.id}`}
							data-panel-tab={tab.id}
							role="tab"
							aria-selected={isSelected}
							selected={isSelected}
							onClick={handleTabClick}
						>
							{tab.label}
						</Button>
					);
				})}
			</div>
		</div>
	);
};

export default PanelTabNavigation;
