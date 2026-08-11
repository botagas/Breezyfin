import {useCallback, useEffect, useRef} from 'react';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {getRuntimeSuspended} from '../../../hooks/useRuntimeSuspension';
import jellyfinService from '../../../services/jellyfinService';

const getPositionTicks = (video) => Math.floor(
	Math.max(0, Number(video?.currentTime) || 0) * JELLYFIN_TICKS_PER_SECOND
);

const MAX_STOPPED_SESSION_KEYS = 32;

const getPlaySessionId = (snapshot) => (
	snapshot?.playSessionId || snapshot?.session?.playSessionId || snapshot?.session?.PlaySessionId || null
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
	const progressEpochRef = useRef(0);
	const startedKeyRef = useRef('');
	const stoppedSessionKeysRef = useRef(new Set());

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

	const settleQueuedProgress = useCallback((queued, result) => {
		queued?.waiters?.forEach((resolve) => resolve(result));
	}, []);

	const flushProgress = useCallback((snapshot) => {
		const epoch = progressEpochRef.current;
		progressPendingRef.current = true;
		const reportPromise = enqueue(async () => {
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
				if (progressEpochRef.current === epoch) {
					progressPendingRef.current = false;
					const queued = queuedProgressRef.current;
					queuedProgressRef.current = null;
					if (queued) {
						flushProgress(queued.snapshot).then((result) => {
							settleQueuedProgress(queued, result);
						});
					}
				}
			}
		});
		return reportPromise;
	}, [enqueue, isSnapshotCurrent, settleQueuedProgress]);

	const reportPlaybackProgressNow = useCallback((isPaused = false, {force = true} = {}) => {
		const snapshot = createSnapshot({isPaused});
		if (!snapshot.itemId) return Promise.resolve(false);
		if (progressPendingRef.current) {
			if (!force) return reportChainRef.current;
			return new Promise((resolve) => {
				if (queuedProgressRef.current) {
					queuedProgressRef.current.snapshot = snapshot;
					queuedProgressRef.current.waiters.push(resolve);
					return;
				}
				queuedProgressRef.current = {
					snapshot,
					waiters: [resolve]
				};
			});
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

	const enqueuePlaybackStopped = useCallback((snapshot, {requirePlaySessionId = false} = {}) => {
		const playSessionId = getPlaySessionId(snapshot);
		if (!snapshot?.itemId || (requirePlaySessionId && !playSessionId)) {
			return Promise.resolve(false);
		}
		const stopKey = playSessionId ? `${snapshot.itemId}:${playSessionId}` : '';
		if (stopKey && stoppedSessionKeysRef.current.has(stopKey)) {
			return Promise.resolve(false);
		}
		if (stopKey) {
			stoppedSessionKeysRef.current.add(stopKey);
			while (stoppedSessionKeysRef.current.size > MAX_STOPPED_SESSION_KEYS) {
				const oldestKey = stoppedSessionKeysRef.current.values().next().value;
				stoppedSessionKeysRef.current.delete(oldestKey);
			}
		}
		return enqueue(async () => {
			await jellyfinService.reportPlaybackStopped(
				snapshot.itemId,
				snapshot.positionTicks,
				snapshot.session
			);
			return true;
		});
	}, [enqueue]);

	const reportPlaybackSessionStopped = useCallback((snapshot = {}) => (
		enqueuePlaybackStopped({
			itemId: snapshot.itemId || null,
			positionTicks: Math.max(0, Number(snapshot.positionTicks) || 0),
			playSessionId: getPlaySessionId(snapshot),
			session: {...(snapshot.session || {})}
		}, {requirePlaySessionId: true})
	), [enqueuePlaybackStopped]);

	const reportPlaybackStopped = useCallback((overrides = {}) => {
		const snapshot = createSnapshot(overrides);
		stopProgressReporting();
		return enqueuePlaybackStopped(snapshot);
	}, [createSnapshot, enqueuePlaybackStopped, stopProgressReporting]);

	useEffect(() => {
		startedKeyRef.current = '';
		progressEpochRef.current += 1;
		settleQueuedProgress(queuedProgressRef.current, false);
		queuedProgressRef.current = null;
		progressPendingRef.current = false;
	}, [item?.Id, settleQueuedProgress]);

	useEffect(() => () => {
		progressEpochRef.current += 1;
		settleQueuedProgress(queuedProgressRef.current, false);
		queuedProgressRef.current = null;
		stopProgressReporting();
	}, [settleQueuedProgress, stopProgressReporting]);

	return {
		reportPlaybackStartedOnce,
		reportPlaybackProgressNow,
		reportPlaybackSessionStopped,
		reportPlaybackStopped,
		startProgressReporting,
		stopProgressReporting
	};
};

export default usePlayerPlaybackReporter;
