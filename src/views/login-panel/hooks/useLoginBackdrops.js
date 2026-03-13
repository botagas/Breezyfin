import {useState, useEffect, useCallback, useRef} from 'react';
import {applyImageFormatFallbackFromEvent} from '../../../utils/imageFormat';
import {
	LOGIN_BACKDROP_ROTATE_INTERVAL_MS,
	LOGIN_BACKDROP_TRANSITION_MS,
} from '../utils/loginImageUrls';
import {
	buildShuffledBackdropList,
	fetchBackdropsForSavedServer,
	resolveSavedUserBackdrop,
	selectAvailableBackdropServers
} from '../utils/loginBackdropSources';

export const useLoginBackdrops = ({isActive, savedServers}) => {
	const [loginBackdropUrls, setLoginBackdropUrls] = useState([]);
	const [activeBackdropIndex, setActiveBackdropIndex] = useState(0);
	const [previousBackdropIndex, setPreviousBackdropIndex] = useState(null);
	const [isBackdropTransitioning, setIsBackdropTransitioning] = useState(false);
	const [backdropImageErrors, setBackdropImageErrors] = useState({});
	const [loadedBackdropUrls, setLoadedBackdropUrls] = useState({});
	const backdropRotateTimerRef = useRef(null);
	const backdropTransitionTimerRef = useRef(null);

	const currentBackdropUrl = loginBackdropUrls[activeBackdropIndex] || '';
	const previousBackdropUrl =
		previousBackdropIndex === null || previousBackdropIndex === activeBackdropIndex
			? ''
			: loginBackdropUrls[previousBackdropIndex] || '';
	const currentBackdropLoaded = Boolean(currentBackdropUrl && loadedBackdropUrls[currentBackdropUrl]);
	const previousBackdropLoaded = Boolean(previousBackdropUrl && loadedBackdropUrls[previousBackdropUrl]);

	useEffect(() => () => {
		if (backdropRotateTimerRef.current) {
			clearInterval(backdropRotateTimerRef.current);
			backdropRotateTimerRef.current = null;
		}
		if (backdropTransitionTimerRef.current) {
			clearTimeout(backdropTransitionTimerRef.current);
			backdropTransitionTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (!isActive) {
			setLoginBackdropUrls([]);
			setBackdropImageErrors({});
			return undefined;
		}

		const availableServers = selectAvailableBackdropServers(savedServers);
		if (availableServers.length === 0) {
			setLoginBackdropUrls([]);
			setBackdropImageErrors({});
			return undefined;
		}

		const controller = new AbortController();
		let isCancelled = false;

		const loadBackdrops = async () => {
			try {
				const [perServerBackdrops, fallbackUserBackdrops] = await Promise.all([
					Promise.all(
						availableServers.map((entry) => fetchBackdropsForSavedServer(entry, controller.signal))
					),
					Promise.all(
						availableServers.map((entry) => resolveSavedUserBackdrop(entry, controller.signal))
					)
				]);
				if (isCancelled) return;
				const nextBackdrops = buildShuffledBackdropList(perServerBackdrops, fallbackUserBackdrops);
				setLoginBackdropUrls(nextBackdrops);
				setBackdropImageErrors({});
			} catch (err) {
				if (isCancelled || err?.name === 'AbortError') return;
				setLoginBackdropUrls([]);
				setBackdropImageErrors({});
			}
		};

		loadBackdrops();

		return () => {
			isCancelled = true;
			controller.abort();
		};
	}, [isActive, savedServers]);

	useEffect(() => {
		setActiveBackdropIndex(0);
		setPreviousBackdropIndex(null);
		setIsBackdropTransitioning(false);
		setLoadedBackdropUrls({});
	}, [loginBackdropUrls]);

	const advanceBackdrop = useCallback(() => {
		setActiveBackdropIndex((previousIndex) => {
			if (loginBackdropUrls.length < 2) return previousIndex;
			const nextIndex = (previousIndex + 1) % loginBackdropUrls.length;
			if (nextIndex === previousIndex) return previousIndex;
			setPreviousBackdropIndex(previousIndex);
			return nextIndex;
		});
	}, [loginBackdropUrls.length]);

	useEffect(() => {
		if (!isActive || loginBackdropUrls.length < 2) return undefined;
		if (backdropRotateTimerRef.current) {
			clearInterval(backdropRotateTimerRef.current);
		}
		backdropRotateTimerRef.current = setInterval(
			advanceBackdrop,
			LOGIN_BACKDROP_ROTATE_INTERVAL_MS
		);
		return () => {
			if (backdropRotateTimerRef.current) {
				clearInterval(backdropRotateTimerRef.current);
				backdropRotateTimerRef.current = null;
			}
		};
	}, [advanceBackdrop, isActive, loginBackdropUrls.length]);

	useEffect(() => {
		if (previousBackdropIndex === null || previousBackdropIndex === activeBackdropIndex) return undefined;
		setIsBackdropTransitioning(true);
		if (backdropTransitionTimerRef.current) {
			clearTimeout(backdropTransitionTimerRef.current);
		}
		backdropTransitionTimerRef.current = setTimeout(() => {
			setIsBackdropTransitioning(false);
			setPreviousBackdropIndex(null);
			backdropTransitionTimerRef.current = null;
		}, LOGIN_BACKDROP_TRANSITION_MS);
		return () => {
			if (backdropTransitionTimerRef.current) {
				clearTimeout(backdropTransitionTimerRef.current);
				backdropTransitionTimerRef.current = null;
			}
		};
	}, [activeBackdropIndex, previousBackdropIndex]);

	const handleBackdropError = useCallback((event) => {
		const source = event.currentTarget?.currentSrc || event.currentTarget?.src;
		if (!source) return;
		if (applyImageFormatFallbackFromEvent(event)) return;
		setBackdropImageErrors((previous) => (
			previous[source] ? previous : { ...previous, [source]: true }
		));
		setLoginBackdropUrls((previous) => (
			previous.includes(source)
				? previous.filter((url) => url !== source)
				: previous
		));
	}, []);

	const handleBackdropLoad = useCallback((event) => {
		const source = event.currentTarget?.dataset?.bfSrcKey || event.currentTarget?.currentSrc || event.currentTarget?.src;
		if (!source) return;
		setLoadedBackdropUrls((previous) => (
			previous[source] ? previous : { ...previous, [source]: true }
		));
	}, []);

	return {
		currentBackdropUrl,
		previousBackdropUrl,
		isBackdropTransitioning,
		backdropImageErrors,
		currentBackdropLoaded,
		previousBackdropLoaded,
		handleBackdropLoad,
		handleBackdropError
	};
};
