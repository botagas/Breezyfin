import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import jellyfinService from '../../services/jellyfinService';
import {
	getSyncPlayCommandRevision,
	getSyncPlayQueueSnapshot,
	resolveSyncPlayPlayRequest
} from '../../utils/syncPlayState';

const QUEUE_UPDATE_TIMEOUT_MS = 10000;
const getServiceSessionKey = () => JSON.stringify([
	String(jellyfinService.serverUrl || ''),
	String(jellyfinService.userId || ''),
	String(jellyfinService.accessToken || '')
]);

export const useAppSyncPlayCoordinator = ({
	authenticated,
	currentView,
	selectedItemId,
	onOpenRemoteItem
}) => {
	const [group, setGroup] = useState(() => jellyfinService.getSyncPlayState());
	const [followMode, setFollowMode] = useState('suspended');
	const [notification, setNotification] = useState(null);
	const [playDecision, setPlayDecision] = useState(null);
	const explicitJoinRef = useRef(false);
	const navigationGenerationRef = useRef(0);
	const dismissedRevisionRef = useRef('');
	const lastNotificationRevisionRef = useRef('');
	const lastCommandNotificationRevisionRef = useRef('');
	const lastNavigationRevisionRef = useRef('');
	const queueWaitersRef = useRef(new Set());
	const coordinatorActiveRef = useRef(false);
	const reconnectGenerationRef = useRef(0);
	const waitParticipationRef = useRef({groupId: '', ignoreWait: null});
	const queue = useMemo(() => getSyncPlayQueueSnapshot(group), [group]);
	const groupRef = useRef(group);
	const queueRef = useRef(queue);
	const followModeRef = useRef(followMode);
	const currentViewRef = useRef(currentView);
	const groupState = useMemo(() => group ? ({
		state: group.State || null,
		reason: group.StateReason || null,
		lastUpdatedAt: group.LastUpdatedAt || null
	}) : null, [group]);
	const serviceSessionKey = getServiceSessionKey();
	const commitGroup = useCallback((nextGroup) => {
		const normalizedGroup = nextGroup || null;
		groupRef.current = normalizedGroup;
		queueRef.current = getSyncPlayQueueSnapshot(normalizedGroup);
		setGroup(normalizedGroup);
	}, []);
	const commitFollowMode = useCallback((nextMode) => {
		followModeRef.current = nextMode;
		setFollowMode(nextMode);
	}, []);

	useEffect(() => {
		followModeRef.current = followMode;
		currentViewRef.current = currentView;
	}, [currentView, followMode]);

	useEffect(() => {
		const queueWaiters = queueWaitersRef.current;
		if (!authenticated) {
			coordinatorActiveRef.current = false;
			reconnectGenerationRef.current += 1;
			queueWaiters.forEach((waiter) => waiter.reject(
				new Error('The SyncPlay session ended before the queue update arrived.')
			));
			queueWaiters.clear();
			commitGroup(null);
			commitFollowMode('suspended');
			setNotification(null);
			return undefined;
		}
		coordinatorActiveRef.current = true;
		const unsubscribeState = jellyfinService.subscribeSyncPlayState((nextGroup) => {
			commitGroup(nextGroup);
			if (!nextGroup) {
				reconnectGenerationRef.current += 1;
				waitParticipationRef.current = {groupId: '', ignoreWait: null};
				commitFollowMode('suspended');
				setNotification(null);
				lastNotificationRevisionRef.current = '';
				lastCommandNotificationRevisionRef.current = '';
				lastNavigationRevisionRef.current = '';
			} else if (explicitJoinRef.current) {
				explicitJoinRef.current = false;
				commitFollowMode('following');
			} else if (
				followModeRef.current !== 'following' &&
				(
					waitParticipationRef.current.groupId !== nextGroup.GroupId ||
					waitParticipationRef.current.ignoreWait !== true
				)
			) {
				waitParticipationRef.current = {groupId: nextGroup.GroupId, ignoreWait: true};
				jellyfinService.syncPlaySetIgnoreWait(true).catch(() => {
					if (waitParticipationRef.current.groupId === nextGroup.GroupId) {
						waitParticipationRef.current = {groupId: '', ignoreWait: null};
					}
				});
			}
		});
		const unsubscribeConnection = jellyfinService.onWebSocketMessage('ConnectionStateChanged', ({state}) => {
			if (state !== 'open') return;
			const currentGroup = jellyfinService.getSyncPlayState();
			if (!currentGroup?.GroupId) return;
			const requestedGroupId = currentGroup.GroupId;
			const requestedSessionKey = getServiceSessionKey();
			const reconnectGeneration = ++reconnectGenerationRef.current;
			jellyfinService.getSyncPlayGroup(requestedGroupId).then((freshGroup) => {
				const liveGroupId = jellyfinService.getSyncPlayState()?.GroupId;
				if (
					!coordinatorActiveRef.current ||
					reconnectGeneration !== reconnectGenerationRef.current ||
					requestedSessionKey !== getServiceSessionKey() ||
					String(liveGroupId || '') !== String(requestedGroupId)
				) {
					return;
				}
				if (!freshGroup) {
					jellyfinService.setSyncPlayGroup(null);
					return;
				}
				jellyfinService.setSyncPlayGroup({...currentGroup, ...freshGroup});
				return jellyfinService.syncPlaySetIgnoreWait(followModeRef.current !== 'following');
			}).catch(() => {});
		});
		const unsubscribeCommand = jellyfinService.onWebSocketMessage('SyncPlayCommand', (message) => {
			const command = message?.Data;
			const liveGroup = groupRef.current;
			const liveQueue = queueRef.current;
			const commandName = String(command?.Command || '');
			if (
				!liveGroup?.GroupId ||
				!liveQueue?.activeItemId ||
				commandName === 'Stop' ||
				(followModeRef.current === 'following' && currentViewRef.current === 'player')
			) {
				return;
			}
			const revision = getSyncPlayCommandRevision(liveGroup.GroupId, command);
			if (
				revision === lastCommandNotificationRevisionRef.current ||
				liveQueue.playbackRevision === dismissedRevisionRef.current
			) {
				return;
			}
			lastCommandNotificationRevisionRef.current = revision;
			lastNotificationRevisionRef.current = liveQueue.playbackRevision;
			setNotification({
				type: 'remote-playback',
				message: commandName === 'Unpause'
					? 'SyncPlay playback resumed while this device is suspended.'
					: 'SyncPlay playback changed while this device is suspended.',
				revision,
				playbackRevision: liveQueue.playbackRevision
			});
		});
		return () => {
			coordinatorActiveRef.current = false;
			reconnectGenerationRef.current += 1;
			unsubscribeState();
			unsubscribeConnection();
			unsubscribeCommand();
			queueWaiters.forEach((waiter) => waiter.reject(
				new Error('SyncPlay queue waiting was cancelled.')
			));
			queueWaiters.clear();
		};
	}, [authenticated, commitFollowMode, commitGroup, serviceSessionKey]);

	useEffect(() => {
		queueWaitersRef.current.forEach((waiter) => {
			if (!waiter.itemId || waiter.itemId === queue.activeItemId) waiter.resolve(queue);
		});
	}, [queue]);

	useEffect(() => {
		if (!authenticated || !group?.GroupId || !queue.activeItemId) return undefined;
		if (followMode !== 'following') {
			if (
				queue.playbackRevision !== dismissedRevisionRef.current &&
				queue.playbackRevision !== lastNotificationRevisionRef.current
			) {
				lastNotificationRevisionRef.current = queue.playbackRevision;
				setNotification({
					type: 'remote-playback',
					message: 'SyncPlay playback changed while this device is suspended.',
					revision: queue.playbackRevision
				});
			}
			return undefined;
		}
		if (currentView === 'player' && String(selectedItemId || '') === queue.activeItemId) {
			lastNavigationRevisionRef.current = queue.revision;
			return undefined;
		}
		if (lastNavigationRevisionRef.current === queue.revision) return undefined;
		lastNavigationRevisionRef.current = queue.revision;
		const generation = ++navigationGenerationRef.current;
		jellyfinService.getItem(queue.activeItemId).then((item) => {
			if (generation !== navigationGenerationRef.current) return;
			if (!item) {
				setNotification({
					type: 'warning',
					message: 'The current SyncPlay item is unavailable to this user.',
					revision: queue.revision
				});
				return;
			}
			onOpenRemoteItem(item, {
				groupId: group.GroupId,
				playlistItemId: queue.activePlaylistItemId,
				queueRevision: queue.revision,
				playbackRevision: queue.playbackRevision,
				startPositionTicks: queue.startPositionTicks,
				isPlaying: queue.isPlaying
			});
		}).catch(() => {
			if (generation === navigationGenerationRef.current) {
				setNotification({type: 'warning', message: 'The current SyncPlay item is unavailable to this user.', revision: queue.revision});
			}
		});
		return () => {
			navigationGenerationRef.current += 1;
		};
	}, [authenticated, currentView, followMode, group?.GroupId, onOpenRemoteItem, queue, selectedItemId]);

	const waitForQueueItem = useCallback((itemId) => new Promise((resolve, reject) => {
		if (!coordinatorActiveRef.current) {
			reject(new Error('SyncPlay queue waiting was cancelled.'));
			return;
		}
		const liveQueue = getSyncPlayQueueSnapshot(jellyfinService.getSyncPlayState());
		if (liveQueue.activeItemId === itemId) {
			resolve(liveQueue);
			return;
		}
		const waiter = {itemId, resolve: null, reject: null};
		const timeout = setTimeout(() => {
			queueWaitersRef.current.delete(waiter);
			reject(new Error('Timed out waiting for the SyncPlay queue update.'));
		}, QUEUE_UPDATE_TIMEOUT_MS);
		waiter.resolve = (value) => {
			clearTimeout(timeout);
			queueWaitersRef.current.delete(waiter);
			resolve(value);
		};
		waiter.reject = (error) => {
			clearTimeout(timeout);
			queueWaitersRef.current.delete(waiter);
			reject(error);
		};
		queueWaitersRef.current.add(waiter);
	}), []);

	const joinGroup = useCallback(async (groupId) => {
		explicitJoinRef.current = true;
		try {
			await jellyfinService.joinSyncPlayGroup(groupId);
			await jellyfinService.syncPlaySetIgnoreWait(false);
			waitParticipationRef.current = {groupId, ignoreWait: false};
			commitFollowMode('following');
		} catch (error) {
			explicitJoinRef.current = false;
			commitFollowMode('suspended');
			throw error;
		}
	}, [commitFollowMode]);
	const createGroup = useCallback(async (name) => {
		explicitJoinRef.current = true;
		try {
			const createdGroup = await jellyfinService.createSyncPlayGroup(name);
			await jellyfinService.syncPlaySetIgnoreWait(false);
			waitParticipationRef.current = {
				groupId: createdGroup?.GroupId || jellyfinService.getSyncPlayState()?.GroupId || '',
				ignoreWait: false
			};
			commitFollowMode('following');
		} catch (error) {
			explicitJoinRef.current = false;
			commitFollowMode('suspended');
			throw error;
		}
	}, [commitFollowMode]);
	const leaveGroup = useCallback(async () => {
		reconnectGenerationRef.current += 1;
		await jellyfinService.leaveSyncPlayGroup();
		if (jellyfinService.getSyncPlayState()?.GroupId) {
			jellyfinService.setSyncPlayGroup(null);
		} else {
			commitGroup(null);
		}
		waitParticipationRef.current = {groupId: '', ignoreWait: null};
		commitFollowMode('suspended');
		setNotification(null);
		setPlayDecision(null);
	}, [commitFollowMode, commitGroup]);
	const resumeSession = useCallback(async () => {
		if (!groupRef.current?.GroupId) return;
		try {
			await jellyfinService.syncPlaySetIgnoreWait(false);
			waitParticipationRef.current = {
				groupId: groupRef.current.GroupId,
				ignoreWait: false
			};
			lastNavigationRevisionRef.current = '';
			commitFollowMode('following');
			setNotification(null);
		} catch (_) {
			setNotification({
				type: 'warning',
				message: 'SyncPlay could not resume this device.',
				revision: `resume-error:${Date.now()}`
			});
		}
	}, [commitFollowMode]);
	const suspend = useCallback(() => {
		commitFollowMode('suspended');
		if (!groupRef.current?.GroupId) return Promise.resolve();
		return jellyfinService.syncPlaySetIgnoreWait(true).then(() => {
			waitParticipationRef.current = {
				groupId: groupRef.current?.GroupId || '',
				ignoreWait: true
			};
		}).catch(() => {
			setNotification({
				type: 'warning',
				message: 'SyncPlay could not suspend group waiting for this device.',
				revision: `suspend-error:${Date.now()}`
			});
		});
	}, [commitFollowMode]);
	const dismissNotification = useCallback(() => {
		dismissedRevisionRef.current = notification?.playbackRevision || notification?.revision || '';
		setNotification(null);
	}, [notification?.playbackRevision, notification?.revision]);
	const replaceQueue = useCallback(async (itemId) => {
		await jellyfinService.syncPlaySetIgnoreWait(false);
		waitParticipationRef.current = {
			groupId: groupRef.current?.GroupId || '',
			ignoreWait: false
		};
		commitFollowMode('following');
		setNotification(null);
		await jellyfinService.syncPlaySetQueue({
			PlayingQueue: [itemId],
			PlayingItemPosition: 0,
			StartPositionTicks: 0
		});
		await waitForQueueItem(itemId);
	}, [commitFollowMode, waitForQueueItem]);
	const requestPlay = useCallback(async (item) => {
		const decision = resolveSyncPlayPlayRequest({
			groupId: group?.GroupId,
			activeItemId: queue.activeItemId,
			selectedItemId: item?.Id
		});
		if (decision === 'local') return false;
		if (decision === 'replace') {
			try {
				await replaceQueue(item.Id);
			} catch (error) {
				setNotification({
					type: 'warning',
					message: error?.message || 'SyncPlay could not replace the group queue.',
					revision: `replace-error:${Date.now()}`
				});
			}
		}
		else if (decision === 'resume') await resumeSession();
		else setPlayDecision({item, currentItemId: queue.activeItemId});
		return true;
	}, [group?.GroupId, queue.activeItemId, replaceQueue, resumeSession]);
	const confirmReplacePlayback = useCallback(async () => {
		const item = playDecision?.item;
		setPlayDecision(null);
		if (!item) return;
		try {
			await replaceQueue(item.Id);
		} catch (error) {
			setNotification({type: 'warning', message: error.message, revision: `error:${Date.now()}`});
		}
	}, [playDecision?.item, replaceQueue]);
	const joinCurrentPlayback = useCallback(async () => {
		setPlayDecision(null);
		await resumeSession();
	}, [resumeSession]);
	const startGroupPlayback = useCallback(async () => {
		if (!groupRef.current?.GroupId) return false;
		await jellyfinService.syncPlaySetIgnoreWait(false);
		waitParticipationRef.current = {
			groupId: groupRef.current.GroupId,
			ignoreWait: false
		};
		commitFollowMode('following');
		await jellyfinService.syncPlayPlay();
		return true;
	}, [commitFollowMode]);
	const cancelPlayDecision = useCallback(() => setPlayDecision(null), []);
	const next = useCallback(() => {
		if (!queue.activePlaylistItemId) return Promise.resolve();
		return jellyfinService.syncPlayNext({PlaylistItemId: queue.activePlaylistItemId});
	}, [queue.activePlaylistItemId]);
	const previous = useCallback(() => {
		if (!queue.activePlaylistItemId) return Promise.resolve();
		return jellyfinService.syncPlayPrevious({PlaylistItemId: queue.activePlaylistItemId});
	}, [queue.activePlaylistItemId]);

	return useMemo(() => ({
		group,
		groupState,
		queue,
		followMode,
		notification,
		playDecision,
		joinGroup,
		createGroup,
		leaveGroup,
		resumeSession,
		suspend,
		dismissNotification,
		requestPlay,
		confirmReplacePlayback,
		joinCurrentPlayback,
		startGroupPlayback,
		cancelPlayDecision,
		next,
		previous
	}), [
		cancelPlayDecision, confirmReplacePlayback, createGroup, dismissNotification,
		followMode, group, groupState, joinCurrentPlayback, joinGroup, leaveGroup, next, notification,
		playDecision, previous, queue, requestPlay, resumeSession, startGroupPlayback, suspend
	]);
};
