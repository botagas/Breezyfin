import {
	applySyncPlayGroupUpdate,
	createSyncPlayGroup,
	getSyncPlayDriftCorrection,
	getSyncPlayState,
	joinSyncPlayGroup,
	reconcileSyncPlayGroup,
	sampleSyncPlayClock,
	ServerClockOffsetEstimator,
	syncPlayBuffering,
	syncPlayNext,
	syncPlayQueue,
	syncPlaySetIgnoreWait,
	syncPlaySetQueue,
	syncPlaySeek
} from '../jellyfin/syncPlayApi';
import {getSyncPlayApi} from '@jellyfin/sdk/lib/utils/api/sync-play-api';
import {getTimeSyncApi} from '@jellyfin/sdk/lib/utils/api/time-sync-api';

describe('syncPlay timing', () => {
	it('uses the median clock offset sample', () => {
		const estimator = new ServerClockOffsetEstimator(5);
		estimator.record({sentAtMs: 0, receivedAtMs: 100, serverTime: new Date(150).toISOString()});
		estimator.record({sentAtMs: 1000, receivedAtMs: 1100, serverTime: new Date(1150).toISOString()});
		estimator.record({sentAtMs: 2000, receivedAtMs: 2100, serverTime: new Date(10000).toISOString()});
		expect(estimator.offsetMs).toBe(100);
	});

	it('uses Jellyfin four-timestamp samples and reports half the network delay', () => {
		const estimator = new ServerClockOffsetEstimator(5);
		const result = estimator.recordTimeSync({
			requestSentAtMs: 0,
			requestReceivedServerTime: new Date(150).toISOString(),
			responseSentServerTime: new Date(160).toISOString(),
			responseReceivedAtMs: 110
		});
		expect(result).toEqual({offsetMs: 100, pingMs: 50});
	});

	it.each([
		[250, {action: 'none', playbackRate: 1}],
		[251, {action: 'rate', playbackRate: 1.03}],
		[-251, {action: 'rate', playbackRate: 0.97}],
		[2000, {action: 'seek', playbackRate: 1}]
	])('applies the drift contract for %i ms', (drift, expected) => {
		expect(getSyncPlayDriftCorrection(drift)).toEqual(expected);
	});

	it('tracks group and participant lifecycle updates', () => {
		const service = {};
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'GroupJoined', GroupId: 'group-1', Data: {GroupId: 'group-1', Participants: ['a']}}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'UserJoined', GroupId: 'group-1', Data: 'b'}
		});
		expect(getSyncPlayState(service).Participants).toEqual(['a', 'b']);
		applySyncPlayGroupUpdate(service, {Data: {Type: 'GroupLeft', GroupId: 'group-1'}});
		expect(getSyncPlayState(service)).toBeNull();
	});

	it('tracks deterministic play queue updates', () => {
		const service = {};
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'GroupJoined', Data: {GroupId: 'group-1', Participants: []}}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'PlayQueue', Data: {PlayingItemIndex: 1, Playlist: [{ItemId: 'item-1'}]}}
		});
		expect(getSyncPlayState(service).PlayQueue.PlayingItemIndex).toBe(1);
	});

	it('applies full group updates without discarding the latest play queue', () => {
		const service = {};
		const playQueue = {
			LastUpdate: '2026-01-01T00:00:02Z',
			PlayingItemIndex: 0,
			Playlist: [{ItemId: 'item-1', PlaylistItemId: 'playlist-1'}]
		};
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'GroupJoined',
				Data: {GroupId: 'group-1', GroupName: 'Before', Participants: ['a'], PlayQueue: playQueue}
			}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'GroupUpdate',
				Data: {GroupId: 'group-1', GroupName: 'After', Participants: ['a', 'b']}
			}
		});

		expect(getSyncPlayState(service)).toEqual(expect.objectContaining({
			GroupName: 'After',
			Participants: ['a', 'b'],
			PlayQueue: playQueue
		}));
	});

	it('rejects duplicate and stale play queue revisions', () => {
		const service = {};
		const firstQueue = {
			LastUpdate: '2026-01-01T00:00:02Z',
			PlayingItemIndex: 0,
			Playlist: [{ItemId: 'item-1', PlaylistItemId: 'playlist-1'}]
		};
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'GroupJoined', Data: {GroupId: 'group-1', Participants: []}}
		});
		applySyncPlayGroupUpdate(service, {Data: {Type: 'PlayQueue', Data: firstQueue}});
		applySyncPlayGroupUpdate(service, {Data: {Type: 'PlayQueue', Data: firstQueue}});
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'PlayQueue',
				Data: {...firstQueue, LastUpdate: '2026-01-01T00:00:01Z', PlayingItemIndex: 1}
			}
		});
		expect(getSyncPlayState(service).PlayQueue).toEqual(firstQueue);
	});

	it('does not let a stale queue replace a newer full group update', () => {
		const service = {};
		const newerQueue = {
			LastUpdate: '2026-01-01T00:00:03Z',
			PlayingItemIndex: 0,
			Playlist: [{ItemId: 'item-2', PlaylistItemId: 'playlist-2'}]
		};
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'GroupJoined', Data: {GroupId: 'group-1', Participants: []}}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'GroupUpdate',
				Data: {GroupId: 'group-1', GroupName: 'Updated', PlayQueue: newerQueue}
			}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'PlayQueue',
				Data: {
					...newerQueue,
					LastUpdate: '2026-01-01T00:00:02Z',
					Playlist: [{ItemId: 'item-1', PlaylistItemId: 'playlist-1'}]
				}
			}
		});

		expect(getSyncPlayState(service)).toEqual(expect.objectContaining({
			GroupName: 'Updated',
			PlayQueue: newerQueue
		}));
	});

	it('does not let a delayed reconnect response replace a newer play queue', () => {
		const service = {};
		const reconnectQueue = {
			LastUpdate: '2026-01-01T00:00:02Z',
			PlayingItemIndex: 0,
			Playlist: [{ItemId: 'old-item', PlaylistItemId: 'old-playlist'}]
		};
		const liveQueue = {
			LastUpdate: '2026-01-01T00:00:03Z',
			PlayingItemIndex: 0,
			Playlist: [{ItemId: 'new-item', PlaylistItemId: 'new-playlist'}]
		};
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'GroupJoined',
				Data: {GroupId: 'group-1', GroupName: 'Before', PlayQueue: reconnectQueue}
			}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'PlayQueue', Data: liveQueue}
		});

		reconcileSyncPlayGroup(service, {
			GroupId: 'group-1',
			GroupName: 'After reconnect',
			PlayQueue: reconnectQueue
		});

		expect(getSyncPlayState(service)).toEqual(expect.objectContaining({
			GroupName: 'After reconnect',
			PlayQueue: liveQueue
		}));
	});

	it('rejects an undated queue after a timestamped revision is authoritative', () => {
		const service = {};
		const currentQueue = {
			LastUpdate: '2026-01-01T00:00:03Z',
			PlayingItemIndex: 0,
			Playlist: [{ItemId: 'item-2', PlaylistItemId: 'playlist-2'}]
		};
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'GroupJoined',
				Data: {GroupId: 'group-1', Participants: [], PlayQueue: currentQueue}
			}
		});
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'PlayQueue',
				Data: {
					PlayingItemIndex: 0,
					Playlist: [{ItemId: 'item-1', PlaylistItemId: 'playlist-1'}]
				}
			}
		});

		expect(getSyncPlayState(service).PlayQueue).toEqual(currentQueue);
	});

	it('accepts changed queue playback state with the same server timestamp', () => {
		const service = {};
		const firstQueue = {
			LastUpdate: '2026-01-01T00:00:02Z',
			PlayingItemIndex: 0,
			StartPositionTicks: 100,
			IsPlaying: false,
			Playlist: [{ItemId: 'item-1', PlaylistItemId: 'playlist-1'}]
		};
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'GroupJoined', Data: {GroupId: 'group-1', Participants: []}}
		});
		applySyncPlayGroupUpdate(service, {Data: {Type: 'PlayQueue', Data: firstQueue}});
		applySyncPlayGroupUpdate(service, {
			Data: {
				Type: 'PlayQueue',
				Data: {...firstQueue, StartPositionTicks: 500, IsPlaying: true}
			}
		});

		expect(getSyncPlayState(service).PlayQueue).toEqual({
			...firstQueue,
			StartPositionTicks: 500,
			IsPlaying: true
		});
	});

	it('clears retained group state when the authenticated session changes', () => {
		const service = {serverUrl: 'https://server.test', userId: 'user-1', accessToken: 'token-1'};
		applySyncPlayGroupUpdate(service, {
			Data: {Type: 'GroupJoined', Data: {GroupId: 'group-1', Participants: []}}
		});
		expect(getSyncPlayState(service)?.GroupId).toBe('group-1');

		service.userId = 'user-2';
		service.accessToken = 'token-2';
		expect(getSyncPlayState(service)).toBeNull();
	});

	it('wraps DTOs in the generated SDK request parameter names', async () => {
		const sdk = {
			syncPlayCreateGroup: jest.fn().mockResolvedValue({data: {GroupId: 'group-1'}}),
			syncPlayJoinGroup: jest.fn().mockResolvedValue({data: undefined}),
			syncPlayQueue: jest.fn().mockResolvedValue({data: undefined}),
			syncPlaySetNewQueue: jest.fn().mockResolvedValue({data: undefined}),
			syncPlayNextItem: jest.fn().mockResolvedValue({data: undefined}),
			syncPlaySeek: jest.fn().mockResolvedValue({data: undefined}),
			syncPlayBuffering: jest.fn().mockResolvedValue({data: undefined}),
			syncPlaySetIgnoreWait: jest.fn().mockResolvedValue({data: undefined})
		};
		getSyncPlayApi.mockReturnValue(sdk);
		const service = {api: {}};
		await createSyncPlayGroup(service, ' Group ');
		await joinSyncPlayGroup(service, 'group-1');
		await syncPlayQueue(service, {ItemIds: ['item-1']});
		await syncPlaySetQueue(service, {PlayingQueue: ['item-1']});
		await syncPlayNext(service, {PlaylistItemId: 'playlist-1'});
		await syncPlaySeek(service, {PositionTicks: 100});
		await syncPlayBuffering(service, {PositionTicks: 100});
		await syncPlaySetIgnoreWait(service, true);
		expect(sdk.syncPlayCreateGroup).toHaveBeenCalledWith({
			newGroupRequestDto: {GroupName: 'Group'}
		});
		expect(sdk.syncPlayJoinGroup).toHaveBeenCalledWith({
			joinGroupRequestDto: {GroupId: 'group-1'}
		});
		expect(sdk.syncPlayQueue).toHaveBeenCalledWith({queueRequestDto: {ItemIds: ['item-1']}});
		expect(sdk.syncPlaySetNewQueue).toHaveBeenCalledWith({
			playRequestDto: {PlayingQueue: ['item-1']}
		});
		expect(sdk.syncPlayNextItem).toHaveBeenCalledWith({
			nextItemRequestDto: {PlaylistItemId: 'playlist-1'}
		});
		expect(sdk.syncPlaySeek).toHaveBeenCalledWith({seekRequestDto: {PositionTicks: 100}});
		expect(sdk.syncPlayBuffering).toHaveBeenCalledWith({bufferRequestDto: {PositionTicks: 100}});
		expect(sdk.syncPlaySetIgnoreWait).toHaveBeenCalledWith({
			ignoreWaitRequestDto: {IgnoreWait: true}
		});
	});

	it('captures authenticated Jellyfin time-sync timestamps', async () => {
		getTimeSyncApi.mockReturnValue({
			getUtcTime: jest.fn().mockResolvedValue({
				data: {
					RequestReceptionTime: '2026-01-01T00:00:00.050Z',
					ResponseTransmissionTime: '2026-01-01T00:00:00.060Z'
				}
			})
		});
		const now = jest.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1120);
		await expect(sampleSyncPlayClock({api: {}}, now)).resolves.toEqual({
			requestSentAtMs: 1000,
			requestReceivedServerTime: '2026-01-01T00:00:00.050Z',
			responseSentServerTime: '2026-01-01T00:00:00.060Z',
			responseReceivedAtMs: 1120
		});
	});
});
