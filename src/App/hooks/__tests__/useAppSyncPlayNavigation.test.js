import {act, renderHook} from '@testing-library/react';
import {useAppSyncPlayCoordinator} from '../useAppSyncPlayCoordinator';
import {useAppSyncPlayNavigation} from '../useAppSyncPlayNavigation';

jest.mock('../useAppSyncPlayCoordinator', () => ({useAppSyncPlayCoordinator: jest.fn()}));

const createOptions = () => ({
	authenticated: true, currentView: 'details', selectedItem: null,
	pushPanelHistory: jest.fn(), navigateBackInHistory: jest.fn(),
	syncPlayerBackTargetDetailsItem: jest.fn(), fallbackToDetailsFromPlayer: jest.fn(),
	setSelectedItem: jest.fn(), setPlaybackOptions: jest.fn(), setPlayerControlsVisible: jest.fn(), setCurrentView: jest.fn()
});

describe('playback navigation admission', () => {
	it('uses the ordinary local player path without forcing audio or subtitle selections', async () => {
		useAppSyncPlayCoordinator.mockReturnValue({requestPlay: jest.fn().mockResolvedValue(false)});
		const options = createOptions();
		const item = {Id: 'item', UserData: {PlaybackPositionTicks: 120000000}};
		const view = renderHook(() => useAppSyncPlayNavigation(options));
		await act(async () => view.result.current.handlePlay(item, null, {isCurrent: () => true}));
		expect(options.pushPanelHistory).toHaveBeenCalledTimes(1);
		expect(options.setSelectedItem).toHaveBeenCalledWith(item);
		expect(options.setPlaybackOptions).toHaveBeenCalledWith(null);
		expect(options.setCurrentView).toHaveBeenCalledWith('player');
	});
	it('does not commit a cancelled local launch after awaiting the playback coordinator', async () => {
		let resolve;
		useAppSyncPlayCoordinator.mockReturnValue({requestPlay: () => new Promise((r) => { resolve = r; })});
		const options = createOptions(); const view = renderHook(() => useAppSyncPlayNavigation(options));
		let current = true, pending;
		act(() => { pending = view.result.current.handlePlay({Id: 'item'}, null, {isCurrent: () => current}); });
		current = false;
		await act(async () => { resolve(false); await pending; });
		expect(options.setCurrentView).not.toHaveBeenCalled();
	});
	it('leaves SyncPlay-owned requests with the existing group coordinator', async () => {
		const requestPlay = jest.fn().mockResolvedValue(true);
		useAppSyncPlayCoordinator.mockReturnValue({requestPlay});
		const options = createOptions(); const view = renderHook(() => useAppSyncPlayNavigation(options));
		await act(async () => view.result.current.handlePlay({Id: 'item'}));
		expect(requestPlay).toHaveBeenCalledWith({Id: 'item'}, null);
		expect(options.setCurrentView).not.toHaveBeenCalled();
	});
});
