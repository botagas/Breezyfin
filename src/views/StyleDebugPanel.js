import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Scroller from '../components/AppScroller';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../components/BreezyButton';
import SettingsToolbar from '../components/SettingsToolbar';
import jellyfinService from '../services/jellyfinService';
import { shuffleArray } from '../utils/arrayUtils';
import { useBreezyfinSettingsSync } from '../hooks/useBreezyfinSettingsSync';
import { usePanelToolbarActions } from '../hooks/usePanelToolbarActions';

import css from './StyleDebugPanel.module.less';

const FALLBACK_DEBUG_BACKDROP_URL = '/icon.png';
const DEBUG_BACKDROP_WIDTH = 1920;

const resolveItemBackdropCandidates = (item) => {
	if (!item?.Id) return [];
	const candidates = [];
	if (Array.isArray(item.BackdropImageTags) && item.BackdropImageTags.length > 0) {
		candidates.push(jellyfinService.getBackdropUrl(item.Id, 0, DEBUG_BACKDROP_WIDTH));
	}
	if (item.SeriesId) {
		candidates.push(jellyfinService.getBackdropUrl(item.SeriesId, 0, DEBUG_BACKDROP_WIDTH));
	}
	if (item.PrimaryImageTag || item.ImageTags?.Primary) {
		candidates.push(jellyfinService.getImageUrl(item.Id, 'Primary', DEBUG_BACKDROP_WIDTH));
	}
	if (item.SeriesId && item.SeriesPrimaryImageTag) {
		candidates.push(jellyfinService.getImageUrl(item.SeriesId, 'Primary', DEBUG_BACKDROP_WIDTH));
	}
	return candidates.filter(Boolean);
};

const SNIPZY_NAV_ITEMS = ['Home', 'About', 'Services', 'Contact'];

const SNIPZY_SEARCH_TERMS = ['Glass effect components', 'Modern UI design', 'CSS animations'];

const SNIPZY_TOGGLES = [
	{ id: 'darkMode', label: 'Dark Mode' },
	{ id: 'notifications', label: 'Notifications' },
	{ id: 'autoUpdate', label: 'Auto Update' }
];

