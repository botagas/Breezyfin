import Button from '../../../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';

const LoginSavedAccountsStep = ({
	SavedItemComponent,
	savedServers,
	resumingKey,
	loading,
	getSavedUserAvatarUrl,
	onResumeClick,
	onAddServer,
	onAddUser,
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
				const avatarClassName = `${css.savedAvatar} ${avatarUrl ? css.savedAvatarWithImage : ''}`;
				return (
					<SavedItemComponent
						key={key}
						data-resume-key={key}
						className={`${css.savedItem} ${entry.isActive ? css.activeSaved : ''}`}
						onClick={onResumeClick}
					>
						<div className={avatarClassName}>
							{avatarUrl && (
								<>
									<img
										src={avatarUrl}
										alt=""
										aria-hidden="true"
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
		<div className={css.buttonRow}>
			<Button
				onClick={onAddServer}
				disabled={loading}
				size="large"
				focusEffect="static"
				className={css.authTextButton}
			>
				Add Server
			</Button>
			<Button
				onClick={onAddUser}
				disabled={loading}
				size="large"
				focusEffect="static"
				className={css.authTextButton}
			>
				Add User
			</Button>
		</div>
	</div>
);

export default LoginSavedAccountsStep;
