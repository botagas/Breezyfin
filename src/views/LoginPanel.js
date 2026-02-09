import { useState, useEffect, useMemo, useCallback } from 'react';
import { Panel } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import Input from '@enact/sandstone/Input';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import {getUserErrorMessage} from '../utils/errorMessages';

import css from './LoginPanel.module.less';

const SpottableDiv = Spottable('div');

const LoginPanel = ({ onLogin, isActive = false, ...rest }) => {
	const [serverUrl, setServerUrl] = useState('http://');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [status, setStatus] = useState('');
	const [step, setStep] = useState('saved'); // 'saved' | 'server' | 'login'
	const [savedServers, setSavedServers] = useState([]);
	const [resumingKey, setResumingKey] = useState(null);
	const savedServersByKey = useMemo(() => {
		const map = new Map();
		savedServers.forEach((entry) => {
			const key = `${entry.serverId}:${entry.userId}`;
			map.set(key, entry);
		});
		return map;
	}, [savedServers]);

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
		if (!username || !password) {
			setError('Username and password are required.');
			return;
		}

		setLoading(true);
		setError(null);
		setStatus('Signing in...');

		try {
			await jellyfinService.authenticate(username, password);
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
		if (!entry?.url || !entry?.userId || !entry?.accessToken) return '';
		const base = `${entry.url}/Users/${entry.userId}/Images/Primary`;
		const params = new URLSearchParams({
			width: '88',
			api_key: entry.accessToken
		});
		if (entry.avatarTag) {
			params.set('tag', entry.avatarTag);
		}
		return `${base}?${params.toString()}`;
	}, []);

	const handleSavedAvatarError = useCallback((event) => {
		event.currentTarget.style.display = 'none';
	}, []);

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
					<div className={css.loginBox}>
						<div className={css.header}>
							<Heading size="large" spacing="medium">
								{headingText}
							</Heading>
							{loading && <Spinner className={css.inlineSpinner} />}
						</div>

						<BodyText className={css.lead}>{leadText}</BodyText>

						{step === 'saved' ? (
							<div className={css.savedServers}>
								<div className={css.savedList}>
									{savedServers.map((entry) => {
										const key = `${entry.serverId}:${entry.userId}`;
										const isResuming = resumingKey === key;
										const userInitial = (entry.username || '?').charAt(0).toUpperCase();
										const avatarUrl = getSavedUserAvatarUrl(entry);
										return (
											<SpottableDiv
												key={key}
												data-resume-key={key}
												className={`${css.savedItem} ${entry.isActive ? css.activeSaved : ''}`}
												onClick={handleResumeClick}
											>
												<div className={css.savedAvatar}>
													{avatarUrl && (
														<img
															src={avatarUrl}
															alt={`${entry.username || 'User'} avatar`}
															onError={handleSavedAvatarError}
														/>
													)}
													<span className={css.savedAvatarFallback}>{userInitial}</span>
												</div>
												<BodyText className={css.savedName}>
													{entry.username || 'User'}
												</BodyText>
												<BodyText className={css.savedState}>
													{isResuming ? 'Opening...' : (entry.serverName || 'Jellyfin Server')}
												</BodyText>
											</SpottableDiv>
										);
									})}
								</div>
								<Button
									onClick={handleManualLogin}
									disabled={loading}
									size="large"
									className={css.manualLoginButton}
								>
									Log in manually
								</Button>
							</div>
						) : step === 'server' ? (
							<div className={css.form}>
								<Input
									type="url"
									placeholder="http://192.168.1.100:8096"
									value={serverUrl}
									onChange={handleServerUrlChange}
									onKeyDown={handleServerUrlKeyDown}
									disabled={loading}
									invalid={!serverUrlValid}
									className={`bf-input-trigger ${css.inputField}`}
								/>
								<Button
									onClick={handleConnect}
									disabled={!serverUrlValid || loading}
									size="large"
								>
									{loading ? 'Connecting...' : 'Connect'}
								</Button>
							</div>
						) : (
							<div className={css.form}>
								<BodyText className={css.serverInfo}>Server: {serverUrl}</BodyText>
								<Input
									placeholder="Username"
									value={username}
									onChange={handleUsernameChange}
									disabled={loading}
									onKeyDown={handleUsernameKeyDown}
									className={`bf-input-trigger ${css.inputField}`}
								/>
								<Input
									type="password"
									placeholder="Password"
									value={password}
									onChange={handlePasswordChange}
									onKeyDown={handlePasswordKeyDown}
									disabled={loading}
									className={`bf-input-trigger ${css.inputField}`}
								/>
								<div className={css.buttonRow}>
									<Button onClick={handleBack} disabled={loading} size="large">
										Back
									</Button>
									<Button
										onClick={handleLogin}
										disabled={!username || !password || loading}
										size="large"
									>
										{loading ? 'Signing In...' : 'Sign In'}
									</Button>
								</div>
							</div>
						)}

						{status && <BodyText className={css.status}>{status}</BodyText>}

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
