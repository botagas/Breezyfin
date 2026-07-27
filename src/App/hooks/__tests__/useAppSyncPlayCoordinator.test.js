import {act, renderHook} from '@testing-library/react';
import jellyfinService from '../../../services/jellyfinService';
import {useAppSyncPlayCoordinator} from '../useAppSyncPlayCoordinator';

jest.mock('../../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		getSyncPlayState: jest.fn(),
		subscribeSyncPlayState: jest.fn(),
		onWebSocketMessage: jest.fn(),
		getSyncPlayGroup: jest.fn(),
		setSyncPlayGroup: jest.fn(),
		joinSyncPlayGroup: jest.fn(),
		createSyncPlayGroup: jest.fn(),
		leaveSyncPlayGroup: jest.fn(),
		syncPlaySetIgnoreWait: jest.fn(),
		syncPlaySetQueue: jest.fn(),
		syncPlayPlay: jest.fn(),
		syncPlayNext: jest.fn(),
		syncPlayPrevious: jest.fn(),
		getItem: jest.fn()
	}
}));

const buildGroup = (itemId = '') => ({
	GroupId: 'group-1',
	PlayQueue: {
		LastUpdate: new Date().toISOString(),
		PlayingItemIndex: itemId ? 0 : -1,
		Playlist: itemId ? [{ItemId: itemId, PlaylistItemId: `playlist-${itemId}`}] : []
	}
});

