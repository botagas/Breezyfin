export const getManualSubtitleCanvasRect = (videoElement, containerElement) => {
	const containerRect = typeof containerElement.getBoundingClientRect === 'function'
		? containerElement.getBoundingClientRect()
		: {
			left: 0,
			top: 0,
			width: containerElement.clientWidth || 0,
			height: containerElement.clientHeight || 0
		};
	const videoRect = typeof videoElement?.getBoundingClientRect === 'function'
		? videoElement.getBoundingClientRect()
		: containerRect;
	const left = Math.max(0, Math.round((videoRect.left || 0) - (containerRect.left || 0)));
	const top = Math.max(0, Math.round((videoRect.top || 0) - (containerRect.top || 0)));
	const width = Math.max(1, Math.round(videoRect.width || containerRect.width || containerElement.clientWidth || 1));
	const height = Math.max(1, Math.round(videoRect.height || containerRect.height || containerElement.clientHeight || 1));
	const pixelRatio = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
		? window.devicePixelRatio
		: 1;
	const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
	const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
	return {
		left,
		top,
		width,
		height,
		canvasWidth,
		canvasHeight
	};
};

export const applyManualSubtitleCanvasStyle = (canvas, rect) => {
	if (!canvas || !rect) return;
	const {
		left,
		top,
		width,
		height
	} = rect;
	canvas.style.left = `${left}px`;
	canvas.style.top = `${top}px`;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
};

export const setManualSubtitleCanvasRect = (
	canvas,
	videoElement,
	containerElement,
	onCanvasResize = null
) => {
	if (!canvas || !containerElement) return;
	const rect = getManualSubtitleCanvasRect(videoElement, containerElement);
	const {
		canvasWidth,
		canvasHeight
	} = rect;
	applyManualSubtitleCanvasStyle(canvas, rect);
	if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		if (typeof onCanvasResize === 'function') {
			onCanvasResize(canvasWidth, canvasHeight);
		}
	}
};

export const cleanupManualSubtitleRenderer = ({
	renderer,
	videoElement,
	eventHandlers = [],
	intervalId = null,
	markDisposed = null
} = {}) => {
	if (typeof markDisposed === 'function') {
		markDisposed();
	}
	if (intervalId) {
		clearInterval(intervalId);
	}
	eventHandlers.forEach(([eventName, handler]) => {
		videoElement?.removeEventListener(eventName, handler);
	});
	if (renderer?.__breezyfinResizeObserver) {
		renderer.__breezyfinResizeObserver.disconnect();
		renderer.__breezyfinResizeObserver = null;
	}
};

export const readVideoTime = (videoElement) => (
	Number.isFinite(videoElement?.currentTime) ? videoElement.currentTime : 0
);
