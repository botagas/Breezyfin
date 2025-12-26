import { useState, useEffect, useCallback } from 'react';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';
import Panels from '@enact/sandstone/Panels';

import LoginPanel from '../views/LoginPanel';
import HomePanel from '../views/HomePanel';
import LibraryPanel from '../views/LibraryPanel';
import SearchPanel from '../views/SearchPanel';
import FavoritesPanel from '../views/FavoritesPanel';
import SettingsPanel from '../views/SettingsPanel';
import PlayerPanel from '../views/PlayerPanel';
import MediaDetailsPanel from '../views/MediaDetailsPanel';
import jellyfinService from '../services/jellyfinService';
import {KeyCodes, isBackKey} from '../utils/keyCodes';

import css from './App.module.less';

const App = (props) => {
	const [currentView, setCurrentView] = useState('login'); // 'login', 'home', 'library', 'search', 'favorites', 'settings', 'details', 'player'
	const [selectedItem, setSelectedItem] = useState(null);
	const [selectedLibrary, setSelectedLibrary] = useState(null);
	const [playbackOptions, setPlaybackOptions] = useState(null);
	const [previousItem, setPreviousItem] = useState(null); // For back navigation from episode to series

	useEffect(() => {
		// Try to restore session on load
		const restored = jellyfinService.restoreSession();
		if (restored) {
			setCurrentView('home');
		}
	}, []);

	// Handle back button globally
	const handleBack = useCallback(() => {
		console.log('handleBack called, currentView:', currentView, 'previousItem:', previousItem);
		switch (currentView) {
			case 'library':
			case 'search':
			case 'favorites':
			case 'settings':
				setCurrentView('home');
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				return true;
			case 'details':
				// If we have a previous item (series), go back to it
				if (previousItem) {
					setSelectedItem(previousItem);
					setPreviousItem(null);
					return true;
				}
				setCurrentView('home');
				setSelectedItem(null);
				setPlaybackOptions(null);
				return true;
			case 'player':
				setCurrentView('details');
				return true;
			case 'home':
			case 'login':
			default:
				return false; // Allow default behavior (exit prompt)
		}
	}, [currentView, previousItem]);

	// Global back-key listener to keep navigation consistent outside the player
	useEffect(() => {
		const handleGlobalKeyDown = (e) => {
			const code = e.keyCode || e.which;
			if (isBackKey(code)) {
				const handled = handleBack();
				if (handled) {
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation?.();
				}
			}
		};
		document.addEventListener('keydown', handleGlobalKeyDown, true);
		return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
	}, [handleBack]);

	// Intercept browser history back (webOS back triggers popstate)
	useEffect(() => {
		const handlePopState = (e) => {
			const handled = handleBack();
			if (handled) {
				e.preventDefault?.();
				// Re-push a dummy state so the next back event stays in-app
				window.history.pushState(null, document.title);
			}
		};
		// Push an initial state to keep back within the app
		window.history.pushState(null, document.title);
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [handleBack]);

	// Back button handling removed - using Panels onBack instead

	const handleLogin = () => {
		setCurrentView('home');
	};

	const handleLogout = () => {
		jellyfinService.logout();
		setCurrentView('login');
		setSelectedItem(null);
		setSelectedLibrary(null);
		setPlaybackOptions(null);
	};

	const handleItemSelect = (item, fromItem = null) => {
		// Track the previous item for back navigation (e.g., series -> episode)
		if (fromItem) {
			setPreviousItem(fromItem);
		} else if (selectedItem && selectedItem.Type === 'Series' && item.Type === 'Episode') {
			// If navigating from series to episode, remember the series
			setPreviousItem(selectedItem);
		} else {
			setPreviousItem(null);
		}
		// Always show details first, not immediate play
		setSelectedItem(item);
		setPlaybackOptions(null);
		setCurrentView('details');
	};

	const handleNavigate = (section, data) => {
		console.log('Navigate to:', section, data);
		switch (section) {
			case 'home':
				setCurrentView('home');
				setSelectedLibrary(null);
				setSelectedItem(null);
				setPlaybackOptions(null);
				break;
			case 'library':
				setSelectedLibrary(data);
				setSelectedItem(null);
				setPlaybackOptions(null);
				setCurrentView('library');
				break;
			case 'search':
			case 'favorites':
			case 'settings':
				setCurrentView(section);
				setSelectedItem(null);
				setSelectedLibrary(null);
				setPlaybackOptions(null);
				break;
			default:
				break;
		}
	};

	const handlePlay = (item, options = null) => {
		setSelectedItem(item);
		setPlaybackOptions(options);
		setCurrentView('player');
	};

	const handleBackToHome = () => {
		setCurrentView('home');
		setSelectedItem(null);
		setSelectedLibrary(null);
		setPlaybackOptions(null);
	};

	const handleBackToDetails = () => {
		setCurrentView('details');
	};

	const handleExit = () => {
		if (typeof window !== 'undefined' && window.close) {
			window.close();
		}
	};

	const getPanelIndex = () => {
		if (currentView === 'login') return 0;
		if (currentView === 'home') return 1;
		if (currentView === 'library') return 2;
		if (currentView === 'search') return 3;
		if (currentView === 'favorites') return 4;
		if (currentView === 'settings') return 5;
		if (currentView === 'details') return 6;
		if (currentView === 'player') return 7;
		return 0;
	};

	return (
		<div className={css.app} {...props}>
			<Panels 
				index={getPanelIndex()}
				onBack={() => {
					if (currentView === 'library') handleBackToHome();
					else if (currentView === 'search') handleBackToHome();
					else if (currentView === 'favorites') handleBackToHome();
					else if (currentView === 'settings') handleBackToHome();
					else if (currentView === 'details') handleBackToHome();
					else if (currentView === 'player') handleBackToDetails();
				}}
			>
				<LoginPanel onLogin={handleLogin} />
				<HomePanel
					onItemSelect={handleItemSelect}
					onNavigate={handleNavigate}
					onLogout={handleLogout}
					onExit={handleExit}
					noCloseButton
				/>
				<LibraryPanel
					library={selectedLibrary}
					onItemSelect={handleItemSelect}
					onNavigate={handleNavigate}
					onLogout={handleLogout}
					onExit={handleExit}
					onBack={handleBackToHome}
					noCloseButton
				/>
				<SearchPanel
					onItemSelect={handleItemSelect}
					onNavigate={handleNavigate}
					onLogout={handleLogout}
					onExit={handleExit}
					noCloseButton
				/>
				<FavoritesPanel
					onItemSelect={handleItemSelect}
					onNavigate={handleNavigate}
					onLogout={handleLogout}
					onExit={handleExit}
					noCloseButton
				/>
				<SettingsPanel
					isActive={currentView === 'settings'}
					onNavigate={handleNavigate}
					onLogout={handleLogout}
					onExit={handleExit}
					noCloseButton
				/>
				<MediaDetailsPanel
					isActive={currentView === 'details'}
					item={selectedItem}
					onBack={handleBackToHome}
					onPlay={handlePlay}
					onItemSelect={handleItemSelect}
					noCloseButton
				/>
				<PlayerPanel
					isActive={currentView === 'player'}
					item={selectedItem}
					playbackOptions={playbackOptions}
					onBack={handleBackToDetails}
					onPlay={handlePlay}
				/>
			</Panels>
		</div>
	);
};

export default ThemeDecorator(App);
