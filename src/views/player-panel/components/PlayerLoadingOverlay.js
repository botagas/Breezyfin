import BreezyLoadingOverlay from '../../../components/BreezyLoadingOverlay';
import css from '../../PlayerPanel.module.less';

const PlayerLoadingOverlay = ({loading}) => {
	if (!loading) return null;

	return (
		<BreezyLoadingOverlay className={css.loading} />
	);
};

export default PlayerLoadingOverlay;
