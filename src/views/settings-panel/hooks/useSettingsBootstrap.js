import {useCallback, useEffect, useState} from 'react';

import {HOME_ROW_ORDER} from '../../../constants/homeRows';
import jellyfinService from '../../../services/jellyfinService';
import {getAppLogs} from '../../../utils/appLogger';
import {getAppVersion, loadAppVersion} from '../../../utils/appInfo';
import {readBreezyfinSettings} from '../../../utils/settingsStorage';
import {setRuntimeCapabilityProbeRefreshDays} from '../../../utils/platformCapabilities';
import {DEFAULT_SETTINGS, SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS} from '../constants';

export const useSettingsBootstrap = ({
	setSettings,
	normalizeCapabilityProbeRefreshDaysSetting
}) => {
	const [appVersion, setAppVersion] = useState(getAppVersion());
	const [serverInfo, setServerInfo] = useState(null);
	const [userInfo, setUserInfo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [savedServers, setSavedServers] = useState([]);
	const [appLogCount, setAppLogCount] = useState(0);

	const loadSettings = useCallback(() => {
		try {
			const parsed = readBreezyfinSettings();
			const parsedWithoutLegacyFmp4Preference = {...parsed};
			delete parsedWithoutLegacyFmp4Preference.preferDolbyVisionMp4;
			const normalizedOrder = Array.isArray(parsed.homeRowOrder)
				? parsed.homeRowOrder.filter((key) => HOME_ROW_ORDER.includes(key))
				: [];
			const resolvedOrder = [
				...normalizedOrder,
				...HOME_ROW_ORDER.filter((key) => !normalizedOrder.includes(key))
			];
			const capabilityProbeRefreshDays = normalizeCapabilityProbeRefreshDaysSetting(parsed.capabilityProbeRefreshDays);
			const subtitleBurnInTextCodecs = Array.isArray(parsed.subtitleBurnInTextCodecs)
				? parsed.subtitleBurnInTextCodecs
					.map((codec) => String(codec || '').trim().toLowerCase())
					.filter((codec) => SUBTITLE_BURN_IN_TEXT_CODEC_OPTIONS.some((option) => option.value === codec))
				: DEFAULT_SETTINGS.subtitleBurnInTextCodecs;
			const hasEnableFmp4Preference = typeof parsed.enableFmp4HlsContainerPreference === 'boolean';
			const hasForceFmp4Preference = typeof parsed.forceFmp4HlsContainerPreference === 'boolean';
			const legacyPreferFmp4Preference = typeof parsed.preferDolbyVisionMp4 === 'boolean'
				? parsed.preferDolbyVisionMp4
				: undefined;
			const enableFmp4HlsContainerPreference = hasEnableFmp4Preference
				? parsed.enableFmp4HlsContainerPreference
				: (legacyPreferFmp4Preference ?? DEFAULT_SETTINGS.enableFmp4HlsContainerPreference);
			const forceFmp4HlsContainerPreferenceRaw = hasForceFmp4Preference
				? parsed.forceFmp4HlsContainerPreference
				: DEFAULT_SETTINGS.forceFmp4HlsContainerPreference;
			const forceFmp4HlsContainerPreference =
				forceFmp4HlsContainerPreferenceRaw === true && enableFmp4HlsContainerPreference === true;
			setRuntimeCapabilityProbeRefreshDays(capabilityProbeRefreshDays);
			setSettings({
				...DEFAULT_SETTINGS,
				...parsedWithoutLegacyFmp4Preference,
				capabilityProbeRefreshDays,
				subtitleBurnInTextCodecs,
				enableFmp4HlsContainerPreference,
				forceFmp4HlsContainerPreference,
				homeRows: {
					...DEFAULT_SETTINGS.homeRows,
					...(parsed.homeRows || {})
				},
				homeRowOrder: resolvedOrder
			});
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
	}, [normalizeCapabilityProbeRefreshDaysSetting, setSettings]);

	const loadServerInfo = useCallback(async () => {
		setLoading(true);
		try {
			const [server, user] = await Promise.all([
				jellyfinService.getPublicServerInfo(),
				jellyfinService.getCurrentUser()
			]);
			setServerInfo(server);
			setUserInfo(user);
		} catch (error) {
			console.error('Failed to load server info:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	const refreshSavedServers = useCallback(() => {
		try {
			setSavedServers(jellyfinService.getSavedServers() || []);
		} catch (error) {
			console.error('Failed to fetch saved servers:', error);
		}
	}, []);

	const refreshAppLogCount = useCallback(() => {
		setAppLogCount(getAppLogs().length);
	}, []);

	useEffect(() => {
		loadSettings();
		loadServerInfo();
		refreshSavedServers();
		refreshAppLogCount();
	}, [loadServerInfo, loadSettings, refreshSavedServers, refreshAppLogCount]);

	useEffect(() => {
		let cancelled = false;
		loadAppVersion().then((resolvedVersion) => {
			if (!cancelled && resolvedVersion) {
				setAppVersion(resolvedVersion);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return {
		appVersion,
		serverInfo,
		userInfo,
		loading,
		savedServers,
		appLogCount,
		setAppLogCount,
		loadServerInfo,
		refreshSavedServers
	};
};
