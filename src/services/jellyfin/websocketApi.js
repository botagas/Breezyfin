import {invalidateWatchlistCache, notifyUserDataInvalidated} from './watchlistApi';

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const KEEPALIVE_INTERVAL_MS = 30000;

const getSocketUrl = (service) => {
	const base = new URL(service.serverUrl);
	base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
	base.pathname = `${base.pathname.replace(/\/$/, '')}/socket`;
	base.search = '';
	base.searchParams.set('api_key', service.accessToken);
	base.searchParams.set('deviceId', service.getDeviceId());
	return base.toString();
};

export class JellyfinWebSocketSession {
	constructor(service, options = {}) {
		this.service = service;
		this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
		this.random = options.random || Math.random;
		this.socket = null;
		this.generation = 0;
		this.reconnectAttempt = 0;
		this.reconnectTimer = null;
		this.keepaliveTimer = null;
		this.shouldRun = false;
		this.listeners = new Map();
	}

	on(messageType, handler) {
		if (typeof handler !== 'function') return () => {};
		const handlers = this.listeners.get(messageType) || new Set();
		handlers.add(handler);
		this.listeners.set(messageType, handlers);
		return () => {
			handlers.delete(handler);
			if (handlers.size === 0) this.listeners.delete(messageType);
		};
	}

	_emit(messageType, payload) {
		const handlers = this.listeners.get(messageType);
		if (!handlers) return;
		handlers.forEach((handler) => {
			try {
				handler(payload);
			} catch (_) {
				// A domain handler must not break the shared socket lifecycle.
			}
		});
	}

	start() {
		if (this.shouldRun) return;
		if (!this.WebSocketImpl || !this.service?.serverUrl || !this.service?.accessToken) return;
		this.shouldRun = true;
		this.generation += 1;
		this._connect(this.generation);
	}

	stop() {
		this.shouldRun = false;
		this.generation += 1;
		clearTimeout(this.reconnectTimer);
		clearInterval(this.keepaliveTimer);
		this.reconnectTimer = null;
		this.keepaliveTimer = null;
		const socket = this.socket;
		this.socket = null;
		if (socket && socket.readyState < 2) socket.close(1000, 'Session ended');
		this._emit('ConnectionStateChanged', {state: 'closed'});
	}

	_connect(generation) {
		if (!this.shouldRun || generation !== this.generation) return;
		let socket;
		try {
			socket = new this.WebSocketImpl(getSocketUrl(this.service));
		} catch (_) {
			this._scheduleReconnect(generation);
			return;
		}
		this.socket = socket;
		this._emit('ConnectionStateChanged', {state: 'connecting'});
		socket.onopen = () => {
			if (generation !== this.generation || socket !== this.socket) return;
			this.reconnectAttempt = 0;
			this._emit('ConnectionStateChanged', {state: 'open'});
			clearInterval(this.keepaliveTimer);
			this.keepaliveTimer = setInterval(() => {
				this.send({MessageType: 'KeepAlive'});
			}, KEEPALIVE_INTERVAL_MS);
		};
		socket.onmessage = (event) => {
			if (generation !== this.generation || socket !== this.socket) return;
			let message;
			try {
				message = JSON.parse(event.data);
			} catch (_) {
				return;
			}
			const type = message?.MessageType;
			if (typeof type !== 'string') return;
			if (type === 'UserDataChanged') {
				invalidateWatchlistCache(this.service);
				notifyUserDataInvalidated(message?.Data?.ItemIds || []);
			}
			this._emit(type, message);
		};
		socket.onerror = () => {
			if (generation === this.generation) this._emit('ConnectionStateChanged', {state: 'error'});
		};
		socket.onclose = () => {
			if (generation !== this.generation || socket !== this.socket) return;
			this.socket = null;
			clearInterval(this.keepaliveTimer);
			this.keepaliveTimer = null;
			this._emit('ConnectionStateChanged', {state: 'closed'});
			this._scheduleReconnect(generation);
		};
	}

	_scheduleReconnect(generation) {
		if (!this.shouldRun || generation !== this.generation) return;
		const exponential = Math.min(
			RECONNECT_MAX_DELAY_MS,
			RECONNECT_BASE_DELAY_MS * (2 ** this.reconnectAttempt)
		);
		const jittered = Math.round(exponential * (0.75 + (this.random() * 0.5)));
		this.reconnectAttempt += 1;
		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = setTimeout(() => this._connect(generation), jittered);
	}

	send(message) {
		if (!message || this.socket?.readyState !== 1) return false;
		this.socket.send(JSON.stringify(message));
		return true;
	}
}

export const startJellyfinWebSocket = (service) => {
	if (service.webSocketSession) service.webSocketSession.stop();
	service.webSocketSession = new JellyfinWebSocketSession(service);
	service.webSocketSession.start();
	return service.webSocketSession;
};

export const stopJellyfinWebSocket = (service) => {
	service.webSocketSession?.stop();
	service.webSocketSession = null;
};