describe('useAppSyncPlayCoordinator', () => {
	let currentGroup;
	let stateListener;
	let websocketListeners;

	beforeEach(() => {
		jest.clearAllMocks();
		currentGroup = buildGroup();
		stateListener = null;
		websocketListeners = {};
		jellyfinService.getSyncPlayState.mockImplementation(() => currentGroup);
		jellyfinService.subscribeSyncPlayState.mockImplementation((listener) => {
			stateListener = listener;
			return jest.fn();
		});
		jellyfinService.onWebSocketMessage.mockImplementation((type, listener) => {
			websocketListeners[type] = listener;
			return jest.fn();
		});
		jellyfinService.getItem.mockResolvedValue(null);
		jellyfinService.syncPlaySetIgnoreWait.mockResolvedValue(undefined);
		jellyfinService.syncPlayPlay.mockResolvedValue(undefined);
		jellyfinService.setSyncPlayGroup.mockImplementation((nextGroup) => {
			currentGroup = nextGroup;
			stateListener?.(nextGroup);
		});
	});

	it('accepts a queue update that arrives before the queue waiter is registered', async () => {
		jellyfinService.syncPlaySetQueue.mockImplementation(async () => {
			currentGroup = buildGroup('item-2');
			stateListener(currentGroup);
		});
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await expect(result.current.requestPlay({Id: 'item-2'})).resolves.toBe(true);
		});
		expect(jellyfinService.syncPlaySetQueue).toHaveBeenCalledWith(expect.objectContaining({
			PlayingQueue: ['item-2']
		}));
		expect(jellyfinService.syncPlayPlay).not.toHaveBeenCalled();
	});

	it('forces a waiting group to start only through the explicit override', async () => {
		currentGroup = {
			...buildGroup('item-1'),
			State: 'Waiting'
		};
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'syncPlay',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await expect(result.current.startGroupPlayback()).resolves.toBe(true);
		});

		expect(jellyfinService.syncPlaySetIgnoreWait).toHaveBeenCalledWith(false);
		expect(jellyfinService.syncPlayPlay).toHaveBeenCalledTimes(1);
		expect(result.current.followMode).toBe('following');
	});

	it('surfaces cancelled queue waits when the coordinator unmounts', async () => {
		jellyfinService.syncPlaySetQueue.mockResolvedValue(undefined);
		const {result, unmount} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));
		let playRequest;
		act(() => {
			playRequest = result.current.requestPlay({Id: 'item-3'});
		});
		unmount();

		await expect(playRequest).resolves.toBe(true);
	});

	it('does not remain in follow mode after a failed explicit join', async () => {
		jellyfinService.joinSyncPlayGroup.mockRejectedValue(new Error('join failed'));
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'syncPlay',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await expect(result.current.joinGroup('group-2')).rejects.toThrow('join failed');
		});
		expect(result.current.followMode).toBe('suspended');
	});

	it('retains joined state when Leave fails', async () => {
		currentGroup = buildGroup('item-1');
		jellyfinService.leaveSyncPlayGroup.mockRejectedValue(new Error('leave failed'));
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'syncPlay',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await expect(result.current.leaveGroup()).rejects.toThrow('leave failed');
		});

		expect(result.current.group?.GroupId).toBe('group-1');
		expect(jellyfinService.setSyncPlayGroup).not.toHaveBeenCalled();
	});

	it('clears joined state after Leave succeeds', async () => {
		currentGroup = buildGroup('item-1');
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'syncPlay',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await result.current.leaveGroup();
		});

		expect(jellyfinService.setSyncPlayGroup).toHaveBeenCalledWith(null);
		expect(result.current.group).toBeNull();
	});

	it('ignores a reconnect lookup that finishes after Leave', async () => {
		currentGroup = buildGroup('item-1');
		let resolveFreshGroup;
		jellyfinService.getSyncPlayGroup.mockReturnValue(new Promise((resolve) => {
			resolveFreshGroup = resolve;
		}));
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'syncPlay',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		act(() => {
			websocketListeners.ConnectionStateChanged({state: 'open'});
		});
		await act(async () => {
			await result.current.leaveGroup();
			resolveFreshGroup(buildGroup('item-1'));
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(result.current.group).toBeNull();
		expect(jellyfinService.setSyncPlayGroup).not.toHaveBeenCalledWith(
			expect.objectContaining({GroupId: 'group-1'})
		);
	});

	it('updates Jellyfin wait participation when following and suspending', async () => {
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'syncPlay',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await result.current.resumeSession();
		});
		expect(jellyfinService.syncPlaySetIgnoreWait).toHaveBeenLastCalledWith(false);
		expect(result.current.followMode).toBe('following');

		await act(async () => {
			await result.current.suspend();
		});
		expect(jellyfinService.syncPlaySetIgnoreWait).toHaveBeenLastCalledWith(true);
		expect(result.current.followMode).toBe('suspended');
	});

	it('marks restored group membership as suspended for Jellyfin group waiting', async () => {
		currentGroup = buildGroup('item-1');
		renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			stateListener(currentGroup);
			await Promise.resolve();
		});

		expect(jellyfinService.syncPlaySetIgnoreWait).toHaveBeenCalledWith(true);
	});

	it('surfaces remote playback commands while browsing in suspended mode', () => {
		currentGroup = buildGroup('item-1');
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		act(() => {
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: '2026-01-01T00:00:00Z',
					PositionTicks: 100,
					PlaylistItemId: 'playlist-item-1'
				}
			});
		});

		expect(result.current.notification).toEqual(expect.objectContaining({
			type: 'remote-playback',
			message: expect.stringContaining('resumed')
		}));
	});

	it('uses the latest queue when a command follows a group update immediately', () => {
		currentGroup = buildGroup('item-1');
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));
		const nextGroup = buildGroup('item-2');

		act(() => {
			stateListener(nextGroup);
			websocketListeners.SyncPlayCommand({
				Data: {
					Command: 'Unpause',
					When: '2026-01-01T00:00:00Z',
					PositionTicks: 100,
					PlaylistItemId: 'playlist-item-2'
				}
			});
		});

		expect(result.current.notification).toEqual(expect.objectContaining({
			type: 'remote-playback',
			playbackRevision: expect.stringContaining('item-2')
		}));
	});

	it('warns when an authoritative queue item is inaccessible', async () => {
		currentGroup = buildGroup('missing-item');
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await result.current.resumeSession();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(result.current.notification).toEqual(expect.objectContaining({
			type: 'warning',
			message: expect.stringContaining('unavailable')
		}));
	});

	it('surfaces direct queue replacement failures through the notification', async () => {
		jellyfinService.syncPlaySetQueue.mockRejectedValue(new Error('replace failed'));
		const {result} = renderHook(() => useAppSyncPlayCoordinator({
			authenticated: true,
			currentView: 'home',
			selectedItemId: null,
			onOpenRemoteItem: jest.fn()
		}));

		await act(async () => {
			await expect(result.current.requestPlay({Id: 'item-2'})).resolves.toBe(true);
		});

		expect(result.current.notification).toEqual(expect.objectContaining({
			type: 'warning',
			message: 'replace failed'
		}));
	});

	it('can resume navigation after Player Back suspended the same queue revision', async () => {
		currentGroup = buildGroup('item-1');
		const item = {Id: 'item-1', Type: 'Movie'};
		const onOpenRemoteItem = jest.fn();
		jellyfinService.getItem.mockResolvedValue(item);
		const {result, rerender} = renderHook(
			({currentView, selectedItemId}) => useAppSyncPlayCoordinator({
				authenticated: true,
				currentView,
				selectedItemId,
				onOpenRemoteItem
			}),
			{initialProps: {currentView: 'home', selectedItemId: null}}
		);

		await act(async () => {
			await result.current.resumeSession();
			await Promise.resolve();
		});
		expect(onOpenRemoteItem).toHaveBeenCalledTimes(1);

		rerender({currentView: 'player', selectedItemId: 'item-1'});
		await act(async () => {
			await result.current.suspend();
		});
		rerender({currentView: 'home', selectedItemId: null});
		await act(async () => {
			await result.current.resumeSession();
			await Promise.resolve();
		});

		expect(onOpenRemoteItem).toHaveBeenCalledTimes(2);
	});
});
