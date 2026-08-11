const normalizeItemId = (value) => String(value || '');

export const createPlaybackRecoveryTransactionManager = () => {
	let activeOperation = null;
	let nextId = 0;
	let disposed = false;

	const invalidate = (reason = 'invalidated') => {
		if (!activeOperation) return false;
		activeOperation.cancelled = true;
		activeOperation.cancelReason = reason;
		activeOperation = null;
		return true;
	};

	const begin = ({
		kind,
		itemId,
		playbackGeneration,
		loadRequestId,
		overrideCandidate = null
	} = {}) => {
		invalidate('superseded');
		if (disposed) return null;
		const immutableOverrideCandidate = overrideCandidate && typeof overrideCandidate === 'object'
			? Object.freeze(overrideCandidate)
			: overrideCandidate;
		const operation = {
			id: ++nextId,
			kind: String(kind || 'recovery'),
			itemId: normalizeItemId(itemId),
			playbackGeneration,
			loadRequestId,
			overrideCandidate: immutableOverrideCandidate,
			cancelled: false,
			cancelReason: null
		};
		activeOperation = operation;
		return operation;
	};

	const isCurrent = (operation, {
		itemId,
		playbackGeneration,
		loadRequestId,
		exitInProgress = false
	} = {}) => Boolean(
		!disposed &&
		!exitInProgress &&
		operation &&
		!operation.cancelled &&
		activeOperation === operation &&
		operation.itemId === normalizeItemId(itemId) &&
		operation.playbackGeneration === playbackGeneration &&
		operation.loadRequestId === loadRequestId
	);

	const complete = (operation) => {
		if (activeOperation !== operation) return false;
		activeOperation = null;
		return true;
	};

	const dispose = () => {
		invalidate('disposed');
		disposed = true;
	};

	return {
		begin,
		complete,
		dispose,
		invalidate,
		isCurrent
	};
};

export default createPlaybackRecoveryTransactionManager;
