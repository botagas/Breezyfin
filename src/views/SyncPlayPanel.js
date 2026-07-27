import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import IntegrationPanelLayout from '../components/IntegrationPanelLayout';
import PanelActionButton from '../components/PanelActionButton';
import jellyfinService from '../services/jellyfinService';
import {usePanelToolbarActions} from '../hooks/usePanelToolbarActions';
import {usePanelScrollState} from '../hooks/usePanelScrollState';
import {useSyncPlay} from '../contexts/SyncPlayContext';

import css from './IntegrationPanels.module.less';

const SyncPlayPanel = ({
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	...rest
}) => {
	const serviceSessionKey = `${jellyfinService.serverUrl || ''}|${jellyfinService.userId || ''}|${jellyfinService.accessToken || ''}`;
	const [groups, setGroups] = useState([]);
	const syncPlay = useSyncPlay();
	const joinedGroup = syncPlay.group;
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [backdropItem, setBackdropItem] = useState(null);
	const requestGenerationRef = useRef(0);
	const {captureScrollTo, handleScrollStop} = usePanelScrollState({cachedState, isActive, onCacheState});
	const toolbarActions = usePanelToolbarActions({
		onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, isActive
	});

	const loadGroups = useCallback(async () => {
		const generation = requestGenerationRef.current + 1;
		requestGenerationRef.current = generation;
		setLoading(true);
		setError('');
		try {
			const response = await jellyfinService.getSyncPlayGroups();
			if (generation !== requestGenerationRef.current) return;
			setGroups(Array.isArray(response) ? response : []);
		} catch (_) {
			if (generation !== requestGenerationRef.current) return;
			setGroups([]);
			setError('SyncPlay groups are unavailable for this user.');
		} finally {
			if (generation === requestGenerationRef.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!isActive) return undefined;
		loadGroups();
		return () => {
			requestGenerationRef.current += 1;
		};
	}, [isActive, loadGroups, serviceSessionKey]);

	const playingItemId = useMemo(() => {
		const queue = joinedGroup?.PlayQueue;
		const playlist = Array.isArray(queue?.Playlist) ? queue.Playlist : [];
		const requestedIndex = Number(queue?.PlayingItemIndex);
		const playingIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0
			? requestedIndex
			: 0;
		return playlist[playingIndex]?.ItemId || playlist[0]?.ItemId || '';
	}, [joinedGroup?.PlayQueue]);

	useEffect(() => {
		if (!isActive || !playingItemId) {
			setBackdropItem(null);
			return undefined;
		}
		let cancelled = false;
		jellyfinService.getItem(playingItemId).then((item) => {
			if (!cancelled) setBackdropItem(item || null);
		}).catch(() => {
			if (!cancelled) setBackdropItem(null);
		});
		return () => {
			cancelled = true;
		};
	}, [isActive, playingItemId]);

	const joinGroup = useCallback(async (event) => {
		const groupId = event.currentTarget.dataset.groupId;
		const group = groups.find((entry) => entry.GroupId === groupId);
		if (!group) return;
		const generation = requestGenerationRef.current;
		setError('');
		try {
			await syncPlay.joinGroup(groupId);
			if (generation !== requestGenerationRef.current) return;
		} catch (_) {
			if (generation !== requestGenerationRef.current) return;
			setError('Could not join this SyncPlay group.');
		}
	}, [groups, syncPlay]);

	const createGroup = useCallback(async () => {
		const generation = requestGenerationRef.current;
		setError('');
		const groupName = `${jellyfinService.username || 'Breezyfin'} Group`;
		try {
			await syncPlay.createGroup(groupName);
			if (generation !== requestGenerationRef.current) return;
			await loadGroups();
		} catch (_) {
			if (generation !== requestGenerationRef.current) return;
			setError('Could not create a SyncPlay group.');
		}
	}, [loadGroups, syncPlay]);

	const leaveGroup = useCallback(async () => {
		const generation = requestGenerationRef.current;
		setError('');
		try {
			await syncPlay.leaveGroup();
			if (generation !== requestGenerationRef.current) return;
			loadGroups();
		} catch (_) {
			if (generation === requestGenerationRef.current) {
				setError('Could not leave this SyncPlay group.');
			}
		}
	}, [loadGroups, syncPlay]);

	const startGroupPlayback = useCallback(async () => {
		setError('');
		try {
			await syncPlay.startGroupPlayback();
		} catch (_) {
			setError('Could not force the waiting SyncPlay group to start.');
		}
	}, [syncPlay]);

	const firstFocusId = joinedGroup ? 'sync-play-leave' : 'sync-play-create';
	return (
		<IntegrationPanelLayout
			{...rest}
			title="SyncPlay"
			activeSection="syncPlay"
			isActive={isActive}
			toolbarActions={toolbarActions}
			firstFocusId={firstFocusId}
			backdropItem={backdropItem}
			loading={loading}
			captureScrollTo={captureScrollTo}
			onScrollStop={handleScrollStop}
		>
			<section className={css.section}>
				<BodyText className={css.sectionTitle}>Native Jellyfin Groups</BodyText>
				{error ? <BodyText>{error}</BodyText> : null}
				{error ? <PanelActionButton spotlightId="sync-play-retry" onClick={loadGroups}>Retry</PanelActionButton> : null}
				{joinedGroup ? (
					<>
						<BodyText>Joined: {joinedGroup.GroupName || joinedGroup.GroupId}</BodyText>
						<BodyText>Participants: {(joinedGroup.Participants || []).length}</BodyText>
						<BodyText>
							Group state: {syncPlay.groupState?.state || joinedGroup.State || 'Unknown'}
						</BodyText>
						<BodyText>Local playback: {syncPlay.followMode === 'following' ? 'Following' : 'Suspended'}</BodyText>
						{syncPlay.followMode === 'suspended' && syncPlay.queue.activeItemId ? (
							<PanelActionButton spotlightId="sync-play-resume" onClick={syncPlay.resumeSession}>
								Resume Session
							</PanelActionButton>
						) : null}
						{String(syncPlay.groupState?.state || joinedGroup.State || '').toLowerCase() === 'waiting' ? (
							<PanelActionButton spotlightId="sync-play-start" onClick={startGroupPlayback}>
								Start Group Playback
							</PanelActionButton>
						) : null}
						<PanelActionButton spotlightId="sync-play-leave" onClick={leaveGroup}>Leave Group</PanelActionButton>
					</>
				) : (
					<>
						<PanelActionButton spotlightId="sync-play-create" onClick={createGroup}>
							Create Group
						</PanelActionButton>
						{groups.map((group) => (
							<PanelActionButton
								key={group.GroupId}
								spotlightId={`sync-play-group-${group.GroupId}`}
								data-group-id={group.GroupId}
								onClick={joinGroup}
							>
								{group.GroupName || group.GroupId} ({(group.Participants || []).length})
							</PanelActionButton>
						))}
					</>
				)}
			</section>
		</IntegrationPanelLayout>
	);
};

export default SyncPlayPanel;
