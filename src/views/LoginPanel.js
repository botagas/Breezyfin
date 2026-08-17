import { useState, useEffect, useMemo, useCallback } from 'react';
import { Panel } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../components/AppScroller';
import Spinner from '@enact/sandstone/Spinner';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import {getUserErrorMessage} from '../utils/errorMessages';
import { useMapById } from '../hooks/useMapById';
import { useImageErrorFallback } from '../hooks/useImageErrorFallback';
import {usePanelBackHandler} from '../hooks/usePanelBackHandler';
import {
	captureRuntimeSessionIdentity,
	getSavedSessionKey,
	isRuntimeSessionIdentityCurrent
} from '../utils/savedSessionIdentity';
import {buildUserPrimaryImageUrl} from './login-panel/utils/loginImageUrls';
import {useLoginBackdrops} from './login-panel/hooks/useLoginBackdrops';
import LoginBackdropLayer from './login-panel/components/LoginBackdropLayer';
import LoginSavedAccountsStep from './login-panel/components/LoginSavedAccountsStep';
import LoginServerSelectStep from './login-panel/components/LoginServerSelectStep';
import LoginServerConnectStep from './login-panel/components/LoginServerConnectStep';
import LoginCredentialsStep from './login-panel/components/LoginCredentialsStep';
import LoginQuickConnectStep from './login-panel/components/LoginQuickConnectStep';
import {useLoginQuickConnect} from './login-panel/hooks/useLoginQuickConnect';

import css from './LoginPanel.module.less';
import imageLoadCss from '../components/ImageLoadReveal.module.less';

const SpottableDiv = Spottable('div');

