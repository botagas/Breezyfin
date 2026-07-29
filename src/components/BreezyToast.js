import css from './BreezyToast.module.less';

const SEVERITY_CLASSES = {
	warning: css.toastWarning,
	error: css.toastError
};

const BreezyToast = ({message, visible, stacked = false, severity = 'info'}) => {
	if (!message) return null;
	const severityClass = SEVERITY_CLASSES[severity] || '';

	return (
		<div
			className={`${css.toast} ${severityClass} ${stacked ? css.toastStackItem : ''} ${visible ? css.toastVisible : ''}`}
			data-severity={severity}
			role="status"
			aria-live="polite"
		>
			{message}
		</div>
	);
};

export default BreezyToast;
