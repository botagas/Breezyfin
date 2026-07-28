/* eslint-disable react/prop-types */
import {render, screen} from '@testing-library/react';
import IntegrationPanelLayout from '../IntegrationPanelLayout';

jest.mock('../BreezyPanels', () => ({
	Panel: ({children}) => <section data-testid="panel">{children}</section>,
	Header: ({title}) => <h1>{title}</h1>
}));

jest.mock('../AppScroller', () => function TestScroller({children}) {
	return <div data-testid="app-scroller">{children}</div>;
});

jest.mock('../Toolbar', () => function TestToolbar({panelTitle}) {
	return <nav data-panel-title={panelTitle} />;
});

jest.mock('../BreezyLoadingOverlay', () => function TestLoading({label}) {
	return <div>{label}</div>;
});

jest.mock('../MediaPanelBackdrop', () => function TestBackdrop() {
	return <div />;
});

jest.mock('../BreezyButton', () => function TestButton({children, ...rest}) {
	return <button type="button" {...rest}>{children}</button>;
});

describe('IntegrationPanelLayout scroll ownership', () => {
	it('uses the shared AppScroller for document-style panel content by default', () => {
		render(
			<IntegrationPanelLayout title="Calendar" activeSection="calendar">
				<div>Calendar content</div>
			</IntegrationPanelLayout>
		);

		expect(screen.getByTestId('app-scroller')).toBeTruthy();
		expect(screen.getByText('Calendar content')).toBeTruthy();
	});

	it('does not nest an AppScroller around a child-owned virtual viewport', () => {
		render(
			<IntegrationPanelLayout title="Watchlist" activeSection="watchlist" scrollable={false}>
				<div>Virtual list content</div>
			</IntegrationPanelLayout>
		);

		expect(screen.queryByTestId('app-scroller')).toBeNull();
		expect(screen.getByText('Virtual list content')).toBeTruthy();
		expect(
			screen.getByText('Virtual list content').closest('[data-bf-integration-panel-content="true"]')
		).toBeTruthy();
		expect(document.querySelector('nav').dataset.panelTitle).toBe('Watchlist');
	});
});
