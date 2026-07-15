import { useEffect, useRef, useState } from 'react';
import {
	getMediaPerformanceSnapshot,
	subscribeMediaPerformanceMetrics
} from '../utils/mediaPerformanceMetrics';
import {getDroppedFrameEstimate, getFrameCadence} from '../utils/framePerformance';
import {useRuntimeSuspended} from '../hooks/useRuntimeSuspension';
import css from './PerformanceOverlay.module.less';

const MAX_LATENCY_SAMPLES = 30;

const toAverage = (values) => {
	if (!values.length) return 0;
	const total = values.reduce((sum, value) => sum + value, 0);
	return total / values.length;
};

const PerformanceOverlay = ({enabled = false, inputMode = '5way', suspended = false}) => {
	const globallySuspended = useRuntimeSuspended();
	const active = enabled && !suspended && !globallySuspended;
	const [fps, setFps] = useState(0);
	const [slowFrames, setSlowFrames] = useState(0);
	const [inputLatency, setInputLatency] = useState(0);
	const [mediaMetrics, setMediaMetrics] = useState(getMediaPerformanceSnapshot);
	const frameCountRef = useRef(0);
	const rafRef = useRef(0);
	const lastFpsTickRef = useRef(0);
	const lastFrameTimeRef = useRef(0);
	const slowFrameCountRef = useRef(0);
	const latencySamplesRef = useRef([]);
	const cadenceSamplesRef = useRef([]);
	const cadenceIntervalRef = useRef(1000 / 60);

	useEffect(() => {
		if (!active) return undefined;
		return subscribeMediaPerformanceMetrics(setMediaMetrics);
	}, [active]);

	useEffect(() => {
		if (!active) return undefined;

		const now = performance.now();
		lastFpsTickRef.current = now;
		lastFrameTimeRef.current = now;
		frameCountRef.current = 0;
		slowFrameCountRef.current = 0;
		cadenceSamplesRef.current = [];
		cadenceIntervalRef.current = 1000 / 60;

		const tick = (time) => {
			const frameDelta = time - lastFrameTimeRef.current;
			if (cadenceSamplesRef.current.length < 30 && frameDelta > 0) {
				cadenceSamplesRef.current.push(frameDelta);
				cadenceIntervalRef.current = getFrameCadence(cadenceSamplesRef.current).intervalMs;
			}
			slowFrameCountRef.current += getDroppedFrameEstimate(frameDelta, cadenceIntervalRef.current);
			lastFrameTimeRef.current = time;
			frameCountRef.current += 1;
			const elapsed = time - lastFpsTickRef.current;
			if (elapsed >= 1000) {
				setFps(Math.round((frameCountRef.current * 1000) / elapsed));
				setSlowFrames(Math.round((slowFrameCountRef.current * 1000) / elapsed));
				lastFpsTickRef.current = time;
				frameCountRef.current = 0;
				slowFrameCountRef.current = 0;
			}
			rafRef.current = window.requestAnimationFrame(tick);
		};

		rafRef.current = window.requestAnimationFrame(tick);
		return () => {
			window.cancelAnimationFrame(rafRef.current);
		};
	}, [active]);

	useEffect(() => {
		if (!active) return undefined;

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
		return () => {
			document.removeEventListener('keydown', handleInput, true);
			document.removeEventListener('pointerdown', handleInput, true);
		};
	}, [active]);

	if (!active) return null;

	return (
		<div className={css.overlay} aria-hidden>
			<div className={css.metric}>
				<span className={css.label}>Slow</span>
				<span className={css.value}>{slowFrames}/s</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>FPS</span>
				<span className={css.value}>{fps}</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Next</span>
				<span className={css.value}>{inputLatency}ms</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Mode</span>
				<span className={css.value}>{inputMode}</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Cards</span>
				<span className={css.value}>{mediaMetrics.mountedCards}</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Images</span>
				<span className={css.value}>{mediaMetrics.pendingImages}/{mediaMetrics.failedImages}</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Load</span>
				<span className={css.value}>{mediaMetrics.imageLoadLatency}ms</span>
			</div>
			<div className={css.metric}>
				<span className={css.label}>Grid</span>
				<span className={css.value}>{mediaMetrics.gridOverhang}</span>
			</div>
		</div>
	);
};

export default PerformanceOverlay;
