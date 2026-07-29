/* eslint-disable react/prop-types */
import {render, screen} from '@testing-library/react';
import SyncPlayGlobalOverlays from '../SyncPlayGlobalOverlays';
import {useSyncPlay} from '../../contexts/SyncPlayContext';

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <div {...rest}>{children}</div>;
});

jest.mock('@enact/sandstone/Popup', () => function TestPopup({children, open}) {
	return open ? <div data-testid="popup-shell">{children}</div> : null;
});

jest.mock('../PanelActionButton', () => function TestButton({children, ...rest}) {
	return <button type="button" {...rest}>{children}</button>;
});

jest.mock('../../contexts/SyncPlayContext', () => ({
	useSyncPlay: jest.fn()
}));

describe('SyncPlayGlobalOverlays', () => {
	it('uses the themed surface and compact Watch action for suspended playback', () => {
		useSyncPlay.mockReturnValue({
			playDecision: null,
			notification: {type: 'remote-playback', message: 'Playback changed.'},
			resumeSession: jest.fn(),
			dismissNotification: jest.fn(),
			cancelPlayDecision: jest.fn()
		});

		render(<SyncPlayGlobalOverlays />);

		const notification = screen.getByRole('status');
		expect(notification.className).toContain('popupSurface');
		expect(screen.getByRole('button', {name: 'Watch'})).toBeTruthy();
		expect(screen.queryByRole('button', {name: 'Join playback'})).toBeNull();
	});

	it('uses the themed surface for queue replacement decisions', () => {
		useSyncPlay.mockReturnValue({
			playDecision: {item: {Id: 'item-1'}},
			notification: null,
			cancelPlayDecision: jest.fn(),
			confirmReplacePlayback: jest.fn(),
			joinCurrentPlayback: jest.fn()
		});

		render(<SyncPlayGlobalOverlays />);

		expect(screen.getByTestId('popup-shell').firstElementChild.className)
			.toContain('popupSurface');
	});
});
