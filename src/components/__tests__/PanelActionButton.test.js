/* eslint-disable react/prop-types */
import {fireEvent, render, screen} from '@testing-library/react';
import PanelActionButton from '../PanelActionButton';

jest.mock('../BreezyButton', () => function TestButton({children, spotlightId, ...rest}) {
	return (
		<button type="button" data-spotlight-id={spotlightId} {...rest}>
			{children}
		</button>
	);
});

describe('PanelActionButton', () => {
	it('combines the shared themed surface with caller styling', () => {
		render(
			<PanelActionButton className="caller-action" spotlightId="example-action">
				Example
			</PanelActionButton>
		);

		const button = screen.getByRole('button', {name: 'Example'});
		expect(button.className).toContain('actionButton');
		expect(button.className).toContain('caller-action');
		expect(button.dataset.spotlightId).toBe('example-action');
	});

	it('preserves the BreezyButton event contract', () => {
		const onClick = jest.fn();
		render(<PanelActionButton onClick={onClick}>Run action</PanelActionButton>);

		fireEvent.click(screen.getByRole('button', {name: 'Run action'}));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
