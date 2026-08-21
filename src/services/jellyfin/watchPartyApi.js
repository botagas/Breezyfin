import {ServerClockOffsetEstimator} from '../../utils/syncTiming';

const TOKEN_ENDPOINT = '/JellyWatchParty/Token';
const CLIENT_ID_PREFIX = 'breezyfin:jellywatchparty:client-id:v1:';
const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_ROOMS = 200;
const MAX_CHAT_MESSAGES = 50;
const MAX_CHAT_LENGTH = 500;
const PING_INTERVAL_MS = 10000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const TOKEN_REFRESH_FLOOR_MS = 30000;
const TOKEN_REFRESH_LEAD_MS = 5 * 60 * 1000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sessions = new WeakMap();

const compactText = (value, maximum = 200) => String(value || '').trim().slice(0, maximum);

const getSessionKey = (service) => {
	if (!service?.serverUrl || !service?.userId || !service?.accessToken) return '';
	return JSON.stringify([service.serverUrl, service.userId, service.accessToken]);
};

const createUuid = () => {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
		const random = Math.floor(Math.random() * 16);
		const value = character === 'x' ? random : ((random & 0x3) | 0x8);
		return value.toString(16);
	});
};

const getPersistentClientId = (service) => {
	const scope = encodeURIComponent(`${service.serverUrl}|${service.userId}`);
	const storageKey = `${CLIENT_ID_PREFIX}${scope}`;
	try {
		const existing = globalThis.localStorage?.getItem(storageKey);
		if (UUID_V4_PATTERN.test(existing || '')) return existing;
		const next = createUuid();
		globalThis.localStorage?.setItem(storageKey, next);
		return next;
	} catch (_) {
		return createUuid();
	}
};

const validateSocketUrl = (value) => {
	try {
		const parsed = new URL(String(value || ''));
		if (!['ws:', 'wss:'].includes(parsed.protocol)) return null;
		if (!parsed.hostname || parsed.username || parsed.password || parsed.hash) return null;
		return parsed.toString();
	} catch (_) {
		return null;
	}
};

const appendClientId = (socketUrl, clientId) => {
	const parsed = new URL(socketUrl);
	parsed.searchParams.set('client_id', clientId);
	return parsed.toString();
};

const initialPublicState = () => ({
	available: false,
	reason: 'not-detected',
	hideNativeSyncButton: false,
	connectionState: 'closed',
	rooms: [],
	room: null,
	clientId: '',
	chat: [],
	serverOffsetMs: 0,
	lastError: null
});

const clonePublicState = (state) => ({
	...state,
	rooms: state.rooms.map((room) => ({...room})),
	room: state.room ? {...state.room, state: {...state.room.state}} : null,
	chat: state.chat.map((message) => ({...message})),
	lastError: state.lastError ? {...state.lastError} : null
});

const createEntry = (service, key) => ({
	service,
	key,
	generation: 0,
	availabilityPromise: null,
	token: '',
	tokenExpiresAt: 0,
	socketUrl: '',
	socket: null,
	shouldReconnect: true,
	reconnectAttempt: 0,
	reconnectTimer: null,
	pingTimer: null,
	refreshTimer: null,
	clock: new ServerClockOffsetEstimator(7),
	listeners: new Set(),
	messageListeners: new Map(),
	state: initialPublicState()
});

const notifyState = (entry) => {
	const snapshot = clonePublicState(entry.state);
	entry.listeners.forEach((listener) => listener(snapshot));
};

const notifyMessage = (entry, message) => {
	const listeners = entry.messageListeners.get(message.type);
	listeners?.forEach((listener) => listener(message));
};

const clearTimer = (entry, name) => {
	if (!entry[name]) return;
	clearTimeout(entry[name]);
	entry[name] = null;
};

const stopSocket = (entry, {clearRoom = false} = {}) => {
	entry.generation += 1;
	entry.shouldReconnect = false;
	clearTimer(entry, 'reconnectTimer');
	clearTimer(entry, 'pingTimer');
	clearTimer(entry, 'refreshTimer');
	const socket = entry.socket;
	entry.socket = null;
	if (socket && socket.readyState < 2) socket.close(1000, 'Session ended');
	entry.clock.reset();
	entry.state = {
		...entry.state,
		connectionState: 'closed',
		serverOffsetMs: 0,
		...(clearRoom ? {room: null, chat: [], clientId: ''} : {})
	};
	notifyState(entry);
};

