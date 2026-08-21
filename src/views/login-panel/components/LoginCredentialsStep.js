import BodyText from '@enact/sandstone/BodyText';
import Input from '@enact/sandstone/Input';
import Button from '../../../components/BreezyButton';

const LoginCredentialsStep = ({
	serverUrl,
	username,
	password,
	loading,
	focusPassword = false,
	quickConnectAvailable = false,
	onUsernameChange,
	onUsernameKeyDown,
	onPasswordChange,
	onPasswordKeyDown,
	onBack,
	onLogin,
	onQuickConnect,
	css
}) => (
	<div className={css.form}>
		<BodyText className={css.serverInfo}>Server: {serverUrl}</BodyText>
		<Input
			placeholder="Username"
			value={username}
			onChange={onUsernameChange}
			disabled={loading}
			onKeyDown={onUsernameKeyDown}
			className={`bf-input-trigger ${css.inputField}`}
		/>
		<Input
			type="password"
			autoFocus={focusPassword}
			placeholder="Password (optional)"
			value={password}
			onChange={onPasswordChange}
			onKeyDown={onPasswordKeyDown}
			disabled={loading}
			className={`bf-input-trigger ${css.inputField}`}
		/>
		<div className={css.buttonRow}>
			<Button
				onClick={onBack}
				disabled={loading}
				size="large"
				focusEffect="static"
				className={css.authTextButton}
			>
				Back
			</Button>
			<Button
				onClick={onLogin}
				disabled={!String(username || '').trim() || loading}
				size="large"
				focusEffect="static"
				className={css.authTextButton}
			>
				{loading ? 'Signing In...' : 'Sign In'}
			</Button>
		</div>
		{quickConnectAvailable ? (
			<Button
				onClick={onQuickConnect}
				disabled={loading}
				size="large"
				focusEffect="static"
				className={css.authTextButton}
			>
				Use Quick Connect
			</Button>
		) : null}
	</div>
);

export default LoginCredentialsStep;
