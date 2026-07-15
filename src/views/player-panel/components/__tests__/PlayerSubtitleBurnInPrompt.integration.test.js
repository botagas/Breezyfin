/* eslint-disable react/prop-types */
import {useState} from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderWithBreezyfin} from '../../../../testUtils/renderWithBreezyfin';
import PlayerSubtitleBurnInPrompt from '../PlayerSubtitleBurnInPrompt';

jest.mock('@enact/sandstone/Popup', () => function TestPopup(props) {
	const React = require('react');
	const {children, onClose, onHide, open} = props;
	const wasOpenRef = React.useRef(open);
	React.useEffect(() => {
		if (wasOpenRef.current && !open) onHide?.();
		wasOpenRef.current = open;
	}, [onHide, open]);
	if (!open) return null;
	return (
		<section>
			<button type="button" onClick={onClose}>Popup Back</button>
			{children}
		</section>
	);
});

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText(props) {
	return <div>{props.children}</div>;
});

jest.mock('../../../../components/BreezyButton', () => function TestButton(props) {
	return <button type="button" onClick={props.onClick}>{props.children}</button>;
});

const PromptHarness = ({onBack, onConfirm, onDecline, onHide}) => {
	const [open, setOpen] = useState(true);
	const handleBack = () => {
		onBack();
		setOpen(false);
	};
	return (
		<PlayerSubtitleBurnInPrompt
			open={open}
			prompt={{type: 'no-subtitles', reason: 'renderer-failed'}}
			onBack={handleBack}
			onConfirm={onConfirm}
			onDecline={onDecline}
			onHide={onHide}
		/>
	);
};

describe('PlayerSubtitleBurnInPrompt lifecycle', () => {
	it('routes Popup Back through the exit path without starting a fallback', async () => {
		const onBack = jest.fn();
		const onConfirm = jest.fn();
		const onDecline = jest.fn();
		const onHide = jest.fn();
		renderWithBreezyfin(
			<PromptHarness
				onBack={onBack}
				onConfirm={onConfirm}
				onDecline={onDecline}
				onHide={onHide}
			/>
		);

		fireEvent.click(screen.getByText('Popup Back'));

		expect(onBack).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onDecline).not.toHaveBeenCalled();
		await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
	});
});
