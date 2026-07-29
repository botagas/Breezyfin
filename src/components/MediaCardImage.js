import {memo, useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import {useImageErrorFallback} from '../hooks/useImageErrorFallback';
import {useRuntimeDiagnosticsEnabled} from '../hooks/useRuntimeDiagnostics';
import {
	registerMediaCardImage,
	unregisterMediaCardImage,
	updateMediaCardImage
} from '../utils/mediaPerformanceMetrics';
import imageLoadCss from './ImageLoadReveal.module.less';

const joinClasses = (...names) => names.filter(Boolean).join(' ');
const getNow = () => (
	typeof performance !== 'undefined' && typeof performance.now === 'function'
		? performance.now()
		: Date.now()
);

const normalizeCandidates = (candidates) => {
	const unique = [];
	(candidates || []).forEach((candidate) => {
		const url = typeof candidate === 'string' ? candidate.trim() : '';
		if (url && !unique.includes(url)) unique.push(url);
	});
	return unique;
};

const MediaCardImage = ({
	candidates = [],
	alt = '',
	className = '',
	width,
	height,
	loading = 'eager',
	deferred = false,
	placeholder = null
}) => {
	const diagnosticsEnabled = useRuntimeDiagnosticsEnabled();
	const candidateSignature = normalizeCandidates(candidates).join('|');
	const imageCandidates = useMemo(
		() => normalizeCandidates(candidateSignature ? candidateSignature.split('|') : []),
		[candidateSignature]
	);
	const imageRef = useRef(null);
	const loadingHintRef = useRef(null);
	const placeholderRef = useRef(null);
	const loadStartedAtRef = useRef(0);
	const metricTokenRef = useRef(Symbol('media-card-image'));

	const setVisualState = useCallback((state) => {
		const image = imageRef.current;
		const loadingHint = loadingHintRef.current;
		const placeholderNode = placeholderRef.current;
		if (image) {
			image.classList.toggle(imageLoadCss.imageRevealLoaded, state === 'loaded');
			image.style.display = state === 'failed' || state === 'empty' ? 'none' : '';
		}
		if (loadingHint) {
			loadingHint.classList.toggle(
				imageLoadCss.imageLoadingHintHidden,
				state !== 'pending'
			);
		}
		if (placeholderNode) {
			placeholderNode.classList.toggle(
				imageLoadCss.imagePlaceholderHidden,
				state !== 'failed' && state !== 'empty'
			);
		}
	}, []);

	const handleCandidateChange = useCallback(() => {
		loadStartedAtRef.current = getNow();
		setVisualState('pending');
		if (diagnosticsEnabled) updateMediaCardImage(metricTokenRef.current, 'pending');
	}, [diagnosticsEnabled, setVisualState]);

	const handleExhausted = useCallback(() => {
		setVisualState('failed');
		if (diagnosticsEnabled) updateMediaCardImage(metricTokenRef.current, 'failed');
	}, [diagnosticsEnabled, setVisualState]);

	const handleImageError = useImageErrorFallback('', {
		fallbackUrls: imageCandidates.slice(1),
		onCandidateChange: handleCandidateChange,
		onError: handleExhausted,
		resetKey: candidateSignature
	});

	const handleImageLoad = useCallback(() => {
		setVisualState('loaded');
		const latency = loadStartedAtRef.current > 0
			? getNow() - loadStartedAtRef.current
			: null;
		if (diagnosticsEnabled) updateMediaCardImage(metricTokenRef.current, 'loaded', latency);
	}, [diagnosticsEnabled, setVisualState]);

	useLayoutEffect(() => {
		const hasCandidates = imageCandidates.length > 0;
		const initialStatus = hasCandidates ? 'pending' : deferred ? 'idle' : 'empty';
		const metricToken = metricTokenRef.current;
		if (diagnosticsEnabled) registerMediaCardImage(metricToken, initialStatus);
		loadStartedAtRef.current = hasCandidates ? getNow() : 0;
		if (imageRef.current) delete imageRef.current.dataset.bfImageFormatFallback;
		setVisualState(hasCandidates ? 'pending' : 'empty');
		return () => {
			if (diagnosticsEnabled) unregisterMediaCardImage(metricToken);
		};
	}, [candidateSignature, deferred, diagnosticsEnabled, imageCandidates.length, setVisualState]);

	return (
		<>
			{imageCandidates.length > 0 ? (
				<img
					ref={imageRef}
					src={imageCandidates[0]}
					alt={alt}
					className={joinClasses(imageLoadCss.imageReveal, className)}
					onLoad={handleImageLoad}
					onError={handleImageError}
					loading={loading}
					decoding="async"
					width={width}
					height={height}
					draggable={false}
				/>
			) : null}
			<div
				ref={placeholderRef}
				className={joinClasses(
					imageLoadCss.imagePlaceholder,
					imageCandidates.length > 0 && imageLoadCss.imagePlaceholderHidden
				)}
				data-bf-card-image-placeholder="true"
			>
				{placeholder}
			</div>
			{imageCandidates.length > 0 ? (
				<div
					ref={loadingHintRef}
					className={imageLoadCss.imageLoadingHint}
					aria-hidden="true"
				/>
			) : null}
		</>
	);
};

export default memo(MediaCardImage);
