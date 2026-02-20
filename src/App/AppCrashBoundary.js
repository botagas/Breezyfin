import {Component} from 'react';
import Button from '../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import Heading from '@enact/sandstone/Heading';

import {getCrashErrorMessage} from '../utils/errorMessages';
import {appendAppLog} from '../utils/appLogger';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';

import css from './AppCrashBoundary.module.less';

const shouldIgnoreResizeObserverLoopErrors = () => {
	const runtimeCapabilities = getRuntimePlatformCapabilities();
	return Boolean(runtimeCapabilities.webosV6Compat || runtimeCapabilities.webosV22Compat);
};

const isIgnorableObserverError = (value) => {
	if (!shouldIgnoreResizeObserverLoopErrors()) return false;
	if (!value) return false;
	const message = String(value);
	return (
		message.includes('ResizeObserver loop limit exceeded') ||
		message.includes('ResizeObserver loop completed with undelivered notifications')
	);
};

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
		if (isIgnorableObserverError(event?.message) || isIgnorableObserverError(event?.error?.message)) {
			appendAppLog('warn', '[AppCrashBoundary] Ignored non-fatal ResizeObserver warning', event?.message || '');
			return;
		}
		const error = event?.error || new Error(event?.message || 'Unexpected runtime error');
		console.error('[AppCrashBoundary] Global error event:', error);
		appendAppLog('error', '[AppCrashBoundary] window.error', error);
		this.setState({error});
	};

	handleUnhandledRejection = (event) => {
		const reason = event?.reason;
		if (isIgnorableObserverError(reason?.message) || isIgnorableObserverError(reason)) {
			appendAppLog('warn', '[AppCrashBoundary] Ignored non-fatal ResizeObserver rejection', reason?.message || reason || '');
			return;
		}
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
					<div className={`${css.crashCard} bf-error-surface`}>
						<Heading size="large" spacing="none" className={`${css.crashTitle} bf-error-title`}>Something went wrong</Heading>
						<BodyText className={`${css.crashMessage} bf-error-message`}>
							{getCrashErrorMessage(error)}
						</BodyText>
						<div className={`${css.crashActions} bf-error-actions`}>
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
