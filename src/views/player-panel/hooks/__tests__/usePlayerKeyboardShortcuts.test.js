import {fireEvent, renderHook} from '@testing-library/react';
import {KeyCodes} from '../../../../utils/keyCodes';
import {usePlayerKeyboardShortcuts} from '../usePlayerKeyboardShortcuts';

const buildHookProps = (overrides = {}) => ({
	isActive: true,
	onUserInteraction: jest.fn(),
	showControls: false,
	setShowControls: jest.fn(),
	skipOverlayVisible: false,
	showAudioPopup: false,
	showSubtitlePopup: false,
	isSeekContext: jest.fn(() => false),
	seekBySeconds: jest.fn(),
	handleInternalBack: jest.fn(() => false),
	handleBackButton: jest.fn(),
	handlePause: jest.fn(),
	handlePlay: jest.fn(),
	playing: false,
	controlsRef: {current: null},
	skipOverlayRef: {current: null},
	focusSkipOverlayAction: jest.fn(),
	isProgressSliderTarget: jest.fn(() => false),
	...overrides
});

describe('usePlayerKeyboardShortcuts', () => {
	it('defers wake keys entirely to the paused-player screensaver', () => {
		const props = buildHookProps({screensaverActive: true});
		renderHook(() => usePlayerKeyboardShortcuts(props));

		fireEvent.keyDown(document, {keyCode: KeyCodes.ENTER, which: KeyCodes.ENTER});
		fireEvent.keyDown(document, {keyCode: KeyCodes.DOWN, which: KeyCodes.DOWN});

		expect(props.onUserInteraction).not.toHaveBeenCalled();
		expect(props.setShowControls).not.toHaveBeenCalled();
		expect(props.handlePlay).not.toHaveBeenCalled();
		expect(props.handlePause).not.toHaveBeenCalled();
	});

	it('retains normal player shortcuts when the screensaver is inactive', () => {
		const props = buildHookProps();
		renderHook(() => usePlayerKeyboardShortcuts(props));

		fireEvent.keyDown(document, {keyCode: KeyCodes.ENTER, which: KeyCodes.ENTER});

		expect(props.onUserInteraction).toHaveBeenCalledTimes(1);
		expect(props.handlePlay).toHaveBeenCalledWith({keepHidden: true});
	});

	it.each([
		['ENTER', KeyCodes.ENTER],
		['OK', KeyCodes.OK],
		['Space', KeyCodes.SPACE]
	])('leaves %s activation to a focused popup action', (_, keyCode) => {
		const props = buildHookProps();
		const popup = document.createElement('div');
		popup.dataset.popupFocusScope = 'true';
		const action = document.createElement('button');
		popup.appendChild(action);
		document.body.appendChild(popup);
		action.focus();
		renderHook(() => usePlayerKeyboardShortcuts(props));

		fireEvent.keyDown(action, {keyCode, which: keyCode});

		expect(props.handlePlay).not.toHaveBeenCalled();
		expect(props.handlePause).not.toHaveBeenCalled();
		popup.remove();
	});
});
