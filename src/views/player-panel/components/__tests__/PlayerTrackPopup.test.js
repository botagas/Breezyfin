import {render, screen} from '@testing-library/react';

import PlayerTrackPopup from '../PlayerTrackPopup';

jest.mock('@enact/sandstone/Popup', () => ({children, open}) => (
	open ? <div>{children}</div> : null
));
jest.mock('@enact/sandstone/BodyText', () => ({children, ...props}) => (
	<div {...props}>{children}</div>
));
jest.mock('@enact/sandstone/Item', () => (
	require('../../../../testUtils/mocks/SelectedControl').default
));
jest.mock('@enact/sandstone/Icon', () => ({children, ...props}) => (
	<span {...props}>{children}</span>
));
jest.mock('../../../../components/AppScroller', () => ({children, ...props}) => (
	<div {...props}>{children}</div>
));
jest.mock('../../../../hooks/usePopupInitialFocus', () => ({
	usePopupInitialFocus: jest.fn()
}));

describe('PlayerTrackPopup', () => {
	it('marks the active track independently from focus', () => {
		render(
			<PlayerTrackPopup
				open
				onClose={jest.fn()}
				title="Audio"
				tracks={[
					{Index: 1, DisplayTitle: 'English'},
					{Index: 2, DisplayTitle: 'Japanese'}
				]}
				currentTrack={2}
				onTrackClick={jest.fn()}
				getTrackLabel={(track) => track.DisplayTitle}
			/>
		);

		expect(screen.getByText('Selected')).toBeTruthy();
		expect(screen.getByText('Japanese').closest('button')?.getAttribute('aria-current')).toBe('true');
		expect(screen.queryByText('English')?.closest('button')?.getAttribute('aria-current')).toBeNull();
	});
});
