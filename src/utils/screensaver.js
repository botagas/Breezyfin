export const SCREENSAVER_TIMEOUT_VALUES = Object.freeze(['off', '1', '3', '5', '10', '15']);
export const SCREENSAVER_INITIAL_VELOCITY = Object.freeze({x: 180, y: 135});
export const SCREENSAVER_ACTIVITY_EVENTS = Object.freeze(['keydown', 'pointerdown', 'pointermove', 'click', 'wheel']);
export const SCREENSAVER_MOUSE_FALLBACK_EVENTS = Object.freeze(['keydown', 'mousedown', 'mousemove', 'click', 'wheel']);

const SCREENSAVER_TIMEOUT_VALUE_SET = new Set(SCREENSAVER_TIMEOUT_VALUES);

export const normalizeScreensaverTimeoutMinutes = (value, fallback = '1') => {
	const normalized = String(value ?? '').trim().toLowerCase();
	if (SCREENSAVER_TIMEOUT_VALUE_SET.has(normalized)) return normalized;
	return SCREENSAVER_TIMEOUT_VALUE_SET.has(fallback) ? fallback : '1';
};

export const getScreensaverTimeoutMs = (value) => {
	const normalized = normalizeScreensaverTimeoutMinutes(value);
	if (normalized === 'off') return 0;
	return Number(normalized) * 60 * 1000;
};

export const isScreensaverEligibleView = ({authenticated = false, currentView = ''} = {}) => (
	authenticated === true && Boolean(currentView) && currentView !== 'login' && currentView !== 'player'
);

export const isPausedPlayerScreensaverEligible = ({
	isActive = false,
	playing = false,
	loading = false,
	hasError = false,
	playbackStarted = false,
	blocked = false,
	timeoutMinutes = '1'
} = {}) => (
	isActive === true &&
	playing !== true &&
	loading !== true &&
	hasError !== true &&
	playbackStarted === true &&
	blocked !== true &&
	getScreensaverTimeoutMs(timeoutMinutes) > 0
);

export const pauseSpotlightForScreensaver = (spotlight) => {
	if (!spotlight || spotlight.isPaused?.() === true) return false;
	spotlight.pause?.();
	return true;
};

export const resumeSpotlightAfterScreensaver = (spotlight, pausedByScreensaver) => {
	if (!pausedByScreensaver) return false;
	spotlight?.resume?.();
	return true;
};

export const addScreensaverActivityListeners = ({target, listener, active = false} = {}) => {
	const eventTarget = target || (typeof document !== 'undefined' ? document : null);
	if (!eventTarget || typeof listener !== 'function') return () => {};
	const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
	const eventNames = supportsPointerEvents ? SCREENSAVER_ACTIVITY_EVENTS : SCREENSAVER_MOUSE_FALLBACK_EVENTS;
	const options = {capture: true, passive: !active};
	eventNames.forEach((eventName) => {
		eventTarget.addEventListener(eventName, listener, options);
	});
	return () => {
		eventNames.forEach((eventName) => {
			eventTarget.removeEventListener(eventName, listener, true);
		});
	};
};

export const handleScreensaverIdleActivity = ({
	event,
	idleState,
	markActivity,
	consumeEvent,
	now = Date.now()
} = {}) => {
	const state = idleState || {};
	const suppressUntil = Number(state.suppressUntil) || 0;
	const suppressedEventType = String(state.suppressedEventType || '');
	if (now <= suppressUntil && suppressedEventType && event?.type === suppressedEventType) {
		consumeEvent?.(event, {preventDefault: false});
		return 'suppressed';
	}
	if (now > suppressUntil) {
		state.suppressUntil = 0;
		state.suppressedEventType = '';
	}
	if (event?.type === 'pointermove' || event?.type === 'mousemove') {
		const lastPointerMoveAt = Number(state.lastPointerMoveAt) || 0;
		if (now - lastPointerMoveAt < 250) return 'throttled';
		state.lastPointerMoveAt = now;
	}
	markActivity?.();
	return 'activity';
};

export const setScreensaverWakeSuppression = ({
	idleState,
	event,
	durationMs = 0,
	now = Date.now()
} = {}) => {
	if (!idleState) return false;
	const eventType = event?.type;
	const shouldSuppressClick = eventType === 'pointerdown' || eventType === 'mousedown';
	idleState.suppressedEventType = shouldSuppressClick ? 'click' : '';
	idleState.suppressUntil = shouldSuppressClick
		? now + Math.max(0, Number(durationMs) || 0)
		: 0;
	return shouldSuppressClick;
};

