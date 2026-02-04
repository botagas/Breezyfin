import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Spottable } from '@enact/spotlight/Spottable';
import Button from '@enact/sandstone/Button';
import Icon from '@enact/sandstone/Icon';
import BodyText from '@enact/sandstone/BodyText';
import jellyfinService from '../services/jellyfinService';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';

import css from './Toolbar.module.less';

const SpottableDiv = Spottable('div');

const Toolbar = ({ activeSection = 'home', activeLibraryId = null, onNavigate, onLogout, onExit }) => {
	const [libraries, setLibraries] = useState([]);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [userName, setUserName] = useState('User');
	const [showUserMenu, setShowUserMenu] = useState(false);
	const centerRef = useRef(null);
	const librariesById = useMemo(() => {
		const map = new Map();
		libraries.forEach((library) => {
			map.set(String(library.Id), library);
		});
		return map;
	}, [libraries]);

	const loadLibraries = useCallback(async () => {
		const libs = await jellyfinService.getLibraryViews();
		setLibraries(libs);
	}, []);

	const loadUserInfo = useCallback(async () => {
		const user = await jellyfinService.getCurrentUser();
		if (user && user.Name) {
			setUserName(user.Name);
		}
	}, []);

	useEffect(() => {
		loadLibraries();
		loadUserInfo();

		// Update clock every minute
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);

		return () => clearInterval(timer);
	}, [loadLibraries, loadUserInfo]);

	const formatTime = () => {
		return currentTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	};

	const handleCenterFocus = useCallback((e) => {
		if (!centerRef.current || !centerRef.current.contains(e.target)) return;
		const target = e.target.closest(`.${css.iconButton}, .${css.toolbarButton}`);
		if (!target) return;

		const scroller = centerRef.current;
		scrollElementIntoHorizontalView(scroller, target, {minBuffer: 40, edgeRatio: 0.10});
	}, []);

	const handleUserMenuOpen = useCallback(() => {
		setShowUserMenu(true);
	}, []);

	const handleUserMenuClose = useCallback(() => {
		setShowUserMenu(false);
	}, []);

	const handleNavigateHome = useCallback(() => {
		onNavigate('home');
	}, [onNavigate]);

	const handleNavigateSearch = useCallback(() => {
		onNavigate('search');
	}, [onNavigate]);

	const handleNavigateShuffle = useCallback(() => {
		onNavigate('shuffle');
	}, [onNavigate]);

	const handleNavigateFavorites = useCallback(() => {
		onNavigate('favorites');
	}, [onNavigate]);

	const handleNavigateSettings = useCallback(() => {
		onNavigate('settings');
	}, [onNavigate]);

	const handleLibraryNavigate = useCallback((event) => {
		const libraryId = event.currentTarget.dataset.libraryId;
		const library = librariesById.get(libraryId);
		if (library) {
			onNavigate('library', library);
		}
	}, [librariesById, onNavigate]);

		return (
		<div className={css.toolbar}>
			<div className={css.start}>
					<div
						className={css.userContainer}
						onMouseEnter={handleUserMenuOpen}
						onMouseLeave={handleUserMenuClose}
					>
					<Button
						size="small"
						className={css.userButton}
						aria-label="User Profile"
					>
						{userName}
					</Button>
					{showUserMenu && (
						<div className={css.userMenu}>
							<Button
								size="small"
								onClick={onLogout}
								className={css.menuButton}
							>
								Logout
							</Button>
							<Button
								size="small"
								onClick={onExit}
								className={css.menuButton}
							>
								Exit
							</Button>
						</div>
					)}
				</div>
			</div>
			<div className={css.center} ref={centerRef} onFocus={handleCenterFocus}>
					<SpottableDiv
						onClick={handleNavigateHome}
						className={`${css.iconButton} ${activeSection === 'home' ? css.selected : ''}`}
						aria-label="Home"
					>
					<Icon size="small">home</Icon>
				</SpottableDiv>

					<SpottableDiv
						onClick={handleNavigateSearch}
						className={`${css.iconButton} ${activeSection === 'search' ? css.selected : ''}`}
						aria-label="Search"
					>
					<Icon size="small">search</Icon>
				</SpottableDiv>

					<SpottableDiv
						onClick={handleNavigateShuffle}
						className={css.iconButton}
						aria-label="Shuffle"
					>
					<Icon size="small">arrowhookright</Icon>
				</SpottableDiv>

					<SpottableDiv
						onClick={handleNavigateFavorites}
						className={css.iconButton}
						aria-label="Favorites"
					>
					<Icon size="small">star</Icon>
				</SpottableDiv>

				{libraries.map((library) => (
					<Button
						key={library.Id}
							size="small"
							backgroundOpacity="transparent"
							shadowed={false}
							data-library-id={library.Id}
							onClick={handleLibraryNavigate}
							selected={activeSection === 'library' && activeLibraryId === library.Id}
							className={css.toolbarButton}
						>
						{library.Name}
					</Button>
				))}
			</div>

				<div className={css.end}>
					<SpottableDiv
						onClick={handleNavigateSettings}
						className={css.iconButton}
						aria-label="Settings"
					>
					<Icon size="small">gear</Icon>
				</SpottableDiv>
				<BodyText className={css.clock}>{formatTime()}</BodyText>
			</div>
		</div>
	);
};

export default Toolbar;