const getEntry = (service) => {
	const key = getSessionKey(service);
	if (!key) return null;
	const current = sessions.get(service);
	if (current?.key === key) return current;
	if (current) stopSocket(current, {clearRoom: true});
	const next = createEntry(service, key);
	sessions.set(service, next);
	return next;
};

const normalizeRoom = (room) => {
	if (!room || typeof room !== 'object') return null;
	const id = compactText(room.id, 128);
	const name = compactText(room.name, 120);
	if (!id || !name) return null;
	return {
		id,
		name,
		count: Math.max(0, Math.trunc(Number(room.count) || 0)),
		mediaId: compactText(room.media_id, 128) || null,
		hasPassword: room.has_password === true
	};
};

const normalizeChatMessage = (message, clientId = '') => {
	if (!message || typeof message !== 'object') return null;
	const text = String(message.text || '').trim().slice(0, MAX_CHAT_LENGTH);
	if (!text) return null;
	const senderId = compactText(message.client_id || message.client, 128);
	return {
		clientId: senderId,
		username: compactText(message.username, 100) || 'Participant',
		text,
		serverTimestamp: Number(message.server_ts) || 0,
		isOwn: Boolean(senderId && senderId === clientId)
	};
};

const normalizeRoomState = (entry, message) => {
	const payload = message.payload;
	if (!payload || typeof payload !== 'object') return null;
	const id = compactText(message.room, 128);
	const name = compactText(payload.name, 120);
	const hostId = compactText(payload.host_id, 128);
	if (!id || !name || !hostId) return null;
	const position = Number(payload.state?.position);
	const playState = payload.state?.play_state === 'playing' ? 'playing' : 'paused';
	return {
		id,
		name,
		hostId,
		isHost: Boolean(entry.state.clientId && entry.state.clientId === hostId),
		participantCount: Math.max(1, Math.trunc(Number(payload.participant_count) || 1)),
		mediaId: compactText(payload.media_id, 128) || null,
		state: {
			position: Number.isFinite(position) && position >= 0 ? position : 0,
			playState
		}
	};
};

const sendRaw = (entry, type, payload = {}, roomOverride = null) => {
	if (!entry.socket || entry.socket.readyState !== 1) {
		throw new Error('JellyWatchParty is not connected');
	}
	const room = roomOverride || entry.state.room?.id || undefined;
	entry.socket.send(JSON.stringify({
		type,
		...(room ? {room} : {}),
		...(entry.state.clientId ? {client: entry.state.clientId} : {}),
		payload,
		ts: Date.now()
	}));
};

const updateClock = (entry, message) => {
	const sentAtMs = Number(message.payload?.client_ts);
	const serverMs = Number(message.server_ts);
	const receivedAtMs = Date.now();
	if (!Number.isFinite(sentAtMs) || !Number.isFinite(serverMs)) return;
	entry.clock.record({
		sentAtMs,
		receivedAtMs,
		serverTime: new Date(serverMs).toISOString()
	});
	entry.state = {...entry.state, serverOffsetMs: entry.clock.offsetMs};
};

