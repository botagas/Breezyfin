import css from '../../MediaDetailsPanel.module.less';

const MediaDetailsToast = ({message, visible}) => {
	if (!message) return null;

	return (
		<div
			className={`${css.toast} ${visible ? css.toastVisible : ''}`}
			role="status"
			aria-live="polite"
		>
			{message}
		</div>
	);
};

export default MediaDetailsToast;