export const addManagedScreensaverActivityListeners = ({
	active = false,
	activeRef,
	onWake,
	idleActivityRef,
	markActivity,
	consumeEvent,
	target
} = {}) => {
	const listener = (event) => {
		if (activeRef?.current) {
			onWake?.(event);
			return;
		}
		handleScreensaverIdleActivity({
			event,
			idleState: idleActivityRef?.current,
			markActivity,
			consumeEvent
		});
	};
	return addScreensaverActivityListeners({target, listener, active});
};

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export const getScreensaverHeadingDegrees = ({velocityX = 0, velocityY = 0} = {}) => {
	const x = Number(velocityX) || 0;
	const y = Number(velocityY) || 0;
	if (x === 0 && y === 0) return 0;
	return Math.atan2(y, x) * (180 / Math.PI);
};

export const interpolateScreensaverHeadingDegrees = ({
	currentDegrees = 0,
	targetDegrees = 0,
	progress = 1
} = {}) => {
	const current = Number(currentDegrees) || 0;
	const target = Number(targetDegrees) || 0;
	const normalizedProgress = clamp(Number(progress) || 0, 0, 1);
	const shortestDelta = ((target - current + 540) % 360) - 180;
	return current + (shortestDelta * normalizedProgress);
};

export const clampScreensaverPosition = ({
	x = 0,
	y = 0,
	viewportWidth = 0,
	viewportHeight = 0,
	itemWidth = 0,
	itemHeight = 0
} = {}) => ({
	x: clamp(Number(x) || 0, 0, Math.max(0, (Number(viewportWidth) || 0) - (Number(itemWidth) || 0))),
	y: clamp(Number(y) || 0, 0, Math.max(0, (Number(viewportHeight) || 0) - (Number(itemHeight) || 0)))
});

export const getScreensaverMessagePosition = ({
	viewportWidth = 0,
	viewportHeight = 0,
	itemWidth = 0,
	itemHeight = 0,
	padding = 48,
	randomX = Math.random(),
	randomY = Math.random()
} = {}) => {
	const safePadding = Math.max(0, Number(padding) || 0);
	const availableWidth = Math.max(0, (Number(viewportWidth) || 0) - (Number(itemWidth) || 0) - (safePadding * 2));
	const availableHeight = Math.max(0, (Number(viewportHeight) || 0) - (Number(itemHeight) || 0) - (safePadding * 2));
	return {
		x: Math.min(
			Math.max(0, (Number(viewportWidth) || 0) - (Number(itemWidth) || 0)),
			safePadding + (availableWidth * clamp(Number(randomX) || 0, 0, 1))
		),
		y: Math.min(
			Math.max(0, (Number(viewportHeight) || 0) - (Number(itemHeight) || 0)),
			safePadding + (availableHeight * clamp(Number(randomY) || 0, 0, 1))
		)
	};
};

const reflectAxis = ({position, velocity, maximum}) => {
	if (maximum <= 0) return {position: 0, velocity: 0};
	let nextPosition = position;
	let nextVelocity = velocity;
	while (nextPosition < 0 || nextPosition > maximum) {
		if (nextPosition < 0) {
			nextPosition = -nextPosition;
			nextVelocity = Math.abs(nextVelocity);
		} else {
			nextPosition = maximum - (nextPosition - maximum);
			nextVelocity = -Math.abs(nextVelocity);
		}
	}
	return {position: nextPosition, velocity: nextVelocity};
};

export const advanceScreensaverPosition = ({
	x = 0,
	y = 0,
	velocityX = 0,
	velocityY = 0,
	deltaSeconds = 0,
	viewportWidth = 0,
	viewportHeight = 0,
	itemWidth = 0,
	itemHeight = 0
} = {}) => {
	const maxX = Math.max(0, (Number(viewportWidth) || 0) - (Number(itemWidth) || 0));
	const maxY = Math.max(0, (Number(viewportHeight) || 0) - (Number(itemHeight) || 0));
	const seconds = Math.max(0, Number(deltaSeconds) || 0);
	const horizontal = reflectAxis({
		position: (Number(x) || 0) + (Number(velocityX) || 0) * seconds,
		velocity: Number(velocityX) || 0,
		maximum: maxX
	});
	const vertical = reflectAxis({
		position: (Number(y) || 0) + (Number(velocityY) || 0) * seconds,
		velocity: Number(velocityY) || 0,
		maximum: maxY
	});
	return {
		x: horizontal.position,
		y: vertical.position,
		velocityX: horizontal.velocity,
		velocityY: vertical.velocity
	};
};
