import {
	createPlaybackRecoveryLedger,
	PLAYBACK_RECOVERY_KEYS
} from '../playbackRecoveryLedger';

describe('playbackRecoveryLedger', () => {
	const createLedger = () => {
		const currentGenerationRef = {current: 1};
		const ledger = createPlaybackRecoveryLedger({
			getCurrentGeneration: () => currentGenerationRef.current,
			maxHistory: 2
		});
		return {currentGenerationRef, ledger};
	};

	it('resets generation-scoped attempts and carries item-scoped budgets', () => {
		const {currentGenerationRef, ledger} = createLedger();
		ledger.beginGeneration(1, {itemId: 'item-1'});
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.playSessionRebuild, {max: 1});
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.transcodeFallback);
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.hlsNetwork, {max: 1});
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.reload);

		currentGenerationRef.current = 2;
		const next = ledger.beginGeneration(2, {itemId: 'item-1'});

		expect(next.attempts.playSessionRebuild).toBe(1);
		expect(next.claims.transcodeFallback).toBe(true);
		expect(next.attempts.hlsNetwork).toBe(0);
		expect(next.claims.reload).toBe(false);
	});

	it('does not carry item-scoped budgets to another item', () => {
		const {currentGenerationRef, ledger} = createLedger();
		ledger.beginGeneration(1, {itemId: 'item-1'});
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.playSessionRebuild, {max: 1});
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.transcodeFallback);

		currentGenerationRef.current = 2;
		const next = ledger.beginGeneration(2, {itemId: 'item-2'});

		expect(next.attempts.playSessionRebuild).toBe(0);
		expect(next.claims.transcodeFallback).toBe(false);
	});

	it('enforces bounded attempts, one-shot claims, and failure locking', () => {
		const {ledger} = createLedger();
		ledger.beginGeneration(1, {itemId: 'item-1'});

		expect(ledger.claim(1, PLAYBACK_RECOVERY_KEYS.hlsNetwork, {max: 1}).accepted).toBe(true);
		expect(ledger.claim(1, PLAYBACK_RECOVERY_KEYS.hlsNetwork, {max: 1})).toEqual(expect.objectContaining({
			accepted: false,
			reason: 'max-attempts'
		}));
		expect(ledger.claim(1, PLAYBACK_RECOVERY_KEYS.reload).accepted).toBe(true);
		expect(ledger.claim(1, PLAYBACK_RECOVERY_KEYS.reload)).toEqual(expect.objectContaining({
			accepted: false,
			reason: 'already-claimed'
		}));

		expect(ledger.lock(1, 'terminal')).toBe(true);
		expect(ledger.isLocked(1)).toBe(true);
		expect(ledger.claim(1, PLAYBACK_RECOVERY_KEYS.hlsMedia)).toEqual(expect.objectContaining({
			accepted: false,
			reason: 'failure-locked'
		}));
	});

	it('rejects stale claims and keeps only the configured history size', () => {
		const {currentGenerationRef, ledger} = createLedger();
		ledger.beginGeneration(1, {itemId: 'item-1'});
		currentGenerationRef.current = 2;
		ledger.beginGeneration(2, {itemId: 'item-1'});
		currentGenerationRef.current = 3;
		ledger.beginGeneration(3, {itemId: 'item-1'});

		expect(ledger.claim(1, PLAYBACK_RECOVERY_KEYS.hlsNetwork)).toEqual(expect.objectContaining({
			accepted: false,
			reason: 'stale-generation'
		}));
		expect(ledger.getHistory()).toHaveLength(2);
		expect(ledger.get(1)).toBeNull();
		expect(ledger.get(3)).toEqual(expect.objectContaining({generation: 3}));
	});

	it('clears all budgets for item changes and explicit retries', () => {
		const {currentGenerationRef, ledger} = createLedger();
		ledger.beginGeneration(1, {itemId: 'item-1'});
		ledger.claim(1, PLAYBACK_RECOVERY_KEYS.transcodeFallback);
		ledger.resetForItem('item-2');
		currentGenerationRef.current = 2;
		let next = ledger.beginGeneration(2, {itemId: 'item-2'});
		expect(next.claims.transcodeFallback).toBe(false);

		ledger.claim(2, PLAYBACK_RECOVERY_KEYS.transcodeFallback);
		ledger.resetForRetry('item-2');
		currentGenerationRef.current = 3;
		next = ledger.beginGeneration(3, {itemId: 'item-2'});
		expect(next.claims.transcodeFallback).toBe(false);
	});

	it('applies grouped claims atomically', () => {
		const {currentGenerationRef, ledger} = createLedger();
		ledger.beginGeneration(1, {itemId: 'item-1'});
		expect(ledger.claimMany(1, [
			{key: PLAYBACK_RECOVERY_KEYS.playSessionRebuild, max: 1},
			{key: PLAYBACK_RECOVERY_KEYS.reload}
		])).toEqual(expect.objectContaining({accepted: true}));

		currentGenerationRef.current = 2;
		ledger.beginGeneration(2, {itemId: 'item-1'});
		expect(ledger.claimMany(2, [
			{key: PLAYBACK_RECOVERY_KEYS.playSessionRebuild, max: 1},
			{key: PLAYBACK_RECOVERY_KEYS.reload}
		])).toEqual(expect.objectContaining({
			accepted: false,
			key: PLAYBACK_RECOVERY_KEYS.playSessionRebuild
		}));
		expect(ledger.get(2).claims.reload).toBe(false);
	});
});
