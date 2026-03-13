import Input from '@enact/sandstone/Input';
import Button from '../../../components/BreezyButton';

const LoginServerConnectStep = ({
	serverUrl,
	loading,
	serverUrlValid,
	onServerUrlChange,
	onServerUrlKeyDown,
	onConnect,
	css
}) => (
	<div className={css.form}>
		<Input
			type="url"
			placeholder="http://192.168.1.100:8096"
			value={serverUrl}
			onChange={onServerUrlChange}
			onKeyDown={onServerUrlKeyDown}
			disabled={loading}
			invalid={!serverUrlValid}
			className={`bf-input-trigger ${css.inputField}`}
		/>
		<Button
			onClick={onConnect}
			disabled={!serverUrlValid || loading}
			size="large"
		>
			{loading ? 'Connecting...' : 'Connect'}
		</Button>
	</div>
);

export default LoginServerConnectStep;
