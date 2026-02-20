import Scroller from '@enact/sandstone/Scroller';

import { SCROLLER_OVERSCROLL_EFFECT_OFF } from '../constants/scroller';

const AppScroller = ({overscrollEffectOn = SCROLLER_OVERSCROLL_EFFECT_OFF, ...rest}) => {
	return (
		<Scroller
			{...rest}
			overscrollEffectOn={overscrollEffectOn}
		/>
	);
};

export default AppScroller;
