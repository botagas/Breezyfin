const SERVERS_KEY = 'breezyfin_servers';
const ACTIVE_SERVER_KEY = 'breezyfin_active_server';
const ACTIVE_USER_KEY = 'breezyfin_active_user';

const safeJsonParse = (value, fallback) => {
	try {
		return JSON.parse(value);
	} catch (err) {
		console.warn('[serverManager] Failed to parse persisted servers:', err);
		return fallback;
	}
};

const loadServers = () => {
	const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SERVERS_KEY) : null;
	return raw ? safeJsonParse(raw, {}) : {};
};

const saveServers = (servers) => {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
	} catch (err) {
		console.warn('[serverManager] Failed to persist servers:', err);
	}
};

const persistActive = (serverId, userId) => {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(ACTIVE_SERVER_KEY, serverId || '');
	localStorage.setItem(ACTIVE_USER_KEY, userId || '');
};

const generateId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const getActiveIds = () => {
	if (typeof localStorage === 'undefined') return { serverId: null, userId: null };
	return {
		serverId: localStorage.getItem(ACTIVE_SERVER_KEY),
		userId: localStorage.getItem(ACTIVE_USER_KEY)
	};
};

const getActiveServer = (serverIdOverride, userIdOverride) => {
	const servers = loadServers();
	const { serverId: storedServerId, userId: storedUserId } = getActiveIds();
	const serverId = serverIdOverride || storedServerId;
	const userId = userIdOverride || storedUserId;

	if (!serverId || !userId) return null;
	const server = servers[serverId];
	if (!server || !server.users || !server.users[userId]) return null;

	const user = server.users[userId];
	return {
		...server,
		activeUser: {
			...user
		}
	};
};

const addServer = ({ serverUrl, serverName, userId, username, accessToken, avatarTag = null }) => {
	if (!serverUrl || !userId || !accessToken) {
		console.warn('[serverManager] Missing required fields to add server');
		return null;
	}

	const servers = loadServers();

	let serverId = Object.keys(servers).find((key) => servers[key].url === serverUrl) || null;
	if (!serverId) {
		serverId = generateId('srv');
		servers[serverId] = {
			id: serverId,
			url: serverUrl,
			name: serverName || serverUrl,
			addedDate: new Date().toISOString(),
			users: {}
		};
	}

	const userEntry = {
		userId,
		username: username || 'User',
		accessToken,
		avatarTag: avatarTag || servers[serverId]?.users?.[userId]?.avatarTag || null,
		addedDate: servers[serverId]?.users?.[userId]?.addedDate || new Date().toISOString(),
		lastConnected: new Date().toISOString()
	};

	servers[serverId].name = serverName || servers[serverId].name || serverUrl;
	servers[serverId].users = servers[serverId].users || {};
	servers[serverId].users[userId] = userEntry;

	saveServers(servers);
	return { serverId, userId };
};

const updateUser = (serverId, userId, patch = {}) => {
	const servers = loadServers();
	if (!servers[serverId] || !servers[serverId].users[userId]) return false;

	servers[serverId].users[userId] = {
		...servers[serverId].users[userId],
		...patch,
		lastConnected: new Date().toISOString()
	};
	saveServers(servers);
	return true;
};

const setActiveServer = (serverId, userId) => {
	const servers = loadServers();
	if (!servers[serverId] || !servers[serverId].users[userId]) {
		return null;
	}
	servers[serverId].users[userId].lastConnected = new Date().toISOString();
	saveServers(servers);
	persistActive(serverId, userId);
	return getActiveServer(serverId, userId);
};

const clearActive = () => {
	persistActive('', '');
};

const removeUser = (serverId, userId) => {
	const servers = loadServers();
	if (!servers[serverId] || !servers[serverId].users[userId]) return;

	delete servers[serverId].users[userId];
	if (Object.keys(servers[serverId].users).length === 0) {
		delete servers[serverId];
	}
	saveServers(servers);

	const { serverId: activeId, userId: activeUserId } = getActiveIds();
	if (activeId === serverId && activeUserId === userId) {
		clearActive();
	}
};

const listServers = () => {
	const servers = loadServers();
	const { serverId: activeServerId, userId: activeUserId } = getActiveIds();
	const result = [];

	Object.keys(servers).forEach((sid) => {
		const server = servers[sid];
		Object.keys(server.users || {}).forEach((uid) => {
			const user = server.users[uid];
				result.push({
					serverId: sid,
					serverName: server.name,
					url: server.url,
					userId: uid,
					username: user.username,
					accessToken: user.accessToken,
					avatarTag: user.avatarTag || null,
					addedDate: user.addedDate,
					lastConnected: user.lastConnected,
					isActive: sid === activeServerId && uid === activeUserId
				});
		});
	});

	return result.sort((a, b) => (b.lastConnected || '').localeCompare(a.lastConnected || ''));
};

const getServerById = (serverId) => {
	const servers = loadServers();
	return servers[serverId] || null;
};

export default {
	addServer,
	clearActive,
	getActiveServer,
	getServerById,
	listServers,
	loadServers,
	removeUser,
	setActiveServer,
	updateUser
};
