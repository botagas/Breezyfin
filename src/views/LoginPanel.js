import { useState, useEffect, useMemo, useCallback } from 'react';
import { Panel } from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import Input from '@enact/sandstone/Input';
import Item from '@enact/sandstone/Item';
import jellyfinService from '../services/jellyfinService';

import css from './LoginPanel.module.less';

const LoginPanel = ({ onLogin, ...rest }) => {
	const [serverUrl, setServerUrl] = useState('http://');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [status, setStatus] = useState('');
	const [step, setStep] = useState('server'); // 'server' or 'login'
	const [savedServers, setSavedServers] = useState([]);
	const [resumingKey, setResumingKey] = useState(null);

	const refreshSavedServers = useCallback(() => {
		try {
			setSavedServers(jellyfinService.getSavedServers() || []);
		} catch (err) {
			console.error('Failed to load saved servers:', err);
		}
	}, []);

	useEffect(() => {
		const lastServer = localStorage.getItem('lastJellyfinServer');
		if (lastServer) {
			setServerUrl(lastServer);
		}
		refreshSavedServers();
	}, [refreshSavedServers]);

	const normalizedServerUrl = useMemo(
		() => serverUrl.trim().replace(/\/+$/, ''),
		[serverUrl]
	);
	const serverUrlValid = /^https?:\/\//i.test(normalizedServerUrl);

	const resetMessages = () => {
		setError(null);
		setStatus('');
	};

	const handleConnect = async () => {
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
			setError('Failed to connect to server. Please check the URL.');
			setStatus('');
		} finally {
			setLoading(false);
		}
	};

	const handleLogin = async () => {
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
			setError('Login failed. Please check your credentials.');
			setStatus('');
		} finally {
			setLoading(false);
			refreshSavedServers();
		}
	};

	const handleBack = () => {
		setStep('server');
		resetMessages();
	};

	const handleResume = async (entry) => {
		if (!entry) return;
		const key = `${entry.serverId}:${entry.userId}`;
		setResumingKey(key);
		setLoading(true);
		setError(null);
		setStatus('Restoring saved session...');
		try {
			jellyfinService.setActiveServer(entry.serverId, entry.userId);
			// Validate quickly by fetching user info; failures will return null/throw
			const user = await jellyfinService.getCurrentUser();
			if (!user) {
				throw new Error('Session is no longer valid');
			}
			onLogin();
		} catch (err) {
			console.error('Failed to resume session:', err);
			setError('Could not resume saved session. Please sign in again.');
			setStep('server');
		} finally {
			setLoading(false);
			setResumingKey(null);
			setStatus('');
			refreshSavedServers();
		}
	};

	return (
		<Panel {...rest} noCloseButton>
			<Scroller>
				<div className={css.page}>
					<div className={css.loginBox}>
						<div className={css.header}>
							<Heading size="large" spacing="medium">
								{step === 'server' ? 'Connect to Jellyfin Server' : 'Sign In'}
							</Heading>
							{loading && <Spinner className={css.inlineSpinner} />}
						</div>

						{savedServers.length > 0 && (
							<div className={css.savedServers}>
								<div className={css.savedHeader}>
									<Heading size="small" spacing="none">Saved servers</Heading>
									<BodyText className={css.savedHint}>Jump back into a remembered server without re-entering credentials.</BodyText>
								</div>
								<div className={css.savedList}>
									{savedServers.map((entry) => {
										const key = `${entry.serverId}:${entry.userId}`;
										return (
											<Item
												key={key}
												className={`${css.savedItem} ${entry.isActive ? css.activeSaved : ''}`}
												onClick={() => handleResume(entry)}
											>
												<div className={css.savedMain}>
													<div className={css.savedTitle}>{entry.serverName || 'Jellyfin Server'}</div>
													<div className={css.savedMeta}>{entry.username} • {entry.url}</div>
												</div>
												<div className={css.savedActions}>
													<Button
														size="small"
														minWidth={false}
														disabled={loading}
														selected={resumingKey === key}
													>
														{resumingKey === key ? 'Resuming...' : 'Resume'}
													</Button>
												</div>
											</Item>
										);
									})}
								</div>
							</div>
						)}

						<BodyText className={css.lead}>
							{step === 'server'
								? 'Enter your Jellyfin server URL to get started.'
								: 'Use your Jellyfin credentials to sign in.'}
						</BodyText>

						{step === 'server' ? (
							<div className={css.form}>
									<Input
										type="url"
										placeholder="http://192.168.1.100:8096"
										value={serverUrl}
										onChange={(e) => setServerUrl(e.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
										disabled={loading}
										invalid={!serverUrlValid}
										className={css.inputField}
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
									onChange={(e) => setUsername(e.value)}
									disabled={loading}
									onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
									className={css.inputField}
								/>
								<Input
									type="password"
									placeholder="Password"
									value={password}
									onChange={(e) => setPassword(e.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
									disabled={loading}
									className={css.inputField}
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
