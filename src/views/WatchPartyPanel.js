import {useCallback, useEffect, useRef, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import Input from '@enact/sandstone/Input';
import IntegrationPanelLayout from '../components/IntegrationPanelLayout';
import PanelActionButton from '../components/PanelActionButton';
import jellyfinService from '../services/jellyfinService';
import {usePanelToolbarActions} from '../hooks/usePanelToolbarActions';
import {usePanelScrollState} from '../hooks/usePanelScrollState';

import css from './IntegrationPanels.module.less';

const getInputValue = (event) => String(event?.value ?? event?.target?.value ?? '');

const WatchPartyPanel = ({
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	onPlay,
	registerBackHandler,
	isActive = false,
	cachedState = null,
	onCacheState = null,
	...rest
}) => {
	const [availability, setAvailability] = useState(null);
	const [state, setState] = useState(() => jellyfinService.getWatchPartyState());
	const [roomName, setRoomName] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [backdropItem, setBackdropItem] = useState(null);
	const pendingJoinRef = useRef('');
	const activeRef = useRef(isActive);
	const availabilityRequestRef = useRef(0);
	const playRequestRef = useRef(0);
	const {captureScrollTo, handleScrollStop} = usePanelScrollState({cachedState, isActive, onCacheState});
	const toolbarActions = usePanelToolbarActions({
		onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, isActive
	});
	const handleRoomNameChange = useCallback((event) => {
		setRoomName(getInputValue(event).slice(0, 120));
	}, []);
	const handlePasswordChange = useCallback((event) => {
		setPassword(getInputValue(event).slice(0, 256));
	}, []);

	const detectAvailability = useCallback(async () => {
		const requestId = availabilityRequestRef.current + 1;
		availabilityRequestRef.current = requestId;
		setAvailability(null);
		try {
			const nextAvailability = await jellyfinService.detectJellyWatchParty();
			if (activeRef.current && requestId === availabilityRequestRef.current) {
				setAvailability(nextAvailability);
			}
		} catch (_) {
			if (activeRef.current && requestId === availabilityRequestRef.current) {
				setAvailability({available: false, reason: 'unavailable'});
			}
		}
	}, []);

	useEffect(() => {
		activeRef.current = isActive;
		if (!isActive) {
			availabilityRequestRef.current += 1;
			playRequestRef.current += 1;
		}
		return () => {
			activeRef.current = false;
			availabilityRequestRef.current += 1;
			playRequestRef.current += 1;
		};
	}, [isActive]);

	useEffect(() => {
		if (!isActive) return undefined;
		let cancelled = false;
		detectAvailability();
			const unsubscribe = jellyfinService.subscribeWatchPartyState((nextState) => {
				if (cancelled) return;
				setState(nextState);
				if (nextState.reason !== 'not-detected') {
					setAvailability({
						available: nextState.available === true,
						reason: nextState.reason,
						hideNativeSyncButton: nextState.hideNativeSyncButton === true
					});
				}
				if (nextState.lastError?.message) setError(nextState.lastError.message);
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [detectAvailability, isActive]);

	useEffect(() => {
		if (!isActive || !state.room?.mediaId) {
			setBackdropItem(null);
			return undefined;
		}
		let cancelled = false;
		jellyfinService.getItem(state.room.mediaId).then((item) => {
			if (!cancelled) setBackdropItem(item || null);
		}).catch(() => {
			if (!cancelled) setBackdropItem(null);
		});
		return () => {
			cancelled = true;
		};
	}, [isActive, state.room?.mediaId]);

	useEffect(() => {
		const pendingRoomId = pendingJoinRef.current;
		if (!isActive || !pendingRoomId || state.room?.id !== pendingRoomId) return;
		pendingJoinRef.current = '';
		if (!state.room.mediaId) return;
		let cancelled = false;
		jellyfinService.getItem(state.room.mediaId).then((roomItem) => {
			if (!cancelled && roomItem?.Id) onPlay(roomItem);
		}).catch(() => {
			if (!cancelled) setError('The room item is not accessible to this Jellyfin user.');
		});
		return () => {
			cancelled = true;
		};
	}, [isActive, onPlay, state.room]);

	const refreshRooms = useCallback(() => {
		try {
			jellyfinService.listWatchPartyRooms();
			setError('');
		} catch (requestError) {
			setError(requestError?.message || 'Could not refresh rooms.');
		}
	}, []);

	const createRoom = useCallback(() => {
		try {
			jellyfinService.createWatchPartyRoom({
				name: roomName.trim() || `${jellyfinService.username || 'Breezyfin'} Watch Party`,
				password
			});
			setPassword('');
			setError('');
		} catch (requestError) {
			setError(requestError?.message || 'Could not create the room.');
		}
	}, [password, roomName]);

	const joinRoom = useCallback((event) => {
		const roomId = event.currentTarget.dataset.roomId;
		try {
			pendingJoinRef.current = roomId;
			jellyfinService.joinWatchPartyRoom(roomId, password);
			setPassword('');
			setError('');
		} catch (requestError) {
			pendingJoinRef.current = '';
			setError(requestError?.message || 'Could not join the room.');
		}
	}, [password]);

	const leaveRoom = useCallback(() => {
		try {
			jellyfinService.leaveWatchPartyRoom();
			setError('');
		} catch (requestError) {
			setError(requestError?.message || 'Could not leave the room.');
		}
	}, []);

	const playRoomItem = useCallback(async () => {
		const mediaId = state.room?.mediaId;
		if (!isActive || !mediaId) return;
		const requestId = playRequestRef.current + 1;
		playRequestRef.current = requestId;
		try {
			const roomItem = await jellyfinService.getItem(mediaId);
			if (!activeRef.current || requestId !== playRequestRef.current) return;
			if (!roomItem?.Id) throw new Error('Missing room item');
			onPlay(roomItem);
		} catch (_) {
			if (activeRef.current && requestId === playRequestRef.current) {
				setError('The room item is not accessible to this Jellyfin user.');
			}
		}
	}, [isActive, onPlay, state.room?.mediaId]);

	const firstFocusId = availability?.available !== true
		? 'watch-party-retry'
		: state.room ? (state.room.mediaId ? 'watch-party-play' : 'watch-party-leave') : 'watch-party-room-name';
	return (
		<IntegrationPanelLayout
			{...rest}
			title="Watch Party"
			activeSection="watchParty"
			isActive={isActive}
			toolbarActions={toolbarActions}
			firstFocusId={firstFocusId}
			backdropItem={backdropItem}
			loading={availability == null}
			captureScrollTo={captureScrollTo}
			onScrollStop={handleScrollStop}
		>
			<section className={css.section}>
				<BodyText className={css.sectionTitle}>JellyWatchParty Rooms</BodyText>
				{availability?.available !== true ? (
					<>
						<BodyText>This server does not provide an authenticated JellyWatchParty session.</BodyText>
						<PanelActionButton spotlightId="watch-party-retry" onClick={detectAvailability}>
							Retry
						</PanelActionButton>
					</>
				) : null}
				{availability?.available === true && state.connectionState !== 'open' ? (
					<BodyText>Connecting to the session server...</BodyText>
				) : null}
				{error ? <BodyText>{error}</BodyText> : null}
				{state.room ? (
					<>
						<BodyText>Joined: {state.room.name}</BodyText>
						<BodyText>{state.room.isHost ? 'Host' : 'Participant'} - {state.room.participantCount} online</BodyText>
						{state.room.mediaId ? (
							<PanelActionButton spotlightId="watch-party-play" onClick={playRoomItem}>
								Play Room Item
							</PanelActionButton>
						) : null}
						<PanelActionButton spotlightId="watch-party-leave" onClick={leaveRoom}>
							Leave Room
						</PanelActionButton>
					</>
				) : availability?.available === true ? (
					<>
						<Input
							spotlightId="watch-party-room-name"
							placeholder="Room name"
							value={roomName}
							onChange={handleRoomNameChange}
							className="bf-input-trigger"
						/>
						<Input
							spotlightId="watch-party-password"
							type="password"
							placeholder="Password for create or join (optional)"
							value={password}
							onChange={handlePasswordChange}
							className="bf-input-trigger"
						/>
						<PanelActionButton
							spotlightId="watch-party-create"
							onClick={createRoom}
							disabled={state.connectionState !== 'open'}
						>
							Create Room
						</PanelActionButton>
						<PanelActionButton
							spotlightId="watch-party-refresh"
							onClick={refreshRooms}
							disabled={state.connectionState !== 'open'}
						>
							Refresh Rooms
						</PanelActionButton>
						{state.rooms.length === 0 && state.connectionState === 'open' ? (
							<BodyText>No watch parties are currently open.</BodyText>
						) : null}
						{state.rooms.map((room) => (
							<PanelActionButton
								key={room.id}
								spotlightId={`watch-party-room-${room.id}`}
								data-room-id={room.id}
								onClick={joinRoom}
							>
								{room.name} ({room.count}){room.hasPassword ? ' - Password' : ''}
							</PanelActionButton>
						))}
					</>
				) : null}
			</section>
		</IntegrationPanelLayout>
	);
};

export default WatchPartyPanel;
