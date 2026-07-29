import Icon from '@enact/sandstone/Icon';

import css from './SelectionOptionContent.module.less';

export const selectionOptionSelectedClass = css.selectedControl;

const SelectionOptionContent = ({children, selected = false}) => (
	<span className={css.content}>
		<span className={css.label}>{children}</span>
		{selected && (
			<span className={css.indicator} aria-hidden="true">
				<Icon className={css.icon} size="small">check</Icon>
				<span>Selected</span>
			</span>
		)}
	</span>
);

export default SelectionOptionContent;
