import {BREEZYFIN_USER_DATA_INVALIDATED_EVENT} from '../constants/integrationEvents';
import {INTEGRATION_PREFERENCES_CHANGED_EVENT} from './integrationPreferences';

// Home is unmounted on every panel switch. Its loaded content is kept here so returning with Back
// shows it immediately; the Home tab passes a new reset token, which forces a fresh load.
// A stale entry is still shown, but Home refreshes it in the background.
let cachedEntry = null;

export const getHomeContentSessionKey = (service) => `${service?.serverUrl || ''}|${service?.userId || ''}|${service?.sessionGeneration || 0}`;

export const readHomeContentCache = (sessionKey, resetToken) => (
    cachedEntry?.sessionKey === sessionKey && cachedEntry.resetToken === resetToken ? cachedEntry : null
);

export const writeHomeContentCache = (sessionKey, resetToken, content, {loadedAt = Date.now(), stale = false} = {}) => {
    const focus = readHomeContentCache(sessionKey, resetToken)?.focus;
    cachedEntry = {sessionKey, resetToken, content, loadedAt, stale, focus};
};

// Spotlight id of the row (or hero Play button) that was opened, restored when Home comes back with Back.
export const rememberHomeFocus = (spotlightId) => {
    if (cachedEntry) cachedEntry.focus = spotlightId || null;
};

export const markHomeContentCacheStale = () => {
    if (cachedEntry) cachedEntry.stale = true;
};

export const clearHomeContentCache = () => {
    cachedEntry = null;
};

// These events often fire while Home is not mounted (e.g. on the media page).
if (typeof window !== 'undefined') {
    window.addEventListener(BREEZYFIN_USER_DATA_INVALIDATED_EVENT, markHomeContentCacheStale);
    // A different Home source means different rows, so the cached layout is unusable.
    window.addEventListener(INTEGRATION_PREFERENCES_CHANGED_EVENT, clearHomeContentCache);
}