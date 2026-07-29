import {useEffect, useRef} from 'react';
import {
	advanceScreensaverPosition,
	clampScreensaverPosition,
	getScreensaverHeadingDegrees,
	getScreensaverMessagePosition,
	interpolateScreensaverHeadingDegrees,
	SCREENSAVER_INITIAL_VELOCITY
} from '../utils/screensaver';
import BreezyfinWindMark from './BreezyfinWindMark';

import css from './ScreensaverOverlay.module.less';

const MESSAGE_FADE_MS = 520;
const MESSAGE_VISIBLE_MS = 2800;

const ScreensaverOverlay = ({active = false, message = ''}) => {
	const rootRef = useRef(null);
	const markRef = useRef(null);
	const headingRef = useRef(null);
	const messageRef = useRef(null);

	useEffect(() => {
		if (!active) return undefined;
		const root = rootRef.current;
		const mark = markRef.current;
		const heading = headingRef.current;
		if (!root || !mark || !heading) return undefined;
		let animationFrame = null;
		let lastFrameAt = 0;
		let position = {x: 0, y: 0};
		let velocityX = SCREENSAVER_INITIAL_VELOCITY.x;
		let velocityY = SCREENSAVER_INITIAL_VELOCITY.y;
		let headingDegrees = getScreensaverHeadingDegrees({velocityX, velocityY});
		let dimensions = {
			viewportWidth: root.clientWidth,
			viewportHeight: root.clientHeight,
			itemWidth: mark.offsetWidth,
			itemHeight: mark.offsetHeight
		};

		const applyPosition = () => {
			mark.style.transform = `translate3d(${position.x.toFixed(1)}px, ${position.y.toFixed(1)}px, 0)`;
		};
		const applyHeading = (elapsedMs = 16.67) => {
			const targetDegrees = getScreensaverHeadingDegrees({velocityX, velocityY});
			headingDegrees = interpolateScreensaverHeadingDegrees({
				currentDegrees: headingDegrees,
				targetDegrees,
				progress: Math.min(1, elapsedMs / 180)
			});
			heading.style.transform = `translate(-50%, -50%) rotate(${headingDegrees.toFixed(2)}deg)`;
		};
		const measure = () => {
			dimensions = {
				viewportWidth: root.clientWidth,
				viewportHeight: root.clientHeight,
				itemWidth: mark.offsetWidth,
				itemHeight: mark.offsetHeight
			};
			position = clampScreensaverPosition({...position, ...dimensions});
			applyPosition();
		};
		position = clampScreensaverPosition({
			x: Math.max(0, dimensions.viewportWidth * 0.16),
			y: Math.max(0, dimensions.viewportHeight * 0.18),
			...dimensions
		});
		applyPosition();
		applyHeading();

		const tick = (timestamp) => {
			if (!lastFrameAt) lastFrameAt = timestamp;
			const elapsedMs = Math.min(Math.max(0, timestamp - lastFrameAt), 250);
			lastFrameAt = timestamp;
			const next = advanceScreensaverPosition({
				...position,
				velocityX,
				velocityY,
				deltaSeconds: elapsedMs / 1000,
				...dimensions
			});
			position = {x: next.x, y: next.y};
			velocityX = next.velocityX;
			velocityY = next.velocityY;
			applyPosition();
			applyHeading(elapsedMs);
			animationFrame = window.requestAnimationFrame(tick);
		};
		window.addEventListener('resize', measure);
		animationFrame = window.requestAnimationFrame(tick);
		return () => {
			window.removeEventListener('resize', measure);
			if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
			mark.style.transform = '';
			heading.style.transform = '';
		};
	}, [active]);

	useEffect(() => {
		if (!active || !message) return undefined;
		const root = rootRef.current;
		const messageElement = messageRef.current;
		if (!root || !messageElement) return undefined;
		let cycleTimer = null;
		let revealTimer = null;
		let revealFrame = null;

		const moveMessage = () => {
			const position = getScreensaverMessagePosition({
				viewportWidth: root.clientWidth,
				viewportHeight: root.clientHeight,
				itemWidth: messageElement.offsetWidth,
				itemHeight: messageElement.offsetHeight
			});
			messageElement.style.transform = `translate3d(${position.x.toFixed(1)}px, ${position.y.toFixed(1)}px, 0)`;
		};
		const revealMessage = () => {
			moveMessage();
			revealFrame = window.requestAnimationFrame(() => {
				messageElement.style.opacity = '1';
			});
		};
		const cycleMessage = () => {
			messageElement.style.opacity = '0';
			revealTimer = setTimeout(revealMessage, MESSAGE_FADE_MS);
			cycleTimer = setTimeout(cycleMessage, MESSAGE_VISIBLE_MS + (MESSAGE_FADE_MS * 2));
		};

		revealMessage();
		cycleTimer = setTimeout(cycleMessage, MESSAGE_VISIBLE_MS);
		window.addEventListener('resize', moveMessage);
		return () => {
			window.removeEventListener('resize', moveMessage);
			if (cycleTimer !== null) clearTimeout(cycleTimer);
			if (revealTimer !== null) clearTimeout(revealTimer);
			if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
			messageElement.style.opacity = '';
			messageElement.style.transform = '';
		};
	}, [active, message]);

	if (!active) return null;
	return (
		<div
			ref={rootRef}
			className={css.screensaver}
			data-bf-screensaver="true"
			aria-hidden={message ? undefined : true}
			role={message ? 'status' : undefined}
		>
			<div ref={markRef} className={css.traveler}>
				<div ref={headingRef} className={css.heading}>
					<BreezyfinWindMark animated={false} className={css.logo} tone="white" />
				</div>
			</div>
			{message ? <div ref={messageRef} className={css.message}>{message}</div> : null}
		</div>
	);
};

export default ScreensaverOverlay;
