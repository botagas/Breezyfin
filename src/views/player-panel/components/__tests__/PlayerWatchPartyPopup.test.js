/* eslint-disable react/prop-types */
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import PlayerWatchPartyPopup from '../PlayerWatchPartyPopup';

jest.mock('@enact/sandstone/Popup', () => function TestPopup({children, open}) {
	return open ? <div>{children}</div> : null;
});

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <div {...rest}>{children}</div>;
});

jest.mock('@enact/sandstone/Input', () => function TestInput({onChange, placeholder, value}) {
	return (
		<input
			aria-label={placeholder}
			value={value}
			onChange={(event) => onChange({value: event.target.value})}
		/>
	);
});

jest.mock('../../../../components/PanelActionButton', () => function TestButton({children, ...rest}) {
	return <button type="button" {...rest}>{children}</button>;
});

const baseProps = {
	open: true,
	availability: {available: true},
	state: {connectionState: 'open', room: null, rooms: [], chat: []},
	item: {Name: 'Example'},
	onClose: jest.fn(),
	onCreate: jest.fn(),
	onJoin: jest.fn(),
	onLeave: jest.fn(),
	onSendChat: jest.fn()
};

describe('PlayerWatchPartyPopup', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('deduplicates pending asynchronous room actions', async () => {
		let resolveCreate;
		const onCreate = jest.fn(() => new Promise((resolve) => {
			resolveCreate = resolve;
		}));
		render(<PlayerWatchPartyPopup {...baseProps} onCreate={onCreate} />);

		const createButton = screen.getByRole('button', {name: 'Create Room'});
		fireEvent.click(createButton);
		fireEvent.click(createButton);

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', {name: 'Creating...'}).disabled).toBe(true);
		resolveCreate();
		await waitFor(() => expect(screen.getByRole('button', {name: 'Create Room'}).disabled).toBe(false));
	});

	it('keeps asynchronous failures visible inside the popup', async () => {
		const onCreate = jest.fn().mockRejectedValue(new Error('Room creation failed'));
		render(<PlayerWatchPartyPopup {...baseProps} onCreate={onCreate} />);

		fireEvent.click(screen.getByRole('button', {name: 'Create Room'}));

		expect(await screen.findByText('Room creation failed')).toBeTruthy();
	});
});
