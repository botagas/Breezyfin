import {useCallback, useEffect, useState} from 'react';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Input from '@enact/sandstone/Input';
import Button from '../../../components/BreezyButton';
import {popupShellCss} from '../../../styles/popupStyles';

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
		}
	}, [open]);

	const createRoom = useCallback(() => {
		try {
			onCreate({name: roomName.trim(), password});
			setPassword('');
			setLocalError('');
		} catch (error) {
			setLocalError(error?.message || 'Could not create the room.');
		}
	}, [onCreate, password, roomName]);

	const joinRoom = useCallback((event) => {
		try {
			onJoin(event.currentTarget.dataset.roomId, password);
			setPassword('');
			setLocalError('');
		} catch (error) {
			setLocalError(error?.message || 'Could not join the room.');
		}
	}, [onJoin, password]);

	const sendChat = useCallback(() => {
		try {
			onSendChat(chatText);
			setChatText('');
			setLocalError('');
		} catch (error) {
			setLocalError(error?.message || 'Could not send the message.');
		}
	}, [chatText, onSendChat]);

	const errorMessage = localError || state?.lastError?.message || '';

	return (
		<Popup open={open} onClose={onClose} css={popupShellCss}>
			<div>
				<BodyText>JellyWatchParty</BodyText>
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
						<div>
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
						<Button onClick={sendChat} disabled={!chatText.trim()}>Send</Button>
						<Button onClick={onLeave}>Leave Room</Button>
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
						<Button onClick={createRoom} disabled={state?.connectionState !== 'open'}>Create Room</Button>
						{(state?.rooms || []).map((room) => (
							<Button
								key={room.id}
								data-room-id={room.id}
								onClick={joinRoom}
								disabled={state?.connectionState !== 'open'}
							>
								{room.name} ({room.count}){room.hasPassword ? ' - Password' : ''}
							</Button>
						))}
					</>
				)}
				<Button onClick={onClose}>Close</Button>
			</div>
		</Popup>
	);
};

export default PlayerWatchPartyPopup;
