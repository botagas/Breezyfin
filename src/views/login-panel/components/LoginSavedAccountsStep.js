import Button from '../../../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';

const LoginSavedAccountsStep = ({
	SavedItemComponent,
	savedServers,
	resumingKey,
	loading,
	getSavedUserAvatarUrl,
	onResumeClick,
	onManualLogin,
	onSavedAvatarError,
	css
}) => (
	<div className={css.savedServers}>
		<div className={css.savedList}>
			{savedServers.map((entry) => {
				const key = `${entry.serverId}:${entry.userId}`;
				const isResuming = resumingKey === key;
				const userInitial = (entry.username || '?').charAt(0).toUpperCase();
				const avatarUrl = getSavedUserAvatarUrl(entry);
				return (
					<SavedItemComponent
						key={key}
						data-resume-key={key}
						className={`${css.savedItem} ${entry.isActive ? css.activeSaved : ''}`}
						onClick={onResumeClick}
					>
						<div className={css.savedAvatar}>
							{avatarUrl && (
								<>
									<img
										src={avatarUrl}
										alt={`${entry.username || 'User'} avatar`}
										data-saved-avatar-key={key}
										onError={onSavedAvatarError}
										draggable={false}
									/>
								</>
							)}
							<span className={css.savedAvatarFallback}>{userInitial}</span>
						</div>
						<BodyText className={css.savedName}>
							{entry.username || 'User'}
						</BodyText>
						<BodyText className={css.savedState}>
							{isResuming ? 'Opening...' : (entry.serverName || 'Jellyfin Server')}
						</BodyText>
					</SavedItemComponent>
				);
			})}
		</div>
		<Button
			onClick={onManualLogin}
			disabled={loading}
			size="large"
			className={css.manualLoginButton}
		>
			Log in manually
		</Button>
	</div>
);

export default LoginSavedAccountsStep;
