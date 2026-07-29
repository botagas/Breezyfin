const SelectedControl = ({
	children,
	selected,
	...props
}) => (
	<button type="button" data-selected={selected ? 'true' : 'false'} {...props}>
		{children}
	</button>
);

export default SelectedControl;
