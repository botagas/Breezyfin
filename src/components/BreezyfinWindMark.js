import breezyfinWindLogo from '../../images/Breezyfin_logo_transparent.png';
import breezyfinScreensaverLogo from '../../images/Breezyfin_logo_screensaver.png';

import css from './BreezyfinWindMark.module.less';

const joinClasses = (...names) => names.filter(Boolean).join(' ');

const BreezyfinWindMark = ({
	animated = true,
	className = '',
	tone = 'brand'
}) => (
	<span
		className={joinClasses(
			css.mark,
			animated && css.animated,
			tone === 'white' && css.white,
			className
		)}
		aria-hidden="true"
		data-bf-wind-mark={tone}
	>
		<img
			className={css.image}
			src={tone === 'white' ? breezyfinScreensaverLogo : breezyfinWindLogo}
			alt=""
			draggable={false}
		/>
	</span>
);

export default BreezyfinWindMark;
