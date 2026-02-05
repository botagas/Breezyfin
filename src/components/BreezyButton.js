import Button from '@enact/sandstone/Button';

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const BreezyButton = ({ className, css, ...rest }) => (
	<Button
		{...rest}
		className={joinClassNames('bf-button', className)}
		css={{
			...css,
			bg: joinClassNames('bf-button-bg', css?.bg)
		}}
	/>
);

export default BreezyButton;
