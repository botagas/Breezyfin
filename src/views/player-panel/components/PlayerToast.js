import BreezyToast from '../../../components/BreezyToast';
import css from '../../../components/BreezyToast.module.less';

const PlayerToast = ({message, severity = 'info', messages, visible}) => {
	if (Array.isArray(messages)) {
		if (!visible || messages.length === 0) return null;
		return (
			<div className={css.toastStack}>
				{messages.map((toast) => (
					<BreezyToast
						key={toast.id}
						message={toast.message}
						severity={toast.severity}
						visible={toast.visible}
						stacked
					/>
				))}
			</div>
		);
	}

	return <BreezyToast message={message} severity={severity} visible={visible} />;
};

export default PlayerToast;
