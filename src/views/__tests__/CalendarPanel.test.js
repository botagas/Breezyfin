/* eslint-disable react/prop-types */
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import jellyfinService from '../../services/jellyfinService';
import CalendarPanel from '../CalendarPanel';

let mockRenderedRows = [];
const mockRequestIdRef = {current: 0};
const mockProviderShell = {
	cachePanelState: jest.fn(),
	captureScrollTo: jest.fn(),
	closeExternalItem: jest.fn(),
	externalItem: null,
	externalItemOpen: false,
	handleExternalItemHide: jest.fn(),
	handleScrollStop: jest.fn(),
	reportProviderDiagnostic: jest.fn(),
	reportProviderFailure: jest.fn(),
	requestIdRef: mockRequestIdRef,
	setExternalItem: jest.fn(),
	toolbarActions: {}
};

jest.mock('../../services/jellyfinService', () => ({
	getCalendarEvents: jest.fn(),
	getImageUrl: jest.fn((id) => `image:${id}`)
}));

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <div {...rest}>{children}</div>;
});

jest.mock('../../components/MediaRow', () => function TestMediaRow({items, title}) {
	mockRenderedRows.push({items, title});
	return <div data-testid={`calendar-row-${title}`}>{items.map((item) => item.Name).join(',')}</div>;
});

jest.mock('../../components/PanelActionButton', () => function TestButton({children, spotlightId, ...rest}) {
	return <button type="button" data-spotlight-id={spotlightId} {...rest}>{children}</button>;
});

jest.mock('../../components/IntegrationPanelLayout', () => function TestLayout({children}) {
	return <div>{children}</div>;
});

jest.mock('../../components/PanelTabNavigation', () => function TestTabs() {
	return <div />;
});

jest.mock('../../components/ProviderItemPopup', () => function TestPopup() {
	return null;
});

jest.mock('../../hooks/useProviderPanelShell', () => ({
	useProviderPanelShell: () => mockProviderShell
}));

jest.mock('../../hooks/usePluginMediaItemActivation', () => ({
	usePluginMediaItemActivation: () => jest.fn()
}));

const buildEvent = (id, title) => ({
	Id: id,
	Title: title,
	Type: 'Movie',
	UtcDate: '2026-08-01T18:00:00Z'
});

const buildPage = ({hasMore, items, nextStartIndex}) => ({
	available: true,
	result: {
		emptyReason: null,
		hasMore,
		items,
		nextStartIndex,
		warnings: []
	}
});

describe('CalendarPanel paging', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRenderedRows = [];
		mockRequestIdRef.current = 0;
	});

	it('deduplicates rapid page requests and appended events by stable ID', async () => {
		let resolveNextPage;
		jellyfinService.getCalendarEvents
			.mockResolvedValueOnce(buildPage({
				hasMore: true,
				items: [buildEvent('event-1', 'First event')],
				nextStartIndex: 60
			}))
			.mockReturnValueOnce(new Promise((resolve) => {
				resolveNextPage = resolve;
			}));

		render(<CalendarPanel isActive />);

		const loadMore = await screen.findByRole('button', {name: 'Load More'});
		fireEvent.click(loadMore);
		fireEvent.click(loadMore);

		expect(jellyfinService.getCalendarEvents).toHaveBeenCalledTimes(2);
		expect(jellyfinService.getCalendarEvents.mock.calls[1][0]).toEqual(expect.objectContaining({
			startIndex: 60
		}));

		await act(async () => {
			resolveNextPage(buildPage({
				hasMore: false,
				items: [
					buildEvent('event-1', 'Duplicate event'),
					buildEvent('event-2', 'Second event')
				],
				nextStartIndex: 120
			}));
			await Promise.resolve();
		});

		await waitFor(() => {
			const latestItems = mockRenderedRows.at(-1)?.items || [];
			expect(latestItems.map((item) => item.Id)).toEqual(['event-1', 'event-2']);
		});
	});
});
