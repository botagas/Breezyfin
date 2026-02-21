import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Panel } from '../components/BreezyPanels';
import Button from '../components/BreezyButton';
import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Scroller from '../components/AppScroller';
import Spinner from '@enact/sandstone/Spinner';
import Input from '@enact/sandstone/Input';
import Spottable from '@enact/spotlight/Spottable';
import jellyfinService from '../services/jellyfinService';
import {getUserErrorMessage} from '../utils/errorMessages';
import { shuffleArray } from '../utils/arrayUtils';
import { useMapById } from '../hooks/useMapById';

import css from './LoginPanel.module.less';

const SpottableDiv = Spottable('div');

const LOGIN_BACKDROP_ITEM_LIMIT = 40;
const LOGIN_BACKDROP_WIDTH = 1920;
const LOGIN_BACKDROP_MAX_IMAGES = 24;
const LOGIN_BACKDROP_ROTATE_INTERVAL_MS = 9000;
const LOGIN_BACKDROP_TRANSITION_MS = 500;
const LOGIN_BACKDROP_IMAGE_FIELDS = [
	'BackdropImageTags',
	'ImageTags',
	'PrimaryImageTag',
	'SeriesId',
	'SeriesPrimaryImageTag',
	'ParentBackdropItemId',
	'ParentBackdropImageTags'
].join(',');

const getFirstImageTag = (value) => (
	Array.isArray(value) && typeof value[0] === 'string' && value[0]
		? value[0]
		: null
);

const buildItemImageUrl = ({ baseUrl, itemId, imageType, accessToken, width, tag = null, index = null }) => {
	if (!baseUrl || !itemId || !imageType || !accessToken) return '';
	const normalizedBase = baseUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		width: String(width),
		api_key: accessToken
	});
	if (tag) {
		params.set('tag', tag);
	}
	const imageSuffix = index == null ? imageType : `${imageType}/${index}`;
	return `${normalizedBase}/Items/${itemId}/Images/${imageSuffix}?${params.toString()}`;
};

const buildUserPrimaryImageUrl = ({ baseUrl, userId, accessToken, width, tag = null }) => {
	if (!baseUrl || !userId || !accessToken || !tag) return '';
	const normalizedBase = baseUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		width: String(width),
		api_key: accessToken,
		tag
	});
	return `${normalizedBase}/Users/${userId}/Images/Primary?${params.toString()}`;
};