const StyleDebugPanel = ({ onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, isActive = false, ...rest }) => {
	const [modeState, setModeState] = useState({
		theme: 'classic',
		animations: 'on',
		allAnimations: 'on',
		inputMode: '5way'
	});
	const [backdropCandidates, setBackdropCandidates] = useState([FALLBACK_DEBUG_BACKDROP_URL]);
	const [backdropCandidateIndex, setBackdropCandidateIndex] = useState(0);
	const [snipzyNavActive, setSnipzyNavActive] = useState('Home');
	const [snipzySearchValue, setSnipzySearchValue] = useState('');
	const [snipzySearchFocused, setSnipzySearchFocused] = useState(false);
	const [snipzyToggleState, setSnipzyToggleState] = useState({
		darkMode: false,
		notifications: true,
		autoUpdate: false
	});
	const [snipzyExactFormMode, setSnipzyExactFormMode] = useState('login');
	const [snipzyExactFormSuccess, setSnipzyExactFormSuccess] = useState({
		login: false,
		register: false
	});
	const [snipzyExactFormError, setSnipzyExactFormError] = useState('');
	const exactFormSpecularRef = useRef(null);
	const exactFormDisplacementMapRef = useRef(null);
	const exactSearchInputRef = useRef(null);
	const exactSearchSpecularRef = useRef(null);
	const exactSearchDisplacementMapRef = useRef(null);
	const suppressNextSearchFocusRef = useRef(false);
	const activeBackdropUrl = backdropCandidates[backdropCandidateIndex] || FALLBACK_DEBUG_BACKDROP_URL;
	const hasSearchValue = snipzySearchValue.trim().length > 0;
	const normalizedSearchValue = snipzySearchValue.trim().toLowerCase();
	const snipzySuggestions =
		normalizedSearchValue.length === 0
			? SNIPZY_SEARCH_TERMS.slice(0, 5)
			: SNIPZY_SEARCH_TERMS.filter((term) => term.toLowerCase().includes(normalizedSearchValue)).slice(0, 5);
	const showSnipzySuggestions = snipzySearchFocused || hasSearchValue;
	const snipzyBackdropStyle = {
		'--snipzy-backdrop-image': `url("${activeBackdropUrl}")`
	};

	const syncModeState = useCallback(() => {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		setModeState({
			theme: root.getAttribute('data-bf-nav-theme') || 'classic',
			animations: root.getAttribute('data-bf-animations') || 'on',
			allAnimations: root.getAttribute('data-bf-all-animations') || 'on',
			inputMode: root.getAttribute('data-bf-input-mode') || '5way'
		});
	}, []);

	useBreezyfinSettingsSync(syncModeState);

	const handleSampleClick = useCallback(() => {}, []);

	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive
	});

	const loadRandomBackdropCandidate = useCallback(async () => {
		if (!jellyfinService?.serverUrl || !jellyfinService?.accessToken || !jellyfinService?.userId) {
			setBackdropCandidates([FALLBACK_DEBUG_BACKDROP_URL]);
			setBackdropCandidateIndex(0);
			return;
		}

		try {
			const [latestMedia, resumeItems, nextUpItems, recentItems] = await Promise.all([
				jellyfinService.getLatestMedia(['Movie', 'Series', 'Episode'], 40),
				jellyfinService.getResumeItems(20),
				jellyfinService.getNextUp(20),
				jellyfinService.getRecentlyAdded(20)
			]);

			const itemPool = shuffleArray([
				...(latestMedia || []),
				...(resumeItems || []),
				...(nextUpItems || []),
				...(recentItems || [])
			]).filter((item) => item?.Id);

			const candidates = [];
			itemPool.forEach((item) => {
				candidates.push(...resolveItemBackdropCandidates(item));
			});

			const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
			if (uniqueCandidates.length > 0) {
				setBackdropCandidates(uniqueCandidates);
				setBackdropCandidateIndex(0);
				return;
			}

			setBackdropCandidates([FALLBACK_DEBUG_BACKDROP_URL]);
			setBackdropCandidateIndex(0);
		} catch (error) {
			console.error('Failed to resolve style debug backdrop candidates:', error);
			setBackdropCandidates([FALLBACK_DEBUG_BACKDROP_URL]);
			setBackdropCandidateIndex(0);
		}
	}, []);

	useEffect(() => {
		loadRandomBackdropCandidate();
	}, [loadRandomBackdropCandidate]);

	const handleBackdropImageError = useCallback(() => {
		setBackdropCandidateIndex((previousIndex) => {
			if (previousIndex >= backdropCandidates.length - 1) {
				return previousIndex;
			}
			return previousIndex + 1;
		});
	}, [backdropCandidates.length]);

	const handleSnipzyToggle = useCallback((toggleId) => {
		setSnipzyToggleState((previous) => ({
			...previous,
			[toggleId]: !previous[toggleId]
		}));
	}, []);

	const handleSnipzySearchBlur = useCallback((event) => {
		if (event?.relatedTarget?.closest?.('[data-snipzy-search-suggestions="true"]')) {
			return;
		}
		window.setTimeout(() => setSnipzySearchFocused(false), 200);
	}, []);

	const handleSnipzyExactSwitchToRegister = useCallback((event) => {
		event.preventDefault();
		setSnipzyExactFormError('');
		setSnipzyExactFormMode('register');
	}, []);

	const handleSnipzyExactSwitchToLogin = useCallback((event) => {
		event.preventDefault();
		setSnipzyExactFormError('');
		setSnipzyExactFormMode('login');
	}, []);

	const handleSnipzyExactFormMouseMove = useCallback((event) => {
		const specular = exactFormSpecularRef.current;
		if (!specular) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		specular.style.background = `radial-gradient(
			circle at ${x}px ${y}px,
			rgba(255,255,255,0.15) 0%,
			rgba(255,255,255,0.05) 30%,
			rgba(255,255,255,0) 60%
		)`;
	}, []);

	const handleSnipzyExactFormMouseLeave = useCallback(() => {
		const displacementMap = exactFormDisplacementMapRef.current;
		if (displacementMap) {
			displacementMap.setAttribute('scale', '77');
		}
		const specular = exactFormSpecularRef.current;
		if (specular) {
			specular.style.background = 'none';
		}
	}, []);

	const handleSnipzyExactInputInvalid = useCallback((event) => {
		event.target.classList.add(css.snipzyExactFormInputError);
	}, []);

	const handleSnipzyExactInput = useCallback((event) => {
		if (event.target.validity.valid) {
			event.target.classList.remove(css.snipzyExactFormInputError);
		}
	}, []);

	const handleSnipzyExactFormSubmit = useCallback((event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const mode = form.dataset.mode === 'register' ? 'register' : 'login';
		const data = Object.fromEntries(new FormData(form).entries());
		if (mode === 'register') {
			const password = data.password;
			const confirmPassword = data['confirm-password'];
			if (password !== confirmPassword) {
				setSnipzyExactFormError('Passwords do not match.');
				return;
			}
		}
		setSnipzyExactFormError('');

		setSnipzyExactFormSuccess((previous) => ({
			...previous,
			[mode]: true
		}));

		window.setTimeout(() => {
			setSnipzyExactFormSuccess((previous) => ({
				...previous,
				[mode]: false
			}));
			form.reset();
		}, 2000);
	}, []);

	const handleSnipzyNavClick = useCallback((event) => {
		const nextItem = event.currentTarget?.dataset?.navItem;
		if (nextItem) {
			setSnipzyNavActive(nextItem);
		}
	}, []);

	const handleSnipzySearchChange = useCallback((event) => {
		setSnipzySearchValue(event.target.value);
	}, []);

	const handleSnipzySearchFocus = useCallback(() => {
		if (suppressNextSearchFocusRef.current) {
			suppressNextSearchFocusRef.current = false;
			return;
		}
		setSnipzySearchFocused(true);
	}, []);

	const handleSnipzySearchClear = useCallback((event) => {
		event.preventDefault();
		setSnipzySearchValue('');
		setSnipzySearchFocused(false);
		suppressNextSearchFocusRef.current = true;
		if (exactSearchInputRef.current) {
			exactSearchInputRef.current.focus();
		}
	}, []);

	const handleSnipzySuggestionClick = useCallback((event) => {
		const nextSuggestion = event.currentTarget?.dataset?.suggestion;
		if (nextSuggestion) {
			setSnipzySearchValue(nextSuggestion);
			setSnipzySearchFocused(false);
			suppressNextSearchFocusRef.current = true;
			if (exactSearchInputRef.current) {
				exactSearchInputRef.current.focus();
			}
		}
	}, []);

	const handleSnipzyExactSearchMouseMove = useCallback((event) => {
		const specular = exactSearchSpecularRef.current;
		if (!specular) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		specular.style.background = `radial-gradient(
			circle at ${x}px ${y}px,
			rgba(255,255,255,0.15) 0%,
			rgba(255,255,255,0.05) 30%,
			rgba(255,255,255,0) 60%
		)`;
	}, []);

	const handleSnipzyExactSearchMouseLeave = useCallback(() => {
		const displacementMap = exactSearchDisplacementMapRef.current;
		if (displacementMap) {
			displacementMap.setAttribute('scale', '77');
		}
		const specular = exactSearchSpecularRef.current;
		if (specular) {
			specular.style.background = 'none';
		}
	}, []);

	const handleSnipzyToggleChange = useCallback(
		(event) => {
			const toggleId = event.currentTarget?.dataset?.toggleId;
			if (!toggleId) return;
			handleSnipzyToggle(toggleId);
		},
		[handleSnipzyToggle]
	);

	const renderSnipzySampleBackdrop = () => (
		<img
			src={activeBackdropUrl}
			alt=""
			aria-hidden="true"
			className={css.snipzySampleBackdropImage}
			onError={handleBackdropImageError}
		/>
	);

	return (
		<Panel {...rest}>
			<Header title="Styling Debug Panel" />
			<SettingsToolbar
				{...toolbarActions}
			/>
			<Scroller className={css.scroller}>
				<div className={css.content}>
					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Runtime Mode</BodyText>
						<div className={css.modeBadges}>
							<BodyText className={css.modeBadge}>Theme: {modeState.theme}</BodyText>
							<BodyText className={css.modeBadge}>Animations: {modeState.animations}</BodyText>
							<BodyText className={css.modeBadge}>Performance+: {modeState.allAnimations}</BodyText>
							<BodyText className={css.modeBadge}>Input: {modeState.inputMode}</BodyText>
						</div>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Liquid Card Sample</BodyText>
						<div className={css.liquidCard}>
							<BodyText className={css.cardTitle}>Media Description Sample</BodyText>
							<BodyText className={css.cardBody}>
								This panel helps verify whether Elegant glass styling, hover states, and performance mode
								fallbacks match the visual language used by navbar and search.
							</BodyText>
						</div>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Backdrop Blur Test</BodyText>
						<div className={css.backdropScenes}>
							<div className={css.backdropScene}>
								<img
									src={activeBackdropUrl}
									alt=""
									aria-hidden="true"
									className={css.backdropImage}
									onError={handleBackdropImageError}
								/>
								<div className={css.backdropTint} />
								<div className={css.backdropGlow} />
								<div className={css.backdropPattern} />
								<div className={css.backdropContent}>
									<BodyText className={css.sceneLabel}>Image Backdrop</BodyText>
									<div className={`${css.liquidCard} ${css.sceneCard}`}>
										<BodyText className={css.cardTitle}>Card Over Backdrop</BodyText>
										<BodyText className={css.cardBody}>
											Use this to verify blur, tint, and highlight response against real image detail.
										</BodyText>
									</div>
									<div className={css.sceneControls}>
										<Button size="small" onClick={loadRandomBackdropCandidate} className={css.liquidButton}>
											Shuffle
										</Button>
										<Button size="small" icon="play" onClick={handleSampleClick} className={css.liquidButton}>
											Play
										</Button>
										<Button size="small" icon="speaker" onClick={handleSampleClick} className={css.liquidButton}>
											English
										</Button>
										<Button
											size="small"
											icon="info"
											aria-label="Info"
											onClick={handleSampleClick}
											className={css.liquidIconButton}
										/>
									</div>
								</div>
							</div>
							<div className={`${css.backdropScene} ${css.backdropSceneSecondary}`}>
								<div className={css.backdropGradientOnly} />
								<div className={css.backdropPattern} />
								<div className={css.backdropContent}>
									<BodyText className={css.sceneLabel}>Abstract Backdrop</BodyText>
									<div className={`${css.liquidCard} ${css.sceneCard}`}>
										<BodyText className={css.cardTitle}>Card Over Gradients</BodyText>
										<BodyText className={css.cardBody}>
											This variant checks readability and glass depth when there is no poster/image behind.
										</BodyText>
									</div>
									<div className={css.sceneControls}>
										<Button size="small" icon="play" onClick={handleSampleClick} className={css.liquidButton}>
											Continue
										</Button>
										<Button size="small" icon="subtitle" onClick={handleSampleClick} className={css.liquidButton}>
											Off
										</Button>
										<Button
											size="small"
											icon="check"
											aria-label="Watched"
											onClick={handleSampleClick}
											className={css.liquidIconButton}
										/>
									</div>
								</div>
							</div>
						</div>
					</section>

					<section className={css.section}>
						<BodyText className={css.sectionTitle}>Liquid Button Samples</BodyText>
						<div className={css.buttonRow}>
							<Button size="small" icon="play" onClick={handleSampleClick} className={css.liquidButton}>
								Play S1E1
							</Button>
							<Button size="small" icon="play" onClick={handleSampleClick} className={css.liquidButton}>
								Continue S2E3
							</Button>
							<Button size="small" icon="speaker" onClick={handleSampleClick} className={css.liquidButton}>
								English
							</Button>
							<Button size="small" icon="subtitle" onClick={handleSampleClick} className={css.liquidButton}>
								Off
							</Button>
						</div>
					</section>

						<section className={css.section}>
							<BodyText className={css.sectionTitle}>Icon Button Samples</BodyText>
							<div className={css.iconRow}>
							<Button
								size="small"
								icon="left"
								aria-label="Back"
								onClick={handleSampleClick}
								className={css.liquidIconButton}
							/>
							<Button
								size="small"
								icon="info"
								aria-label="Info"
								onClick={handleSampleClick}
								className={css.liquidIconButton}
							/>
							<Button
								size="small"
								icon="hearthollow"
								aria-label="Favorite"
								onClick={handleSampleClick}
								className={css.liquidIconButton}
							/>
							<Button
								size="small"
								icon="check"
								aria-label="Watched"
								onClick={handleSampleClick}
								className={css.liquidIconButton}
								/>
							</div>
						</section>

						<section className={css.section}>
							<BodyText className={css.sectionTitle}>Liquid Glass Testing</BodyText>
							<BodyText className={css.sectionSubtitle}>
								Snippet-faithful test set: FRM001, ICO001, NAV002, SRH002, LDR003, TGL001. Each sample uses
								the same image backdrop to validate blur behavior.
							</BodyText>
							<svg className={css.snipzyDefs} aria-hidden="true" focusable="false">
								<filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
									<feTurbulence
										type="fractalNoise"
										baseFrequency="0.008 0.008"
										numOctaves="2"
										seed="92"
										result="noise"
									/>
									<feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
									<feDisplacementMap in="SourceGraphic" in2="blurred" scale="70" xChannelSelector="R" yChannelSelector="B" />
								</filter>
								<filter id="glass-distortion-form-exact">
									<feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
									<feDisplacementMap
										ref={exactFormDisplacementMapRef}
										in="SourceGraphic"
										in2="noise"
										scale="77"
									/>
								</filter>
								<filter id="glass-distortion-search-exact">
									<feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
									<feDisplacementMap
										ref={exactSearchDisplacementMapRef}
										in="SourceGraphic"
										in2="noise"
										scale="77"
									/>
								</filter>
							</svg>
							<div className={css.snipzyGrid} style={snipzyBackdropStyle}>

								<article className={css.snipzySample}>
									{renderSnipzySampleBackdrop()}
									<BodyText className={css.snipzySampleTitle}>FRM001 Form</BodyText>
									<div
										className={css.snipzyExactForm}
										onMouseMove={handleSnipzyExactFormMouseMove}
										onMouseLeave={handleSnipzyExactFormMouseLeave}
									>
										<div className={css.snipzyExactFormFilter} />
										<div className={css.snipzyExactFormOverlay} />
										<div ref={exactFormSpecularRef} className={css.snipzyExactFormSpecular} />
										<div className={css.snipzyExactFormContent}>
											<div
												className={`${css.snipzyExactFormContainer} ${css.snipzyExactFormLogin} ${snipzyExactFormMode === 'login' ? css.snipzyExactFormContainerActive : ''}`}
											>
												<h3>Login</h3>
												<form data-mode="login" onSubmit={handleSnipzyExactFormSubmit}>
													<div className={css.snipzyExactFormGroup}>
														<i className={css.snipzyExactFormFieldIcon} aria-hidden="true">
															@
														</i>
														<input
															type="email"
															name="email"
															placeholder="Email"
															required
															onInvalid={handleSnipzyExactInputInvalid}
															onInput={handleSnipzyExactInput}
														/>
													</div>
													<div className={css.snipzyExactFormGroup}>
														<i className={css.snipzyExactFormFieldIcon} aria-hidden="true">
															*
														</i>
														<input
															type="password"
															name="password"
															placeholder="Password"
															required
															onInvalid={handleSnipzyExactInputInvalid}
															onInput={handleSnipzyExactInput}
														/>
													</div>
													<button
														type="submit"
														className={`${css.snipzyExactFormSubmit} ${snipzyExactFormSuccess.login ? css.snipzyExactFormSubmitSuccess : ''}`}
													>
														{snipzyExactFormSuccess.login ? 'Success!' : 'Sign In'}
													</button>
												</form>
												<p className={css.snipzyExactFormSwitch}>
													Don&apos;t have an account?{' '}
													<button type="button" className={css.snipzyExactFormSwitchLink} onClick={handleSnipzyExactSwitchToRegister}>
														Register
													</button>
												</p>
											</div>

											<div
												className={`${css.snipzyExactFormContainer} ${css.snipzyExactFormRegister} ${snipzyExactFormMode === 'register' ? css.snipzyExactFormContainerActive : ''}`}
											>
												<h3>Register</h3>
												<form data-mode="register" onSubmit={handleSnipzyExactFormSubmit}>
													<div className={css.snipzyExactFormGroup}>
														<i className={css.snipzyExactFormFieldIcon} aria-hidden="true">
															#
														</i>
														<input
															type="text"
															name="username"
															placeholder="Username"
															required
															onInvalid={handleSnipzyExactInputInvalid}
															onInput={handleSnipzyExactInput}
														/>
													</div>
													<div className={css.snipzyExactFormGroup}>
														<i className={css.snipzyExactFormFieldIcon} aria-hidden="true">
															@
														</i>
														<input
															type="email"
															name="email"
															placeholder="Email"
															required
															onInvalid={handleSnipzyExactInputInvalid}
															onInput={handleSnipzyExactInput}
														/>
													</div>
													<div className={css.snipzyExactFormGroup}>
														<i className={css.snipzyExactFormFieldIcon} aria-hidden="true">
															*
														</i>
														<input
															type="password"
															name="password"
															placeholder="Password"
															required
															onInvalid={handleSnipzyExactInputInvalid}
															onInput={handleSnipzyExactInput}
														/>
													</div>
													<div className={css.snipzyExactFormGroup}>
														<i className={css.snipzyExactFormFieldIcon} aria-hidden="true">
															*
														</i>
														<input
															type="password"
															name="confirm-password"
															placeholder="Confirm Password"
															required
															onInvalid={handleSnipzyExactInputInvalid}
															onInput={handleSnipzyExactInput}
														/>
													</div>
													<button
														type="submit"
														className={`${css.snipzyExactFormSubmit} ${snipzyExactFormSuccess.register ? css.snipzyExactFormSubmitSuccess : ''}`}
													>
														{snipzyExactFormSuccess.register ? 'Success!' : 'Sign Up'}
													</button>
												</form>
												{snipzyExactFormError ? <p className={css.snipzyExactFormError}>{snipzyExactFormError}</p> : null}
												<p className={css.snipzyExactFormSwitch}>
													Already have an account?{' '}
													<button type="button" className={css.snipzyExactFormSwitchLink} onClick={handleSnipzyExactSwitchToLogin}>
														Login
													</button>
												</p>
											</div>
										</div>
									</div>
								</article>

								<article className={css.snipzySample}>
									{renderSnipzySampleBackdrop()}
									<BodyText className={css.snipzySampleTitle}>ICO001 Icons</BodyText>
									<div className={css.snipzyExactIconsGrid}>
										<div className={css.snipzyExactIcon}>
											<div className={css.snipzyExactIconFilter} />
											<div className={css.snipzyExactIconOverlay} />
											<div className={css.snipzyExactIconSpecular} />
											<div className={css.snipzyExactIconContent}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
													<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
												</svg>
											</div>
										</div>

										<div className={css.snipzyExactIcon}>
											<div className={css.snipzyExactIconFilter} />
											<div className={css.snipzyExactIconOverlay} />
											<div className={css.snipzyExactIconSpecular} />
											<div className={css.snipzyExactIconContent}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
													<path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
												</svg>
											</div>
										</div>

										<div className={css.snipzyExactIcon}>
											<div className={css.snipzyExactIconFilter} />
											<div className={css.snipzyExactIconOverlay} />
											<div className={css.snipzyExactIconSpecular} />
											<div className={css.snipzyExactIconContent}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
													<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
												</svg>
											</div>
										</div>

										<div className={css.snipzyExactIcon}>
											<div className={css.snipzyExactIconFilter} />
											<div className={css.snipzyExactIconOverlay} />
											<div className={css.snipzyExactIconSpecular} />
											<div className={css.snipzyExactIconContent}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
													<path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
												</svg>
											</div>
										</div>
									</div>
								</article>

								<article className={css.snipzySample}>
									{renderSnipzySampleBackdrop()}
									<BodyText className={css.snipzySampleTitle}>NAV002 Nav</BodyText>
									<nav className={css.snipzyExactNav} aria-label="Snipzy nav sample">
										<div className={css.snipzyExactNavFilter} />
										<div className={css.snipzyExactNavOverlay} />
										<div className={css.snipzyExactNavSpecular} />
										<div className={css.snipzyExactNavContent}>
											<ul className={css.snipzyExactNavList}>
												{SNIPZY_NAV_ITEMS.map((item) => (
													<li key={item}>
														<button
															type="button"
															className={`${css.snipzyExactNavItem} ${snipzyNavActive === item ? css.snipzyExactNavItemActive : ''}`}
															data-nav-item={item}
															onClick={handleSnipzyNavClick}
														>
															{item}
														</button>
													</li>
												))}
											</ul>
										</div>
									</nav>
								</article>

								<article className={css.snipzySample}>
									{renderSnipzySampleBackdrop()}
									<BodyText className={css.snipzySampleTitle}>SRH002 Search</BodyText>
									<div
										className={css.snipzyExactSearch}
										onMouseMove={handleSnipzyExactSearchMouseMove}
										onMouseLeave={handleSnipzyExactSearchMouseLeave}
									>
										<div className={css.snipzyExactSearchFilter} />
										<div className={css.snipzyExactSearchOverlay} />
										<div ref={exactSearchSpecularRef} className={css.snipzyExactSearchSpecular} />
										<div className={css.snipzyExactSearchContent}>
											<div
												className={`${css.snipzyExactSearchContainer} ${showSnipzySuggestions ? css.snipzyExactSearchContainerExpanded : ''}`.trim()}
											>
												<span className={css.snipzyExactSearchIcon} aria-hidden="true">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<circle cx="11" cy="11" r="8" />
														<path d="m21 21-4.35-4.35" />
													</svg>
												</span>
												<input
													ref={exactSearchInputRef}
													type="text"
													placeholder="Search..."
													className={css.snipzyExactSearchInput}
													value={snipzySearchValue}
													onChange={handleSnipzySearchChange}
													onFocus={handleSnipzySearchFocus}
													onBlur={handleSnipzySearchBlur}
												/>
												<button
													type="button"
													className={`${css.snipzyExactSearchClear} ${hasSearchValue ? css.snipzyExactSearchClearVisible : ''}`.trim()}
													aria-label="Clear search"
													onClick={handleSnipzySearchClear}
												>
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<path d="m18 6-12 12" />
														<path d="m6 6 12 12" />
													</svg>
												</button>
											</div>
											<div
												className={`${css.snipzyExactSearchSuggestions} ${showSnipzySuggestions && snipzySuggestions.length > 0 ? css.snipzyExactSearchSuggestionsActive : ''}`.trim()}
												data-snipzy-search-suggestions="true"
											>
												<div className={css.snipzyExactSuggestionGroup}>
													<h4>Recent Searches</h4>
													<ul>
														{snipzySuggestions.map((suggestion) => (
															<li key={suggestion}>
																<button
																	type="button"
																	className={css.snipzyExactSuggestionItem}
																	data-suggestion={suggestion}
																	onClick={handleSnipzySuggestionClick}
																>
																	<span className={css.snipzyExactSuggestionIcon} aria-hidden="true">
																		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
																			<path d="M3 3v5h5" />
																			<path d="M3.05 13a9 9 0 1 0 .5-4.5L8 8" />
																		</svg>
																	</span>
																	<span>{suggestion}</span>
																</button>
															</li>
														))}
													</ul>
												</div>
											</div>
										</div>
									</div>
								</article>

								<article className={css.snipzySample}>
									{renderSnipzySampleBackdrop()}
									<BodyText className={css.snipzySampleTitle}>LDR003 Spinner</BodyText>
									<div className={css.snipzyExactSpinner}>
										<div className={css.snipzyExactSpinnerFilter} />
										<div className={css.snipzyExactSpinnerOverlay} />
										<div className={css.snipzyExactSpinnerSpecular} />
										<div className={css.snipzyExactSpinnerContent}>
											<div className={css.snipzyExactSpinnerRing} />
											<div className={css.snipzyExactSpinnerCore} />
										</div>
									</div>
								</article>

								<article className={css.snipzySample}>
									{renderSnipzySampleBackdrop()}
									<BodyText className={css.snipzySampleTitle}>TGL001 Toggle</BodyText>
									<div className={css.snipzyExactToggleGroup}>
										{SNIPZY_TOGGLES.map((toggle) => (
											<label key={toggle.id} className={css.snipzyExactToggle}>
												<input
													type="checkbox"
													className={css.snipzyExactToggleInput}
													data-toggle-id={toggle.id}
													checked={Boolean(snipzyToggleState[toggle.id])}
													onChange={handleSnipzyToggleChange}
												/>
												<div className={css.snipzyExactToggleTrack}>
													<div className={css.snipzyExactToggleTrackFilter} />
													<div className={css.snipzyExactToggleTrackOverlay} />
													<div className={css.snipzyExactToggleTrackSpecular} />
													<div className={css.snipzyExactToggleThumb}>
														<div className={css.snipzyExactToggleThumbFilter} />
														<div className={css.snipzyExactToggleThumbOverlay} />
														<div className={css.snipzyExactToggleThumbSpecular} />
													</div>
												</div>
												<span className={css.snipzyExactToggleLabel}>{toggle.label}</span>
											</label>
										))}
									</div>
								</article>
							</div>
						</section>
					</div>
				</Scroller>
			</Panel>
	);
};

export default StyleDebugPanel;