const applyMessage = (entry, message) => {
	switch (message.type) {
		case 'client_hello': {
			const clientId = compactText(message.payload?.client_id || message.client, 128);
			if (clientId) entry.state = {...entry.state, clientId};
			break;
		}
		case 'room_list': {
			const rooms = Array.isArray(message.payload)
				? message.payload.slice(0, MAX_ROOMS).map(normalizeRoom).filter(Boolean)
				: [];
			entry.state = {...entry.state, rooms};
			break;
		}
		case 'room_state': {
			const room = normalizeRoomState(entry, message);
			if (!room) break;
			const history = Array.isArray(message.payload?.chat_history)
				? message.payload.chat_history.slice(-MAX_CHAT_MESSAGES)
					.map((item) => normalizeChatMessage(item, entry.state.clientId)).filter(Boolean)
				: [];
			entry.state = {...entry.state, room, chat: history, lastError: null};
			break;
		}
		case 'participants_update':
		case 'client_left': {
			if (!entry.state.room) break;
			const participantCount = Math.max(1, Math.trunc(Number(message.payload?.participant_count) || 1));
			entry.state = {...entry.state, room: {...entry.state.room, participantCount}};
			break;
		}
		case 'host_changed': {
			if (!entry.state.room) break;
			const hostId = compactText(message.payload?.host_id || message.client, 128);
			entry.state = {
				...entry.state,
				room: {
					...entry.state.room,
					hostId,
					isHost: Boolean(hostId && hostId === entry.state.clientId),
					participantCount: Math.max(1, Math.trunc(Number(message.payload?.participant_count) || entry.state.room.participantCount))
				}
			};
			break;
		}
		case 'room_closed':
			entry.state = {...entry.state, room: null, chat: []};
			break;
		case 'chat_message': {
			const chatMessage = normalizeChatMessage({
				...message.payload,
				client: message.client,
				server_ts: message.server_ts
			}, entry.state.clientId);
			if (chatMessage) {
				entry.state = {...entry.state, chat: [...entry.state.chat, chatMessage].slice(-MAX_CHAT_MESSAGES)};
			}
			break;
		}
		case 'pong':
			updateClock(entry, message);
			break;
		case 'error':
			entry.state = {
				...entry.state,
				lastError: {
					message: compactText(message.payload?.message, 240) || 'JellyWatchParty request failed',
					reason: compactText(message.payload?.reason, 80) || null
				}
			};
			break;
		default:
			break;
	}
	notifyState(entry);
	notifyMessage(entry, message);
};

const parseSocketMessage = (entry, data) => {
	if (typeof data !== 'string' || data.length > MAX_MESSAGE_BYTES) return;
	try {
		const message = JSON.parse(data);
		if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
		const messageRoom = compactText(message.room, 128);
		if (entry.state.room && messageRoom && messageRoom !== entry.state.room.id && message.type !== 'room_state') return;
		applyMessage(entry, message);
	} catch (_) {
		// Invalid server messages are ignored without exposing their payload.
	}
};

const schedulePing = (entry, generation) => {
	clearTimer(entry, 'pingTimer');
	entry.pingTimer = setInterval(() => {
		if (entry.generation !== generation || entry.socket?.readyState !== 1) return;
		try {
			sendRaw(entry, 'ping', {client_ts: Date.now()});
		} catch (_) {
			// The close handler owns reconnect behavior.
		}
	}, PING_INTERVAL_MS);
};

const connectSocket = (entry) => {
	if (!entry.state.available || !entry.token || !entry.socketUrl || entry.socket?.readyState < 2) return;
	const WebSocketImpl = globalThis.WebSocket;
	if (!WebSocketImpl) return;
	entry.shouldReconnect = true;
	const generation = ++entry.generation;
	entry.state = {...entry.state, connectionState: 'connecting'};
	notifyState(entry);
	let socket;
	try {
		socket = new WebSocketImpl(appendClientId(entry.socketUrl, getPersistentClientId(entry.service)));
	} catch (_) {
		entry.state = {...entry.state, connectionState: 'unavailable'};
		notifyState(entry);
		return;
	}
	entry.socket = socket;
	socket.onopen = () => {
		if (entry.generation !== generation || entry.socket !== socket) return;
		entry.reconnectAttempt = 0;
		entry.state = {...entry.state, connectionState: 'open', lastError: null};
		notifyState(entry);
		try {
			sendRaw(entry, 'auth', {token: entry.token});
			sendRaw(entry, 'ping', {client_ts: Date.now()});
			sendRaw(entry, 'list_rooms');
			schedulePing(entry, generation);
		} catch (_) {
			socket.close();
		}
	};
	socket.onmessage = (event) => {
		if (entry.generation === generation) parseSocketMessage(entry, event.data);
	};
	socket.onerror = () => {};
	socket.onclose = () => {
		if (entry.generation !== generation || entry.socket !== socket) return;
		entry.socket = null;
		clearTimer(entry, 'pingTimer');
		entry.clock.reset();
		entry.state = {...entry.state, connectionState: 'closed', serverOffsetMs: 0};
		notifyState(entry);
		if (!entry.shouldReconnect) return;
		const exponentialDelay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * (2 ** entry.reconnectAttempt));
		entry.reconnectAttempt += 1;
		const jitteredDelay = Math.round(exponentialDelay * (0.8 + (Math.random() * 0.4)));
		entry.reconnectTimer = setTimeout(() => connectSocket(entry), jitteredDelay);
	};
};

