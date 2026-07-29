import {render, screen} from '@testing-library/react';

import MediaTrackPickerPopup from '../MediaTrackPickerPopup';

jest.mock('../../../../components/BreezyButton', () => (
	require('../../../../testUtils/mocks/SelectedControl').default
));
jest.mock('@enact/sandstone/Icon', () => ({children, ...props}) => (
	<span {...props}>{children}</span>
));
jest.mock('../MediaOptionPickerPopup', () => ({children, open, title}) => (
	open ? (
		<div>
			<h2>{title}</h2>
			{children}
		</div>
	) : null
));

describe('MediaTrackPickerPopup', () => {
	it('marks the active track independently from focus', () => {
		render(
			<MediaTrackPickerPopup
				open
				onClose={jest.fn()}
				type="subtitle"
				tracks={[
					{key: 'off', children: 'Off'},
					{key: 3, children: 'English ASS'}
				]}
				selectedKey={3}
				onTrackSelect={jest.fn()}
			/>
		);

		expect(screen.getByText('Selected')).toBeTruthy();
		expect(screen.getByText('English ASS').closest('button')?.getAttribute('aria-current')).toBe('true');
		expect(screen.queryByText('Off')?.closest('button')?.getAttribute('aria-current')).toBeNull();
	});
});
