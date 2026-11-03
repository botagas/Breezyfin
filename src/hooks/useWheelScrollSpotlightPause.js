import {useCallback, useEffect, useMemo, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Pause from '@enact/spotlight/Pause';

// Magic Remote wheel scrolling comes in bursts; resuming after a short delay keeps focus from
// jumping to the item under the cursor between bursts.
export const WHEEL_SCROLL_RESUME_DELAY_MS = 400;

// While the wheel scrolls, items keep passing under the pointer and every pointer focus change
// costs a native focus plus style work on the TV. Spotlight stays paused until the scroll stops.
export const useWheelScrollSpotlightPause = ({onScrollStart, onScrollStop} = {}) => {
    const pause = useMemo(() => new Pause('wheel-scroll'), []);
    const resumeTimerRef = useRef(null);

    const clearResumeTimer = useCallback(() => {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
    }, []);

    const handleScrollStart = useCallback((event) => {
        clearResumeTimer();
        if (Spotlight.getPointerMode()) pause.pause();
        onScrollStart?.(event);
    }, [clearResumeTimer, onScrollStart, pause]);

    const handleScrollStop = useCallback((event) => {
        clearResumeTimer();
        resumeTimerRef.current = window.setTimeout(() => {
            resumeTimerRef.current = null;
            pause.resume();
        }, WHEEL_SCROLL_RESUME_DELAY_MS);
        onScrollStop?.(event);
    }, [clearResumeTimer, onScrollStop, pause]);

    useEffect(() => () => {
        clearResumeTimer();
        pause.resume();
    }, [clearResumeTimer, pause]);

    return {handleScrollStart, handleScrollStop};
};