const getStatus = (error) => {
	const status = Number(error?.status);
	return Number.isInteger(status) ? status : null;
};

const loadToken = async (entry) => {
	let data;
	try {
		data = await entry.service._request(TOKEN_ENDPOINT, {
			context: 'get JellyWatchParty token',
			suppressAuthHandling: true
		});
	} catch (error) {
		const status = getStatus(error);
		if (status === 404) return {available: false, reason: 'plugin-missing'};
		if ([401, 403].includes(status)) return {available: false, reason: 'token-unauthorized'};
		return {available: false, reason: 'token-unavailable'};
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return {available: false, reason: 'invalid-token-response'};
	}
	if (data.auth_enabled !== true) {
		return {available: false, reason: 'authentication-required'};
	}
	const token = typeof data.token === 'string' ? data.token.trim() : '';
	const socketUrl = validateSocketUrl(data.session_server_url);
	const expiresIn = Number(data.expires_in);
	if (
		!token || token.length > 16384 || !socketUrl ||
		!Number.isFinite(expiresIn) || expiresIn <= 0 ||
		compactText(data.user_id, 128) !== String(entry.service.userId)
	) {
		return {available: false, reason: 'invalid-token-response'};
	}
	entry.token = token;
	entry.tokenExpiresAt = Date.now() + (Math.min(expiresIn, 7 * 24 * 60 * 60) * 1000);
	entry.socketUrl = socketUrl;
	return {
		available: true,
		reason: 'available',
		hideNativeSyncButton: data.hide_native_sync_button === true
	};
};

const scheduleTokenRefresh = (entry) => {
	clearTimer(entry, 'refreshTimer');
	const lifetimeMs = Math.max(0, entry.tokenExpiresAt - Date.now());
	const leadMs = Math.min(TOKEN_REFRESH_LEAD_MS, lifetimeMs * 0.2);
	const delay = Math.max(TOKEN_REFRESH_FLOOR_MS, lifetimeMs - leadMs);
	entry.refreshTimer = setTimeout(async () => {
		if (sessions.get(entry.service) !== entry) return;
		try {
			const availability = await loadToken(entry);
			if (!availability.available) {
				stopSocket(entry, {clearRoom: true});
				entry.state = {...initialPublicState(), reason: availability.reason};
				notifyState(entry);
				return;
			}
			entry.state = {...entry.state, ...availability};
			if (entry.socket?.readyState === 1) sendRaw(entry, 'auth', {token: entry.token});
			else connectSocket(entry);
			scheduleTokenRefresh(entry);
		} catch (_) {
			stopSocket(entry, {clearRoom: true});
			entry.state = {...initialPublicState(), reason: 'token-refresh-failed'};
			notifyState(entry);
		}
	}, delay);
};

export const detectJellyWatchParty = async (service) => {
	const entry = getEntry(service);
	if (!entry) return {available: false, reason: 'unauthenticated', hideNativeSyncButton: false};
	if (!entry.availabilityPromise) {
		entry.availabilityPromise = (async () => {
			const availability = await loadToken(entry);
			entry.state = {...entry.state, ...availability};
			notifyState(entry);
			if (availability.available) {
				scheduleTokenRefresh(entry);
				connectSocket(entry);
			}
			return availability;
		})();
	}
	return entry.availabilityPromise;
};

export const getWatchPartyState = (service) => {
	const entry = getEntry(service);
	return entry ? clonePublicState(entry.state) : initialPublicState();
};

