/* eslint-disable react/prop-types */
import '../../testUtils/homePanelTestSetup';
import {readIntegrationPreferences} from '../../utils/integrationPreferences';
import {act, render, screen, waitFor} from '@testing-library/react';
import HomePanel from '../HomePanel';
import jellyfinService from '../../services/jellyfinService';
import {clearHomeContentCache} from '../../utils/homeContentCache';

jest.mock('@enact/spotlight', () => ({__esModule: true, default: {getPointerMode: () => true}}));
jest.mock('@enact/spotlight/Spottable', () => ({__esModule: true, default: () => function TestSpottable({children, className, onFocus}) {
 return <div className={className} onFocus={onFocus}>{children}</div>;
}}));
jest.mock('../../utils/spotlightContainerUtils', () => ({createLastFocusedSpotlightContainer: () => function TestContainer({children, onFocus}) {
 return <div onFocus={onFocus}>{children}</div>;
}}));
jest.mock('../../utils/platformCapabilities', () => ({getRuntimePlatformCapabilities: () => ({supportsAspectRatio: true, supportsFlexGap: true})}));
jest.mock('../../components/MediaCardImage', () => () => null);

const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
let observers;
beforeEach(() => {
 clearHomeContentCache(); jest.clearAllMocks(); observers = [];
 readIntegrationPreferences.mockReturnValue({homeSource: 'server', watchlistEnabled: true});
 Object.defineProperty(window, 'IntersectionObserver', {configurable: true, writable: true, value: jest.fn(callback => {
  const observer = {callback, target: null, observe: jest.fn(node => {observer.target = node;}), disconnect: jest.fn()};
  observers.push(observer);
  return observer;
 })});
 jellyfinService.getRecentlyAdded.mockResolvedValue([]);
 jellyfinService.getBreezyfinHomeSections.mockResolvedValue({available: true, result: {
  items: Array.from({length: 12}, (_, index) => ({Id: `row-${index}`, Title: `Server row ${index}`, Enabled: true})),
  totalRecordCount: 12
 }});
 jellyfinService.getBreezyfinHomeSectionItems.mockImplementation(async id => ({available: true, result: {
  items: [{Id: `movie-${id}`, Name: `Movie ${id}`, Type: 'Movie'}]
 }}));
});
afterEach(() => {
 clearHomeContentCache();
 if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
 else delete window.IntersectionObserver;
});

it('loads later server Home rows and expands the render window through visibility without focusing a card', async () => {
 render(<HomePanel isActive />);
 await waitFor(() => expect(jellyfinService.getBreezyfinHomeSectionItems).toHaveBeenCalledTimes(4));
 expect(screen.queryByText('Server row 8')).toBeNull();
 const row = screen.getByText('Server row 6').closest('[data-bf-home-row-status]');
 expect(row.dataset.bfHomeRowStatus).toBe('pending');
 const observer = observers.find(entry => entry.target === row);
 expect(observer).toBeDefined();
 act(() => observer.callback([{isIntersecting: true}]));
 await waitFor(() => expect(jellyfinService.getBreezyfinHomeSectionItems).toHaveBeenCalledWith('row-6', 10, 0));
 expect(await screen.findByText('Movie row-6')).toBeTruthy();
 expect(screen.getByText('Server row 8')).toBeTruthy();
});
