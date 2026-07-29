/* eslint-disable react/prop-types */
import {fireEvent, render, screen} from '@testing-library/react';
import PanelTabNavigation from '../PanelTabNavigation';

jest.mock('../BreezyButton', () => function TestButton({
	children,
	minWidth,
	selected,
	size,
	spotlightId,
	...rest
}) {
	return (
		<button
			type="button"
			data-min-width={String(minWidth)}
			data-selected={String(selected)}
			data-size={size}
			data-spotlight-id={spotlightId}
			{...rest}
		>
			{children}
		</button>
	);
});

describe('PanelTabNavigation', () => {
	const tabs = [
		{id: 'first', label: 'First'},
		{id: 'second', label: 'Second'}
	];

	it('renders Settings-style tab semantics and stable Spotlight ids', () => {
		render(
			<PanelTabNavigation
				activeId="second"
				ariaLabel="Example views"
				onSelect={jest.fn()}
				spotlightIdPrefix="example-tab"
				tabs={tabs}
			/>
		);

		expect(screen.getByRole('tablist', {name: 'Example views'})).toBeTruthy();
		expect(screen.getByRole('tab', {name: 'First'}).dataset.spotlightId).toBe('example-tab-first');
		expect(screen.getByRole('tab', {name: 'First'}).getAttribute('aria-selected')).toBe('false');
		expect(screen.getByRole('tab', {name: 'Second'}).getAttribute('aria-selected')).toBe('true');
	});

	it('reports the selected tab id through one shared event contract', () => {
		const onSelect = jest.fn();
		render(
			<PanelTabNavigation
				activeId="first"
				ariaLabel="Example views"
				onSelect={onSelect}
				tabs={tabs}
			/>
		);

		fireEvent.click(screen.getByRole('tab', {name: 'Second'}));
		expect(onSelect).toHaveBeenCalledWith('second', expect.any(Object));
	});
});
