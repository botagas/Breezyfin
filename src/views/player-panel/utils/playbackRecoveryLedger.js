const DEFAULT_MAX_HISTORY = 4;

export const PLAYBACK_RECOVERY_KEYS = Object.freeze({
	hlsNetwork: 'hlsNetwork',
	hlsMedia: 'hlsMedia',
	playSessionRebuild: 'playSessionRebuild',
	transcodeFallback: 'transcodeFallback',
	dynamicRangeFallback: 'dynamicRangeFallback',
	reload: 'reload',
	subtitleCompatibilityFallback: 'subtitleCompatibilityFallback',
	nativeAudioFallback: 'nativeAudioFallback'
});

const RECOVERY_POLICIES = Object.freeze({
	hlsNetwork: {kind: 'counter', scope: 'generation'},
	hlsMedia: {kind: 'counter', scope: 'generation'},
	playSessionRebuild: {kind: 'counter', scope: 'item'},
	transcodeFallback: {kind: 'flag', scope: 'item'},
	dynamicRangeFallback: {kind: 'flag', scope: 'generation'},
	reload: {kind: 'flag', scope: 'generation'},
	subtitleCompatibilityFallback: {kind: 'flag', scope: 'generation'},
	nativeAudioFallback: {kind: 'flag', scope: 'item'}
});

const isGeneration = (value) => Number.isInteger(value) && value >= 0;

const cloneRecord = (record) => ({
	generation: record.generation,
	itemId: record.itemId,
	attempts: {...record.attempts},
	claims: {...record.claims},
	failureLocked: record.failureLocked,
	failureReason: record.failureReason
});

const createRecord = (generation, itemId, previousRecord = null) => ({
	generation,
	itemId: itemId || null,
	attempts: {
		hlsNetwork: 0,
		hlsMedia: 0,
		playSessionRebuild: previousRecord?.attempts.playSessionRebuild || 0
	},
	claims: {
		transcodeFallback: previousRecord?.claims.transcodeFallback === true,
		dynamicRangeFallback: false,
		reload: false,
		subtitleCompatibilityFallback: false,
		nativeAudioFallback: previousRecord?.claims.nativeAudioFallback === true
	},
	failureLocked: false,
	failureReason: null
});

export const createPlaybackRecoveryLedger = ({
	getCurrentGeneration = null,
	maxHistory = DEFAULT_MAX_HISTORY
} = {}) => {
	const historyLimit = Math.max(1, Number(maxHistory) || DEFAULT_MAX_HISTORY);
	const records = new Map();
	let activeGeneration = null;
	let activeItemId = null;

	const isCurrent = (generation) => {
		if (!isGeneration(generation)) return false;
		const currentGeneration = typeof getCurrentGeneration === 'function'
			? getCurrentGeneration()
			: activeGeneration;
		return currentGeneration === generation;
	};

	const trimHistory = () => {
		while (records.size > historyLimit) {
			records.delete(records.keys().next().value);
		}
	};

	const beginGeneration = (generation, {itemId = activeItemId} = {}) => {
		if (!isGeneration(generation)) return null;
		const existingRecord = records.get(generation);
		if (existingRecord) {
			activeGeneration = generation;
			activeItemId = itemId || existingRecord.itemId || null;
			return cloneRecord(existingRecord);
		}

		const previousRecord = records.get(activeGeneration);
		const canCarryItemScope = Boolean(
			previousRecord &&
			previousRecord.itemId &&
			previousRecord.itemId === (itemId || activeItemId)
		);
		const record = createRecord(
			generation,
			itemId || activeItemId,
			canCarryItemScope ? previousRecord : null
		);
		records.set(generation, record);
		activeGeneration = generation;
		activeItemId = record.itemId;
		trimHistory();
		return cloneRecord(record);
	};

	const getRecord = (generation) => {
		const record = records.get(generation);
		return record ? cloneRecord(record) : null;
	};

	const reject = (generation, key, reason) => ({
		accepted: false,
		generation,
		key,
		reason
	});

	const claim = (generation, key, {max = 1} = {}) => {
		const policy = RECOVERY_POLICIES[key];
		if (!policy) return reject(generation, key, 'unknown-key');
		if (!isCurrent(generation)) return reject(generation, key, 'stale-generation');
		const record = records.get(generation);
		if (!record) return reject(generation, key, 'generation-not-started');
		if (record.failureLocked) return reject(generation, key, 'failure-locked');

		const limit = Math.max(1, Number(max) || 1);
		if (policy.kind === 'counter') {
			const attempt = (record.attempts[key] || 0) + 1;
			if (attempt > limit) return reject(generation, key, 'max-attempts');
			record.attempts[key] = attempt;
			return {
				accepted: true,
				generation,
				key,
				attempt,
				remaining: limit - attempt,
				scope: policy.scope
			};
		}

		if (record.claims[key]) return reject(generation, key, 'already-claimed');
		record.claims[key] = true;
		return {
			accepted: true,
			generation,
			key,
			attempt: 1,
			remaining: Math.max(0, limit - 1),
			scope: policy.scope
		};
	};

	const claimMany = (generation, requests = []) => {
		if (!isCurrent(generation)) return reject(generation, 'multiple', 'stale-generation');
		const record = records.get(generation);
		if (!record) return reject(generation, 'multiple', 'generation-not-started');
		if (record.failureLocked) return reject(generation, 'multiple', 'failure-locked');
		const draft = cloneRecord(record);
		const accepted = [];

		for (const request of requests) {
			const key = request?.key;
			const policy = RECOVERY_POLICIES[key];
			if (!policy) return reject(generation, key, 'unknown-key');
			const limit = Math.max(1, Number(request?.max) || 1);
			if (policy.kind === 'counter') {
				const attempt = (draft.attempts[key] || 0) + 1;
				if (attempt > limit) return reject(generation, key, 'max-attempts');
				draft.attempts[key] = attempt;
				accepted.push({key, attempt, remaining: limit - attempt, scope: policy.scope});
				continue;
			}
			if (draft.claims[key]) return reject(generation, key, 'already-claimed');
			draft.claims[key] = true;
			accepted.push({key, attempt: 1, remaining: Math.max(0, limit - 1), scope: policy.scope});
		}

		record.attempts = draft.attempts;
		record.claims = draft.claims;
		return {accepted: true, generation, claims: accepted};
	};

	const resetGeneration = (generation) => {
		const record = records.get(generation);
		if (!record) return false;
		record.attempts.hlsNetwork = 0;
		record.attempts.hlsMedia = 0;
		record.claims.dynamicRangeFallback = false;
		record.claims.reload = false;
		record.claims.subtitleCompatibilityFallback = false;
		record.failureLocked = false;
		record.failureReason = null;
		return true;
	};

	const resetForItem = (itemId = null) => {
		records.clear();
		activeGeneration = null;
		activeItemId = itemId || null;
	};

	const resetForRetry = (itemId = activeItemId) => {
		records.clear();
		activeGeneration = null;
		activeItemId = itemId || null;
	};

	const lock = (generation, reason = 'playback-failed') => {
		if (!isCurrent(generation)) return false;
		const record = records.get(generation);
		if (!record) return false;
		record.failureLocked = true;
		record.failureReason = reason;
		return true;
	};

	return {
		beginGeneration,
		claim,
		claimMany,
		get: getRecord,
		getHistory: () => Array.from(records.values(), cloneRecord),
		isCurrent,
		isLocked: (generation) => Boolean(records.get(generation)?.failureLocked),
		lock,
		resetGeneration,
		resetForItem,
		resetForRetry
	};
};

export default createPlaybackRecoveryLedger;
