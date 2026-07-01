const VIDEO_SOURCE_EVENTS = ['loadstart', 'loadedmetadata', 'canplay', 'emptied', 'error'];
const HAVE_METADATA = 1;

export const hasAttachedVideoSource = (videoElement) => Boolean(
	videoElement &&
	(
		videoElement.currentSrc ||
		videoElement.src ||
		videoElement.getAttribute?.('src') ||
		videoElement.srcObject ||
		videoElement.readyState >= HAVE_METADATA
	)
);

export const waitForAttachedVideoSource = (
	videoElement,
	{
		timeoutMs = 3500,
		isCancelled = () => false
	} = {}
) => new Promise((resolve) => {
	const startedAt = Date.now();
	if (!videoElement) {
		resolve({
			status: 'missing-video',
			waitedMs: 0
		});
		return;
	}
	if (hasAttachedVideoSource(videoElement)) {
		resolve({
			status: 'ready',
			waitedMs: 0
		});
		return;
	}

	let settled = false;
	let intervalId = null;
	let timeoutId = null;

	const cleanup = () => {
		VIDEO_SOURCE_EVENTS.forEach((eventName) => {
			videoElement.removeEventListener(eventName, checkSource);
		});
		if (intervalId) clearInterval(intervalId);
		if (timeoutId) clearTimeout(timeoutId);
	};

	const settle = (status) => {
		if (settled) return;
		settled = true;
		cleanup();
		resolve({
			status,
			waitedMs: Date.now() - startedAt
		});
	};

	function checkSource() {
		if (isCancelled()) {
			settle('cancelled');
			return;
		}
		if (hasAttachedVideoSource(videoElement)) {
			settle('ready');
		}
	}

	VIDEO_SOURCE_EVENTS.forEach((eventName) => {
		videoElement.addEventListener(eventName, checkSource);
	});
	intervalId = setInterval(checkSource, 50);
	timeoutId = setTimeout(() => {
		checkSource();
		if (!settled) settle(isCancelled() ? 'cancelled' : 'timeout');
	}, timeoutMs);
});
