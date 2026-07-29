/* eslint-disable react/prop-types */
import {fireEvent, render, screen} from '@testing-library/react';
import {KeyCodes} from '../../../../utils/keyCodes';
import PlayerErrorPopup from '../PlayerErrorPopup';
import {usePlayerKeyboardShortcuts} from '../../hooks/usePlayerKeyboardShortcuts';
import {
	SERVER_TRANSCODING_FAILURE_MESSAGE,
	SERVER_TRANSCODING_FAILURE_TITLE
} from '../../utils/playerRecoveryPolicy';

jest.mock('@enact/sandstone/Popup', () => function TestPopup({children, open}) {
	return open ? <section>{children}</section> : null;
});

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children}) {
	return <div>{children}</div>;
});

jest.mock('../../../../components/BreezyButton', () => function TestButton({
	children,
	onClick,
	...props
}) {
	const {KeyCodes: MockKeyCodes} = require('../../../../utils/keyCodes');
	return (
		<button
			type="button"
			onClick={onClick}
			onKeyDown={(event) => {
				const code = event.keyCode || event.which;
				if ([MockKeyCodes.ENTER, MockKeyCodes.OK, MockKeyCodes.SPACE].includes(code)) onClick?.();
			}}
			{...props}
		>
			{children}
		</button>
	);
});

const Harness = ({onRetry, onBack, error = 'Format not supported'}) => {
	usePlayerKeyboardShortcuts({
		isActive: true,
		onUserInteraction: jest.fn(),
		showControls: true,
		setShowControls: jest.fn(),
		skipOverlayVisible: false,
		showAudioPopup: false,
		showSubtitlePopup: false,
		isSeekContext: jest.fn(() => false),
		seekBySeconds: jest.fn(),
		handleInternalBack: jest.fn(() => false),
		handleBackButton: onBack,
		handlePause: jest.fn(),
		handlePlay: jest.fn(),
		playing: false,
		controlsRef: {current: null},
		skipOverlayRef: {current: null},
		focusSkipOverlayAction: jest.fn(),
		isProgressSliderTarget: jest.fn(() => false)
	});
	return (
		<PlayerErrorPopup
			open
			error={error}
			onClose={jest.fn()}
			onRetry={onRetry}
			onBack={onBack}
		/>
	);
};

describe('PlayerErrorPopup activation', () => {
	it.each([
		['Retry', 'ENTER', KeyCodes.ENTER],
		['Retry', 'OK', KeyCodes.OK],
		['Retry', 'Space', KeyCodes.SPACE],
		['Go Back', 'ENTER', KeyCodes.ENTER],
		['Go Back', 'OK', KeyCodes.OK],
		['Go Back', 'Space', KeyCodes.SPACE]
	])('activates %s with %s', (action, _, keyCode) => {
		const onRetry = jest.fn();
		const onBack = jest.fn();
		render(<Harness onRetry={onRetry} onBack={onBack} />);
		const button = screen.getByRole('button', {name: action});
		button.focus();

		fireEvent.keyDown(button, {keyCode, which: keyCode});

		expect(action === 'Retry' ? onRetry : onBack).toHaveBeenCalledTimes(1);
	});

	it('activates both actions through pointer input', () => {
		const onRetry = jest.fn();
		const onBack = jest.fn();
		render(<Harness onRetry={onRetry} onBack={onBack} />);

		fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
		fireEvent.click(screen.getByRole('button', {name: 'Go Back'}));

		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('routes Back through Player back handling without retrying', () => {
		const onRetry = jest.fn();
		const onBack = jest.fn();
		render(<Harness onRetry={onRetry} onBack={onBack} />);

		fireEvent.keyDown(document, {keyCode: KeyCodes.BACK, which: KeyCodes.BACK});

		expect(onBack).toHaveBeenCalledTimes(1);
		expect(onRetry).not.toHaveBeenCalled();
	});

	it('renders the dedicated server-transcoding title and guidance', () => {
		render(
			<Harness
				onRetry={jest.fn()}
				onBack={jest.fn()}
				error={SERVER_TRANSCODING_FAILURE_MESSAGE}
			/>
		);

		expect(screen.getByText(SERVER_TRANSCODING_FAILURE_TITLE)).toBeTruthy();
		expect(screen.getByText(SERVER_TRANSCODING_FAILURE_MESSAGE)).toBeTruthy();
		expect(screen.queryByText('Playback Error')).toBeNull();
	});
});
