const DEVICE_ID_STORAGE_KEY = 'breezyfin_device_id';
const DEVICE_ID_PREFIX = 'breezyfin-webos';

let cachedDeviceId = null;

const getStorage = () => {
	if (typeof window !== 'undefined' && window?.localStorage) {
		return window.localStorage;
	}
	if (typeof localStorage !== 'undefined') {
		return localStorage;
	}
	return null;
};

const normalizeDeviceId = (value) => {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized || null;
};

const readStoredDeviceId = () => {
	const storage = getStorage();
	if (!storage) return null;
	try {
		return normalizeDeviceId(storage.getItem(DEVICE_ID_STORAGE_KEY));
	} catch (error) {
		return null;
	}
};

const writeStoredDeviceId = (deviceId) => {
	const storage = getStorage();
	if (!storage) return false;
	try {
		storage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
		return true;
	} catch (error) {
		return false;
	}
};

const createGeneratedDeviceId = () => (
	`${DEVICE_ID_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
);

export const getDeviceId = () => {
	if (cachedDeviceId) return cachedDeviceId;

	const storedDeviceId = readStoredDeviceId();
	if (storedDeviceId) {
		cachedDeviceId = storedDeviceId;
		return cachedDeviceId;
	}

	const generatedDeviceId = createGeneratedDeviceId();
	cachedDeviceId = generatedDeviceId;
	writeStoredDeviceId(generatedDeviceId);
	return cachedDeviceId;
};

