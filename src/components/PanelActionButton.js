import Button from './BreezyButton';

import css from './PanelActionButton.module.less';

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const PanelActionButton = ({className, ...rest}) => (
	<Button
		{...rest}
		className={joinClassNames(css.actionButton, className)}
	/>
);

export default PanelActionButton;
