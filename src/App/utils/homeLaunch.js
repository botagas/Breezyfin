const GUID = /^[0-9a-f]{32}$/i;
const normalizeId = (value) => typeof value === 'string' ? value.replace(/-/g, '').toLowerCase() : '';

export const parseHomeLaunch = (params) => {
	if (typeof params === 'string') {
		if (!params.trim()) return null;
		if (params.length > 8192) throw new Error('The Home playback request is invalid.');
		try { params = JSON.parse(params); } catch (_) { throw new Error('The Home playback request is invalid.'); }
	}
	if (!params?.breezyfinHome) return null;
	const value = params.breezyfinHome;
	const itemId = normalizeId(value.itemId);
	const serverId = normalizeId(value.serverId);
	const userId = normalizeId(value.userId);
	if (value.version !== 1 || value.action !== 'play') throw new Error('Update Home and Breezyfin to use compatible playback requests.');
	if (![itemId, serverId, userId].every((id) => GUID.test(id)) ||
		typeof value.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.requestId)) {
		throw new Error('The Home playback request is invalid.');
	}
	let url;
	try { url = new URL(value.serverUrl); } catch (_) { throw new Error('The Home server address is invalid.'); }
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
		throw new Error('The Home server address is invalid.');
	}
	return {version: 1, action: 'play', requestId: value.requestId, itemId, serverId, userId, serverUrl: url.href.replace(/\/+$/, '')};
};

export const createHomeLaunchInbox = () => {
	let snapshot = {request: null, error: ''};
	const seen = new Set();
	const listeners = new Set();
	const publish = (next) => { snapshot = next; listeners.forEach((listener) => listener()); };
	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
		clear: () => publish({request: null, error: ''}),
		receive: (params) => {
			try {
				const request = parseHomeLaunch(params);
				if (!request || seen.has(request.requestId)) return;
				seen.add(request.requestId);
				if (seen.size > 128) seen.delete(seen.values().next().value);
				publish({request, error: ''});
			} catch (error) { publish({request: null, error: error.message}); }
		}
	};
};

export const homeLaunchInbox = createHomeLaunchInbox();

export const installHomeLaunchListener = (targetWindow, targetDocument, inbox = homeLaunchInbox) => {
	const receive = (event) => inbox.receive(event.detail);
	targetDocument.addEventListener('webOSLaunch', receive, true);
	targetDocument.addEventListener('webOSRelaunch', receive, true);
	try { inbox.receive((targetWindow.webOSSystem || targetWindow.PalmSystem)?.launchParams); } catch (_) { /* Events remain available. */ }
	return () => {
		targetDocument.removeEventListener('webOSLaunch', receive, true);
		targetDocument.removeEventListener('webOSRelaunch', receive, true);
	};
};
