import {useEffect, useMemo, useState} from 'react';

import {
	getEpisodeActionBadge,
	isEpisodeInProgress,
	isEpisodePlayed
} from '../utils/mediaDetailsHelpers';

export const useMediaDetailsOverviewState = ({
	item,
	episodes,
	selectedEpisode,
	isElegantTheme,
	hasOverviewText,
	overviewTextRef,
	overviewCollapsedClass
}) => {
	const [hasOverviewOverflow, setHasOverviewOverflow] = useState(false);

	useEffect(() => {
		if (!isElegantTheme || !hasOverviewText) {
			setHasOverviewOverflow(false);
			return undefined;
		}

		let frameId = 0;
		const measureOverviewOverflow = () => {
			const overviewElement = overviewTextRef.current;
			if (!overviewElement) {
				setHasOverviewOverflow(false);
				return;
			}
			const hadCollapsedClass = overviewElement.classList.contains(overviewCollapsedClass);
			if (!hadCollapsedClass) {
				overviewElement.classList.add(overviewCollapsedClass);
			}
			const hasOverflow = (overviewElement.scrollHeight - overviewElement.clientHeight) > 1;
			if (!hadCollapsedClass) {
				overviewElement.classList.remove(overviewCollapsedClass);
			}
			setHasOverviewOverflow(hasOverflow);
		};

		const scheduleOverviewMeasurement = () => {
			window.cancelAnimationFrame(frameId);
			frameId = window.requestAnimationFrame(measureOverviewOverflow);
		};

		scheduleOverviewMeasurement();
		window.addEventListener('resize', scheduleOverviewMeasurement);
		return () => {
			window.cancelAnimationFrame(frameId);
			window.removeEventListener('resize', scheduleOverviewMeasurement);
		};
	}, [
		hasOverviewText,
		isElegantTheme,
		item?.Id,
		overviewCollapsedClass,
		overviewTextRef
	]);

	const shouldShowContinue = useMemo(() => {
		if (item?.Type === 'Series') return false;
		if (!item?.UserData) return false;
		const playbackPosition = item?.UserData?.PlaybackPositionTicks || 0;
		if (playbackPosition > 0) return true;
		const percentage = item?.UserData?.PlayedPercentage || 0;
		return percentage > 0 && percentage < 100;
	}, [item]);

	const seriesHasWatchHistory = useMemo(() => {
		if (item?.Type !== 'Series') return false;
		if (episodes.some((episode) => isEpisodeInProgress(episode) || isEpisodePlayed(episode))) return true;
		const userData = item?.UserData;
		if (!userData) return false;
		if ((userData.PlaybackPositionTicks || 0) > 0) return true;
		if ((userData.PlayedPercentage || 0) > 0) return true;
		return userData.Played === true;
	}, [episodes, item]);

	const seriesPlayLabel = useMemo(() => {
		if (item?.Type !== 'Series') return 'Play';
		const targetEpisode =
			selectedEpisode ||
			episodes.find((episode) => !isEpisodePlayed(episode)) ||
			episodes[0] ||
			null;
		if (!targetEpisode) return 'Play';
		const badge = getEpisodeActionBadge(targetEpisode);
		const withBadge = (label) => (badge ? `${label} ${badge}` : label);
		if (isEpisodeInProgress(targetEpisode)) {
			return withBadge('Continue');
		}
		if (!isEpisodePlayed(targetEpisode) && seriesHasWatchHistory) {
			return withBadge('Next Up');
		}
		if (!isEpisodePlayed(targetEpisode)) {
			return withBadge('Play');
		}
		return withBadge('Play');
	}, [episodes, item?.Type, selectedEpisode, seriesHasWatchHistory]);

	const overviewPlayLabel = item?.Type === 'Series'
		? seriesPlayLabel
		: (shouldShowContinue ? 'Continue' : 'Play');

	return {
		hasOverviewOverflow,
		seriesPlayLabel,
		overviewPlayLabel
	};
};
