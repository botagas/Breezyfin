const canPlayVideoType = (type) => {
	if (typeof document === 'undefined') return null;
	const video = document.createElement('video');
	if (!video?.canPlayType) return null;
	try {
		const result = video.canPlayType(type);
		return result === 'probably' || result === 'maybe';
	} catch (_) {
		return null;
	}
};

export const detectCodecSupport = (types) => {
	let sawSignal = false;
	for (const type of types) {
		const supported = canPlayVideoType(type);
		if (supported == null) continue;
		sawSignal = true;
		if (supported) return true;
	}
	return sawSignal ? false : null;
};

export const detectImageFormatSupport = (mimeType) => {
	if (typeof document === 'undefined') return null;
	try {
		const canvas = document.createElement('canvas');
		if (!canvas?.getContext) return null;
		const encoded = canvas.toDataURL(mimeType);
		return typeof encoded === 'string' && encoded.startsWith(`data:${mimeType}`);
	} catch (_) {
		return null;
	}
};

export const detectFlexGapSupport = () => {
	if (typeof document === 'undefined' || !document.body) return null;
	const flex = document.createElement('div');
	flex.style.display = 'flex';
	flex.style.flexDirection = 'column';
	flex.style.rowGap = '1px';

	const childA = document.createElement('div');
	childA.style.height = '0';
	const childB = document.createElement('div');
	childB.style.height = '0';

	flex.appendChild(childA);
	flex.appendChild(childB);
	document.body.appendChild(flex);
	const supported = flex.scrollHeight === 1;
	document.body.removeChild(flex);
	return supported;
};

export const detectBackdropFilterSupport = () => {
	if (typeof window === 'undefined' || !window.CSS?.supports) return false;
	return (
		window.CSS.supports('backdrop-filter', 'blur(1px)') ||
		window.CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
	);
};