const LoginPanel = ({
	onLogin,
	onNavigate = null,
	isActive = false,
	deferBackdrops = false,
	sessionNotice = '',
	sessionNoticeNonce = 0,
	sessionReauthenticationKey = null,
	registerBackHandler = null,
	...rest
}) => {
	const [serverUrl, setServerUrl] = useState('http://');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [status, setStatus] = useState('');
	const [notice, setNotice] = useState('');
	const [step, setStep] = useState('saved'); // 'saved' | 'server' | 'serverSelect' | 'login' | 'quickConnect'
	const [savedServers, setSavedServers] = useState([]);
	const [resumingKey, setResumingKey] = useState(null);
	const [reauthenticatingKey, setReauthenticatingKey] = useState(null);
	const savedServerKeySelector = useCallback((entry) => getSavedSessionKey(entry), []);
	const savedServersByKey = useMapById(savedServers, savedServerKeySelector);
	const savedServerChoices = useMemo(() => {
		const choicesByServerId = new Map();
		(savedServers || []).forEach((entry) => {
			if (!entry?.serverId || !entry?.url || choicesByServerId.has(entry.serverId)) return;
			choicesByServerId.set(entry.serverId, {
				serverId: entry.serverId,
				serverName: entry.serverName,
				url: entry.url,
				lastConnected: entry.lastConnected
			});
		});
		return Array.from(choicesByServerId.values())
			.sort((a, b) => (b.lastConnected || '').localeCompare(a.lastConnected || ''));
	}, [savedServers]);
	const {
		currentBackdropUrl,
		previousBackdropUrl,
		isBackdropTransitioning,
		backdropImageErrors,
		currentBackdropLoaded,
		previousBackdropLoaded,
		handleBackdropLoad,
		handleBackdropError
	} = useLoginBackdrops({
		isActive,
		deferLoading: deferBackdrops,
		savedServers
	});
	const getInitialStep = useCallback((entries) => {
		return entries.length > 0 ? 'saved' : 'server';
	}, []);
	const clearLoginMessages = useCallback(() => {
		setNotice('');
		setError(null);
		setStatus('');
	}, []);
	const {
		available: quickConnectAvailable,
		phase: quickConnectPhase,
		code: quickConnectCode,
		error: quickConnectError,
		checkAvailability: checkQuickConnectAvailability,
		start: startQuickConnect,
		retry: retryQuickConnect,
		cancel: cancelQuickConnect
	} = useLoginQuickConnect({
		isActive,
		onAuthenticated: onLogin
	});

	const refreshSavedServers = useCallback(() => {
		try {
			const entries = jellyfinService.getSavedServers() || [];
			setSavedServers(entries);
			return entries;
		} catch (err) {
			console.error('Failed to load saved servers:', err);
			setSavedServers([]);
			return [];
		}
	}, []);

	useEffect(() => {
		const lastServer = localStorage.getItem('lastJellyfinServer');
		if (lastServer) {
			setServerUrl(lastServer);
		}
		const entries = refreshSavedServers();
		setStep(getInitialStep(entries));
	}, [getInitialStep, refreshSavedServers]);

	useEffect(() => {
		if (!isActive) return;
		const entries = refreshSavedServers();
		setStep(getInitialStep(entries));
		setUsername('');
		setPassword('');
		setError(null);
		setStatus('');
		setResumingKey(null);
		setReauthenticatingKey(null);
		setLoading(false);
		cancelQuickConnect();
	}, [cancelQuickConnect, getInitialStep, isActive, refreshSavedServers]);

	useEffect(() => {
		if (!sessionNotice) return undefined;
		setNotice(sessionNotice);
		const timer = window.setTimeout(() => {
			setNotice('');
		}, 3800);
		return () => {
			window.clearTimeout(timer);
		};
	}, [sessionNotice, sessionNoticeNonce]);

	const normalizedServerUrl = useMemo(
		() => serverUrl.trim().replace(/\/+$/, ''),
		[serverUrl]
	);
	const serverUrlValid = /^https?:\/\//i.test(normalizedServerUrl);

	const handleConnect = useCallback(async () => {
		if (!serverUrlValid) {
			setError('Enter a valid http(s) server URL.');
			return;
		}

		cancelQuickConnect();
		clearLoginMessages();
		setLoading(true);
		setStatus('Connecting to server...');

		try {
			await jellyfinService.connect(normalizedServerUrl);
			localStorage.setItem('lastJellyfinServer', normalizedServerUrl);
			setStep('login');
			setReauthenticatingKey(null);
			setStatus('Connected. Enter your credentials.');
			void checkQuickConnectAvailability();
		} catch (err) {
			setError(getUserErrorMessage(err, 'Failed to connect to server. Please check the URL.'));
			setStatus('');
		} finally {
			setLoading(false);
		}
	}, [cancelQuickConnect, checkQuickConnectAvailability, clearLoginMessages, normalizedServerUrl, serverUrlValid]);

	const handleLogin = useCallback(async () => {
		const normalizedUsername = String(username || '').trim();
		if (!normalizedUsername) {
			setError('Username is required.');
			return;
		}

		cancelQuickConnect();
		clearLoginMessages();
		setLoading(true);
		setStatus('Signing in...');

		try {
			await jellyfinService.authenticate(normalizedUsername, String(password || ''));
			onLogin();
		} catch (err) {
			setError(getUserErrorMessage(err, 'Login failed. Please check your credentials.'));
			setStatus('');
		} finally {
			setLoading(false);
			refreshSavedServers();
		}
	}, [cancelQuickConnect, clearLoginMessages, onLogin, password, refreshSavedServers, username]);

	const handleBack = useCallback(() => {
		cancelQuickConnect();
		clearLoginMessages();
		setReauthenticatingKey(null);
		setStep(savedServers.length > 0 ? 'saved' : 'server');
	}, [cancelQuickConnect, clearLoginMessages, savedServers.length]);

	const handleAddServer = useCallback(() => {
		cancelQuickConnect();
		clearLoginMessages();
		setReauthenticatingKey(null);
		setUsername('');
		setPassword('');
		setStep('server');
	}, [cancelQuickConnect, clearLoginMessages]);

	const connectToSavedServer = useCallback(async (serverChoice, options = {}) => {
		if (!serverChoice?.url) return;
		cancelQuickConnect();
		clearLoginMessages();
		setLoading(true);
		setStatus(`Connecting to ${serverChoice.serverName || 'server'}...`);
		try {
			await jellyfinService.connect(serverChoice.url);
			localStorage.setItem('lastJellyfinServer', serverChoice.url);
			setServerUrl(serverChoice.url);
			setUsername(options.username || '');
			setPassword('');
			setReauthenticatingKey(options.reauthenticationKey || null);
			setStep('login');
			setStatus('Connected. Enter your credentials.');
			void checkQuickConnectAvailability();
		} catch (err) {
			setError(getUserErrorMessage(err, 'Failed to connect to saved server.'));
			setStatus('');
		} finally {
			setLoading(false);
		}
	}, [cancelQuickConnect, checkQuickConnectAvailability, clearLoginMessages]);

	const handleAddUser = useCallback(() => {
		cancelQuickConnect();
		clearLoginMessages();
		setReauthenticatingKey(null);
		setUsername('');
		setPassword('');
		if (savedServerChoices.length === 0) {
			setStep('server');
			setStatus('Add a server first, then sign in.');
			return;
		}
		if (savedServerChoices.length === 1) {
			connectToSavedServer(savedServerChoices[0]);
			return;
		}
		setStep('serverSelect');
	}, [cancelQuickConnect, clearLoginMessages, connectToSavedServer, savedServerChoices]);

	const handleSavedServerSelect = useCallback((event) => {
		const serverId = event.currentTarget.dataset.serverId;
		const serverChoice = savedServerChoices.find((entry) => entry.serverId === serverId);
		if (!serverChoice) return;
		connectToSavedServer(serverChoice);
	}, [connectToSavedServer, savedServerChoices]);

	const handleOpenSettings = useCallback(() => {
		if (typeof onNavigate !== 'function') return;
		onNavigate('settings');
	}, [onNavigate]);

	const handleResume = useCallback(async (entry) => {
		if (!entry) return;
		const key = `${entry.serverId}:${entry.userId}`;
		clearLoginMessages();
		cancelQuickConnect();
		setResumingKey(key);
		setLoading(true);
		setError(null);
		setStatus('Restoring saved session...');
		let resumedSessionIdentity = null;
		try {
			jellyfinService.setActiveServer(entry.serverId, entry.userId);
			resumedSessionIdentity = captureRuntimeSessionIdentity(jellyfinService);
			if (!resumedSessionIdentity) {
				throw new Error('Saved session could not be activated');
			}
			const user = await jellyfinService.getCurrentUser();
			if (!isRuntimeSessionIdentityCurrent(resumedSessionIdentity, jellyfinService)) return;
			if (!user) {
				throw new Error('Session is no longer valid');
			}
			onLogin();
		} catch (err) {
			if (
				resumedSessionIdentity &&
				!isRuntimeSessionIdentityCurrent(resumedSessionIdentity, jellyfinService)
			) {
				return;
			}
			console.error('Failed to resume session:', err);
			await connectToSavedServer(entry, {
				username: entry.username || '',
				reauthenticationKey: key
			});
		} finally {
			const resumedSessionIsCurrent = !resumedSessionIdentity ||
				isRuntimeSessionIdentityCurrent(resumedSessionIdentity, jellyfinService);
			if (resumedSessionIsCurrent) {
				setLoading(false);
				setResumingKey(null);
				setStatus('');
				refreshSavedServers();
			}
		}
	}, [cancelQuickConnect, clearLoginMessages, connectToSavedServer, onLogin, refreshSavedServers]);

	const handleResumeClick = useCallback((event) => {
		const key = event.currentTarget.dataset.resumeKey;
		const entry = savedServersByKey.get(key);
		if (!entry) return;
		if (key === sessionReauthenticationKey) {
			connectToSavedServer(entry, {
				username: entry.username || '',
				reauthenticationKey: key
			});
			return;
		}
		handleResume(entry);
	}, [connectToSavedServer, handleResume, savedServersByKey, sessionReauthenticationKey]);

	const handleStartQuickConnect = useCallback(() => {
		clearLoginMessages();
		setStep('quickConnect');
		void startQuickConnect();
	}, [clearLoginMessages, startQuickConnect]);

	const handleRetryQuickConnect = useCallback(() => {
		clearLoginMessages();
		void retryQuickConnect();
	}, [clearLoginMessages, retryQuickConnect]);

	const handleQuickConnectBack = useCallback(() => {
		cancelQuickConnect({preserveAvailability: true});
		clearLoginMessages();
		setStep('login');
	}, [cancelQuickConnect, clearLoginMessages]);

	const handlePanelBack = useCallback(() => {
		if (loading) return true;
		if (step === 'quickConnect') {
			handleQuickConnectBack();
			return true;
		}
		if (step === 'login' || step === 'serverSelect') {
			handleBack();
			return true;
		}
		if (step === 'server' && savedServers.length > 0) {
			handleBack();
			return true;
		}
		return false;
	}, [handleBack, handleQuickConnectBack, loading, savedServers.length, step]);
	usePanelBackHandler(registerBackHandler, handlePanelBack, {enabled: isActive});

	const handleServerUrlChange = useCallback((event) => {
		setServerUrl(event.value);
	}, []);

	const handleServerUrlKeyDown = useCallback((event) => {
		if (event.key === 'Enter') {
			handleConnect();
		}
	}, [handleConnect]);

	const handleUsernameChange = useCallback((event) => {
		setUsername(event.value);
	}, []);

	const handleUsernameKeyDown = useCallback((event) => {
		if (event.key === 'Enter') {
			handleLogin();
		}
	}, [handleLogin]);

	const handlePasswordChange = useCallback((event) => {
		setPassword(event.value);
	}, []);

	const handlePasswordKeyDown = useCallback((event) => {
		if (event.key === 'Enter') {
			handleLogin();
		}
	}, [handleLogin]);

	const getSavedUserAvatarUrl = useCallback((entry) => {
		return buildUserPrimaryImageUrl({
			baseUrl: entry?.url,
			userId: entry?.userId,
			accessToken: entry?.accessToken,
			width: 88,
			tag: entry?.avatarTag || null
		});
	}, []);

	const handleSavedAvatarError = useImageErrorFallback(css.savedAvatarImageUnavailable);

	const headingText = step === 'saved'
		? 'Choose Account'
		: step === 'server'
			? 'Connect to Jellyfin Server'
			: step === 'serverSelect'
				? 'Choose Server'
				: step === 'quickConnect'
					? 'Quick Connect'
					: 'Sign In';
	const leadText = step === 'saved'
		? 'Select a saved account, add a server, or add another user.'
		: step === 'server'
			? 'Enter your Jellyfin server URL to get started.'
			: step === 'serverSelect'
				? 'Select the server you want to sign in to.'
				: step === 'quickConnect'
					? 'Approve this sign-in from another Jellyfin client.'
					: 'Use your Jellyfin credentials to sign in.';

	return (
		<Panel {...rest} noCloseButton>
			<Scroller>
				<div className={css.page}>
					<LoginBackdropLayer
						css={css}
						imageLoadCss={imageLoadCss}
						isBackdropTransitioning={isBackdropTransitioning}
						previousBackdropUrl={previousBackdropUrl}
						currentBackdropUrl={currentBackdropUrl}
						backdropImageErrors={backdropImageErrors}
						previousBackdropLoaded={previousBackdropLoaded}
						currentBackdropLoaded={currentBackdropLoaded}
						onBackdropLoad={handleBackdropLoad}
						onBackdropError={handleBackdropError}
					/>
					{onNavigate ? (
						<div className={css.topActions}>
							<Button
								onClick={handleOpenSettings}
								size="small"
								icon="gear"
								aria-label="Open settings and diagnostics"
								focusEffect="static"
								className={css.settingsIconButton}
							/>
						</div>
					) : null}
					<div className={css.loginBox}>
						<div className={css.header}>
							<div className={css.headerTitle}>
								<Heading size="large" spacing="medium">
									{headingText}
								</Heading>
								{loading && <Spinner className={css.inlineSpinner} />}
							</div>
						</div>

						<BodyText className={css.lead}>{leadText}</BodyText>

						{step === 'saved' ? (
							<LoginSavedAccountsStep
								SavedItemComponent={SpottableDiv}
								savedServers={savedServers}
								resumingKey={resumingKey}
								reauthenticationKey={sessionReauthenticationKey}
								loading={loading}
								getSavedUserAvatarUrl={getSavedUserAvatarUrl}
								onResumeClick={handleResumeClick}
								onAddServer={handleAddServer}
								onAddUser={handleAddUser}
								onSavedAvatarError={handleSavedAvatarError}
								css={css}
							/>
						) : step === 'server' ? (
							<LoginServerConnectStep
								serverUrl={serverUrl}
								loading={loading}
								serverUrlValid={serverUrlValid}
								onServerUrlChange={handleServerUrlChange}
								onServerUrlKeyDown={handleServerUrlKeyDown}
								onConnect={handleConnect}
								css={css}
							/>
						) : step === 'serverSelect' ? (
							<LoginServerSelectStep
								servers={savedServerChoices}
								loading={loading}
								onServerSelect={handleSavedServerSelect}
								onBack={handleBack}
								css={css}
							/>
						) : step === 'quickConnect' ? (
							<LoginQuickConnectStep
								phase={quickConnectPhase}
								code={quickConnectCode}
								error={quickConnectError}
								onRetry={handleRetryQuickConnect}
								onBack={handleQuickConnectBack}
								css={css}
							/>
						) : (
							<LoginCredentialsStep
								serverUrl={serverUrl}
								username={username}
								password={password}
								loading={loading}
								focusPassword={Boolean(reauthenticatingKey)}
								quickConnectAvailable={quickConnectAvailable === true}
								onUsernameChange={handleUsernameChange}
								onUsernameKeyDown={handleUsernameKeyDown}
								onPasswordChange={handlePasswordChange}
								onPasswordKeyDown={handlePasswordKeyDown}
								onBack={handleBack}
								onLogin={handleLogin}
								onQuickConnect={handleStartQuickConnect}
								css={css}
							/>
						)}

						{status && <BodyText className={css.status}>{status}</BodyText>}

						{notice && (
							<div className={css.noticeBanner}>
								<BodyText>{notice}</BodyText>
							</div>
						)}

						{error && (
							<div className={css.errorBanner}>
								<BodyText>{error}</BodyText>
							</div>
						)}
					</div>
				</div>
			</Scroller>
		</Panel>
	);
};

export default LoginPanel;
