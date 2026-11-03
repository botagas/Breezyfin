/* eslint-disable react/prop-types */
import '../../testUtils/homePanelTestSetup';
import {readIntegrationPreferences} from '../../utils/integrationPreferences';
import {act, render, screen, waitFor} from '@testing-library/react';
import HomePanel from '../HomePanel';
import jellyfinService from '../../services/jellyfinService';
import {clearHomeContentCache, getHomeContentSessionKey, readHomeContentCache, writeHomeContentCache} from '../../utils/homeContentCache';
import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../../constants/integrationEvents';

jest.mock('../../components/MediaRow', () => ({items = []}) => <div>{items.map(item => <span key={item.Id}>{item.Name}</span>)}</div>);

beforeEach(() => {
 clearHomeContentCache(); jest.clearAllMocks();
 readIntegrationPreferences.mockReturnValue({homeSource: 'builtin', watchlistEnabled: true});
 jest.spyOn(console, 'error').mockImplementation(() => {});
 for (const method of ['getRecentlyAdded', 'getResumeItems', 'getNextUp', 'getLatestMedia']) jellyfinService[method].mockResolvedValue([]);
 jellyfinService.getMyRequests.mockResolvedValue({items: []});
 jellyfinService.getLikesWatchlist.mockResolvedValue({items: []});
});
afterEach(() => {clearHomeContentCache(); jest.restoreAllMocks();});
const key = () => getHomeContentSessionKey(jellyfinService);

it('retries a failed initial load on the next Home visit and accepts valid empty results', async () => {
 jellyfinService.getResumeItems.mockRejectedValueOnce(new Error('offline'));
 jellyfinService.getRecentlyAdded.mockResolvedValue([{Id: 'available', Type: 'Movie', Name: 'Available despite row failure'}]);
 const view = render(<HomePanel isActive />);
 await waitFor(() => expect(console.error).toHaveBeenCalled());
 expect(readHomeContentCache(key(), 0)).toBeNull();
 expect(screen.getAllByText('Available despite row failure').length).toBeGreaterThan(0);
 view.unmount();
 render(<HomePanel isActive />);
 await waitFor(() => expect(readHomeContentCache(key(), 0)?.stale).toBe(false));
 expect(jellyfinService.getResumeItems).toHaveBeenCalledTimes(2);
 expect(jellyfinService.getResumeItems).toHaveBeenCalledWith(10, 0, {throwOnError: true});
});

it('retains successful content after a failed refresh and retries on return', async () => {
 const old = {recentlyAdded: [{Id: 'kept', Type: 'Movie'}]};
 writeHomeContentCache(key(), 0, old);
 const view = render(<HomePanel isActive />);
 jellyfinService.getResumeItems.mockRejectedValueOnce(new Error('offline'));
 act(() => window.dispatchEvent(new CustomEvent(BREEZYFIN_USER_DATA_INVALIDATED_EVENT)));
 await waitFor(() => expect(console.error).toHaveBeenCalled());
 expect(readHomeContentCache(key(), 0)).toMatchObject({stale: true, content: old});
 view.unmount();
 render(<HomePanel isActive />);
 await waitFor(() => expect(readHomeContentCache(key(), 0)?.stale).toBe(false));
 expect(jellyfinService.getResumeItems).toHaveBeenCalledTimes(2);
});

it('refreshes expired cached content after Back instead of resetting its freshness clock', async () => {
 writeHomeContentCache(key(), 0, {}, {loadedAt: Date.now() - 120001});
 render(<HomePanel isActive />);
 await waitFor(() => expect(jellyfinService.getResumeItems).toHaveBeenCalledTimes(1));
});
