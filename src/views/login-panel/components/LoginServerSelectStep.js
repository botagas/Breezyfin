import BodyText from '@enact/sandstone/BodyText';
import Button from '../../../components/BreezyButton';

const LoginServerSelectStep = ({
	servers,
	loading,
	onServerSelect,
	onBack,
	css
}) => (
	<div className={css.form}>
		<BodyText className={css.serverInfo}>Choose which saved server to add a user to.</BodyText>
		<div className={css.savedList}>
			{servers.map((server) => (
				<Button
					key={server.serverId}
					data-server-id={server.serverId}
					onClick={onServerSelect}
					disabled={loading}
					size="large"
					className={css.authTextButton}
				>
					{server.serverName || server.url || 'Jellyfin Server'}
				</Button>
			))}
		</div>
		<Button
			onClick={onBack}
			disabled={loading}
			size="large"
			focusEffect="static"
			className={css.authTextButton}
		>
			Back
		</Button>
	</div>
);

export default LoginServerSelectStep;
