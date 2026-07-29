import {useCallback, useEffect, useRef, useState} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Input from '@enact/sandstone/Input';
import PanelActionButton from '../../../components/PanelActionButton';
import {usePopupInitialFocus} from '../../../hooks/usePopupInitialFocus';
import {popupShellCss} from '../../../styles/popupStyles';
import popupStyles from '../../../styles/popupStyles.module.less';

import css from './PlayerWatchPartyPopup.module.less';

const getInputValue = (event) => String(event?.value ?? event?.target?.value ?? '');

const PlayerWatchPartyPopup = ({
	open,
	availability,
	state,
	item,
	onClose,
	onCreate,
	onJoin,
	onLeave,
	onSendChat
}) => {
	const [roomName, setRoomName] = useState('');
	const [password, setPassword] = useState('');
	const [chatText, setChatText] = useState('');
	const [localError, setLocalError] = useState('');
	const [pendingAction, setPendingAction] = useState('');
	const contentRef = useRef(null);
	const pendingActionRef = useRef('');
	usePopupInitialFocus(open, contentRef);
	const handleRoomNameChange = useCallback((event) => {
		setRoomName(getInputValue(event).slice(0, 120));
	}, []);
	const handlePasswordChange = useCallback((event) => {
		setPassword(getInputValue(event).slice(0, 256));
	}, []);
	const handleChatTextChange = useCallback((event) => {
		setChatText(getInputValue(event).slice(0, 500));
	}, []);

	useEffect(() => {
		if (!open) {
			setPassword('');
			setChatText('');
			setLocalError('');
			pendingActionRef.current = '';
			setPendingAction('');
		}
	}, [open]);

	const runAction = useCallback(async (actionId, action, onSuccess) => {
		if (pendingActionRef.current) return;
		pendingActionRef.current = actionId;
		setPendingAction(actionId);
		setLocalError('');
		try {
			await action();
			onSuccess?.();
		} catch (error) {
			setLocalError(error?.message || 'The Watch Party action failed.');
		} finally {
			pendingActionRef.current = '';
			setPendingAction('');
		}
	}, []);

	const createRoom = useCallback(() => runAction(
		'create',
		() => onCreate({name: roomName.trim(), password}),
		() => {
			setPassword('');
		}
	), [onCreate, password, roomName, runAction]);

	const joinRoom = useCallback((event) => {
		const roomId = event.currentTarget.dataset.roomId;
		return runAction(
			`join:${roomId}`,
			() => onJoin(roomId, password),
			() => {
				setPassword('');
			}
		);
	}, [onJoin, password, runAction]);

	const sendChat = useCallback(() => runAction(
		'chat',
		() => onSendChat(chatText),
		() => {
			setChatText('');
		}
	), [chatText, onSendChat, runAction]);

	const leaveRoom = useCallback(() => runAction(
		'leave',
		onLeave
	), [onLeave, runAction]);

	const errorMessage = localError || state?.lastError?.message || '';

	return (
		<Popup open={open} onClose={onClose} css={popupShellCss}>
			<div ref={contentRef} className={`${popupStyles.popupSurface} ${css.content}`}>
				<BodyText className={css.title}>JellyWatchParty</BodyText>
				<div className={css.body}>
				{availability?.available !== true ? (
					<BodyText>Watch parties are unavailable for this server session.</BodyText>
				) : null}
				{availability?.available === true && state?.connectionState !== 'open' ? (
					<BodyText>Connecting to the session server...</BodyText>
				) : null}
				{errorMessage ? <BodyText>{errorMessage}</BodyText> : null}
				{state?.room ? (
					<>
						<BodyText>{state.room.name}</BodyText>
						<BodyText>{state.room.isHost ? 'Host' : 'Participant'} - {state.room.participantCount} online</BodyText>
						<div className={css.chat}>
							{state.chat.map((message, index) => (
								<BodyText key={`${message.serverTimestamp}-${message.clientId}-${index}`}>
									{message.username}: {message.text}
								</BodyText>
							))}
						</div>
						<Input
							placeholder="Message"
							value={chatText}
							onChange={handleChatTextChange}
							className="bf-input-trigger"
						/>
						<PanelActionButton onClick={sendChat} disabled={!chatText.trim() || Boolean(pendingAction)}>
							{pendingAction === 'chat' ? 'Sending...' : 'Send'}
						</PanelActionButton>
						<PanelActionButton onClick={leaveRoom} disabled={Boolean(pendingAction)}>
							{pendingAction === 'leave' ? 'Leaving...' : 'Leave Room'}
						</PanelActionButton>
					</>
				) : (
					<>
						<BodyText>Create a room for {item?.Name || 'the current item'} or join an existing room.</BodyText>
						<Input
							placeholder="Room name"
							value={roomName}
							onChange={handleRoomNameChange}
							className="bf-input-trigger"
						/>
						<Input
							type="password"
							placeholder="Room password (optional)"
							value={password}
							onChange={handlePasswordChange}
							className="bf-input-trigger"
						/>
						<PanelActionButton
							onClick={createRoom}
							disabled={state?.connectionState !== 'open' || Boolean(pendingAction)}
						>
							{pendingAction === 'create' ? 'Creating...' : 'Create Room'}
						</PanelActionButton>
						{(state?.rooms || []).map((room) => (
							<PanelActionButton
								key={room.id}
								data-room-id={room.id}
								onClick={joinRoom}
								disabled={state?.connectionState !== 'open' || Boolean(pendingAction)}
							>
								{room.name} ({room.count}){room.hasPassword ? ' - Password' : ''}
							</PanelActionButton>
						))}
					</>
				)}
				</div>
				<div className={css.actions}>
					<PanelActionButton onClick={onClose} disabled={Boolean(pendingAction)}>Close</PanelActionButton>
				</div>
			</div>
		</Popup>
	);
};

export default PlayerWatchPartyPopup;
