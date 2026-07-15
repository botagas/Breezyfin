import {act, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';
import {renderWithBreezyfin} from '../../../testUtils/renderWithBreezyfin';
import ToolbarLibraryPicker from '../ToolbarLibraryPicker';

describe('ToolbarLibraryPicker focus', () => {
	it('exposes library entries as a contained Spotlight focus scope', async () => {
		renderWithBreezyfin(
			<ToolbarLibraryPicker
				useElegantGlass={false}
				libraries={[
					{Id: 'movies', Name: 'Movies'},
					{Id: 'shows', Name: 'Shows'}
				]}
				activeSection="home"
				activeLibraryId={null}
				onLibrarySelect={jest.fn()}
				contentRef={{current: null}}
			/>
		);

		expect(await screen.findByText('Movies')).toBeTruthy();
		let focused = false;
		act(() => {
			focused = Spotlight.focus('toolbar-library-picker-movies');
		});
		expect(focused).toBe(true);
		expect(document.activeElement?.getAttribute('data-spotlight-id')).toBe('toolbar-library-picker-movies');
	});
});
