import Button from '../../../components/BreezyButton';
import BodyText from '@enact/sandstone/BodyText';

const LoginSavedAccountsStep = ({
	SavedItemComponent,
	savedServers,
	resumingKey,
	loading,
	loadedSavedAvatarKeys,
	getSavedUserAvatarUrl,
	onResumeClick,
	onManualLogin,
	onSavedAvatarLoad,
	onSavedAvatarError,
	css,
	imageLoadCss
}) => (
	<div className={css.savedServers}>
		<div className={css.savedList}>
			{savedServers.map((entry) => {
				const key = `${entry.serverId}:${entry.userId}`;
				const isResuming = resumingKey === key;
				const userInitial = (entry.username || '?').charAt(0).toUpperCase();
				const avatarUrl = getSavedUserAvatarUrl(entry);
				const avatarLoaded = loadedSavedAvatarKeys.has(key);
				const avatarClassName = `${imageLoadCss.imageReveal} ${avatarLoaded ? imageLoadCss.imageRevealLoaded : ''}`;
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
										className={avatarClassName}
										onLoad={onSavedAvatarLoad}
										onError={onSavedAvatarError}
										loading="lazy"
										decoding="async"
										draggable={false}
									/>
									{!avatarLoaded ? (
										<div className={`${imageLoadCss.imageLoadingHint} ${css.savedAvatarLoadingHint}`} aria-hidden="true" />
									) : null}
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
