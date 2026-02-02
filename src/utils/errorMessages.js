const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const DEFAULT_CRASH_MESSAGE = 'The app hit an unexpected issue. You can safely return to Home.';

const toMessage = (error) => {
	if (!error) return '';
	if (typeof error === 'string') return error;
	if (typeof error.message === 'string') return error.message;
	return String(error);
};

export const getPlaybackErrorMessage = (error, fallback = 'Failed to play video') => {
	const raw = toMessage(error);
	if (!raw) return fallback;

	const message = raw.toLowerCase();
	if (message.includes('not supported') || message.includes('no supported source')) {
		return 'Format not supported';
	}
	if (message.includes('decode') || message.includes('codec')) {
		return 'Decode error';
	}
	if (message.includes('network')) {
		return 'Network error';
	}
	if (message.includes('aborted')) {
		return 'Playback aborted';
	}

	return raw || fallback;
};

export const isFatalPlaybackError = (error) => {
	if (!error) return false;
	const name = (error.name || '').toLowerCase();
	const message = toMessage(error).toLowerCase();

	return (
		name === 'notsupportederror' ||
		message.includes('not supported') ||
		message.includes('no supported source') ||
		message.includes('decode') ||
		message.includes('codec')
	);
};

export const getUserErrorMessage = (error, fallback = DEFAULT_ERROR_MESSAGE) => {
	const message = toMessage(error).trim();
	return message || fallback;
};

export const getCrashErrorMessage = (error) => {
	const message = toMessage(error).trim();
	return message || DEFAULT_CRASH_MESSAGE;
};

