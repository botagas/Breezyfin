import Button from '@enact/sandstone/Button';

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const BreezyButton = ({ className, ...rest }) => (
	<Button
		{...rest}
		className={joinClassNames('bf-button', className)}
	/>
);

export default BreezyButton;