const normalizeImageTag = (value) => (
	typeof value === 'string' && value ? value : null
);

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
	const [loginBackdropUrls, setLoginBackdropUrls] = useState([]);
	const [activeBackdropIndex, setActiveBackdropIndex] = useState(0);
	const [previousBackdropIndex, setPreviousBackdropIndex] = useState(null);
	const [isBackdropTransitioning, setIsBackdropTransitioning] = useState(false);
	const [backdropImageErrors, setBackdropImageErrors] = useState({});
	const backdropRotateTimerRef = useRef(null);
	const backdropTransitionTimerRef = useRef(null);
	const savedServerKeySelector = useCallback(
		(entry) => `${entry.serverId}:${entry.userId}`,
		[]
	);
	const savedServersByKey = useMapById(savedServers, savedServerKeySelector);
	const currentBackdropUrl = loginBackdropUrls[activeBackdropIndex] || '';
	const previousBackdropUrl =
		previousBackdropIndex === null || previousBackdropIndex === activeBackdropIndex
			? ''
			: loginBackdropUrls[previousBackdropIndex] || '';

	useEffect(() => () => {
		if (backdropRotateTimerRef.current) {
			clearInterval(backdropRotateTimerRef.current);
			backdropRotateTimerRef.current = null;
		}
		if (backdropTransitionTimerRef.current) {
			clearTimeout(backdropTransitionTimerRef.current);
			backdropTransitionTimerRef.current = null;
		}
	}, []);

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

	const fetchBackdropsForSavedServer = useCallback(async (entry, signal) => {
		if (!entry?.url || !entry?.userId || !entry?.accessToken) return [];
		const baseUrl = entry.url.replace(/\/+$/, '');
		const requestUrls = [
			`${baseUrl}/Users/${entry.userId}/Items?includeItemTypes=Movie,Series,Episode&recursive=true&limit=${LOGIN_BACKDROP_ITEM_LIMIT}&sortBy=DateCreated&sortOrder=Descending&fields=${LOGIN_BACKDROP_IMAGE_FIELDS}&imageTypeLimit=1&enableTotalRecordCount=false`,
			`${baseUrl}/Users/${entry.userId}/Items/Resume?limit=${LOGIN_BACKDROP_ITEM_LIMIT}&fields=${LOGIN_BACKDROP_IMAGE_FIELDS}&imageTypeLimit=1`
		];

		try {
			const responses = await Promise.all(
				requestUrls.map((requestUrl) => (
					fetch(requestUrl, {
						headers: {
							'X-Emby-Token': entry.accessToken
						},
						signal
					}).catch(() => null)
				))
			);
			const payloads = await Promise.all(
				responses
					.filter((response) => response?.ok)
					.map((response) => response.json().catch(() => null))
			);
			const items = [];
			payloads.forEach((data) => {
				if (Array.isArray(data?.Items)) {
					items.push(...data.Items);
				}
			});
			if (items.length === 0) return [];
			const urls = [];
			const addImageUrl = (itemId, imageType, tag = null, index = null) => {
				const imageUrl = buildItemImageUrl({
					baseUrl,
					itemId,
					imageType,
					accessToken: entry.accessToken,
					width: LOGIN_BACKDROP_WIDTH,
					tag,
					index
				});
				if (imageUrl) {
					urls.push(imageUrl);
				}
			};

			items.forEach((item) => {
				if (!item?.Id) return;
				const backdropTag = getFirstImageTag(item.BackdropImageTags)
					|| (typeof item.ImageTags?.Backdrop === 'string' && item.ImageTags.Backdrop ? item.ImageTags.Backdrop : null);
				if (backdropTag) {
					addImageUrl(item.Id, 'Backdrop', backdropTag, 0);
				}

				const primaryTag = item.PrimaryImageTag || item.ImageTags?.Primary || null;
				if (primaryTag) {
					addImageUrl(item.Id, 'Primary', primaryTag);
				}

				if (item.SeriesId && item.SeriesPrimaryImageTag) {
					addImageUrl(item.SeriesId, 'Primary', item.SeriesPrimaryImageTag);
				}

				if (item.ParentBackdropItemId) {
					const parentBackdropTag = getFirstImageTag(item.ParentBackdropImageTags);
					if (parentBackdropTag) {
						addImageUrl(item.ParentBackdropItemId, 'Backdrop', parentBackdropTag, 0);
					}
				}
			});
			return [...new Set(urls)];
		} catch (err) {
			if (err?.name === 'AbortError') return [];
			return [];
		}
	}, []);

	const resolveSavedUserBackdrop = useCallback(async (entry, signal) => {
		if (!entry?.url || !entry?.userId || !entry?.accessToken) return '';
		const baseUrl = entry.url.replace(/\/+$/, '');
		let tag = normalizeImageTag(entry.avatarTag);

		if (!tag) {
			try {
				const response = await fetch(`${baseUrl}/Users/${entry.userId}`, {
					headers: {
						'X-Emby-Token': entry.accessToken
					},
					signal
				});
				if (response?.ok) {
					const data = await response.json().catch(() => null);
					tag = normalizeImageTag(data?.PrimaryImageTag);
				}
			} catch (err) {
				if (err?.name === 'AbortError') return '';
			}
		}

		return buildUserPrimaryImageUrl({
			baseUrl: entry.url,
			userId: entry.userId,
			accessToken: entry.accessToken,
			width: LOGIN_BACKDROP_WIDTH,
			tag
		});
	}, []);

	useEffect(() => {
		if (!isActive) {
			setLoginBackdropUrls([]);
			setBackdropImageErrors({});
			return undefined;
		}

		const availableServers = (savedServers || [])
			.filter((entry) => entry?.url && entry?.userId && entry?.accessToken)
			.slice(0, 4);
		if (availableServers.length === 0) {
			setLoginBackdropUrls([]);
			setBackdropImageErrors({});
			return undefined;
		}

		const controller = new AbortController();
		let isCancelled = false;

		const loadBackdrops = async () => {
			try {
				const [perServerBackdrops, fallbackUserBackdrops] = await Promise.all([
					Promise.all(
						availableServers.map((entry) => fetchBackdropsForSavedServer(entry, controller.signal))
					),
					Promise.all(
						availableServers.map((entry) => resolveSavedUserBackdrop(entry, controller.signal))
					)
				]);
				if (isCancelled) return;
				const uniqueBackdrops = [...new Set(perServerBackdrops.flat().filter(Boolean))];
				const candidateBackdrops = [...new Set([
					...uniqueBackdrops,
					...fallbackUserBackdrops.filter(Boolean)
				])];
				const nextBackdrops = shuffleArray(candidateBackdrops).slice(0, LOGIN_BACKDROP_MAX_IMAGES);
				setLoginBackdropUrls(nextBackdrops);
				setBackdropImageErrors({});
			} catch (err) {
				if (isCancelled || err?.name === 'AbortError') return;
				setLoginBackdropUrls([]);
				setBackdropImageErrors({});
			}
		};

		loadBackdrops();

		return () => {
			isCancelled = true;
			controller.abort();
		};
	}, [fetchBackdropsForSavedServer, isActive, resolveSavedUserBackdrop, savedServers]);

	useEffect(() => {
		setActiveBackdropIndex(0);
		setPreviousBackdropIndex(null);
		setIsBackdropTransitioning(false);
	}, [loginBackdropUrls]);

	const advanceBackdrop = useCallback(() => {
		setActiveBackdropIndex((previousIndex) => {
			if (loginBackdropUrls.length < 2) return previousIndex;
			const nextIndex = (previousIndex + 1) % loginBackdropUrls.length;
			if (nextIndex === previousIndex) return previousIndex;
			setPreviousBackdropIndex(previousIndex);
			return nextIndex;
		});
	}, [loginBackdropUrls.length]);

	useEffect(() => {
		if (!isActive || loginBackdropUrls.length < 2) return undefined;
		if (backdropRotateTimerRef.current) {
			clearInterval(backdropRotateTimerRef.current);
		}
		backdropRotateTimerRef.current = setInterval(
			advanceBackdrop,
			LOGIN_BACKDROP_ROTATE_INTERVAL_MS
		);
		return () => {
			if (backdropRotateTimerRef.current) {
				clearInterval(backdropRotateTimerRef.current);
				backdropRotateTimerRef.current = null;
			}
		};
	}, [advanceBackdrop, isActive, loginBackdropUrls.length]);

	useEffect(() => {
		if (previousBackdropIndex === null || previousBackdropIndex === activeBackdropIndex) return undefined;
		setIsBackdropTransitioning(true);
		if (backdropTransitionTimerRef.current) {
			clearTimeout(backdropTransitionTimerRef.current);
		}
		backdropTransitionTimerRef.current = setTimeout(() => {
			setIsBackdropTransitioning(false);
			setPreviousBackdropIndex(null);
			backdropTransitionTimerRef.current = null;
		}, LOGIN_BACKDROP_TRANSITION_MS);
		return () => {
			if (backdropTransitionTimerRef.current) {
				clearTimeout(backdropTransitionTimerRef.current);
				backdropTransitionTimerRef.current = null;
			}
		};
	}, [activeBackdropIndex, previousBackdropIndex]);

	const handleBackdropError = useCallback((event) => {
		const source = event.currentTarget?.currentSrc || event.currentTarget?.src;
		if (!source) return;
		setBackdropImageErrors((previous) => (
			previous[source] ? previous : { ...previous, [source]: true }
		));
		setLoginBackdropUrls((previous) => (
			previous.includes(source)
				? previous.filter((url) => url !== source)
				: previous
		));
	}, []);

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
		return buildUserPrimaryImageUrl({
			baseUrl: entry?.url,
			userId: entry?.userId,
			accessToken: entry?.accessToken,
			width: 88,
			tag: entry?.avatarTag || null
		});
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
					<div className={css.backdropLayer} aria-hidden="true">
						{isBackdropTransitioning && previousBackdropUrl && !backdropImageErrors[previousBackdropUrl] ? (
							<img
								src={previousBackdropUrl}
								alt=""
								className={`${css.backdropImage} ${css.backdropImageOutgoing}`}
								onError={handleBackdropError}
							/>
						) : null}
						{currentBackdropUrl && !backdropImageErrors[currentBackdropUrl] ? (
							<img
								src={currentBackdropUrl}
								alt=""
								className={`${css.backdropImage} ${isBackdropTransitioning ? css.backdropImageIncoming : css.backdropImageCurrent}`}
								onError={handleBackdropError}
							/>
						) : null}
						<div className={css.backdropGradient} />
					</div>
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
									<Button
										onClick={handleBack}
										disabled={loading}
										size="large"
										focusEffect="static"
										className={css.authTextButton}
									>
										Back
									</Button>
									<Button
										onClick={handleLogin}
										disabled={!username || !password || loading}
										size="large"
										focusEffect="static"
										className={css.authTextButton}
									>
										{loading ? 'Signing In...' : 'Sign In'}
									</Button>
								</div>
							</div>
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
