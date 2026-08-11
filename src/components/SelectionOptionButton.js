import Button from './BreezyButton';
import SelectionOptionContent, {selectionOptionSelectedClass} from './SelectionOptionContent';

const SelectionOptionButton = ({
	selected = false,
	className = '',
	children,
	selectionMode = 'single',
	...rest
}) => (
	<Button
		{...rest}
		selected={selected}
		aria-current={selectionMode === 'single' && selected ? 'true' : undefined}
		aria-pressed={selectionMode === 'multiple' ? selected : undefined}
		className={`${className} ${selected ? selectionOptionSelectedClass : ''}`.trim()}
	>
		<SelectionOptionContent selected={selected}>
			{children}
		</SelectionOptionContent>
	</Button>
);

export default SelectionOptionButton;
