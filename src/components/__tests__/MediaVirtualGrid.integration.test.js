/* eslint-disable react/prop-types */
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderWithBreezyfin} from '../../testUtils/renderWithBreezyfin';
import MediaVirtualGrid from '../MediaVirtualGrid';

const mockScrollTo = jest.fn();
let mockVirtualGridProps = null;

jest.mock('@enact/sandstone/Spinner', () => function TestSpinner() {
	return <span>Loading</span>;
});

jest.mock('@enact/sandstone/VirtualList', () => ({
	VirtualGridList: function TestVirtualGridList(props) {
		const React = require('react');
		const {cbScrollTo} = props;
		mockVirtualGridProps = props;
		React.useEffect(() => {
			cbScrollTo?.(mockScrollTo);
			return () => cbScrollTo?.(null);
		}, [cbScrollTo]);
		return (
			<div data-testid="virtual-grid">
				{Array.from({length: props.dataSize}, (_, index) => (
					<div key={index}>
						{props.itemRenderer({...props.childProps, index})}
					</div>
				))}
			</div>
		);
	}
}));

const ItemRenderer = ({index, items, onVirtualItemFocusEvent}) => (
	<button
		type="button"
		data-index={index}
		onFocus={onVirtualItemFocusEvent}
	>
		{items[index].Name}
	</button>
);

describe('MediaVirtualGrid integration', () => {
	beforeEach(() => {
		mockScrollTo.mockClear();
		mockVirtualGridProps = null;
	});

	it('restores a stable item through the VirtualGridList scroll API', async () => {
		renderWithBreezyfin(
			<MediaVirtualGrid
				id="results"
				items={[{Id: 'a', Name: 'Alpha'}, {Id: 'b', Name: 'Beta'}]}
				itemRenderer={ItemRenderer}
				queryKey="query-one"
				restoreItemId="b"
			/>
		);

		await waitFor(() => expect(mockScrollTo).toHaveBeenCalledWith({
			index: 1,
			focus: true,
			animate: false
		}));
	});

	it('tracks focused item identity and requests pagination near the end', () => {
		const focusedItemIdRef = {current: null};
		const onLoadMore = jest.fn();
		renderWithBreezyfin(
			<MediaVirtualGrid
				id="results"
				items={[{Id: 'a', Name: 'Alpha'}, {Id: 'b', Name: 'Beta'}]}
				itemRenderer={ItemRenderer}
				focusedItemIdRef={focusedItemIdRef}
				hasMore
				loadMoreThreshold={0}
				onLoadMore={onLoadMore}
			/>
		);

		fireEvent.focus(screen.getByText('Beta'));
		expect(focusedItemIdRef.current).toBe('b');
		expect(onLoadMore).toHaveBeenCalledTimes(1);

		act(() => mockVirtualGridProps.onScrollStop({moreInfo: {lastVisibleIndex: 1}}));
		expect(onLoadMore).toHaveBeenCalledTimes(2);
	});

	it('keeps the virtual scroller mounted when its results are temporarily cleared', () => {
		const {rerender} = renderWithBreezyfin(
			<MediaVirtualGrid
				id="results"
				items={[{Id: 'a', Name: 'Alpha'}]}
				itemRenderer={ItemRenderer}
			/>
		);
		const initialGrid = screen.getByTestId('virtual-grid');

		rerender(
			<MediaVirtualGrid
				id="results"
				items={[]}
				itemRenderer={ItemRenderer}
				data-spotlight-container-disabled
			/>
		);

		expect(screen.getByTestId('virtual-grid')).toBe(initialGrid);
		expect(mockVirtualGridProps.dataSize).toBe(0);
	});
});
