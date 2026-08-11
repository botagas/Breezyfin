const EARLY_PLAYBACK_WINDOW_MS = 10000;

const getSourceKey = (sourceToken) => {
	if (!sourceToken) return '';
	return [
		sourceToken.generation,
		sourceToken.sourceGeneration,
		sourceToken.itemId,
		sourceToken.mediaSourceId
	].join(':');
};

export const getBufferedSecondsAhead = (video) => {
	const currentTime = Number(video?.currentTime) || 0;
	const buffered = video?.buffered;
	if (!buffered || !Number.isInteger(buffered.length) || buffered.length <= 0) return 0;
	for (let index = 0; index < buffered.length; index += 1) {
		const start = Number(buffered.start(index));
		const end = Number(buffered.end(index));
		if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
		if (currentTime >= start && currentTime <= end) {
			return Math.max(0, end - currentTime);
		}
	}
	return 0;
};

const getFragmentType = (fragment) => {
	const type = String(fragment?.type || fragment?.elementaryStreams || 'unknown').trim();
	return type || 'unknown';
};

const isMainVideoFragment = (fragment) => {
	const type = getFragmentType(fragment).toLowerCase();
	return type === 'main' || type.includes('video');
};

const isAlternateAudioFragment = (fragment) => {
	const type = getFragmentType(fragment).toLowerCase();
	return type === 'audio' || type.includes('audio');
};

export const createHlsStartupMeasurements = ({
	enabled = false,
	appendDiagnostic,
	now = () => Date.now()
} = {}) => {
	let record = null;

	const isCurrent = (sourceToken) => Boolean(
		enabled &&
		record &&
		record.sourceToken === sourceToken &&
		record.key === getSourceKey(sourceToken)
	);

	const append = (stage, status, reason, message) => {
		if (!enabled) return;
		appendDiagnostic?.({
			scope: 'hls-startup-measurement',
			stage,
			status,
			reason,
			message
		});
	};

	return {
		begin (sourceToken) {
			if (!enabled || !sourceToken) return false;
			record = {
				key: getSourceKey(sourceToken),
				sourceToken,
				attachedAt: now(),
				mediaAttachedAt: null,
				manifestAt: null,
				firstFragmentAt: null,
				firstFragmentType: null,
				firstMainVideoAt: null,
				firstAlternateAudioAt: null,
				engineReadyAt: null,
				bufferedSecondsAtReady: 0,
				playingAt: null,
				firstTimelineProgressAt: null,
				earlyRecoveryReasons: []
			};
			return true;
		},

		mediaAttached (sourceToken) {
			if (!isCurrent(sourceToken) || record.mediaAttachedAt !== null) return false;
			record.mediaAttachedAt = now();
			return true;
		},

		manifestParsed (sourceToken) {
			if (!isCurrent(sourceToken) || record.manifestAt !== null) return false;
			record.manifestAt = now();
			return true;
		},

		fragmentBuffered (sourceToken, fragment, video) {
			if (!isCurrent(sourceToken)) return false;
			const timestamp = now();
			if (record.firstFragmentAt === null) {
				record.firstFragmentAt = timestamp;
				record.firstFragmentType = getFragmentType(fragment);
			}
			if (record.firstMainVideoAt === null && isMainVideoFragment(fragment)) {
				record.firstMainVideoAt = timestamp;
			}
			if (record.firstAlternateAudioAt === null && isAlternateAudioFragment(fragment)) {
				record.firstAlternateAudioAt = timestamp;
			}
			if (record.engineReadyAt === null) {
				record.engineReadyAt = timestamp;
				record.bufferedSecondsAtReady = getBufferedSecondsAhead(video);
				append(
					'engine-ready',
					'ready',
					record.firstFragmentType,
					`First fragment=${record.firstFragmentType}; attached-to-buffered=${timestamp - record.attachedAt} ms; buffered=${record.bufferedSecondsAtReady.toFixed(3)} s.`
				);
			}
			return true;
		},

		playbackSignal (sourceToken, signal) {
			if (!isCurrent(sourceToken)) return false;
			const timestamp = now();
			let firstEvidence = false;
			if ((signal === 'playing' || signal === 'playing-event') && record.playingAt === null) {
				record.playingAt = timestamp;
				firstEvidence = true;
			}
			if (signal === 'timeline-progress' && record.firstTimelineProgressAt === null) {
				record.firstTimelineProgressAt = timestamp;
				firstEvidence = true;
			}
			if (signal !== 'playing' && signal !== 'playing-event' && signal !== 'timeline-progress') return true;
			if (!firstEvidence) return true;
			const latency = record.engineReadyAt === null ? null : timestamp - record.engineReadyAt;
			append(
				'playback-evidence',
				'ready',
				signal,
				`Signal=${signal}; engine-ready-to-signal=${latency === null ? '-' : `${latency} ms`}; first-video=${record.firstMainVideoAt === null ? '-' : `${record.firstMainVideoAt - record.attachedAt} ms`}; first-audio=${record.firstAlternateAudioAt === null ? '-' : `${record.firstAlternateAudioAt - record.attachedAt} ms`}.`
			);
			return true;
		},

		recovery (sourceToken, reason) {
			if (!isCurrent(sourceToken)) return false;
			const timestamp = now();
			const windowStart = record.engineReadyAt ?? record.attachedAt;
			if (timestamp - windowStart > EARLY_PLAYBACK_WINDOW_MS) return false;
			if (record.earlyRecoveryReasons.length >= 8) return false;
			record.earlyRecoveryReasons.push(String(reason || 'unknown'));
			append(
				'early-recovery',
				'warning',
				reason || 'unknown',
				`Recovery or stall occurred ${timestamp - windowStart} ms into the first ten seconds of HLS startup.`
			);
			return true;
		},

		clear (sourceToken = null) {
			if (!record || (sourceToken && record.sourceToken !== sourceToken)) return false;
			record = null;
			return true;
		},

		snapshot () {
			if (!enabled || !record) return null;
			return {
				...record,
				sourceToken: undefined,
				earlyRecoveryReasons: [...record.earlyRecoveryReasons]
			};
		}
	};
};
