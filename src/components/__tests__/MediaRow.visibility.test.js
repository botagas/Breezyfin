/* eslint-disable react/prop-types */
import {act, fireEvent, render, screen} from '@testing-library/react';
import MediaRow from '../MediaRow';

jest.mock('../../services/jellyfinService', () => ({__esModule: true, default: {}}));
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {getPointerMode: () => true}}));
jest.mock('@enact/spotlight/Spottable', () => ({__esModule: true, default: (Component) => Component}));
jest.mock('@enact/sandstone/BodyText', () => ({children}) => <span>{children}</span>);
jest.mock('@enact/sandstone/Icon', () => ({children}) => <span>{children}</span>);
jest.mock('../../utils/spotlightContainerUtils', () => ({createLastFocusedSpotlightContainer: () => 'div'}));
jest.mock('../../utils/platformCapabilities', () => ({getRuntimePlatformCapabilities: () => ({supportsAspectRatio: true, supportsFlexGap: true})}));
jest.mock('../BreezyLoadingOverlay', () => () => null);

const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
let observers;
beforeEach(() => {
	observers = [];
	Object.defineProperty(window, 'IntersectionObserver', {configurable: true, writable: true, value: jest.fn((callback) => {
		const observer = {callback, observe: jest.fn(), disconnect: jest.fn()};
		observers.push(observer);
		return observer;
	})});
});
afterEach(() => {
	if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
	else delete window.IntersectionObserver;
});

it.each([undefined, true, false])('activates an unfocused pending row on visibility with imagesActive=%s', (imagesActive) => {
	const onRowVisible = jest.fn();
	render(<MediaRow title="Later server row" status="pending" items={[]} rowIndex={4} imagesActive={imagesActive} onRowVisible={onRowVisible} />);
	expect(observers).toHaveLength(1);
	const observer = observers[0];
	expect(observer.observe).toHaveBeenCalledWith(screen.getByText('Later server row').closest('[data-bf-home-row-status]'));
	act(() => observer.callback([{isIntersecting: false}]));
	expect(onRowVisible).not.toHaveBeenCalled();
	act(() => observer.callback([{isIntersecting: true}]));
	expect(onRowVisible).toHaveBeenCalledWith(4);
	expect(observer.disconnect).toHaveBeenCalled();
	act(() => observer.callback([{isIntersecting: true}]));
	expect(onRowVisible).toHaveBeenCalledTimes(1);
});

it('does not restart visibility observation when image activation changes', () => {
	const onRowVisible = jest.fn();
	const view = render(<MediaRow title="Later server row" status="pending" onRowVisible={onRowVisible} imagesActive={false} />);
	view.rerender(<MediaRow title="Later server row" status="pending" onRowVisible={onRowVisible} imagesActive />);
	expect(observers).toHaveLength(1);
	act(() => observers[0].callback([{isIntersecting: true}]));
	expect(onRowVisible).toHaveBeenCalledWith(0);
});

it('disconnects on unmount and ignores an already queued visibility callback', () => {
	const onRowVisible = jest.fn();
	const {unmount} = render(<MediaRow title="Later server row" status="pending" imagesActive={false} onRowVisible={onRowVisible} />);
	const observer = observers[0];
	unmount();
	expect(observer.disconnect).toHaveBeenCalled();
	act(() => observer.callback([{isIntersecting: true}]));
	expect(onRowVisible).not.toHaveBeenCalled();
});

it('retains focus activation when IntersectionObserver is unavailable', () => {
	window.IntersectionObserver = undefined;
	const onRowVisible = jest.fn();
	render(<MediaRow title="Later server row" status="pending" rowIndex={4} onRowVisible={onRowVisible} />);
	fireEvent.focus(screen.getByText('Later server row').closest('[data-bf-home-row-status]'));
	expect(onRowVisible).toHaveBeenCalledWith(4);
});

it('does not allocate an observer when the caller does not request row visibility', () => {
	render(<MediaRow title="Standalone row" status="pending" />);
	expect(observers).toHaveLength(0);
});
