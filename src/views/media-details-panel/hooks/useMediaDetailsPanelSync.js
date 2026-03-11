import {useCallback, useEffect} from 'react';

import {useBreezyfinSettingsSync} from '../../../hooks/useBreezyfinSettingsSync';

export const useMediaDetailsPanelSync = ({
	item,
	setOverviewExpanded,
	setIsCastCollapsed,
	castFocusScrollTimeoutRef,
	seasonFocusScrollTimeoutRef,
	episodeFocusScrollTimeoutRef,
	setNavbarTheme,
	setShowSeasonImages,
	setUseSidewaysEpisodeList
}) => {
	useEffect(() => {
		setOverviewExpanded(false);
		setIsCastCollapsed(false);
	}, [item?.Id, item?.SeriesId, item?.Type, setIsCastCollapsed, setOverviewExpanded]);

	useEffect(() => {
		return () => {
			if (castFocusScrollTimeoutRef.current) {
				window.clearTimeout(castFocusScrollTimeoutRef.current);
				castFocusScrollTimeoutRef.current = null;
			}
			if (seasonFocusScrollTimeoutRef.current) {
				window.clearTimeout(seasonFocusScrollTimeoutRef.current);
				seasonFocusScrollTimeoutRef.current = null;
			}
			if (episodeFocusScrollTimeoutRef.current) {
				window.clearTimeout(episodeFocusScrollTimeoutRef.current);
				episodeFocusScrollTimeoutRef.current = null;
			}
		};
	}, [castFocusScrollTimeoutRef, episodeFocusScrollTimeoutRef, seasonFocusScrollTimeoutRef]);

	const applyPanelSettings = useCallback((settingsPayload) => {
		const settings = settingsPayload || {};
		setNavbarTheme(settings.navbarTheme === 'classic' ? 'classic' : 'elegant');
		setShowSeasonImages(settings.showSeasonImages === true);
		setUseSidewaysEpisodeList(settings.useSidewaysEpisodeList !== false);
	}, [setNavbarTheme, setShowSeasonImages, setUseSidewaysEpisodeList]);

	useBreezyfinSettingsSync(applyPanelSettings);
};
