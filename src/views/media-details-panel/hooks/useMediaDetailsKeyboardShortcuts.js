import {useEffect} from 'react';
import Spotlight from '@enact/spotlight';
import {KeyCodes} from '../../../utils/keyCodes';

const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, KeyCodes.PLAY, 179];

export const useMediaDetailsKeyboardShortcuts = ({
	isActive,
	detailsDebugEnabled,
	logDetailsDebug,
	describeNode,
	getScrollSnapshot,
	handleInternalBack,
	handlePlay
}) => {
	useEffect(() => {
		if (!isActive) return undefined;

		const handleKeyDown = (event) => {
			const code = event.keyCode || event.which;
			const isBack = BACK_KEYS.includes(code);
			const isPlay = PLAY_KEYS.includes(code);

			if ((isBack || isPlay) && detailsDebugEnabled) {
				logDetailsDebug('keydown', {
					code,
					isBack,
					isPlay,
					target: describeNode(event.target),
					active: describeNode(document.activeElement),
					pointerMode: Spotlight?.getPointerMode?.(),
					scroll: getScrollSnapshot()
				});
			}

			if (isBack) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation?.();
				handleInternalBack();
				return;
			}

			if (isPlay) {
				if (Spotlight?.getPointerMode?.()) {
					logDetailsDebug('play-key-skipped-pointer-mode', {
						target: describeNode(event.target),
						active: describeNode(document.activeElement),
						scroll: getScrollSnapshot()
					});
					return;
				}

				const target = event.target;
				const interactiveTarget = target?.closest?.(
					'button, input, select, textarea, [role="button"], [role="textbox"], [tabindex], .spottable, [data-spotlight-id]'
				);
				if (interactiveTarget) {
					logDetailsDebug('play-key-ignored-interactive-target', {
						target: describeNode(target),
						interactiveTarget: describeNode(interactiveTarget),
						active: describeNode(document.activeElement)
					});
					return;
				}
				event.preventDefault();
				logDetailsDebug('play-key-trigger-handlePlay', {
					target: describeNode(target),
					active: describeNode(document.activeElement),
					scroll: getScrollSnapshot()
				});
				handlePlay();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [
		describeNode,
		detailsDebugEnabled,
		getScrollSnapshot,
		handleInternalBack,
		handlePlay,
		isActive,
		logDetailsDebug
	]);
};
