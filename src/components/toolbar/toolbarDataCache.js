// Every panel mounts its own Toolbar, so session data is kept here and loaded once
// per login instead of on every panel switch.
let cachedEntry = null;

export const readToolbarData = (sessionKey) => (
    cachedEntry?.sessionKey === sessionKey ? cachedEntry : null
);

export const writeToolbarData = (sessionKey, patch) => {
    cachedEntry = {...(readToolbarData(sessionKey) || {sessionKey}), ...patch};
};

export const resetToolbarDataCache = () => {
    cachedEntry = null;
};