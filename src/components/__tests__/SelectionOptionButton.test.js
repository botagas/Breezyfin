import {render, screen} from '@testing-library/react';

import SelectionOptionButton from '../SelectionOptionButton';

jest.mock('@enact/sandstone/Icon', () => ({children, ...props}) => (
	<span {...props}>{children}</span>
));

describe('SelectionOptionButton', () => {
	it('renders the real shared button surface with Sandstone selection state', () => {
		render(
			<SelectionOptionButton selected>Japanese</SelectionOptionButton>
		);

		const button = screen.getByRole('button', {name: /Japanese/});
		expect(button.getAttribute('aria-current')).toBe('true');
		expect(button.className).toContain('bf-button');
		expect(button.className).toContain('selectedControl');
		expect(screen.getByText('Selected')).toBeTruthy();
	});

	it('uses pressed semantics for multi-select filters', () => {
		render(
			<SelectionOptionButton selected selectionMode="multiple">
				Favorites
			</SelectionOptionButton>
		);

		const button = screen.getByRole('button', {name: /Favorites/});
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(button.getAttribute('aria-current')).toBeNull();
	});
});
