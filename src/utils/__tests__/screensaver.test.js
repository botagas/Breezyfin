import {
	addManagedScreensaverActivityListeners,
	addScreensaverActivityListeners,
	advanceScreensaverPosition,
	clampScreensaverPosition,
	getScreensaverHeadingDegrees,
	getScreensaverMessagePosition,
	getScreensaverTimeoutMs,
	handleScreensaverIdleActivity,
	interpolateScreensaverHeadingDegrees,
	isPausedPlayerScreensaverEligible,
	isScreensaverEligibleView,
	normalizeScreensaverTimeoutMinutes,
	pauseSpotlightForScreensaver,
	resumeSpotlightAfterScreensaver,
	SCREENSAVER_INITIAL_VELOCITY
} from '../screensaver';

describe('screensaver utilities', () => {
	it('normalizes supported timeout values and defaults invalid values', () => {
		expect(normalizeScreensaverTimeoutMinutes('off')).toBe('off');
		expect(normalizeScreensaverTimeoutMinutes(' 10 ')).toBe('10');
		expect(normalizeScreensaverTimeoutMinutes('2')).toBe('1');
		expect(getScreensaverTimeoutMs('3')).toBe(180000);
		expect(getScreensaverTimeoutMs('off')).toBe(0);
	});

	it('allows only authenticated non-player views', () => {
		expect(isScreensaverEligibleView({authenticated: true, currentView: 'home'})).toBe(true);
		expect(isScreensaverEligibleView({authenticated: true, currentView: 'settings'})).toBe(true);
		expect(isScreensaverEligibleView({authenticated: true, currentView: 'player'})).toBe(false);
		expect(isScreensaverEligibleView({authenticated: false, currentView: 'home'})).toBe(false);
	});

	it('enables the separate player screensaver only for established paused playback', () => {
		expect(isPausedPlayerScreensaverEligible({
			isActive: true,
			playing: false,
			playbackStarted: true,
			timeoutMinutes: '1'
		})).toBe(true);
		expect(isPausedPlayerScreensaverEligible({
			isActive: true,
			playing: true,
			playbackStarted: true,
			timeoutMinutes: '1'
		})).toBe(false);
		expect(isPausedPlayerScreensaverEligible({
			isActive: true,
			playing: false,
			playbackStarted: true,
			blocked: true,
			timeoutMinutes: '1'
		})).toBe(false);
	});

	it('clamps positions after a viewport resize', () => {
		expect(clampScreensaverPosition({
			x: 900,
			y: -10,
			viewportWidth: 800,
			viewportHeight: 600,
			itemWidth: 120,
			itemHeight: 80
		})).toEqual({x: 680, y: 0});
	});

	it('reflects at viewport boundaries without leaving the visible area', () => {
		const next = advanceScreensaverPosition({
			x: 670,
			y: 515,
			velocityX: 100,
			velocityY: 100,
			deltaSeconds: 0.2,
			viewportWidth: 800,
			viewportHeight: 600,
			itemWidth: 120,
			itemHeight: 80
		});
		expect(next).toEqual({x: 670, y: 505, velocityX: -100, velocityY: -100});
	});

	it('uses the balanced motion profile and points the right-facing mark along velocity', () => {
		expect(SCREENSAVER_INITIAL_VELOCITY).toEqual({x: 180, y: 135});
		expect(getScreensaverHeadingDegrees({velocityX: 1, velocityY: 0})).toBe(0);
		expect(getScreensaverHeadingDegrees({velocityX: 0, velocityY: 1})).toBe(90);
		expect(getScreensaverHeadingDegrees({velocityX: -1, velocityY: 0})).toBe(180);
		expect(getScreensaverHeadingDegrees({velocityX: 0, velocityY: -1})).toBe(-90);
	});

	it('keeps randomly positioned player wake text inside padded viewport bounds', () => {
		expect(getScreensaverMessagePosition({
			viewportWidth: 1920,
			viewportHeight: 1080,
			itemWidth: 520,
			itemHeight: 60,
			padding: 48,
			randomX: 1,
			randomY: 1
		})).toEqual({x: 1352, y: 972});
		expect(getScreensaverMessagePosition({
			viewportWidth: 320,
			viewportHeight: 180,
			itemWidth: 400,
			itemHeight: 220,
			padding: 48,
			randomX: 0.5,
			randomY: 0.5
		})).toEqual({x: 0, y: 0});
	});

	it('updates heading after reflected motion changes direction', () => {
		const next = advanceScreensaverPosition({
			x: 95,
			y: 30,
			velocityX: 20,
			velocityY: 10,
			deltaSeconds: 1,
			viewportWidth: 200,
			viewportHeight: 200,
			itemWidth: 100,
			itemHeight: 100
		});
		expect(next.velocityX).toBe(-20);
		expect(getScreensaverHeadingDegrees(next)).toBeCloseTo(153.435, 2);
	});

	it('interpolates heading across the shortest wrap-around path', () => {
		expect(interpolateScreensaverHeadingDegrees({
			currentDegrees: 170,
			targetDegrees: -170,
			progress: 0.5
		})).toBe(180);
	});

	it('resumes Spotlight only when the screensaver paused it', () => {
		const spotlight = {
			isPaused: jest.fn(() => false),
			pause: jest.fn(),
			resume: jest.fn()
		};
		const pausedByScreensaver = pauseSpotlightForScreensaver(spotlight);
		expect(pausedByScreensaver).toBe(true);
		expect(spotlight.pause).toHaveBeenCalledTimes(1);
		expect(resumeSpotlightAfterScreensaver(spotlight, pausedByScreensaver)).toBe(true);
		expect(spotlight.resume).toHaveBeenCalledTimes(1);
	});

	it('shares capture-phase activity listener setup and cleanup', () => {
		const target = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn()
		};
		const listener = jest.fn();
		const remove = addScreensaverActivityListeners({target, listener});
		expect(target.addEventListener).toHaveBeenCalledWith(
			'keydown',
			listener,
			{capture: true, passive: true}
		);
		remove();
		expect(target.removeEventListener).toHaveBeenCalledWith('keydown', listener, true);
		expect(target.addEventListener).toHaveBeenCalledWith(
			'click',
			listener,
			{capture: true, passive: true}
		);
	});

	it('uses non-passive listeners only while consuming a wake event', () => {
		const target = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn()
		};
		addScreensaverActivityListeners({target, listener: jest.fn(), active: true});
		expect(target.addEventListener).toHaveBeenCalledWith(
			'keydown',
			expect.any(Function),
			{capture: true, passive: false}
		);
	});

	it('shares wake suppression and pointer-move throttling for idle screensavers', () => {
		const markActivity = jest.fn();
		const consumeEvent = jest.fn();
		const idleState = {lastPointerMoveAt: 1000, suppressUntil: 2000};
		expect(handleScreensaverIdleActivity({
			event: {type: 'click'},
			now: 1500,
			idleState,
			markActivity,
			consumeEvent
		})).toBe('suppressed');
		expect(consumeEvent).toHaveBeenCalledWith({type: 'click'}, {preventDefault: false});
		idleState.suppressUntil = 0;
		expect(handleScreensaverIdleActivity({
			event: {type: 'pointermove'},
			now: 1100,
			idleState,
			markActivity
		})).toBe('throttled');
		expect(handleScreensaverIdleActivity({
			event: {type: 'pointermove'},
			now: 1300,
			idleState,
			markActivity
		})).toBe('activity');
		expect(markActivity).toHaveBeenCalledTimes(1);
		expect(idleState.lastPointerMoveAt).toBe(1300);
	});

	it('routes active and idle activity through the shared screensaver listener', () => {
		const listeners = new Map();
		const target = {
			addEventListener: jest.fn((name, listener) => listeners.set(name, listener)),
			removeEventListener: jest.fn()
		};
		const activeRef = {current: true};
		const onWake = jest.fn();
		const markActivity = jest.fn();
		const remove = addManagedScreensaverActivityListeners({
			active: true,
			activeRef,
			onWake,
			idleActivityRef: {current: {lastPointerMoveAt: 0, suppressUntil: 0}},
			markActivity,
			target
		});
		listeners.get('keydown')?.({type: 'keydown'});
		expect(onWake).toHaveBeenCalledTimes(1);
		activeRef.current = false;
		listeners.get('wheel')?.({type: 'wheel'});
		expect(markActivity).toHaveBeenCalledTimes(1);
		remove();
		expect(target.removeEventListener).toHaveBeenCalled();
	});

	it('does not resume Spotlight when another owner had already paused it', () => {
		const spotlight = {
			isPaused: jest.fn(() => true),
			pause: jest.fn(),
			resume: jest.fn()
		};
		const pausedByScreensaver = pauseSpotlightForScreensaver(spotlight);
		expect(pausedByScreensaver).toBe(false);
		expect(spotlight.pause).not.toHaveBeenCalled();
		expect(resumeSpotlightAfterScreensaver(spotlight, pausedByScreensaver)).toBe(false);
		expect(spotlight.resume).not.toHaveBeenCalled();
	});
});
