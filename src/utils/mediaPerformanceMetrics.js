const IMAGE_LATENCY_SAMPLE_LIMIT = 20;
const METRIC_NOTIFY_INTERVAL_MS = 250;

const imageRecords = new Map();
const gridRecords = new Map();
const listeners = new Set();
const imageLatencySamples = [];
let notifyTimer = null;

const toAverage = (values) => {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const buildSnapshot = () => {
	let pendingImages = 0;
	let failedImages = 0;
	imageRecords.forEach((record) => {
		if (record.status === 'pending') pendingImages += 1;
		if (record.status === 'failed') failedImages += 1;
	});

	const activeOverhangs = [...gridRecords.values()]
		.filter((record) => record.active)
		.map((record) => record.overhang)
		.filter(Number.isFinite);

	return {
		mountedCards: imageRecords.size,
		pendingImages,
		failedImages,
		imageLoadLatency: Math.round(toAverage(imageLatencySamples)),
		gridOverhang: activeOverhangs.length > 0
			? [...new Set(activeOverhangs)].sort((left, right) => left - right).join('/')
			: '-'
	};
};

const flushNotify = () => {
	notifyTimer = null;
	if (listeners.size === 0) return;
	const snapshot = buildSnapshot();
	listeners.forEach((listener) => listener(snapshot));
};

const notify = () => {
	if (listeners.size === 0 || notifyTimer !== null) return;
	notifyTimer = setTimeout(flushNotify, METRIC_NOTIFY_INTERVAL_MS);
};

export const registerMediaCardImage = (token, status = 'pending') => {
	if (!token) return;
	imageRecords.set(token, {status});
	notify();
};

export const updateMediaCardImage = (token, status, latencyMs = null) => {
	if (!token || !imageRecords.has(token)) return;
	imageRecords.set(token, {status});
	if (status === 'loaded' && Number.isFinite(latencyMs)) {
		imageLatencySamples.push(Math.max(0, latencyMs));
		if (imageLatencySamples.length > IMAGE_LATENCY_SAMPLE_LIMIT) {
			imageLatencySamples.splice(0, imageLatencySamples.length - IMAGE_LATENCY_SAMPLE_LIMIT);
		}
	}
	notify();
};

export const unregisterMediaCardImage = (token) => {
	if (!token || !imageRecords.delete(token)) return;
	notify();
};

export const registerMediaGridProfile = (token, profile) => {
	if (!token) return;
	gridRecords.set(token, {
		overhang: Number(profile?.overhang),
		active: profile?.active === true
	});
	notify();
};

export const unregisterMediaGridProfile = (token) => {
	if (!token || !gridRecords.delete(token)) return;
	notify();
};

export const resetMediaPerformanceMetrics = () => {
	imageRecords.clear();
	gridRecords.clear();
	imageLatencySamples.length = 0;
	if (notifyTimer !== null) {
		clearTimeout(notifyTimer);
		notifyTimer = null;
	}
	if (listeners.size > 0) {
		const snapshot = buildSnapshot();
		listeners.forEach((listener) => listener(snapshot));
	}
};

export const getMediaPerformanceSnapshot = () => buildSnapshot();

export const subscribeMediaPerformanceMetrics = (listener) => {
	if (typeof listener !== 'function') return () => {};
	listeners.add(listener);
	listener(buildSnapshot());
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && notifyTimer !== null) {
			clearTimeout(notifyTimer);
			notifyTimer = null;
		}
	};
};
