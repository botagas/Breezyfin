/* eslint-disable react/prop-types */
import {fireEvent, render, screen} from '@testing-library/react';
import ProviderItemPopup from '../ProviderItemPopup';

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <div {...rest}>{children}</div>;
});

jest.mock('@enact/sandstone/Popup', () => function TestPopup({children, open}) {
	return open ? <div data-testid="popup-shell">{children}</div> : null;
});

jest.mock('../BreezyPanels', () => ({
	Header: ({title}) => <h2>{title}</h2>
}));

jest.mock('../PanelActionButton', () => function TestButton({children, spotlightId, ...rest}) {
	return <button type="button" data-spotlight-id={spotlightId} {...rest}>{children}</button>;
});

jest.mock('../../hooks/usePopupInitialFocus', () => ({
	usePopupInitialFocus: jest.fn()
}));

describe('ProviderItemPopup', () => {
	it('uses the themed popup surface and shared action button', () => {
		const onClose = jest.fn();
		render(
			<ProviderItemPopup
				open
				title="Provider title"
				detail="A long provider description."
				onClose={onClose}
			/>
		);

		const surface = screen.getByText('A long provider description.').parentElement;
		expect(surface.className).toContain('popupSurface');
		fireEvent.click(screen.getByRole('button', {name: 'Close'}));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('renders available provider summary and credits without requiring every field', () => {
		render(
			<ProviderItemPopup
				open
				title="Provider title"
				detail="A provider description."
				item={{
					Type: 'Movie',
					ProductionYear: 2026,
					CommunityRating: 8.25,
					Genres: ['Drama', 'Fantasy'],
					People: [
						{Name: 'Director One', Type: 'Director'},
						{Name: 'Writer One', Type: 'Writer'}
					]
				}}
				onClose={jest.fn()}
			/>
		);

		expect(screen.getByText('2026')).toBeTruthy();
		expect(screen.getByText('★')).toBeTruthy();
		expect(screen.getByText('8.3/10')).toBeTruthy();
		expect(screen.queryByText('Rating 8.3/10')).toBeNull();
		expect(screen.getByText('Drama')).toBeTruthy();
		expect(screen.getByText('Fantasy')).toBeTruthy();
		expect(screen.queryByText(/Genres:/)).toBeNull();
		expect(screen.getByText(/Director One/)).toBeTruthy();
		expect(screen.getByText(/Writer One/)).toBeTruthy();
	});
});
