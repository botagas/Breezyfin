import { useEffect, useRef, useState } from 'react';
import css from './PerformanceOverlay.module.less';

const MAX_LATENCY_SAMPLES = 30;

const toAverage = (values) => {
	if (!values.length) return 0;
	const total = values.reduce((sum, value) => sum + value, 0);
	return total / values.length;
};

const PerformanceOverlay = ({enabled = false, inputMode = '5way'}) => {
	const [fps, setFps] = useState(0);
	const [inputLatency, setInputLatency] = useState(0);
	const frameCountRef = useRef(0);
	const rafRef = useRef(0);
	const lastFpsTickRef = useRef(0);
	const latencySamplesRef = useRef([]);

	useEffect(() => {
		if (!enabled) return undefined;

		const now = performance.now();
		lastFpsTickRef.current = now;
		frameCountRef.current = 0;

		const tick = (time) => {
			frameCountRef.current += 1;
			const elapsed = time - lastFpsTickRef.current;
			if (elapsed >= 1000) {
				setFps(Math.round((frameCountRef.current * 1000) / elapsed));
				lastFpsTickRef.current = time;
				frameCountRef.current = 0;
			}
			rafRef.current = window.requestAnimationFrame(tick);
		};

		rafRef.current = window.requestAnimationFrame(tick);
		return () => {
			window.cancelAnimationFrame(rafRef.current);
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return undefined;

		const addLatencySample = (sample) => {
			const nextSamples = [...latencySamplesRef.current, sample].slice(-MAX_LATENCY_SAMPLES);
			latencySamplesRef.current = nextSamples;
			setInputLatency(Math.round(toAverage(nextSamples)));
		};

		const handleInput = () => {
			const start = performance.now();
			window.requestAnimationFrame(() => {
				addLatencySample(Math.max(0, performance.now() - start));
			});
		};

		document.addEventListener('keydown', handleInput, true);
		document.addEventListener('pointerdown', handleInput, true);
		document.addEventListener('mousedown', handleInput, true);
		document.addEventListener('touchstart', handleInput, true);
		return () => {
			document.removeEventListener('keydown', handleInput, true);
			document.removeEventListener('pointerdown', handleInput, true);
			document.removeEventListener('mousedown', handleInput, true);
			document.removeEventListener('touchstart', handleInput, true);
		};
	}, [enabled]);

	if (!enabled) return null;

	return (
		<div className={css.overlay} aria-hidden>
			<div className={css.metric}>
				<span className={css.label}>FPS</span>
				<span className={css.value}>{fps}</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Input</span>
				<span className={css.value}>{inputLatency}ms</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Mode</span>
				<span className={css.value}>{inputMode}</span>
			</div>
		</div>
	);
};

export default PerformanceOverlay;
