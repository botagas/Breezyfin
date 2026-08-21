import {
	createWatchPartyRoom,
	detectJellyWatchParty,
	getWatchPartyState,
	joinWatchPartyRoom,
	sendWatchPartyChat,
	stopJellyWatchParty
} from '../jellyfin/watchPartyApi';

class FakeWebSocket {
	static instances = [];

	constructor(url) {
		this.url = url;
		this.readyState = 0;
		this.sent = [];
		FakeWebSocket.instances.push(this);
	}

	open() {
		this.readyState = 1;
		this.onopen?.();
	}

	receive(message) {
		this.onmessage?.({data: JSON.stringify(message)});
	}

	send(value) {
		this.sent.push(JSON.parse(value));
	}

	close() {
		this.readyState = 3;
		this.onclose?.({code: 1000});
	}
}

const createService = (response) => ({
	serverUrl: 'https://jellyfin.test',
	userId: 'user-1',
	accessToken: 'jellyfin-token',
	_request: jest.fn().mockResolvedValue(response)
});

const tokenResponse = (overrides = {}) => ({
	token: 'signed-session-token',
	auth_enabled: true,
	expires_in: 3600,
	user_id: 'user-1',
	user_name: 'Viewer',
	session_server_url: 'wss://party.test/ws',
	hide_native_sync_button: false,
	...overrides
});

describe('JellyWatchParty protocol client', () => {
	beforeEach(() => {
		FakeWebSocket.instances = [];
		global.WebSocket = FakeWebSocket;
		localStorage.clear();
	});

	afterEach(() => {
		delete global.WebSocket;
	});

	it('requires plugin JWT authentication and a safe WebSocket URL', async () => {
		const authDisabled = createService(tokenResponse({auth_enabled: false, token: null}));
		await expect(detectJellyWatchParty(authDisabled)).resolves.toMatchObject({
			available: false,
			reason: 'authentication-required'
		});
		expect(FakeWebSocket.instances).toHaveLength(0);

		const unsafe = createService(tokenResponse({session_server_url: 'https://party.test/ws'}));
		await expect(detectJellyWatchParty(unsafe)).resolves.toMatchObject({
			available: false,
			reason: 'invalid-token-response'
		});
		expect(FakeWebSocket.instances).toHaveLength(0);
	});

	it.each([401, 403])('treats token endpoint HTTP %i as feature unavailability', async (status) => {
		const service = createService(tokenResponse());
		service._request.mockRejectedValueOnce(Object.assign(
			new Error(`JellyWatchParty token failed with status ${status}`),
			{status}
		));

		await expect(detectJellyWatchParty(service)).resolves.toMatchObject({
			available: false,
			reason: 'token-unauthorized'
		});
		expect(service._request).toHaveBeenCalledWith(
			'/JellyWatchParty/Token',
			expect.objectContaining({
				context: 'get JellyWatchParty token',
				suppressAuthHandling: true
			})
		);
	});

	it('persists only a scoped client UUID and keeps the JWT out of the socket URL', async () => {
		const service = createService(tokenResponse({hide_native_sync_button: true}));
		await expect(detectJellyWatchParty(service)).resolves.toMatchObject({
			available: true,
			hideNativeSyncButton: true
		});
		const socket = FakeWebSocket.instances[0];
		expect(socket.url).toMatch(/^wss:\/\/party\.test\/ws\?client_id=/);
		expect(socket.url).not.toContain('signed-session-token');
		expect(Object.values(localStorage)).not.toContain('signed-session-token');

		socket.open();
		expect(socket.sent[0]).toEqual({
			type: 'auth',
			payload: {token: 'signed-session-token'},
			ts: expect.any(Number)
		});
		stopJellyWatchParty(service);
	});

	it('tracks room lifecycle and retains no more than 50 chat messages', async () => {
		const service = createService(tokenResponse());
		await detectJellyWatchParty(service);
		const socket = FakeWebSocket.instances[0];
		socket.open();
		socket.receive({type: 'client_hello', client: 'socket-client', payload: {client_id: 'socket-client'}});
		socket.receive({
			type: 'room_state',
			room: 'room-1',
			client: 'socket-client',
			server_ts: Date.now(),
			payload: {
				name: 'Movie Night',
				host_id: 'socket-client',
				participant_count: 2,
				media_id: 'item-1',
				state: {position: 12, play_state: 'paused'},
				chat_history: []
			}
		});
		expect(getWatchPartyState(service).room).toMatchObject({id: 'room-1', isHost: true, mediaId: 'item-1'});

		for (let index = 0; index < 60; index += 1) {
			socket.receive({
				type: 'chat_message',
				room: 'room-1',
				client: `client-${index}`,
				server_ts: index,
				payload: {username: 'Viewer', text: `Message ${index}`}
			});
		}
		const chat = getWatchPartyState(service).chat;
		expect(chat).toHaveLength(50);
		expect(chat[0].text).toBe('Message 10');
		expect(() => sendWatchPartyChat(service, 'x'.repeat(501))).toThrow(/500/);
		stopJellyWatchParty(service);
	});

	it('never includes passwords in retained public state', async () => {
		const service = createService(tokenResponse());
		await detectJellyWatchParty(service);
		const socket = FakeWebSocket.instances[0];
		socket.open();
		createWatchPartyRoom(service, {name: 'Private', password: 'create-secret'});
		joinWatchPartyRoom(service, 'room-2', 'join-secret');
		expect(JSON.stringify(getWatchPartyState(service))).not.toMatch(/create-secret|join-secret/);
		stopJellyWatchParty(service);
	});
});
