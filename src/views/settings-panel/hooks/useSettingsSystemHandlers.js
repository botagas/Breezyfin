import {useCallback, useState} from 'react';

import jellyfinService from '../../../services/jellyfinService';
import {clearAppLogs, getAppLogs} from '../../../utils/appLogger';
import {wipeAllAppCache} from '../../../utils/cacheMaintenance';
import {SETTINGS_DISCLOSURE_KEYS} from '../constants';

const LOCAL_STORAGE_AUTH_KEYS = [
	'breezyfin_servers',
	'breezyfin_active_server',
	'breezyfin_active_user',
	'jellyfinAuth',
	'breezyfin_device_id'
];

export const useSettingsSystemHandlers = ({
	loadServerInfo,
	refreshSavedServers,
	savedServersByKey,
	setSwitchingServerId,
	onSignOut,
	onLogout,
	closeDisclosure,
	openDisclosure,
	setAppLogs,
	setAppLogCount,
	cacheWipeInProgress,
	setCacheWipeInProgress,
	setCacheWipeError
}) => {
	const [wipeCacheKeepLogin, setWipeCacheKeepLogin] = useState(false);

	const handleSwitchServer = useCallback(async (entry) => {
		if (!entry) return;
		setSwitchingServerId(entry.serverId + ':' + entry.userId);
		try {
			jellyfinService.setActiveServer(entry.serverId, entry.userId);
			await loadServerInfo();
		} catch (error) {
			console.error('Failed to switch server:', error);
		} finally {
			setSwitchingServerId(null);
			refreshSavedServers();
		}
	}, [loadServerInfo, refreshSavedServers, setSwitchingServerId]);

	const handleForgetServer = useCallback((entry) => {
		if (!entry) return;
		jellyfinService.forgetServer(entry.serverId, entry.userId);
		const hasActiveSession = Boolean(
			jellyfinService.userId &&
			jellyfinService.serverUrl &&
			jellyfinService.accessToken
		);
		if (!hasActiveSession) {
			if (typeof onSignOut === 'function') {
				onSignOut();
			} else {
				onLogout();
			}
			return;
		}
		refreshSavedServers();
	}, [onLogout, onSignOut, refreshSavedServers]);

	const handleSwitchServerClick = useCallback((event) => {
		const serverKey = event.currentTarget.dataset.serverKey;
		const entry = savedServersByKey.get(serverKey);
		if (!entry) return;
		handleSwitchServer(entry);
	}, [handleSwitchServer, savedServersByKey]);

	const handleForgetServerClick = useCallback((event) => {
		const serverKey = event.currentTarget.dataset.serverKey;
		const entry = savedServersByKey.get(serverKey);
		if (!entry) return;
		handleForgetServer(entry);
	}, [handleForgetServer, savedServersByKey]);

	const handleLogoutConfirm = useCallback(() => {
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGOUT_CONFIRM);
		if (typeof onSignOut === 'function') {
			onSignOut();
			return;
		}
		onLogout();
	}, [closeDisclosure, onLogout, onSignOut]);

	const openLogsPopup = useCallback(() => {
		const logs = getAppLogs();
		setAppLogs(logs.slice().reverse());
		setAppLogCount(logs.length);
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.LOGS);
	}, [openDisclosure, setAppLogCount, setAppLogs]);

	const handleClearLogs = useCallback(() => {
		clearAppLogs();
		setAppLogs([]);
		setAppLogCount(0);
	}, [setAppLogCount, setAppLogs]);

	const openWipeCacheConfirm = useCallback(() => {
		setWipeCacheKeepLogin(false);
		setCacheWipeError('');
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM);
	}, [openDisclosure, setCacheWipeError]);

	const openWipeCacheKeepLoginConfirm = useCallback(() => {
		setWipeCacheKeepLogin(true);
		setCacheWipeError('');
		openDisclosure(SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM);
	}, [openDisclosure, setCacheWipeError]);

	const closeWipeCacheConfirm = useCallback(() => {
		if (cacheWipeInProgress) return;
		setWipeCacheKeepLogin(false);
		closeDisclosure(SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM);
	}, [cacheWipeInProgress, closeDisclosure]);

	const handleWipeCacheConfirm = useCallback(async () => {
		if (cacheWipeInProgress) return;
		setCacheWipeInProgress(true);
		setCacheWipeError('');

		try {
			const summary = await wipeAllAppCache({
				preserveLocalStorageKeys: wipeCacheKeepLogin ? LOCAL_STORAGE_AUTH_KEYS : []
			});
			console.info('[Settings] Cache wipe summary:', summary);
			if (typeof window !== 'undefined') {
				window.setTimeout(() => {
					window.location.reload();
				}, 160);
			}
		} catch (error) {
			console.error('Failed to wipe application cache:', error);
			setCacheWipeError('Failed to wipe app cache. Please restart the TV and try again.');
			setCacheWipeInProgress(false);
		}
	}, [
		cacheWipeInProgress,
		setCacheWipeError,
		setCacheWipeInProgress,
		wipeCacheKeepLogin
	]);

	return {
		handleSwitchServerClick,
		handleForgetServerClick,
		handleLogoutConfirm,
		openLogsPopup,
		handleClearLogs,
		openWipeCacheConfirm,
		openWipeCacheKeepLoginConfirm,
		closeWipeCacheConfirm,
		wipeCacheKeepLogin,
		handleWipeCacheConfirm
	};
};
