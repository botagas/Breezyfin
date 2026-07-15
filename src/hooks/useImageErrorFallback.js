import {useCallback, useEffect, useRef} from 'react';
import {applyImageFormatFallbackFromEvent} from '../utils/imageFormat';

export const useImageErrorFallback = (placeholderClassName, options = {}) => {
	const {
		onError,
		fallbackUrls = [],
		onCandidateChange,
		resetKey = ''
	} = options;
	const fallbackIndexRef = useRef(0);

	useEffect(() => {
		fallbackIndexRef.current = 0;
	}, [resetKey]);

	return useCallback((event) => {
		const image = event?.currentTarget || event?.target;
		if (!image) return;
		if (applyImageFormatFallbackFromEvent(event)) return;
		const fallbackUrl = fallbackUrls[fallbackIndexRef.current];
		if (fallbackUrl) {
			fallbackIndexRef.current += 1;
			delete image.dataset.bfImageFormatFallback;
			image.style.display = '';
			image.src = fallbackUrl;
			onCandidateChange?.(fallbackUrl, fallbackIndexRef.current);
			return;
		}
		image.style.display = 'none';
		const container = image.parentElement;
		if (container && placeholderClassName) {
			container.classList.add(placeholderClassName);
		}
		if (typeof onError === 'function') {
			onError(event, {image, container});
		}
	}, [fallbackUrls, onCandidateChange, onError, placeholderClassName]);
};
