import css from '../../PlayerPanel.module.less';

const PlayerToast = ({message, hidden}) => {
	if (!message || hidden) return null;
	return <div className={css.playerToast}>{message}</div>;
};

export default PlayerToast;
