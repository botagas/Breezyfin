// Centralized key code definitions for webOS remotes and keyboards.
// Having a single source of truth keeps navigation/controls consistent.

export const KeyCodes = {
	LEFT: 37,
	UP: 38,
	RIGHT: 39,
	DOWN: 40,
	ENTER: 13,
	OK: 13, // Alias

	// webOS remote-specific
	BACK: 461,
	BACK_SOFT: 412, // some remotes send 412 on back
	EXIT: 174,
	RED: 403,
	GREEN: 404,
	YELLOW: 405,
	BLUE: 406,
	PLAY: 415,
	MEDIA_PLAY_PAUSE: 179, // keyboard media key on some remotes/devices
	PAUSE: 19,
	STOP: 413,
	REWIND: 412,
	FAST_FORWARD: 417,

	// Keyboard equivalents
	SPACE: 32,
	ESC: 27,
	TAB: 9,
	BACKSPACE: 8,
	DELETE: 46
};

export const isNavigationKey = (code) => {
	return (
		code === KeyCodes.LEFT ||
		code === KeyCodes.UP ||
		code === KeyCodes.RIGHT ||
		code === KeyCodes.DOWN ||
		code === KeyCodes.ENTER ||
		code === KeyCodes.OK
	);
};

export const isBackKey = (code) => {
	return (
		code === KeyCodes.BACK ||
		code === KeyCodes.BACK_SOFT ||
		code === KeyCodes.EXIT ||
		code === KeyCodes.BACKSPACE ||
		code === KeyCodes.ESC
	);
};
