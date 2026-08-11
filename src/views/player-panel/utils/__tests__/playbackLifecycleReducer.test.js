import {
	createInitialPlayerLifecycleState,
	playerLifecycleReducer,
	PLAYER_LIFECYCLE_PHASES
} from '../playbackLifecycleReducer';

const reduce = (state, event) => playerLifecycleReducer(state, event);

describe('playbackLifecycleReducer', () => {
	it('preserves the public startup phases through source and gate readiness', () => {
		let state = createInitialPlayerLifecycleState();
		state = reduce(state, {type: 'GENERATION_ALLOCATED', generation: 1});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_SOURCE);

		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 1,
			sourceGeneration: 1,
			engineReady: false,
			audioSelectionReady: false
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_ENGINE);

		state = reduce(state, {
			type: 'ENGINE_READY',
			generation: 1,
			sourceGeneration: 1
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_AUDIO);

		state = reduce(state, {
			type: 'AUDIO_GATE_READY',
			generation: 1,
			sourceGeneration: 1
		});
		state = reduce(state, {
			type: 'SUBTITLE_GATE_UPDATED',
			generation: 1,
			sourceGeneration: 1,
			status: 'loading'
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_SUBTITLES);

		state = reduce(state, {
			type: 'SUBTITLE_GATE_UPDATED',
			generation: 1,
			sourceGeneration: 1,
			status: 'ready'
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.STARTING);
	});

	it('ignores stale generation and source events', () => {
		let state = reduce(createInitialPlayerLifecycleState(), {
			type: 'GENERATION_ALLOCATED',
			generation: 2
		});
		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 2,
			sourceGeneration: 4,
			engineReady: true
		});

		const staleGeneration = reduce(state, {
			type: 'ENGINE_READY',
			generation: 1,
			sourceGeneration: 4
		});
		const staleSource = reduce(state, {
			type: 'PLAY_CONFIRMED',
			generation: 2,
			sourceGeneration: 3
		});

		expect(staleGeneration).toBe(state);
		expect(staleSource).toBe(state);
	});

	it('allows only current-generation visible phase updates', () => {
		let state = reduce(createInitialPlayerLifecycleState(), {
			type: 'GENERATION_ALLOCATED',
			generation: 3
		});
		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 3,
			sourceGeneration: 2
		});
		const current = reduce(state, {
			type: 'PHASE_UPDATED',
			generation: 3,
			sourceGeneration: 2,
			phase: PLAYER_LIFECYCLE_PHASES.WAITING_SUBTITLES
		});
		expect(current.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_SUBTITLES);
		expect(reduce(current, {
			type: 'PHASE_UPDATED',
			generation: 2,
			sourceGeneration: 2,
			phase: PLAYER_LIFECYCLE_PHASES.STARTED
		})).toBe(current);
	});

	it('accepts a newer physical source within the same playback generation', () => {
		let state = reduce(createInitialPlayerLifecycleState(), {
			type: 'GENERATION_ALLOCATED',
			generation: 1
		});
		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 1,
			sourceGeneration: 1,
			engineReady: true
		});
		state = reduce(state, {
			type: 'PLAY_CONFIRMED',
			generation: 1,
			sourceGeneration: 1
		});

		const replacement = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 1,
			sourceGeneration: 2,
			engineReady: false
		});

		expect(replacement.sourceGeneration).toBe(2);
		expect(replacement.playbackStarted).toBe(false);
		expect(replacement.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_ENGINE);
	});

	it('handles SyncPlay, playback confirmation, pause, and late recovery events', () => {
		let state = reduce(createInitialPlayerLifecycleState(), {
			type: 'GENERATION_ALLOCATED',
			generation: 1
		});
		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 1,
			sourceGeneration: 1,
			engineReady: true
		});
		state = reduce(state, {
			type: 'SYNCPLAY_WAITING',
			generation: 1,
			sourceGeneration: 1
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.WAITING_SYNCPLAY);

		state = reduce(state, {
			type: 'SYNCPLAY_READY',
			generation: 1,
			sourceGeneration: 1
		});
		state = reduce(state, {
			type: 'PLAY_REQUESTED',
			generation: 1,
			sourceGeneration: 1
		});
		state = reduce(state, {
			type: 'PLAY_CONFIRMED',
			generation: 1,
			sourceGeneration: 1
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.STARTED);

		state = reduce(state, {
			type: 'PLAYBACK_PAUSED',
			generation: 1,
			sourceGeneration: 1
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.PAUSED);

		const staleRecovery = reduce(state, {
			type: 'RECOVERY_STARTED',
			generation: 0,
			kind: 'hls'
		});
		expect(staleRecovery).toBe(state);
	});

	it('keeps audio-transition restore in the public started phase without claiming playback started', () => {
		let state = reduce(createInitialPlayerLifecycleState(), {
			type: 'GENERATION_ALLOCATED',
			generation: 1
		});
		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 1,
			sourceGeneration: 1,
			engineReady: true
		});
		state = reduce(state, {
			type: 'AUDIO_TRANSITION_READY',
			generation: 1,
			sourceGeneration: 1,
			started: false
		});

		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.STARTED);
		expect(state.playbackStarted).toBe(false);
	});

	it('moves terminal failures to failed and ignores later source events', () => {
		let state = reduce(createInitialPlayerLifecycleState(), {
			type: 'GENERATION_ALLOCATED',
			generation: 1
		});
		state = reduce(state, {
			type: 'SOURCE_ATTACHED',
			generation: 1,
			sourceGeneration: 1,
			engineReady: true
		});
		state = reduce(state, {
			type: 'TERMINAL_ERROR',
			generation: 1
		});
		expect(state.phase).toBe(PLAYER_LIFECYCLE_PHASES.FAILED);
		expect(state.terminal).toBe(true);

		const laterStart = reduce(state, {
			type: 'PLAY_CONFIRMED',
			generation: 1,
			sourceGeneration: 1
		});
		expect(laterStart).toBe(state);
	});
});
