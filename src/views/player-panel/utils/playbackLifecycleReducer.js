export const PLAYER_LIFECYCLE_PHASES = Object.freeze({
	IDLE: 'idle',
	WAITING_SOURCE: 'waiting-source',
	WAITING_ENGINE: 'waiting-engine',
	WAITING_AUDIO: 'waiting-audio',
	WAITING_SUBTITLES: 'waiting-subtitles',
	WAITING_SYNCPLAY: 'waiting-syncplay',
	STARTING: 'starting',
	STARTED: 'started',
	PAUSED: 'paused',
	RECOVERING: 'recovering',
	TIMED_OUT: 'timed-out',
	FAILED: 'failed',
	STOPPED: 'stopped'
});

const isGeneration = (value) => Number.isInteger(value) && value >= 0;
const VALID_PHASES = new Set(Object.values(PLAYER_LIFECYCLE_PHASES));

const isCurrentGenerationEvent = (state, event) => (
	isGeneration(event?.generation) && event.generation === state.generation
);

const isCurrentSourceEvent = (state, event) => (
	isCurrentGenerationEvent(state, event) &&
	isGeneration(event?.sourceGeneration) &&
	event.sourceGeneration === state.sourceGeneration
);

const isNewerSourceEvent = (state, event) => (
	isCurrentGenerationEvent(state, event) &&
	isGeneration(event?.sourceGeneration) &&
	(
		state.sourceGeneration === null ||
		event.sourceGeneration >= state.sourceGeneration
	)
);

const resolveGatePhase = (state) => {
	if (!state.sourceAttached) return PLAYER_LIFECYCLE_PHASES.WAITING_SOURCE;
	if (!state.engineReady) return PLAYER_LIFECYCLE_PHASES.WAITING_ENGINE;
	if (!state.audioSelectionReady) return PLAYER_LIFECYCLE_PHASES.WAITING_AUDIO;
	if (!state.subtitleReady) return PLAYER_LIFECYCLE_PHASES.WAITING_SUBTITLES;
	return PLAYER_LIFECYCLE_PHASES.STARTING;
};

const resetForGeneration = (generation) => ({
	generation,
	sourceGeneration: null,
	phase: PLAYER_LIFECYCLE_PHASES.WAITING_SOURCE,
	sourceAttached: false,
	engineReady: false,
	audioSelectionReady: true,
	subtitleReady: true,
	syncPlayWaiting: false,
	startInFlight: false,
	playbackStarted: false,
	recovery: null,
	terminal: false
});

export const createInitialPlayerLifecycleState = ({generation = 0} = {}) => ({
	...resetForGeneration(isGeneration(generation) ? generation : 0),
	phase: PLAYER_LIFECYCLE_PHASES.WAITING_SOURCE
});

