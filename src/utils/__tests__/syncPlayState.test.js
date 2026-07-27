import {
	getSyncPlayCommandRevision,
	getSyncPlayCommandTargetSeconds,
	getSyncPlayQueueSnapshot,
	isNewerSyncPlayRevision,
	isSyncPlayVideoReady,
	resolveSyncPlayPlayRequest
} from '../syncPlayState';

describe('SyncPlay queue normalization', () => {
	it('separates the active queue item and synchronized start state', () => {
		const snapshot = getSyncPlayQueueSnapshot({
			GroupId: 'group-1',
			PlayQueue: {
				LastUpdate: '2026-01-01T00:00:00Z',
				PlayingItemIndex: 1,
				StartPositionTicks: 123,
				IsPlaying: true,
				Playlist: [
					{ItemId: 'item-1', PlaylistItemId: 'playlist-1'},
					{ItemId: 'item-2', PlaylistItemId: 'playlist-2'}
				]
			}
		});
		expect(snapshot).toMatchObject({
			activeItemId: 'item-2',
			activePlaylistItemId: 'playlist-2',
			playingItemIndex: 1,
			startPositionTicks: 123,
			isPlaying: true
		});
	});

	it('tracks playback changes separately from queue identity', () => {
		const group = {
			GroupId: 'group-1',
			State: 'Playing',
			PlayQueue: {
				LastUpdate: '2026-01-01T00:00:00Z',
				PlayingItemIndex: 0,
				StartPositionTicks: 100,
				IsPlaying: true,
				Playlist: [{ItemId: 'item-1', PlaylistItemId: 'playlist-1'}]
			}
		};
		const playing = getSyncPlayQueueSnapshot(group);
		const paused = getSyncPlayQueueSnapshot({
			...group,
			State: 'Paused',
			PlayQueue: {...group.PlayQueue, IsPlaying: false}
		});

		expect(paused.revision).toBe(playing.revision);
		expect(paused.playbackRevision).not.toBe(playing.playbackRevision);
	});

	it('builds deterministic command revisions and elapsed playback targets', () => {
		const command = {
			Command: 'Unpause',
			When: '2026-01-01T00:00:01.000Z',
			PositionTicks: 50000000,
			PlaylistItemId: 'playlist-1'
		};
		expect(getSyncPlayCommandRevision('group-1', command)).toBe(
			'group-1|Unpause|2026-01-01T00:00:01.000Z|50000000|playlist-1'
		);
		expect(getSyncPlayCommandTargetSeconds({
			positionTicks: command.PositionTicks,
			when: command.When,
			serverNowMs: Date.parse('2026-01-01T00:00:03.500Z')
		})).toBe(7.5);
	});

	it('requires a playable source before reporting local SyncPlay readiness', () => {
		expect(isSyncPlayVideoReady({readyState: 3, currentSrc: 'video.m3u8'})).toBe(true);
		expect(isSyncPlayVideoReady({readyState: 2, currentSrc: 'video.m3u8'})).toBe(false);
		expect(isSyncPlayVideoReady({readyState: 4, currentSrc: '', src: ''})).toBe(false);
	});

	it('rejects duplicate and older normalized revisions', () => {
		const current = {revision: 'two', lastUpdate: '2026-01-01T00:00:02Z'};
		expect(isNewerSyncPlayRevision(current, current)).toBe(false);
		expect(isNewerSyncPlayRevision(current, {
			revision: 'one', lastUpdate: '2026-01-01T00:00:01Z'
		})).toBe(false);
		expect(isNewerSyncPlayRevision(current, {
			revision: 'three', lastUpdate: '2026-01-01T00:00:03Z'
		})).toBe(true);
	});

	it.each([
		[{groupId: '', activeItemId: '', selectedItemId: 'item-1'}, 'local'],
		[{groupId: 'group-1', activeItemId: '', selectedItemId: 'item-1'}, 'replace'],
		[{groupId: 'group-1', activeItemId: 'item-1', selectedItemId: 'item-1'}, 'resume'],
		[{groupId: 'group-1', activeItemId: 'item-2', selectedItemId: 'item-1'}, 'confirm-replace']
	])('resolves group play intent without silently starting local playback', (input, expected) => {
		expect(resolveSyncPlayPlayRequest(input)).toBe(expected);
	});
});
