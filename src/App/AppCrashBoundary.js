import {Component} from 'react';
import Button from '../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import Heading from '@enact/sandstone/Heading';

import {getCrashErrorMessage} from '../utils/errorMessages';
import {appendAppLog} from '../utils/appLogger';
import {getRuntimePlatformCapabilities} from '../utils/platformCapabilities';
import {isBackKey} from '../utils/keyCodes';
import {CRASH_RECOVERY_ACTIONS, queueCrashRecoveryAction} from '../utils/crashRecovery';

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
		document.addEventListener('keydown', this.handleCrashKeyDown, true);
	}

	componentWillUnmount() {
		window.removeEventListener('error', this.handleWindowError);
		window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
		document.removeEventListener('keydown', this.handleCrashKeyDown, true);
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

	handleRecoverWithAction = (action) => {
		queueCrashRecoveryAction(action);
		this.handleRecover();
	};

	handleCrashKeyDown = (event) => {
		if (!this.state?.error) return;
		const code = event?.keyCode || event?.which;
		if (!isBackKey(code)) return;
		event.preventDefault?.();
		event.stopPropagation?.();
		event.stopImmediatePropagation?.();
		this.handleRecoverWithAction(CRASH_RECOVERY_ACTIONS.BACK);
	};

	handleRecoverBack = () => {
		this.handleRecoverWithAction(CRASH_RECOVERY_ACTIONS.BACK);
	};

	handleRecoverToHome = () => {
		this.handleRecoverWithAction(CRASH_RECOVERY_ACTIONS.HOME);
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
							<Button size="large" onClick={this.handleRecoverBack} autoFocus className="bf-error-action-button">
								Back
							</Button>
							<Button size="large" onClick={this.handleRecoverToHome} className="bf-error-action-button">
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
