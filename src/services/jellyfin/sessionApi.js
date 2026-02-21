import serverManager from '../serverManager';
import {APP_VERSION} from '../../utils/appInfo';

const LEGACY_AUTH_KEY = 'jellyfinAuth';

const clearRuntimeSession = (service) => {
	service.api = null;
	service.userId = null;
	service.serverUrl = null;
	service.accessToken = null;
	service.serverName = null;
	service.username = null;
	service.sessionExpiredNotified = false;
};

export const applySessionFromStore = (service, entry) => {
	if (!entry) return false;
	service.serverUrl = entry.url;
	service.accessToken = entry.accessToken;
	service.userId = entry.userId;
	service.serverName = entry.serverName;
	service.username = entry.username;
	service.api = service.jellyfin.createApi(entry.url, entry.accessToken);
	service.sessionExpiredNotified = false;
	return true;
};

export const connectToServer = async (service, serverUrl) => {
	try {
		service.serverUrl = serverUrl;
		service.api = service.jellyfin.createApi(serverUrl);
		const response = await fetch(`${serverUrl}/System/Info/Public`);
		if (!response.ok) throw new Error('Server not reachable');

		const info = await response.json();
		service.serverName = info?.ServerName || info?.Name || serverUrl;
		return info;
	} catch (error) {
		console.error('Failed to connect to server:', error);
		throw error;
	}
};

export const authenticateWithServer = async (service, username, password) => {
	try {
		const response = await fetch(
			`${service.serverUrl}/Users/AuthenticateByName`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Emby-Authorization': `MediaBrowser Client="Breezyfin", Device="webOS", DeviceId="breezyfin-webos", Version="${APP_VERSION}"`
				},
				body: JSON.stringify({
					Username: username,
					Pw: password
				})
			}
		);

		const data = await response.json();

		if (data.AccessToken) {
			service.accessToken = data.AccessToken;
			service.userId = data.User.Id;
			service.username = data.User?.Name || username;
			service.serverName = data?.ServerName || service.serverName || service.serverUrl;
			service.sessionExpiredNotified = false;

			service.api.accessToken = service.accessToken;
			localStorage.setItem(LEGACY_AUTH_KEY, JSON.stringify({
				serverUrl: service.serverUrl,
				accessToken: service.accessToken,
				userId: service.userId
			}));

			const saved = serverManager.addServer({
				serverUrl: service.serverUrl,
				serverName: service.serverName,
				userId: service.userId,
				username: service.username,
				accessToken: service.accessToken,
				avatarTag: data.User?.PrimaryImageTag || null
			});
			if (saved) {
				serverManager.setActiveServer(saved.serverId, saved.userId);
			}

			return data.User;
		}
	} catch (error) {
		console.error('Authentication failed:', error);
		throw error;
	}
};

export const restoreServiceSession = (service, serverId = null, userId = null) => {
	const active = serverManager.getActiveServer(serverId, userId);
	if (active && active.activeUser) {
		return applySessionFromStore(service, {
			url: active.url,
			accessToken: active.activeUser.accessToken,
			userId: active.activeUser.userId,
			serverName: active.name,
			username: active.activeUser.username
		});
	}

	const stored = localStorage.getItem(LEGACY_AUTH_KEY);
	if (stored) {
		let parsedLegacySession = null;
		try {
			parsedLegacySession = JSON.parse(stored);
		} catch (error) {
			console.warn('[jellyfinService] Failed to parse legacy jellyfinAuth payload:', error);
			localStorage.removeItem(LEGACY_AUTH_KEY);
			return false;
		}
		const { serverUrl, accessToken, userId: storedUserId } = parsedLegacySession || {};
		if (!serverUrl || !accessToken || !storedUserId) {
			localStorage.removeItem(LEGACY_AUTH_KEY);
			return false;
		}
		service.serverUrl = serverUrl;
		service.accessToken = accessToken;
		service.userId = storedUserId;
		service.api = service.jellyfin.createApi(serverUrl, accessToken);

		const saved = serverManager.addServer({
			serverUrl,
			serverName: serverUrl,
			userId: storedUserId,
			username: 'User',
			accessToken: accessToken,
			avatarTag: null
		});
		if (saved) {
			serverManager.setActiveServer(saved.serverId, saved.userId);
		}
		return true;
	}
	return false;
};

export const logoutSession = (service) => {
	localStorage.removeItem(LEGACY_AUTH_KEY);
	const active = serverManager.getActiveServer();
	if (active?.id && active?.activeUser?.userId) {
		serverManager.removeUser(active.id, active.activeUser.userId);
	}
	serverManager.clearActive();
	clearRuntimeSession(service);
};

export const switchUserSession = (service) => {
	localStorage.removeItem(LEGACY_AUTH_KEY);
	serverManager.clearActive();
	clearRuntimeSession(service);
};

export const setActiveServiceServer = (service, serverId, userId) => {
	const active = serverManager.setActiveServer(serverId, userId);
	if (!active || !active.activeUser) {
		throw new Error('Server selection failed: not found');
	}
	return applySessionFromStore(service, {
		url: active.url,
		accessToken: active.activeUser.accessToken,
		userId: active.activeUser.userId,
		serverName: active.name,
		username: active.activeUser.username
	});
};

export const listSavedServers = () => {
	return serverManager.listServers();
};

export const forgetServiceServer = (service, serverId, userId) => {
	serverManager.removeUser(serverId, userId);
	const active = serverManager.getActiveServer();
	if (!active || !active.activeUser) {
		clearRuntimeSession(service);
	}
};

export const getCurrentServiceUser = async (service) => {
	if (!service.userId) return null;
	try {
		const user = await service._request(`/Users/${service.userId}`, {
			context: 'getCurrentUser'
		});
		const active = serverManager.getActiveServer();
		if (active?.id && active?.activeUser?.userId) {
			serverManager.updateUser(active.id, active.activeUser.userId, {
				username: user?.Name || active.activeUser.username || 'User',
				avatarTag: user?.PrimaryImageTag || null
			});
		}
		return user;
	} catch (err) {
		console.error('Failed to get current user:', err);
		return null;
	}
};
