import BodyText from '@enact/sandstone/BodyText';
import Spinner from '@enact/sandstone/Spinner';
import Button from '../../../components/BreezyButton';

const LoginQuickConnectStep = ({phase, code, error, onRetry, onBack, css}) => {
	const waiting = phase === 'starting' || phase === 'waiting' || phase === 'completing';
	const canRetry = phase === 'failed' || phase === 'expired';
	return (
		<div className={css.quickConnectStep}>
			{code ? (
				<div className={css.quickConnectCode} aria-label={`Quick Connect code ${code}`}>
					{code}
				</div>
			) : null}
			{code ? (
				<BodyText className={css.quickConnectInstructions}>
					Open Settings &gt; Quick Connect in another signed-in Jellyfin client, then enter this code.
				</BodyText>
			) : null}
			{waiting ? (
				<div className={css.quickConnectStatus} role="status">
					<Spinner />
					<BodyText>
						{phase === 'starting'
							? 'Generating code...'
							: phase === 'completing'
								? 'Signing in...'
								: 'Waiting for approval...'}
					</BodyText>
				</div>
			) : null}
			{error ? <BodyText className={css.quickConnectError}>{error}</BodyText> : null}
			<div className={css.buttonRow}>
				{canRetry ? (
					<Button
						onClick={onRetry}
						autoFocus
						size="large"
						focusEffect="static"
						className={css.authTextButton}
					>
						Retry
					</Button>
				) : null}
				<Button
					onClick={onBack}
					autoFocus={waiting}
					size="large"
					focusEffect="static"
					className={css.authTextButton}
				>
					Back
				</Button>
			</div>
		</div>
	);
};

export default LoginQuickConnectStep;
