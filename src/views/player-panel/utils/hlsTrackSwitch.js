export const HLS_TRACK_SWITCH_TIMEOUT_MS = 5000;

const getEventTrackId = (data) => {
	const candidate = data?.id ?? data?.trackId ?? data?.index;
	return Number.isInteger(candidate) ? candidate : Number(candidate);
};

export const waitForHlsTrackSwitch = ({
	hls,
	eventName,
	expectedTrackId,
	apply,
	isCurrent,
	timeoutMs = HLS_TRACK_SWITCH_TIMEOUT_MS
}) => new Promise((resolve) => {
	if (!hls || !eventName || typeof apply !== 'function') {
		resolve({confirmed: false, reason: 'invalid-switch-context'});
		return;
	}
	let timer = null;
	let settled = false;
	let onSwitched = null;
	const finish = (confirmed, reason, data = null) => {
		if (settled) return;
		settled = true;
		if (timer) clearTimeout(timer);
		hls.off?.(eventName, onSwitched);
		resolve({confirmed, reason, data});
	};
	onSwitched = (event, data) => {
		if (isCurrent?.() === false) return finish(false, 'stale-source', data);
		const actualTrackId = getEventTrackId(data);
		if (actualTrackId !== expectedTrackId) return;
		finish(true, 'event-confirmed', data);
	};
	hls.on?.(eventName, onSwitched);
	timer = setTimeout(() => finish(false, 'event-timeout'), timeoutMs);
	try {
		apply();
	} catch (error) {
		finish(false, error?.message || 'switch-assignment-failed');
	}
});
