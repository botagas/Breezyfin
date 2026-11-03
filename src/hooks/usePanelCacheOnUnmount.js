import {useEffect, useRef} from 'react';

// Persisting a panel snapshot on every change re-renders the whole App, so the latest
// snapshot builder is kept in a ref and persisted once when the panel unmounts.
export const usePanelCacheOnUnmount = (onCacheState, getSnapshot) => {
    const latestRef = useRef({onCacheState, getSnapshot});

    useEffect(() => {
        latestRef.current = {onCacheState, getSnapshot};
    }, [getSnapshot, onCacheState]);

    useEffect(() => () => {
        const {onCacheState: persistSnapshot, getSnapshot: buildSnapshot} = latestRef.current;
        if (typeof persistSnapshot === 'function') {
            persistSnapshot(buildSnapshot());
        }
    }, []);
};