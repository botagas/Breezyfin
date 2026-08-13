import {useCallback, useEffect, useRef, useState} from 'react';

import {JELLYFIN_TICKS_PER_SECOND} from '../../../constants/time';
import {buildPlaybackOverride, resolveVideoSeekSeconds} from '../utils/playbackOverride';

const SWITCH_TOAST_KEY = 'audio-track-switch';
export const AUDIO_TRANSITION_PROGRESS_BARRIER_TIMEOUT_MS = 5000;

const getPlaySessionId = (session) => session?.playSessionId || session?.PlaySessionId || null;

const createCompletion = () => {
	let resolve;
	const promise = new Promise((next) => {
		resolve = next;
	});
	return {promise, resolve};
};

export const usePlayerAudioTransition = ({
	itemId,
	videoRef,
	playbackOptions,
	playbackOverrideRef,
	playbackGenerationRef,
	loadRequestIdRef,
	nativeSourceTokenRef,
	exitInProgressRef,
	mediaSourceData,
	currentAudioTrack,
	currentSubtitleTrack,
	audioTracks,
	subtitleTracks,
	playbackSessionRef,
	preparePlaybackPlan,
	requestPlaybackDecision,
	loadVideo,
	captureSourceDescriptor,
	restorePlaybackSnapshot,
	reportPlaybackProgressNow,
	reportPlaybackSessionStopped,
	saveAudioSelection,
	setCurrentAudioTrack,
	setToastMessage,
	dismissToast,
	appendPlaybackDiagnostic,
	resolveTransitionPosition,
	onTerminalFailure
}) => {
	const [phase, setPhase] = useState(null);
	const operationRef = useRef(null);
	const nextIdRef = useRef(0);
	const progressBarrierRef = useRef(null);
	const itemIdRef = useRef(String(itemId || ''));
	itemIdRef.current = String(itemId || '');

	const isOperationOwned = useCallback((operation) => Boolean(
		operation &&
		operationRef.current === operation &&
		!operation.cancelled &&
		!exitInProgressRef.current &&
		operation.itemId === itemIdRef.current
	), [exitInProgressRef]);

	const isOperationCurrent = useCallback((operation, sourceToken = null) => {
		if (!isOperationOwned(operation)) return false;
		if (
			!operation ||
			operation.cancelled
		) return false;
		if (operation.swapped || sourceToken) {
			const activeSourceToken = nativeSourceTokenRef?.current || null;
			const expectedSourceToken = sourceToken || activeSourceToken;
			return Boolean(
				expectedSourceToken &&
				activeSourceToken === expectedSourceToken &&
				expectedSourceToken.itemId === operation.itemId &&
				expectedSourceToken.runtimeContext?.audioTransition?.id === operation.id
			);
		}
		return (
			playbackGenerationRef.current === operation.generation &&
			(!loadRequestIdRef || loadRequestIdRef.current === operation.loadRequestId) &&
			(!nativeSourceTokenRef || nativeSourceTokenRef.current === operation.sourceToken)
		);
	}, [isOperationOwned, loadRequestIdRef, nativeSourceTokenRef, playbackGenerationRef]);

	const cancelProgressBarrier = useCallback((operation, reason = 'cancelled') => {
		const barrier = progressBarrierRef.current;
		if (!barrier || (operation && barrier.operation !== operation)) return false;
		barrier.settle(reason);
		return true;
	}, []);

	const waitForPausedProgress = useCallback((operation) => new Promise((resolve) => {
		let settled = false;
		let timer = null;
		const settle = (status) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			if (progressBarrierRef.current?.operation === operation) {
				progressBarrierRef.current = null;
			}
			resolve(status);
		};
		timer = setTimeout(
			() => settle('timed-out'),
			AUDIO_TRANSITION_PROGRESS_BARRIER_TIMEOUT_MS
		);
		progressBarrierRef.current = {operation, settle};
		Promise.resolve()
			.then(() => reportPlaybackProgressNow(true))
			.then(() => settle('reported'), () => settle('failed'));
	}), [reportPlaybackProgressNow]);

	const finishOperation = useCallback((operation) => {
		if (operationRef.current !== operation) return;
		cancelProgressBarrier(operation);
		operationRef.current = null;
		setPhase(null);
		dismissToast?.(SWITCH_TOAST_KEY);
	}, [cancelProgressBarrier, dismissToast]);

	const stopTransitionSession = useCallback((operation, session, counterpartSession, {
		skipIfActive = false
	} = {}) => {
		const playSessionId = getPlaySessionId(session);
		const activePlaySessionId = getPlaySessionId(playbackSessionRef.current);
		if (
			!playSessionId ||
			playSessionId === getPlaySessionId(counterpartSession) ||
			(skipIfActive && playSessionId === activePlaySessionId)
		) return false;
		reportPlaybackSessionStopped?.({
			itemId: operation.itemId,
			positionTicks: Math.floor(
				Math.max(0, Number(operation.snapshot?.position) || 0) * JELLYFIN_TICKS_PER_SECOND
			),
			session: {...session}
		});
		return true;
	}, [playbackSessionRef, reportPlaybackSessionStopped]);

	const rollback = useCallback(async (operation, reason) => {
		if (!isOperationOwned(operation)) return false;
		setPhase('rolling-back');
		stopTransitionSession(
			operation,
			operation.replacementSession,
			operation.snapshot.playbackSession
		);
		appendPlaybackDiagnostic?.({
			scope: 'audio-track',
			stage: 'transition-rollback',
			status: 'requested',
			reason,
			message: 'Restoring the previous playback source after an audio transition failure.'
		});
		try {
			operation.completion = createCompletion();
			const restored = await restorePlaybackSnapshot?.(operation.snapshot, operation.id);
			if (!restored || !isOperationCurrent(operation)) throw new Error('Previous source could not be restored');
			const restoredOutcome = await operation.completion.promise;
			if (!restoredOutcome?.success || !isOperationCurrent(operation)) {
				throw new Error(restoredOutcome?.reason || 'Previous source did not become ready');
			}
			setPhase('failed');
			finishOperation(operation);
			setToastMessage({
				message: 'Audio track could not be switched. Previous track restored. Press Play to resume.',
				severity: 'warning'
			});
			return true;
		} catch (error) {
			finishOperation(operation);
			onTerminalFailure?.(
				'Audio track switching failed and the previous playback source could not be restored.'
			);
			return false;
		}
	}, [
		appendPlaybackDiagnostic,
		finishOperation,
		isOperationOwned,
		isOperationCurrent,
		onTerminalFailure,
		restorePlaybackSnapshot,
		setToastMessage,
		stopTransitionSession
	]);

	const requestAudioTransition = useCallback(async (trackIndex) => {
		if (
			operationRef.current ||
			!Number.isInteger(trackIndex) ||
			trackIndex === currentAudioTrack ||
			!videoRef.current
		) return false;
		const video = videoRef.current;
		const localPosition = resolveVideoSeekSeconds(video);
		const position = Number(resolveTransitionPosition?.(localPosition));
		const resolvedPosition = Number.isFinite(position) ? Math.max(0, position) : localPosition;
		const wasPlaying = video.paused === false && video.ended !== true;
		const sourceDescriptor = captureSourceDescriptor?.();
		if (!sourceDescriptor) return false;
		const completion = createCompletion();
		const operation = {
			id: `audio-${++nextIdRef.current}`,
			itemId: itemIdRef.current,
			trackIndex,
			generation: playbackGenerationRef.current,
			loadRequestId: loadRequestIdRef?.current ?? null,
			sourceToken: nativeSourceTokenRef?.current || null,
			completion,
			cancelled: false,
			snapshot: {
				sourceDescriptor,
				mediaSourceData,
				audioTracks,
				subtitleTracks,
				currentAudioTrack,
				currentSubtitleTrack,
				playbackSession: {...playbackSessionRef.current},
				position: resolvedPosition,
				wasPlaying
			}
		};
		operationRef.current = operation;
		setPhase('preparing');
		video.pause();
		setToastMessage({
			key: SWITCH_TOAST_KEY,
			message: 'Switching audio...',
			severity: 'warning',
			persistent: true
		});
		const progressBarrierStatus = await waitForPausedProgress(operation);
		if (progressBarrierStatus === 'timed-out') {
			appendPlaybackDiagnostic?.({
				scope: 'audio-track',
				stage: 'paused-progress-barrier',
				status: 'warning',
				reason: 'report-timeout',
				message: 'Audio transition continued after the paused progress report exceeded 5000 ms.'
			});
		}
		if (!isOperationCurrent(operation)) {
			finishOperation(operation);
			return false;
		}
		const override = buildPlaybackOverride({
			baseOptions: playbackOptions,
			mediaSourceId: mediaSourceData?.Id,
			audioStreamIndex: trackIndex,
			subtitleStreamIndex: currentSubtitleTrack,
			seekSeconds: resolvedPosition,
			extra: {
				disableDirectPlay: true,
				audioTransition: {
					id: operation.id,
					startPaused: !wasPlaying,
					seekSeconds: resolvedPosition
				}
			}
		});
		try {
			const playbackPlan = await preparePlaybackPlan({playbackOverride: override});
			operation.replacementSession = playbackPlan?.session || null;
			if (!isOperationCurrent(operation)) {
				stopTransitionSession(
					operation,
					operation.replacementSession,
					operation.snapshot.playbackSession
				);
				finishOperation(operation);
				return false;
			}
			const preparedSource = playbackPlan?.mediaSource || null;
			operation.preparedAudioTracks = playbackPlan?.tracks?.audio || [];
			operation.resolvedTrackIndex = Number.isInteger(playbackPlan?.tracks?.selectedAudioStreamIndex)
				? playbackPlan.tracks.selectedAudioStreamIndex
				: trackIndex;
			const requiredDecision = playbackPlan?.decision?.required || null;
			if (requiredDecision) {
				stopTransitionSession(
					operation,
					operation.replacementSession,
					operation.snapshot.playbackSession
				);
				finishOperation(operation);
				await requestPlaybackDecision?.({
					...requiredDecision,
					audioStreamIndex: operation.resolvedTrackIndex,
					pendingAudioSelection: true,
					generation: operation.generation,
					itemId: sourceDescriptor.runtimeContext?.itemId,
					mediaSourceId: requiredDecision.mediaSourceId || preparedSource?.Id || mediaSourceData?.Id,
					resumeTicks: Number.isFinite(Number(requiredDecision.resumeTicks))
						? requiredDecision.resumeTicks
						: Math.floor(resolvedPosition * 10000000),
					runtime: false
				});
				return false;
			}
			setPhase('swapping');
			playbackOverrideRef.current = override;
			operation.swapped = true;
			const loadResult = await loadVideo(false, null, {
				playbackPlan,
				transitionId: operation.id,
				deferDecisions: true,
				deferTrackState: true,
				suppressErrors: true
			});
			if (loadResult?.status !== 'attached') {
				return rollback(operation, loadResult?.reason || loadResult?.error?.message || 'replacement-not-attached');
			}
			if (!isOperationCurrent(operation, loadResult?.sourceToken || null)) {
				finishOperation(operation);
				return false;
			}
			operation.replacementAttached = true;
			setPhase(wasPlaying ? 'starting' : 'restoring');
			const outcome = await completion.promise;
			if (!isOperationOwned(operation)) {
				finishOperation(operation);
				return false;
			}
			if (!outcome?.success) return rollback(operation, outcome?.reason || 'replacement-startup-failed');
			stopTransitionSession(
				operation,
				operation.snapshot.playbackSession,
				operation.replacementSession,
				{skipIfActive: true}
			);
			setCurrentAudioTrack(operation.resolvedTrackIndex);
			saveAudioSelection(
				operation.resolvedTrackIndex,
				operation.preparedAudioTracks.length > 0 ? operation.preparedAudioTracks : audioTracks
			);
			setPhase('completed');
			finishOperation(operation);
			return true;
		} catch (error) {
			if (!isOperationCurrent(operation)) {
				finishOperation(operation);
				return false;
			}
			if (!operation.swapped) {
				finishOperation(operation);
				setToastMessage({
					message: 'Audio track could not be switched. Previous track restored. Press Play to resume.',
					severity: 'warning'
				});
				return false;
			}
			return rollback(operation, error?.message || 'audio-transition-failed');
		}
	}, [
		appendPlaybackDiagnostic,
		audioTracks,
		captureSourceDescriptor,
		currentAudioTrack,
		currentSubtitleTrack,
		finishOperation,
		isOperationOwned,
		isOperationCurrent,
		loadRequestIdRef,
		loadVideo,
		mediaSourceData,
		nativeSourceTokenRef,
		playbackGenerationRef,
		playbackOptions,
		playbackOverrideRef,
		playbackSessionRef,
		preparePlaybackPlan,
		requestPlaybackDecision,
		resolveTransitionPosition,
		rollback,
		saveAudioSelection,
		setCurrentAudioTrack,
		setToastMessage,
		waitForPausedProgress,
		stopTransitionSession,
		subtitleTracks,
		videoRef
	]);

	const handleAudioTransitionReady = useCallback((sourceToken) => {
		const operation = operationRef.current;
		if (!operation || sourceToken?.runtimeContext?.audioTransition?.id !== operation.id) return false;
		operation.completion.resolve({success: true});
		return true;
	}, []);

	const handleAudioTransitionFailed = useCallback((sourceToken, reason) => {
		const operation = operationRef.current;
		if (!operation || sourceToken?.runtimeContext?.audioTransition?.id !== operation.id) return false;
		operation.completion.resolve({success: false, reason});
		return true;
	}, []);

	const cancelAudioTransition = useCallback(() => {
		const operation = operationRef.current;
		if (!operation) return false;
		operation.cancelled = true;
		cancelProgressBarrier(operation);
		if (operation.replacementAttached) {
			stopTransitionSession(
				operation,
				operation.snapshot.playbackSession,
				operation.replacementSession
			);
		} else if (operation.replacementSession) {
			stopTransitionSession(
				operation,
				operation.replacementSession,
				operation.snapshot.playbackSession
			);
		}
		operation.completion.resolve({success: false, reason: 'cancelled'});
		finishOperation(operation);
		return true;
	}, [cancelProgressBarrier, finishOperation, stopTransitionSession]);

	useEffect(() => cancelAudioTransition, [cancelAudioTransition, itemId]);

	return {
		phase,
		active: Boolean(phase),
		requestAudioTransition,
		handleAudioTransitionReady,
		handleAudioTransitionFailed,
		cancelAudioTransition,
		isTrackTransitionActive: () => Boolean(operationRef.current)
	};
};

export default usePlayerAudioTransition;
