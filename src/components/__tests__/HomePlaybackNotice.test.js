/* eslint-disable react/prop-types */
import {fireEvent, render, screen} from '@testing-library/react';
import HomePlaybackNotice from '../HomePlaybackNotice';

let mockHide;
jest.mock('@enact/sandstone/Popup', () => function TestPopup({children, open, onHide}) {
	mockHide = onHide;
	return open ? <section role="dialog">{children}</section> : null;
});
jest.mock('@enact/sandstone/BodyText', () => function TestText({children}) { return <p>{children}</p>; });
jest.mock('../PanelActionButton', () => function TestButton({children, ...props}) { return <button {...props}>{children}</button>; });
jest.mock('../../hooks/usePopupInitialFocus', () => ({usePopupInitialFocus: jest.fn()}));

describe('Home account notice', () => {
	it('defers account navigation until the popup finishes hiding', () => {
		const choose = jest.fn(), hidden = jest.fn(), shown = jest.fn();
		render(<HomePlaybackNotice notice={{account: true, message: 'Match Home account'}} onChooseAccount={choose} onCancel={jest.fn()} onShown={shown} onHidden={hidden} />);
		expect(shown).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByRole('button', {name: 'Choose account'}));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenLastCalledWith({hideOnly: true});
		mockHide();
		expect(hidden).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledTimes(2);
		expect(choose).toHaveBeenLastCalledWith();
	});
	it('cancels a queued account action before hide completion', () => {
		const choose = jest.fn(), cancel = jest.fn();
		render(<HomePlaybackNotice notice={{account: true, message: 'Match Home account'}} onChooseAccount={choose} onCancel={cancel} onShown={jest.fn()} onHidden={jest.fn()} />);
		fireEvent.click(screen.getByRole('button', {name: 'Choose account'}));
		fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
		mockHide();
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledTimes(1);
	});
});
