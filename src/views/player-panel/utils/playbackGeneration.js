const normalizeGeneration = (value) => (
	Number.isInteger(value) && value >= 0 ? value : 0
);

export const createPlaybackGenerationAllocator = ({
	generationRef = {current: 0},
	publishGeneration = () => undefined,
	onGenerationAllocated = null
} = {}) => {
	let highestGeneration = normalizeGeneration(generationRef.current);

	const current = () => {
		const observedGeneration = normalizeGeneration(generationRef.current);
		if (observedGeneration > highestGeneration) {
			highestGeneration = observedGeneration;
		} else if (observedGeneration < highestGeneration) {
			generationRef.current = highestGeneration;
		}
		return highestGeneration;
	};

	const advance = (reason, publish) => {
		const generation = current() + 1;
		highestGeneration = generation;
		generationRef.current = generation;
		if (publish) {
			publishGeneration(generation, reason);
			onGenerationAllocated?.(generation, reason);
		}
		return generation;
	};

	return {
		current,
		isCurrent: (generation) => current() === generation,
		invalidate: (reason = 'playback-invalidated') => advance(reason, false),
		allocate: (reason = 'playback-allocated') => advance(reason, true)
	};
};

export default createPlaybackGenerationAllocator;
