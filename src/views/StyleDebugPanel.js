import { useState, useEffect, useCallback, useRef } from 'react';
import { Panel, Header } from '../components/BreezyPanels';
import Scroller from '@enact/sandstone/Scroller';
import BodyText from '@enact/sandstone/BodyText';
import Button from '../components/BreezyButton';
import Toolbar from '../components/Toolbar';
import debugBackdropImage from '../assets/debug-image.jpg';

import css from './StyleDebugPanel.module.less';

const DEBUG_BACKDROP_URL = debugBackdropImage;

const StyleDebugPanel = ({ onNavigate, onSwitchUser, onLogout, onExit, registerBackHandler, ...rest }) => {
	const [modeState, setModeState] = useState({
		theme: 'classic',
		animations: 'on',
		allAnimations: 'on',
		inputMode: '5way'
	});
	const toolbarBackHandlerRef = useRef(null);

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

	useEffect(() => {
		syncModeState();
		const handleSettingsChanged = () => syncModeState();
		const handleStorage = (event) => {
			if (event?.key !== 'breezyfinSettings') return;
			syncModeState();
		};
		window.addEventListener('breezyfin-settings-changed', handleSettingsChanged);
		window.addEventListener('storage', handleStorage);
		return () => {
			window.removeEventListener('breezyfin-settings-changed', handleSettingsChanged);
			window.removeEventListener('storage', handleStorage);
		};
	}, [syncModeState]);

	const handleSampleClick = useCallback(() => {
		// Intentionally no-op. This panel is used to validate styling behavior.
	}, []);

	const registerToolbarBackHandler = useCallback((handler) => {
		toolbarBackHandlerRef.current = handler;
	}, []);

	const handleInternalBack = useCallback(() => {
		if (typeof toolbarBackHandlerRef.current === 'function') {
			return toolbarBackHandlerRef.current() === true;
		}
		return false;
	}, []);

	useEffect(() => {
		if (typeof registerBackHandler !== 'function') return undefined;
		registerBackHandler(handleInternalBack);
		return () => registerBackHandler(null);
	}, [handleInternalBack, registerBackHandler]);

	return (
		<Panel {...rest}>
			<Header title="Styling Debug Panel" />
			<Toolbar
				activeSection="settings"
				onNavigate={onNavigate}
				onSwitchUser={onSwitchUser}
				onLogout={onLogout}
				onExit={onExit}
				registerBackHandler={registerToolbarBackHandler}
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
								<img src={DEBUG_BACKDROP_URL} alt="" aria-hidden="true" className={css.backdropImage} />
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
				</div>
			</Scroller>
		</Panel>
	);
};

export default StyleDebugPanel;
