import {useCallback, useEffect, useRef} from 'react';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {getRuntimeSuspended} from '../../../hooks/useRuntimeSuspension';
import jellyfinService from '../../../services/jellyfinService';

const getPositionTicks = (video) => Math.floor(
	Math.max(0, Number(video?.currentTime) || 0) * JELLYFIN_TICKS_PER_SECOND
);

export const usePlayerPlaybackReporter = ({
	item,
	videoRef,
	progressIntervalRef,
	playbackGenerationRef,
	playbackSessionRef,
	getPlaybackSessionContext
}) => {
	const reportChainRef = useRef(Promise.resolve());
	const progressPendingRef = useRef(false);
	const queuedProgressRef = useRef(null);
	const startedKeyRef = useRef('');

	const isSnapshotCurrent = useCallback((snapshot) => (
		snapshot?.itemId === item?.Id &&
		snapshot?.generation === playbackGenerationRef.current &&
		snapshot?.playSessionId === playbackSessionRef.current?.playSessionId
	), [item?.Id, playbackGenerationRef, playbackSessionRef]);

	const createSnapshot = useCallback((overrides = {}) => {
		const session = getPlaybackSessionContext();
		return {
			itemId: item?.Id || null,
			generation: playbackGenerationRef.current,
			playSessionId: session?.playSessionId || session?.PlaySessionId || null,
			positionTicks: getPositionTicks(videoRef.current),
			session,
			...overrides
		};
	}, [getPlaybackSessionContext, item?.Id, playbackGenerationRef, videoRef]);

	const enqueue = useCallback((operation) => {
		reportChainRef.current = reportChainRef.current
			.catch(() => undefined)
			.then(operation)
			.catch((error) => {
				console.warn('Playback reporting failed:', error);
			});
		return reportChainRef.current;
	}, []);

	const reportPlaybackStartedOnce = useCallback(() => {
		const snapshot = createSnapshot();
		const startedKey = `${snapshot.itemId}:${snapshot.playSessionId}:${snapshot.generation}`;
		if (!snapshot.itemId || startedKeyRef.current === startedKey) return Promise.resolve(false);
		startedKeyRef.current = startedKey;
		return enqueue(async () => {
			if (!isSnapshotCurrent(snapshot)) return false;
			await jellyfinService.reportPlaybackStart(
				snapshot.itemId,
				snapshot.positionTicks,
				snapshot.session
			);
			return true;
		});
	}, [createSnapshot, enqueue, isSnapshotCurrent]);

	const flushProgress = useCallback((snapshot) => {
		progressPendingRef.current = true;
		return enqueue(async () => {
			try {
				if (!isSnapshotCurrent(snapshot)) return false;
				await jellyfinService.reportPlaybackProgress(
					snapshot.itemId,
					snapshot.positionTicks,
					snapshot.isPaused,
					snapshot.session
				);
				return true;
			} finally {
				progressPendingRef.current = false;
				const queued = queuedProgressRef.current;
				queuedProgressRef.current = null;
				if (queued) {
					flushProgress(queued);
				}
			}
		});
	}, [enqueue, isSnapshotCurrent]);

	const reportPlaybackProgressNow = useCallback((isPaused = false, {force = true} = {}) => {
		const snapshot = createSnapshot({isPaused});
		if (!snapshot.itemId) return Promise.resolve(false);
		if (progressPendingRef.current) {
			if (force) queuedProgressRef.current = snapshot;
			return reportChainRef.current;
		}
		return flushProgress(snapshot);
	}, [createSnapshot, flushProgress]);

	const stopProgressReporting = useCallback(() => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
			progressIntervalRef.current = null;
		}
	}, [progressIntervalRef]);

	const startProgressReporting = useCallback(() => {
		stopProgressReporting();
		progressIntervalRef.current = setInterval(() => {
			const video = videoRef.current;
			if (!video || video.paused || getRuntimeSuspended()) return;
			reportPlaybackProgressNow(false, {force: false});
		}, 10000);
	}, [progressIntervalRef, reportPlaybackProgressNow, stopProgressReporting, videoRef]);

	const reportPlaybackStopped = useCallback((overrides = {}) => {
		const snapshot = createSnapshot(overrides);
		stopProgressReporting();
		if (!snapshot.itemId) return Promise.resolve(false);
		return enqueue(async () => {
			await jellyfinService.reportPlaybackStopped(
				snapshot.itemId,
				snapshot.positionTicks,
				snapshot.session
			);
			return true;
		});
	}, [createSnapshot, enqueue, stopProgressReporting]);

	useEffect(() => {
		startedKeyRef.current = '';
		queuedProgressRef.current = null;
		progressPendingRef.current = false;
	}, [item?.Id]);

	useEffect(() => stopProgressReporting, [stopProgressReporting]);

	return {
		reportPlaybackStartedOnce,
		reportPlaybackProgressNow,
		reportPlaybackStopped,
		startProgressReporting,
		stopProgressReporting
	};
};

export default usePlayerPlaybackReporter;
