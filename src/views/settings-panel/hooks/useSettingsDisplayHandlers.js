import {useCallback} from 'react';

import {refreshRuntimePlatformCapabilitiesWithLuna} from '../../../utils/platformCapabilities';
import {
	BITRATE_OPTIONS,
	CAPABILITY_PROBE_REFRESH_OPTIONS,
	DISCLOSURE_BACK_PRIORITY,
	LANGUAGE_OPTIONS,
	NAVBAR_THEME_OPTIONS,
	SETTINGS_DISCLOSURE_KEYS
} from '../constants';
import {getOptionLabel} from '../labels';
import {formatCapabilityTimestamp} from '../capabilityFormatting';

export const useSettingsDisplayHandlers = ({
	normalizeCapabilityProbeRefreshDaysSetting,
	getCapabilityProbeRefreshLabel,
	setToastMessage,
	bumpCapabilitySnapshotVersion,
	disclosures,
	cacheWipeInProgress,
	closeDisclosure
}) => {
	const getBitrateLabel = useCallback(
		(value) => getOptionLabel(BITRATE_OPTIONS, value, `${value} Mbps`),
		[]
	);

	const getLanguageLabel = useCallback(
		(value) => getOptionLabel(LANGUAGE_OPTIONS, value, value),
		[]
	);

	const getNavbarThemeLabel = useCallback(
		(value) => getOptionLabel(NAVBAR_THEME_OPTIONS, value, 'Classic'),
		[]
	);

	const getCapabilityProbeRefreshPeriodLabel = useCallback(
		(value) => getOptionLabel(
			CAPABILITY_PROBE_REFRESH_OPTIONS,
			normalizeCapabilityProbeRefreshDaysSetting(value),
			getCapabilityProbeRefreshLabel(value)
		),
		[getCapabilityProbeRefreshLabel, normalizeCapabilityProbeRefreshDaysSetting]
	);

	const handleRefreshCapabilitiesNow = useCallback(async () => {
		try {
			const refreshed = await refreshRuntimePlatformCapabilitiesWithLuna();
			bumpCapabilitySnapshotVersion((version) => version + 1);
			const refreshedAt = refreshed?.capabilityProbe?.checkedAt;
			const refreshedLabel = formatCapabilityTimestamp(refreshedAt);
			setToastMessage(`Capabilities refreshed (${refreshedLabel}).`);
		} catch (error) {
			console.error('Failed to refresh runtime capabilities:', error);
			setToastMessage('Failed to refresh capabilities.');
		}
	}, [bumpCapabilitySnapshotVersion, setToastMessage]);

	const handlePanelBack = useCallback(() => {
		for (const disclosureKey of DISCLOSURE_BACK_PRIORITY) {
			if (disclosures[disclosureKey] !== true) continue;
			if (
				disclosureKey === SETTINGS_DISCLOSURE_KEYS.WIPE_CACHE_CONFIRM &&
				cacheWipeInProgress
			) {
				return true;
			}
			closeDisclosure(disclosureKey);
			return true;
		}
		return false;
	}, [cacheWipeInProgress, closeDisclosure, disclosures]);

	return {
		getBitrateLabel,
		getLanguageLabel,
		getNavbarThemeLabel,
		getCapabilityProbeRefreshPeriodLabel,
		handleRefreshCapabilitiesNow,
		handlePanelBack
	};
};
