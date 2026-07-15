export const attachSuspendableRendererInterval = ({
	renderer,
	intervalMs,
	onInterval,
	onResume,
	onSuspensionChange,
	shouldRun = () => true
} = {}) => {
	if (!renderer || typeof onInterval !== 'function') return () => {};
	let intervalId = null;
	let suspended = false;

	const stop = () => {
		if (intervalId === null) return;
		clearInterval(intervalId);
		intervalId = null;
	};
	const start = () => {
		if (intervalId !== null || suspended || !shouldRun()) return;
		intervalId = setInterval(onInterval, intervalMs);
	};
	renderer.__breezyfinSetRuntimeSuspended = (nextSuspended) => {
		const next = nextSuspended === true;
		if (next === suspended) return;
		suspended = next;
		onSuspensionChange?.(suspended);
		if (suspended) {
			stop();
			return;
		}
		onResume?.();
		start();
	};
	start();

	return () => {
		stop();
		delete renderer.__breezyfinSetRuntimeSuspended;
	};
};

export default attachSuspendableRendererInterval;
