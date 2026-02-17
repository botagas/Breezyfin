import { useCallback } from 'react';

export const useImageErrorFallback = (placeholderClassName, options = {}) => {
	const {onError} = options;

	return useCallback((event) => {
		const image = event?.currentTarget || event?.target;
		if (!image) return;
		image.style.display = 'none';
		const container = image.parentElement;
		if (container && placeholderClassName) {
			container.classList.add(placeholderClassName);
		}
		if (typeof onError === 'function') {
			onError(event, {image, container});
		}
	}, [onError, placeholderClassName]);
};
