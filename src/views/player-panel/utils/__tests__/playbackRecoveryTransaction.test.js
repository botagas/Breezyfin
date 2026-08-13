import {createPlaybackRecoveryTransactionManager} from '../playbackRecoveryTransaction';

describe('playbackRecoveryTransaction', () => {
	it('supersedes an initial native-audio fallback before it can publish its override', () => {
		const manager = createPlaybackRecoveryTransactionManager();
		const nativeAudioFallback = manager.begin({
			kind: 'initial-native-audio-fallback',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7,
			overrideCandidate: {audioStreamIndex: 2, disableDirectPlay: true}
		});

		manager.begin({
			kind: 'transcode-fallback',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		});

		expect(manager.isCurrent(nativeAudioFallback, {
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		})).toBe(false);
		expect(nativeAudioFallback.cancelReason).toBe('superseded');
	});

	it('keeps an operation current while its ownership identity is unchanged', () => {
		const manager = createPlaybackRecoveryTransactionManager();
		const overrideCandidate = Object.freeze({forceTranscoding: true});
		const operation = manager.begin({
			kind: 'transcode',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7,
			overrideCandidate
		});

		expect(manager.isCurrent(operation, {
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		})).toBe(true);
		expect(operation.overrideCandidate).toBe(overrideCandidate);
		expect(manager.complete(operation)).toBe(true);
		expect(manager.isCurrent(operation, {
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		})).toBe(false);
	});

	it.each([
		['item replacement', {itemId: 'item-2', playbackGeneration: 3, loadRequestId: 7}],
		['generation replacement', {itemId: 'item-1', playbackGeneration: 4, loadRequestId: 7}],
		['new load request', {itemId: 'item-1', playbackGeneration: 3, loadRequestId: 8}],
		['exit', {itemId: 'item-1', playbackGeneration: 3, loadRequestId: 7, exitInProgress: true}]
	])('rejects an operation after %s', (label, currentIdentity) => {
		const manager = createPlaybackRecoveryTransactionManager();
		const operation = manager.begin({
			kind: 'subtitle',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		});

		expect(manager.isCurrent(operation, currentIdentity)).toBe(false);
	});

	it('cancels the previous operation when a newer recovery begins', () => {
		const manager = createPlaybackRecoveryTransactionManager();
		const first = manager.begin({
			kind: 'transcode',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		});
		const second = manager.begin({
			kind: 'subtitle',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		});

		expect(first.cancelled).toBe(true);
		expect(first.cancelReason).toBe('superseded');
		expect(manager.isCurrent(first, {
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		})).toBe(false);
		expect(manager.isCurrent(second, {
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		})).toBe(true);
	});

	it('invalidates active and future work when disposed', () => {
		const manager = createPlaybackRecoveryTransactionManager();
		const operation = manager.begin({
			kind: 'transcode',
			itemId: 'item-1',
			playbackGeneration: 3,
			loadRequestId: 7
		});

		manager.dispose();

		expect(operation.cancelled).toBe(true);
		expect(manager.begin({kind: 'subtitle'})).toBeNull();
	});
});
