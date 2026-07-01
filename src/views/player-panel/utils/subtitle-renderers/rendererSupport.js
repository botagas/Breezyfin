const getChromiumMajorVersion = () => {
	if (typeof navigator === 'undefined') return null;
	const match = String(navigator.userAgent || '').match(/(?:Chrome|Chromium)\/(\d+)/i);
	return match ? parseInt(match[1], 10) : null;
};

export const supportsTransferableCanvas = () => {
	if (typeof document === 'undefined') return false;
	const canvas = document.createElement('canvas');
	return typeof canvas.transferControlToOffscreen === 'function';
};

export const canCreateOffscreenCanvasRenderContext = () => {
	const OffscreenCanvasConstructor = globalThis?.OffscreenCanvas;
	if (typeof OffscreenCanvasConstructor !== 'function') return false;
	try {
		const canvas = new OffscreenCanvasConstructor(1, 1);
		if (typeof canvas.getContext !== 'function') return false;
		return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('2d'));
	} catch (error) {
		return false;
	}
};

export const supportsVideoFrameCallback = () => {
	if (typeof document === 'undefined') return false;
	const video = document.createElement('video');
	return typeof video.requestVideoFrameCallback === 'function';
};

export const supportsLibassRuntime = () => {
	const chromiumMajor = getChromiumMajorVersion();
	if (typeof Worker !== 'function') return false;
	if (typeof Promise === 'undefined') return false;
	if (typeof Uint8Array === 'undefined') return false;
	if (chromiumMajor && chromiumMajor < 49) return false;
	return true;
};

export const supportsJassubRuntime = () => (
	typeof Worker === 'function' &&
	typeof WebAssembly === 'object' &&
	typeof OffscreenCanvas === 'function' &&
	typeof Promise === 'function' &&
	typeof fetch === 'function' &&
	supportsTransferableCanvas() &&
	supportsVideoFrameCallback() &&
	canCreateOffscreenCanvasRenderContext()
);

export const supportsJassubManualRuntime = () => (
	typeof Worker === 'function' &&
	typeof WebAssembly === 'object' &&
	typeof OffscreenCanvas === 'function' &&
	typeof Promise === 'function' &&
	typeof fetch === 'function' &&
	supportsTransferableCanvas() &&
	canCreateOffscreenCanvasRenderContext()
);

export const supportsAssJsRuntime = () => (
	typeof document !== 'undefined' &&
	typeof window !== 'undefined' &&
	typeof Promise === 'function'
);
