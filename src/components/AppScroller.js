import Scroller from '@enact/sandstone/Scroller';

import {SCROLLER_OVERSCROLL_EFFECT_OFF} from '../constants/scroller';
import {useWheelScrollSpotlightPause} from '../hooks/useWheelScrollSpotlightPause';

const AppScroller = ({overscrollEffectOn = SCROLLER_OVERSCROLL_EFFECT_OFF, onScrollStart, onScrollStop, ...rest}) => {
	const {handleScrollStart, handleScrollStop} = useWheelScrollSpotlightPause({onScrollStart, onScrollStop});
	return (
		<Scroller
			{...rest}
			onScrollStart={handleScrollStart}
			onScrollStop={handleScrollStop}
			overscrollEffectOn={overscrollEffectOn}
		/>
	);
};

export default AppScroller;