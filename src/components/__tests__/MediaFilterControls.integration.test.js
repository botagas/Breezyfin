/* eslint-disable react/prop-types */
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderWithBreezyfin} from '../../testUtils/renderWithBreezyfin';
import {useMediaFilterState} from '../../hooks/useMediaFilterState';
import MediaFilterControls from '../MediaFilterControls';

jest.mock('@enact/sandstone/Popup', () => function TestPopup(props) {
	const React = require('react');
	const {children, onHide, open} = props;
	const wasOpenRef = React.useRef(open);
	React.useEffect(() => {
		if (wasOpenRef.current && !open) onHide?.();
		wasOpenRef.current = open;
	}, [onHide, open]);
	return open ? <section data-testid="filter-popup">{children}</section> : null;
});

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText(props) {
	return <div className={props.className}>{props.children}</div>;
});

jest.mock('../BreezyButton', () => function TestButton(props) {
	return (
		<button
			type="button"
			className={props.className}
			data-filter-id={props['data-filter-id']}
			data-selected={props.selected ? 'true' : 'false'}
			aria-pressed={props['aria-pressed']}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
});

jest.mock('../MediaBrowseControls', () => function TestMediaBrowseControls(props) {
	return (
		<button
			type="button"
			aria-label={props.filterLabel}
			data-active-filter-count={props.activeFilterCount}
			onClick={props.onFilterClick}
		>
			Filters
		</button>
	);
});

const FilterHarness = ({onApplyFilters}) => {
	const filters = useMediaFilterState({onApplyFilters});
	return (
		<MediaFilterControls
			title="Library"
			triggerSpotlightId="library-filter"
			activeFilterCount={filters.activeFilterCount}
			filterPopupOpen={filters.filterPopupOpen}
			filterPopupContentRef={filters.filterPopupContentRef}
			draftFilterIds={filters.draftFilterIds}
			onTrigger={filters.openFilterPopup}
			onClose={filters.closeFilterPopup}
			onHide={filters.handleFilterPopupHide}
			onReset={filters.resetDraftFilters}
			onApply={filters.applyDraftFilters}
			onDraftSelect={filters.selectDraftFilter}
		/>
	);
};

describe('MediaFilterControls lifecycle', () => {
	it('commits changed filters only after the Popup hide lifecycle', async () => {
		const onApplyFilters = jest.fn();
		renderWithBreezyfin(<FilterHarness onApplyFilters={onApplyFilters} />);

		fireEvent.click(screen.getByLabelText('Library filters'));
		fireEvent.click(screen.getByText('Favorites'));
		fireEvent.click(screen.getByText('Done'));

		await waitFor(() => expect(onApplyFilters).toHaveBeenCalledWith(['favorites']));
		expect(screen.queryByTestId('filter-popup')).toBeNull();
		expect(screen.getByLabelText('Library filters').getAttribute('data-active-filter-count')).toBe('1');
	});

	it('closes a no-op filter edit without reloading results', async () => {
		const onApplyFilters = jest.fn();
		renderWithBreezyfin(<FilterHarness onApplyFilters={onApplyFilters} />);

		fireEvent.click(screen.getByLabelText('Library filters'));
		fireEvent.click(screen.getByText('Done'));

		await waitFor(() => expect(screen.queryByTestId('filter-popup')).toBeNull());
		expect(onApplyFilters).not.toHaveBeenCalled();
	});

	it('uses the persistent selected marker alongside Sandstone selection state', () => {
		renderWithBreezyfin(<FilterHarness onApplyFilters={jest.fn()} />);

		fireEvent.click(screen.getByLabelText('Library filters'));

		expect(screen.getByText('Selected')).toBeTruthy();
		expect(screen.getByText('All').closest('button')?.getAttribute('data-selected')).toBe('true');
		expect(screen.getByText('All').closest('button')?.getAttribute('aria-pressed')).toBe('true');
	});
});
