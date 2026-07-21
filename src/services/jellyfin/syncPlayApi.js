import {getSyncPlayApi} from '@jellyfin/sdk/lib/utils/api/sync-play-api';
import {getTimeSyncApi} from '@jellyfin/sdk/lib/utils/api/time-sync-api';

export {getSyncPlayDriftCorrection, ServerClockOffsetEstimator} from '../../utils/syncTiming';

const stateByService = new WeakMap();

const getSessionKey = (service) => JSON.stringify([
	String(service?.serverUrl || ''),
	String(service?.userId || ''),
	String(service?.accessToken || '')
]);

const getStateEntry = (service) => {
	const key = getSessionKey(service);
	let entry = stateByService.get(service);
	if (entry?.key === key) return entry;
	if (entry?.unsubscribe) {
		entry.unsubscribe();
		entry.unsubscribe = null;
	}
	entry = {key, group: null, listeners: new Set(), unsubscribe: null};
	stateByService.set(service, entry);
	return entry;
};

const notifyState = (entry) => {
	entry.listeners.forEach((listener) => listener(entry.group));
};

export const applySyncPlayGroupUpdate = (service, message) => {
	const update = message?.Data;
	if (!update || typeof update.Type !== 'string') return;
	const entry = getStateEntry(service);
	switch (update.Type) {
		case 'GroupJoined':
			entry.group = update.Data && typeof update.Data === 'object'
				? update.Data
				: {GroupId: update.GroupId, Participants: []};
			break;
		case 'GroupLeft':
		case 'GroupDoesNotExist':
		case 'NotInGroup':
			entry.group = null;
			break;
		case 'UserJoined':
			if (entry.group && typeof update.Data === 'string') {
				entry.group = {
					...entry.group,
					Participants: [...new Set([...(entry.group.Participants || []), update.Data])]
				};
			}
			break;
		case 'UserLeft':
			if (entry.group && typeof update.Data === 'string') {
				entry.group = {
					...entry.group,
					Participants: (entry.group.Participants || []).filter((id) => id !== update.Data)
				};
			}
			break;
		case 'StateUpdate':
			if (entry.group) {
				entry.group = {
					...entry.group,
					State: update.Data?.State || entry.group.State,
					StateReason: update.Data?.Reason || entry.group.StateReason
				};
			}
			break;
		case 'PlayQueue':
			if (entry.group) entry.group = {...entry.group, PlayQueue: update.Data || null};
			break;
		default:
			return;
	}
	notifyState(entry);
};

export const setSyncPlayGroup = (service, group) => {
	const entry = getStateEntry(service);
	entry.group = group || null;
	notifyState(entry);
};

export const getSyncPlayState = (service) => getStateEntry(service).group;

export const subscribeSyncPlayState = (service, listener) => {
	const entry = getStateEntry(service);
	entry.listeners.add(listener);
	if (!entry.unsubscribe) {
		entry.unsubscribe = service.onWebSocketMessage('SyncPlayGroupUpdate', (message) => (
			applySyncPlayGroupUpdate(service, message)
		));
	}
	listener(entry.group);
	return () => {
		entry.listeners.delete(listener);
		if (entry.listeners.size === 0 && entry.unsubscribe) {
			entry.unsubscribe();
			entry.unsubscribe = null;
		}
	};
};

const getApi = (service) => {
	if (!service?.api) throw new Error('An authenticated Jellyfin session is required');
	return getSyncPlayApi(service.api);
};

const invoke = async (service, method, ...args) => {
	const api = getApi(service);
	return (await api[method](...args))?.data;
};

export const listSyncPlayGroups = (service) => invoke(service, 'syncPlayGetGroups');
export const getSyncPlayGroup = (service, groupId) => invoke(service, 'syncPlayGetGroup', {id: groupId});
export const createSyncPlayGroup = (service, groupName) => invoke(
	service,
	'syncPlayCreateGroup',
	{newGroupRequestDto: {GroupName: String(groupName || '').trim()}}
);
export const joinSyncPlayGroup = (service, groupId) => invoke(
	service,
	'syncPlayJoinGroup',
	{joinGroupRequestDto: {GroupId: groupId}}
);
export const leaveSyncPlayGroup = (service) => invoke(service, 'syncPlayLeaveGroup');
export const syncPlayQueue = (service, request) => invoke(
	service, 'syncPlayQueue', {queueRequestDto: request}
);
export const syncPlaySetQueue = (service, request) => invoke(
	service, 'syncPlaySetNewQueue', {playRequestDto: request}
);
export const syncPlayMoveQueueItem = (service, request) => invoke(
	service, 'syncPlayMovePlaylistItem', {movePlaylistItemRequestDto: request}
);
export const syncPlayRemoveQueueItems = (service, request) => invoke(
	service, 'syncPlayRemoveFromPlaylist', {removeFromPlaylistRequestDto: request}
);
export const syncPlaySetQueueItem = (service, request) => invoke(
	service, 'syncPlaySetPlaylistItem', {setPlaylistItemRequestDto: request}
);
export const syncPlayNext = (service, request) => invoke(
	service, 'syncPlayNextItem', {nextItemRequestDto: request}
);
export const syncPlayPrevious = (service, request) => invoke(
	service, 'syncPlayPreviousItem', {previousItemRequestDto: request}
);
export const syncPlayPlay = (service) => invoke(service, 'syncPlayUnpause');
export const syncPlayPause = (service) => invoke(service, 'syncPlayPause');
export const syncPlayStop = (service) => invoke(service, 'syncPlayStop');
export const syncPlaySeek = (service, request) => invoke(
	service, 'syncPlaySeek', {seekRequestDto: request}
);
export const syncPlayBuffering = (service, request) => invoke(
	service, 'syncPlayBuffering', {bufferRequestDto: request}
);
export const syncPlayReady = (service, request) => invoke(
	service, 'syncPlayReady', {readyRequestDto: request}
);
export const syncPlaySetRepeatMode = (service, request) => invoke(
	service, 'syncPlaySetRepeatMode', {setRepeatModeRequestDto: request}
);
export const syncPlaySetShuffleMode = (service, request) => invoke(
	service, 'syncPlaySetShuffleMode', {setShuffleModeRequestDto: request}
);
export const syncPlayPing = (service, request) => invoke(
	service, 'syncPlayPing', {pingRequestDto: request}
);

export const sampleSyncPlayClock = async (service, now = Date.now) => {
	if (!service?.api) throw new Error('An authenticated Jellyfin session is required');
	const requestSentAtMs = now();
	const response = await getTimeSyncApi(service.api).getUtcTime();
	const responseReceivedAtMs = now();
	return {
		requestSentAtMs,
		requestReceivedServerTime: response?.data?.RequestReceptionTime,
		responseSentServerTime: response?.data?.ResponseTransmissionTime,
		responseReceivedAtMs
	};
};
