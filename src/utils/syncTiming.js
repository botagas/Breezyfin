export class ServerClockOffsetEstimator {
	constructor(maxSamples = 7) {
		this.maxSamples = Math.max(3, Math.trunc(maxSamples));
		this.samples = [];
	}

	record({sentAtMs, receivedAtMs, serverTime}) {
		const serverMs = Date.parse(serverTime);
		if (![sentAtMs, receivedAtMs, serverMs].every(Number.isFinite) || receivedAtMs < sentAtMs) {
			return this.offsetMs;
		}
		const midpoint = sentAtMs + ((receivedAtMs - sentAtMs) / 2);
		this._recordOffset(serverMs - midpoint);
		return this.offsetMs;
	}

	recordTimeSync({
		requestSentAtMs,
		requestReceivedServerTime,
		responseSentServerTime,
		responseReceivedAtMs
	}) {
		const requestReceivedAtMs = Date.parse(requestReceivedServerTime);
		const responseSentAtMs = Date.parse(responseSentServerTime);
		const values = [
			requestSentAtMs,
			requestReceivedAtMs,
			responseSentAtMs,
			responseReceivedAtMs
		];
		if (!values.every(Number.isFinite) || responseReceivedAtMs < requestSentAtMs) {
			throw new Error('Invalid Jellyfin time synchronization response');
		}
		const offsetMs = (
			(requestReceivedAtMs - requestSentAtMs)
			+ (responseSentAtMs - responseReceivedAtMs)
		) / 2;
		const roundTripMs = Math.max(
			0,
			(responseReceivedAtMs - requestSentAtMs) - (responseSentAtMs - requestReceivedAtMs)
		);
		this._recordOffset(offsetMs);
		return {offsetMs: this.offsetMs, pingMs: roundTripMs / 2};
	}

	_recordOffset(offsetMs) {
		this.samples.push(offsetMs);
		if (this.samples.length > this.maxSamples) this.samples.shift();
	}

	get offsetMs() {
		if (this.samples.length === 0) return 0;
		const sorted = [...this.samples].sort((left, right) => left - right);
		return sorted[Math.floor(sorted.length / 2)];
	}

	reset() {
		this.samples = [];
	}
}

export const getSyncPlayDriftCorrection = (driftMs, {forceSeek = false} = {}) => {
	const numericDrift = Number(driftMs);
	if (!Number.isFinite(numericDrift)) return {action: 'none', playbackRate: 1};
	const magnitude = Math.abs(numericDrift);
	if (forceSeek || magnitude >= 2000) {
		return {action: 'seek', playbackRate: 1};
	}

	return {
		action: 'none',
		playbackRate: 1
	};
};

export const getBoundedSyncPlayDriftCorrection = (
	driftMs,
	{forceSeek = false, hardSeekApplied = false} = {}
) => {
	const correction = getSyncPlayDriftCorrection(driftMs, {
		forceSeek: forceSeek && !hardSeekApplied
	});
	if (correction.action !== 'seek' || !hardSeekApplied) {
		return correction;
	}

	return {
		action: 'none',
		playbackRate: 1
	};
};
