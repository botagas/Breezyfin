import {useCallback, useEffect, useMemo, useState} from 'react';

import jellyfinService from '../../../services/jellyfinService';
import {useImageErrorFallback} from '../../../hooks/useImageErrorFallback';
import {
	getEpisodeImageUrl as resolveEpisodeImageUrl,
	getSeasonImageUrl as resolveSeasonImageUrl
} from '../utils/mediaDetailsHelpers';

export const useMediaDetailsImages = ({item}) => {
	const [headerLogoUnavailable, setHeaderLogoUnavailable] = useState(false);
	const [backdropUnavailable, setBackdropUnavailable] = useState(false);
	const [loadedBackdropUrls, setLoadedBackdropUrls] = useState({});

	useEffect(() => {
		setHeaderLogoUnavailable(false);
	}, [item?.Id, item?.SeriesId, item?.Type]);

	useEffect(() => {
		setBackdropUnavailable(false);
		setLoadedBackdropUrls({});
	}, [item?.Id, item?.SeriesId, item?.Type]);

	const backdropUrl = useMemo(() => {
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 1920);
		}
		if (item?.SeriesId) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 1920);
		}
		return '';
	}, [item]);

	const hasBackdropImage = Boolean(backdropUrl) && !backdropUnavailable;
	const isBackdropImageLoaded = Boolean(backdropUrl && loadedBackdropUrls[backdropUrl]);

	const headerLogoUrl = useMemo(() => {
		if (!item) return '';
		const logoItemId = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
		if (!logoItemId) return '';
		return jellyfinService.getImageUrl(logoItemId, 'Logo', 1600) || '';
	}, [item]);
	const useHeaderLogo = Boolean(headerLogoUrl) && !headerLogoUnavailable;
	const headerTitle = useHeaderLogo ? undefined : (item?.Name || 'Details');

	const handleHeaderLogoError = useImageErrorFallback(null, {
		onError: () => setHeaderLogoUnavailable(true)
	});
	const handleBackdropImageError = useImageErrorFallback(null, {
		onError: () => setBackdropUnavailable(true)
	});

	const handleBackdropImageLoad = useCallback((event) => {
		const imageUrl = event.currentTarget?.dataset?.bfSrcKey || event.currentTarget?.currentSrc || event.currentTarget?.src;
		if (!imageUrl) return;
		setLoadedBackdropUrls((previous) => (
			previous[imageUrl] ? previous : {...previous, [imageUrl]: true}
		));
	}, []);

	const handleCastImageError = useImageErrorFallback();
	const hideImageOnError = useImageErrorFallback();

	const getCastImageUrl = useCallback((personId) => {
		return jellyfinService.getImageUrl(personId, 'Primary', 240);
	}, []);

	const getSeasonImageUrl = useCallback((season) => {
		return resolveSeasonImageUrl(season, item, jellyfinService);
	}, [item]);

	const getEpisodeImageUrl = useCallback((episode) => {
		return resolveEpisodeImageUrl(episode, item, jellyfinService);
	}, [item]);

	const handleSeasonImageError = useCallback((event) => {
		if (item?.ImageTags?.Primary) {
			event.target.src = jellyfinService.getImageUrl(item.Id, 'Primary', 500);
		} else {
			hideImageOnError(event);
		}
	}, [hideImageOnError, item]);

	const handleEpisodeImageError = useCallback((event) => {
		const imageElement = event.currentTarget;
		const fallbackStep = imageElement.dataset.fallbackStep || '0';
		if (fallbackStep === '0' && item?.BackdropImageTags?.length > 0) {
			imageElement.dataset.fallbackStep = '1';
			imageElement.src = jellyfinService.getBackdropUrl(item.Id, 0, 960);
			return;
		}
		if (fallbackStep !== '2' && item?.ImageTags?.Primary) {
			imageElement.dataset.fallbackStep = '2';
			imageElement.src = jellyfinService.getImageUrl(item.Id, 'Primary', 760);
			return;
		}
		hideImageOnError(event);
	}, [hideImageOnError, item]);

	return {
		backdropUrl,
		hasBackdropImage,
		isBackdropImageLoaded,
		headerLogoUrl,
		useHeaderLogo,
		headerTitle,
		handleHeaderLogoError,
		handleBackdropImageError,
		handleBackdropImageLoad,
		handleCastImageError,
		getCastImageUrl,
		getSeasonImageUrl,
		getEpisodeImageUrl,
		handleSeasonImageError,
		handleEpisodeImageError
	};
};

