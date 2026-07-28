/* eslint-disable react/prop-types */
import {act, fireEvent, render, screen} from '@testing-library/react';
import {createRef} from 'react';
import Spotlight from '@enact/spotlight';
import AppCrashBoundary from '../AppCrashBoundary';
import {getCrashActionFromElement} from '../utils/crashActions';
import {
	consumeCrashRecoveryAction,
	CRASH_RECOVERY_ACTIONS
} from '../../utils/crashRecovery';
import {KeyCodes} from '../../utils/keyCodes';

jest.mock('@enact/spotlight', () => ({
	__esModule: true,
	default: {getCurrent: jest.fn()}
}));

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children}) {
	return <div>{children}</div>;
});

jest.mock('@enact/sandstone/Heading', () => function TestHeading({children}) {
	return <h1>{children}</h1>;
});

jest.mock('../../components/BreezyButton', () => function TestButton({
	children,
	onClick,
	...props
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={props.className}
			data-crash-action={props['data-crash-action']}
			data-spotlight-id={props.spotlightId}
		>
			{children}
		</button>
	);
});

describe('AppCrashBoundary crash actions', () => {
	beforeEach(() => {
		window.localStorage.clear();
		Spotlight.getCurrent.mockReset();
	});

	it('resolves Spotlight ids returned as strings for 5-way activation', () => {
		expect(getCrashActionFromElement('crash-action-back')).toBe(CRASH_RECOVERY_ACTIONS.BACK);
		expect(getCrashActionFromElement('crash-action-home')).toBe(CRASH_RECOVERY_ACTIONS.HOME);
	});

	it('resolves the focused crash action from a nested button element', () => {
		const button = document.createElement('button');
		button.dataset.crashAction = CRASH_RECOVERY_ACTIONS.BACK;
		const child = document.createElement('span');
		button.appendChild(child);
		expect(getCrashActionFromElement(child)).toBe(CRASH_RECOVERY_ACTIONS.BACK);
	});

	it.each([
		['Back', 'crash-action-back', CRASH_RECOVERY_ACTIONS.BACK, KeyCodes.ENTER],
		['Back', 'crash-action-back', CRASH_RECOVERY_ACTIONS.BACK, KeyCodes.OK],
		['Back', 'crash-action-back', CRASH_RECOVERY_ACTIONS.BACK, KeyCodes.SPACE],
		['Return Home', 'crash-action-home', CRASH_RECOVERY_ACTIONS.HOME, KeyCodes.ENTER],
		['Return Home', 'crash-action-home', CRASH_RECOVERY_ACTIONS.HOME, KeyCodes.OK],
		['Return Home', 'crash-action-home', CRASH_RECOVERY_ACTIONS.HOME, KeyCodes.SPACE]
	])('activates %s through a 5-way key', (_, spotlightId, expectedAction, keyCode) => {
		const boundaryRef = createRef();
		render(
			<AppCrashBoundary ref={boundaryRef}>
				<div>Application content</div>
			</AppCrashBoundary>
		);
		act(() => {
			boundaryRef.current.setState({error: new Error('test crash')});
		});
		Spotlight.getCurrent.mockReturnValue(spotlightId);

		fireEvent.keyDown(document, {keyCode, which: keyCode});

		expect(consumeCrashRecoveryAction()).toBe(expectedAction);
		expect(screen.getByText('Application content')).toBeTruthy();
	});

	it('uses the physical Back key for crash recovery', () => {
		const boundaryRef = createRef();
		render(
			<AppCrashBoundary ref={boundaryRef}>
				<div>Application content</div>
			</AppCrashBoundary>
		);
		act(() => {
			boundaryRef.current.setState({error: new Error('test crash')});
		});

		fireEvent.keyDown(document, {keyCode: KeyCodes.BACK, which: KeyCodes.BACK});

		expect(consumeCrashRecoveryAction()).toBe(CRASH_RECOVERY_ACTIONS.BACK);
	});
});
