import {Component} from 'react';
import Button from '../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import Heading from '@enact/sandstone/Heading';

import {getCrashErrorMessage} from '../utils/errorMessages';
import {appendAppLog} from '../utils/appLogger';

import css from './AppCrashBoundary.module.less';

class AppCrashBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = {
			error: null,
			resetToken: 0
		};
	}

	componentDidCatch(error, info) {
		console.error('[AppCrashBoundary] React render error:', error, info);
		appendAppLog('error', '[AppCrashBoundary] componentDidCatch', error, info?.componentStack || '');
		this.setState({error});
	}

	componentDidMount() {
		window.addEventListener('error', this.handleWindowError);
		window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
	}

	componentWillUnmount() {
		window.removeEventListener('error', this.handleWindowError);
		window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
	}

	handleWindowError = (event) => {
		const error = event?.error || new Error(event?.message || 'Unexpected runtime error');
		console.error('[AppCrashBoundary] Global error event:', error);
		appendAppLog('error', '[AppCrashBoundary] window.error', error);
		this.setState({error});
	};

	handleUnhandledRejection = (event) => {
		const reason = event?.reason;
		const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled promise rejection'));
		console.error('[AppCrashBoundary] Unhandled promise rejection:', error);
		appendAppLog('error', '[AppCrashBoundary] unhandledrejection', error);
		this.setState({error});
	};

	handleRecover = () => {
		this.setState((prev) => ({
			error: null,
			resetToken: prev.resetToken + 1
		}));
	};

	render() {
		const {children} = this.props;
		const {error, resetToken} = this.state;

		if (error) {
			return (
				<div className={css.crashRoot}>
					<div className={css.crashCard}>
						<Heading size="large" spacing="none" className={css.crashTitle}>Something went wrong</Heading>
						<BodyText className={css.crashMessage}>
							{getCrashErrorMessage(error)}
						</BodyText>
						<div className={css.crashActions}>
							<Button size="large" onClick={this.handleRecover} autoFocus>
								Return Home
							</Button>
						</div>
					</div>
				</div>
			);
		}

		return <div key={resetToken}>{children}</div>;
	}
}

export default AppCrashBoundary;
