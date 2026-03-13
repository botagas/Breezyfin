import { useState, useEffect, useMemo, useCallback } from 'react';
import { Panel } from '../components/BreezyPanels';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../components/AppScroller';
import Spinner from '@enact/sandstone/Spinner';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import {getUserErrorMessage} from '../utils/errorMessages';
import { useMapById } from '../hooks/useMapById';
import { useImageErrorFallback } from '../hooks/useImageErrorFallback';
import {buildUserPrimaryImageUrl} from './login-panel/utils/loginImageUrls';
import {useLoginBackdrops} from './login-panel/hooks/useLoginBackdrops';
import LoginBackdropLayer from './login-panel/components/LoginBackdropLayer';
import LoginSavedAccountsStep from './login-panel/components/LoginSavedAccountsStep';
import LoginServerConnectStep from './login-panel/components/LoginServerConnectStep';
import LoginCredentialsStep from './login-panel/components/LoginCredentialsStep';

import css from './LoginPanel.module.less';
import imageLoadCss from '../components/ImageLoadReveal.module.less';

const SpottableDiv = Spottable('div');

const LoginPanel = ({ onLogin, isActive = false, sessionNotice = '', sessionNoticeNonce = 0, ...rest }) => {
	const [serverUrl, setServerUrl] = useState('http://');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [status, setStatus] = useState('');
	const [notice, setNotice] = useState('');
	const [step, setStep] = useState('saved'); // 'saved' | 'server' | 'login'
	const [savedServers, setSavedServers] = useState([]);
	const [resumingKey, setResumingKey] = useState(null);
	const [loadedSavedAvatarKeys, setLoadedSavedAvatarKeys] = useState(() => new Set());
	const savedServerKeySelector = useCallback(
		(entry) => `${entry.serverId}:${entry.userId}`,
		[]
	);
	const savedServersByKey = useMapById(savedServers, savedServerKeySelector);
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
		savedServers
	});
	const savedAvatarKeysSignature = useMemo(
		() => savedServers.map((entry) => `${entry.serverId}:${entry.userId}`).join('|'),
		[savedServers]
	);

	const getInitialStep = useCallback((entries) => {
		return entries.length > 0 ? 'saved' : 'server';
	}, []);

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
		setLoading(false);
	}, [getInitialStep, isActive, refreshSavedServers]);

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

	useEffect(() => {
		setLoadedSavedAvatarKeys(new Set());
	}, [savedAvatarKeysSignature]);

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

		setLoading(true);
		setError(null);
		setStatus('Connecting to server...');

		try {
			await jellyfinService.connect(normalizedServerUrl);
			localStorage.setItem('lastJellyfinServer', normalizedServerUrl);
			setStep('login');
			setStatus('Connected. Enter your credentials.');
		} catch (err) {
			setError(getUserErrorMessage(err, 'Failed to connect to server. Please check the URL.'));
			setStatus('');
		} finally {
			setLoading(false);
		}
	}, [normalizedServerUrl, serverUrlValid]);

	const handleLogin = useCallback(async () => {
		const normalizedUsername = String(username || '').trim();
		if (!normalizedUsername) {
			setError('Username is required.');
			return;
		}

		setLoading(true);
		setError(null);
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
	}, [onLogin, password, refreshSavedServers, username]);

	const handleBack = useCallback(() => {
		setError(null);
		setStatus('');
		setStep(savedServers.length > 0 ? 'saved' : 'server');
	}, [savedServers.length]);

	const handleManualLogin = useCallback(() => {
		setError(null);
		setStatus('');
		setStep('server');
	}, []);

	const handleResume = useCallback(async (entry) => {
		if (!entry) return;
		const key = `${entry.serverId}:${entry.userId}`;
		setResumingKey(key);
		setLoading(true);
		setError(null);
		setStatus('Restoring saved session...');
		try {
			jellyfinService.setActiveServer(entry.serverId, entry.userId);
			const user = await jellyfinService.getCurrentUser();
			if (!user) {
				throw new Error('Session is no longer valid');
			}
			onLogin();
		} catch (err) {
			console.error('Failed to resume session:', err);
			setError(getUserErrorMessage(err, 'Could not resume saved session. Please sign in again.'));
			setStep(savedServers.length > 0 ? 'saved' : 'server');
		} finally {
			setLoading(false);
			setResumingKey(null);
			setStatus('');
			refreshSavedServers();
		}
	}, [onLogin, refreshSavedServers, savedServers.length]);

	const handleResumeClick = useCallback((event) => {
		const key = event.currentTarget.dataset.resumeKey;
		const entry = savedServersByKey.get(key);
		if (!entry) return;
		handleResume(entry);
	}, [handleResume, savedServersByKey]);

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

	const handleSavedAvatarLoad = useCallback((event) => {
		const avatarKey = event.currentTarget?.dataset?.savedAvatarKey;
		if (!avatarKey) return;
		setLoadedSavedAvatarKeys((currentKeys) => {
			if (currentKeys.has(avatarKey)) return currentKeys;
			const nextKeys = new Set(currentKeys);
			nextKeys.add(avatarKey);
			return nextKeys;
		});
	}, []);

	const handleSavedAvatarError = useImageErrorFallback(null, {
		onError: (_, {image}) => {
			const avatarKey = image?.dataset?.savedAvatarKey;
			if (!avatarKey) return;
			setLoadedSavedAvatarKeys((currentKeys) => {
				if (!currentKeys.has(avatarKey)) return currentKeys;
				const nextKeys = new Set(currentKeys);
				nextKeys.delete(avatarKey);
				return nextKeys;
			});
		}
	});

	const headingText = step === 'saved'
		? 'Choose Account'
		: step === 'server'
			? 'Connect to Jellyfin Server'
			: 'Sign In';
	const leadText = step === 'saved'
		? 'Select a saved account, or continue with manual login.'
		: step === 'server'
			? 'Enter your Jellyfin server URL to get started.'
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
					<div className={css.loginBox}>
						<div className={css.header}>
							<Heading size="large" spacing="medium">
								{headingText}
							</Heading>
							{loading && <Spinner className={css.inlineSpinner} />}
						</div>

						<BodyText className={css.lead}>{leadText}</BodyText>

						{step === 'saved' ? (
							<LoginSavedAccountsStep
								SavedItemComponent={SpottableDiv}
								savedServers={savedServers}
								resumingKey={resumingKey}
								loading={loading}
								loadedSavedAvatarKeys={loadedSavedAvatarKeys}
								getSavedUserAvatarUrl={getSavedUserAvatarUrl}
								onResumeClick={handleResumeClick}
								onManualLogin={handleManualLogin}
								onSavedAvatarLoad={handleSavedAvatarLoad}
								onSavedAvatarError={handleSavedAvatarError}
								css={css}
								imageLoadCss={imageLoadCss}
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
						) : (
							<LoginCredentialsStep
								serverUrl={serverUrl}
								username={username}
								password={password}
								loading={loading}
								onUsernameChange={handleUsernameChange}
								onUsernameKeyDown={handleUsernameKeyDown}
								onPasswordChange={handlePasswordChange}
								onPasswordKeyDown={handlePasswordKeyDown}
								onBack={handleBack}
								onLogin={handleLogin}
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
