export const getSyncPlayQueueSnapshot = (group) => {
	const queue = group?.PlayQueue;
	const playlist = Array.isArray(queue?.Playlist)
		? queue.Playlist.filter((item) => item && typeof item.ItemId === 'string')
		: [];
	const requestedIndex = Number(queue?.PlayingItemIndex);
	const playingItemIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < playlist.length
		? requestedIndex
		: (playlist.length > 0 ? 0 : -1);
	const activeEntry = playingItemIndex >= 0 ? playlist[playingItemIndex] : null;
	const revision = [
		group?.GroupId || '',
		queue?.LastUpdate || '',
		activeEntry?.PlaylistItemId || '',
		activeEntry?.ItemId || '',
		playingItemIndex,
		playlist.map((item) => `${item.PlaylistItemId || ''}:${item.ItemId}`).join(',')
	].join('|');
	const playbackRevision = [
		revision,
		Number(queue?.StartPositionTicks) || 0,
		queue?.IsPlaying === true ? 'playing' : 'paused',
		group?.State || '',
		group?.StateReason || ''
	].join('|');
	return {
		playlist,
		playingItemIndex,
		lastUpdate: queue?.LastUpdate || '',
		activeItemId: activeEntry?.ItemId || '',
		activePlaylistItemId: activeEntry?.PlaylistItemId || '',
		startPositionTicks: Number(queue?.StartPositionTicks) || 0,
		isPlaying: queue?.IsPlaying === true,
		revision,
		playbackRevision
	};
};

export const getSyncPlayCommandRevision = (groupId, command = {}) => [
	String(groupId || ''),
	String(command?.Command || ''),
	String(command?.When || ''),
	Number(command?.PositionTicks) || 0,
	String(command?.PlaylistItemId || '')
].join('|');

export const getSyncPlayCommandTargetSeconds = ({
	positionTicks,
	when,
	serverNowMs = Date.now()
} = {}) => {
	const positionSeconds = Number(positionTicks) / 10000000;
	if (!Number.isFinite(positionSeconds)) return null;
	const commandTimeMs = Date.parse(when);
	const elapsedSeconds = Number.isFinite(commandTimeMs)
		? Math.max(0, (Number(serverNowMs) - commandTimeMs) / 1000)
		: 0;
	return Math.max(0, positionSeconds + elapsedSeconds);
};

export const isSyncPlayVideoReady = (video) => (
	Boolean(video) &&
	Number(video.readyState) >= 3 &&
	Boolean(video.currentSrc || video.src)
);

export const isNewerSyncPlayRevision = (current, incoming) => {
	if (!current) return true;
	if (!incoming || current.revision === incoming.revision) return false;
	const currentTime = Date.parse(current.lastUpdate || '');
	const incomingTime = Date.parse(incoming.lastUpdate || '');
	if (Number.isFinite(currentTime) && Number.isFinite(incomingTime)) return incomingTime > currentTime;
	return true;
};

export const resolveSyncPlayPlayRequest = ({groupId, activeItemId, selectedItemId}) => {
	if (!groupId) return 'local';
	if (!activeItemId) return 'replace';
	if (String(activeItemId) === String(selectedItemId || '')) return 'resume';
	return 'confirm-replace';
};
