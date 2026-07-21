import {
	applySyncPlayGroupUpdate,
	createSyncPlayGroup,
	getSyncPlayDriftCorrection,
	getSyncPlayState,
	joinSyncPlayGroup,
	sampleSyncPlayClock,
	ServerClockOffsetEstimator,
	syncPlayBuffering,
	syncPlayQueue,
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
			syncPlaySeek: jest.fn().mockResolvedValue({data: undefined}),
			syncPlayBuffering: jest.fn().mockResolvedValue({data: undefined})
		};
		getSyncPlayApi.mockReturnValue(sdk);
		const service = {api: {}};
		await createSyncPlayGroup(service, ' Group ');
		await joinSyncPlayGroup(service, 'group-1');
		await syncPlayQueue(service, {ItemIds: ['item-1']});
		await syncPlaySeek(service, {PositionTicks: 100});
		await syncPlayBuffering(service, {PositionTicks: 100});
		expect(sdk.syncPlayCreateGroup).toHaveBeenCalledWith({
			newGroupRequestDto: {GroupName: 'Group'}
		});
		expect(sdk.syncPlayJoinGroup).toHaveBeenCalledWith({
			joinGroupRequestDto: {GroupId: 'group-1'}
		});
		expect(sdk.syncPlayQueue).toHaveBeenCalledWith({queueRequestDto: {ItemIds: ['item-1']}});
		expect(sdk.syncPlaySeek).toHaveBeenCalledWith({seekRequestDto: {PositionTicks: 100}});
		expect(sdk.syncPlayBuffering).toHaveBeenCalledWith({bufferRequestDto: {PositionTicks: 100}});
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