export const playerLifecycleReducer = (state, event = {}) => {
	if (!state) return createInitialPlayerLifecycleState({generation: event.generation});

	switch (event.type) {
		case 'GENERATION_ALLOCATED':
			if (!isGeneration(event.generation) || event.generation <= state.generation) return state;
			return resetForGeneration(event.generation);

		case 'SOURCE_ATTACHED':
			if (!isNewerSourceEvent(state, event)) return state;
			{
				const nextState = {
					...state,
					sourceGeneration: event.sourceGeneration,
					sourceAttached: true,
					engineReady: event.engineReady === true,
					audioSelectionReady: event.audioSelectionReady !== false,
					subtitleReady: event.subtitleReady !== false,
					syncPlayWaiting: false,
					startInFlight: false,
					playbackStarted: false,
					recovery: null,
					terminal: false
				};
				return {...nextState, phase: resolveGatePhase(nextState)};
			}

		case 'SOURCE_INVALIDATED':
			if (
				!isCurrentGenerationEvent(state, event) ||
				(state.sourceGeneration !== null && event.sourceGeneration !== state.sourceGeneration)
			) return state;
			return {
				...resetForGeneration(state.generation),
				phase: PLAYER_LIFECYCLE_PHASES.WAITING_SOURCE
			};

		case 'PHASE_UPDATED':
			if (!isCurrentGenerationEvent(state, event) || !VALID_PHASES.has(event.phase)) return state;
			if (
				state.sourceGeneration !== null &&
				event.sourceGeneration !== state.sourceGeneration
			) return state;
			if (state.terminal && event.phase !== PLAYER_LIFECYCLE_PHASES.FAILED) return state;
			return {...state, phase: event.phase};

		case 'ENGINE_READY':
			if (!isCurrentSourceEvent(state, event)) return state;
			{
				const nextState = {...state, engineReady: true};
				return nextState.playbackStarted || nextState.phase === PLAYER_LIFECYCLE_PHASES.PAUSED
					? nextState
					: {...nextState, phase: resolveGatePhase(nextState)};
			}

		case 'AUDIO_GATE_READY':
			if (!isCurrentSourceEvent(state, event)) return state;
			{
				const nextState = {...state, audioSelectionReady: true};
				return nextState.playbackStarted || nextState.phase === PLAYER_LIFECYCLE_PHASES.PAUSED
					? nextState
					: {...nextState, phase: resolveGatePhase(nextState)};
			}

		case 'AUDIO_GATE_FAILED':
			if (!isCurrentSourceEvent(state, event)) return state;
			return {
				...state,
				audioSelectionReady: false,
				phase: event.terminal === true
					? PLAYER_LIFECYCLE_PHASES.FAILED
					: PLAYER_LIFECYCLE_PHASES.WAITING_AUDIO
			};

		case 'SUBTITLE_GATE_UPDATED':
			if (!isCurrentSourceEvent(state, event)) return state;
			{
				const status = String(event.status || 'loading');
				const subtitleReady = status === 'ready' && event.readyForSource !== false;
				let phase = subtitleReady
					? resolveGatePhase({...state, subtitleReady: true})
					: PLAYER_LIFECYCLE_PHASES.WAITING_SUBTITLES;
				if (status === 'timed-out') phase = PLAYER_LIFECYCLE_PHASES.TIMED_OUT;
				if (['failed', 'fetch-failed', 'unsupported-payload', 'empty-events'].includes(status)) {
					phase = PLAYER_LIFECYCLE_PHASES.FAILED;
				}
				return {...state, subtitleReady, phase};
			}

		case 'SYNCPLAY_WAITING':
			if (!isCurrentSourceEvent(state, event)) return state;
			return {
				...state,
				syncPlayWaiting: true,
				phase: PLAYER_LIFECYCLE_PHASES.WAITING_SYNCPLAY
			};

		case 'SYNCPLAY_READY':
			if (!isCurrentSourceEvent(state, event)) return state;
			{
				const nextState = {...state, syncPlayWaiting: false};
				return {...nextState, phase: resolveGatePhase(nextState)};
			}

		case 'PLAY_REQUESTED':
			if (!isCurrentSourceEvent(state, event) || state.terminal) return state;
			return {
				...state,
				startInFlight: true,
				phase: PLAYER_LIFECYCLE_PHASES.STARTING
			};

		case 'PLAY_CONFIRMED':
			if (!isCurrentSourceEvent(state, event) || state.terminal) return state;
			return {
				...state,
				startInFlight: false,
				playbackStarted: true,
				phase: PLAYER_LIFECYCLE_PHASES.STARTED,
				recovery: null
			};

		case 'PLAYBACK_PAUSED':
			if (!isCurrentSourceEvent(state, event) || !state.playbackStarted) return state;
			return {...state, phase: PLAYER_LIFECYCLE_PHASES.PAUSED};

		case 'AUDIO_TRANSITION_STARTED':
			if (!isCurrentSourceEvent(state, event)) return state;
			return {
				...state,
				startInFlight: false,
				recovery: {kind: 'audio-transition', id: event.transitionId || null},
				phase: PLAYER_LIFECYCLE_PHASES.RECOVERING
			};

		case 'AUDIO_TRANSITION_READY':
			if (!isCurrentSourceEvent(state, event)) return state;
			return {
				...state,
				startInFlight: false,
				playbackStarted: event.started === true,
				recovery: null,
				phase: PLAYER_LIFECYCLE_PHASES.STARTED
			};

		case 'RECOVERY_STARTED':
			if (!isCurrentGenerationEvent(state, event) || state.terminal) return state;
			return {
				...state,
				startInFlight: false,
				recovery: {kind: event.kind || 'playback-recovery', attempt: event.attempt || null},
				phase: PLAYER_LIFECYCLE_PHASES.RECOVERING
			};

		case 'RECOVERY_FAILED':
			if (!isCurrentGenerationEvent(state, event)) return state;
			return event.terminal === true
				? {...state, recovery: null, terminal: true, phase: PLAYER_LIFECYCLE_PHASES.FAILED}
				: {...state, recovery: null, phase: resolveGatePhase(state)};

		case 'TERMINAL_ERROR':
			if (!isCurrentGenerationEvent(state, event)) return state;
			return {
				...state,
				startInFlight: false,
				recovery: null,
				terminal: true,
				phase: PLAYER_LIFECYCLE_PHASES.FAILED
			};

		case 'STOPPED':
			if (!isCurrentGenerationEvent(state, event)) return state;
			return {
				...state,
				startInFlight: false,
				playbackStarted: false,
				phase: PLAYER_LIFECYCLE_PHASES.STOPPED
			};

		default:
			return state;
	}
};

export default playerLifecycleReducer;