export const subscribeWatchPartyState = (service, listener) => {
	const entry = getEntry(service);
	if (!entry) {
		listener(initialPublicState());
		return () => {};
	}
	entry.listeners.add(listener);
	listener(clonePublicState(entry.state));
	return () => entry.listeners.delete(listener);
};

export const onWatchPartyMessage = (service, type, listener) => {
	const entry = getEntry(service);
	if (!entry || !type || typeof listener !== 'function') return () => {};
	let listeners = entry.messageListeners.get(type);
	if (!listeners) {
		listeners = new Set();
		entry.messageListeners.set(type, listeners);
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) entry.messageListeners.delete(type);
	};
};

export const listWatchPartyRooms = (service) => {
	const entry = getEntry(service);
	if (!entry) throw new Error('An authenticated Jellyfin session is required');
	sendRaw(entry, 'list_rooms');
};

export const createWatchPartyRoom = (service, {name, startPosition = 0, mediaId = '', password = ''} = {}) => {
	const entry = getEntry(service);
	if (!entry) throw new Error('An authenticated Jellyfin session is required');
	const roomName = compactText(name, 120);
	if (!roomName) throw new Error('Room name is required');
	const payload = {
		name: roomName,
		start_pos: Math.max(0, Number(startPosition) || 0),
		media_id: compactText(mediaId, 128)
	};
	const roomPassword = String(password || '').slice(0, 256);
	if (roomPassword) payload.password = roomPassword;
	entry.state = {...entry.state, lastError: null};
	notifyState(entry);
	sendRaw(entry, 'create_room', payload);
};

export const joinWatchPartyRoom = (service, roomId, password = '') => {
	const entry = getEntry(service);
	if (!entry) throw new Error('An authenticated Jellyfin session is required');
	const normalizedRoomId = compactText(roomId, 128);
	if (!normalizedRoomId) throw new Error('Room ID is required');
	const payload = {};
	const roomPassword = String(password || '').slice(0, 256);
	if (roomPassword) payload.password = roomPassword;
	entry.state = {...entry.state, lastError: null};
	notifyState(entry);
	sendRaw(entry, 'join_room', payload, normalizedRoomId);
};

export const leaveWatchPartyRoom = (service) => {
	const entry = getEntry(service);
	if (!entry?.state.room) return;
	sendRaw(entry, 'leave_room');
	entry.state = {...entry.state, room: null, chat: []};
	notifyState(entry);
};

export const sendWatchPartyReady = (service, mediaId) => {
	const entry = getEntry(service);
	if (!entry?.state.room) return;
	sendRaw(entry, 'ready', {media_id: compactText(mediaId, 128)});
};

export const sendWatchPartyPlayerEvent = (service, action, position) => {
	const entry = getEntry(service);
	if (!entry?.state.room?.isHost) return;
	if (!['play', 'pause', 'seek', 'buffering'].includes(action)) return;
	sendRaw(entry, 'player_event', {action, position: Math.max(0, Number(position) || 0)});
};

export const sendWatchPartyStateUpdate = (service, position, playing) => {
	const entry = getEntry(service);
	if (!entry?.state.room?.isHost) return;
	sendRaw(entry, 'state_update', {
		position: Math.max(0, Number(position) || 0),
		play_state: playing ? 'playing' : 'paused'
	});
};

export const sendWatchPartyChat = (service, text) => {
	const entry = getEntry(service);
	if (!entry?.state.room) throw new Error('Join a room before sending chat');
	const message = String(text || '').trim();
	if (!message) throw new Error('Chat message cannot be empty');
	if (message.length > MAX_CHAT_LENGTH) throw new Error(`Chat messages are limited to ${MAX_CHAT_LENGTH} characters`);
	sendRaw(entry, 'chat_message', {text: message});
};

export const getWatchPartyServerNow = (service) => Date.now() + getWatchPartyState(service).serverOffsetMs;

export const stopJellyWatchParty = (service) => {
	const entry = sessions.get(service);
	if (!entry) return;
	stopSocket(entry, {clearRoom: true});
	sessions.delete(service);
};
