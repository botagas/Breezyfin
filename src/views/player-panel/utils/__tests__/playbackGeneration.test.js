import {createPlaybackGenerationAllocator} from '../playbackGeneration';

describe('playbackGeneration', () => {
	it('separates unpublished invalidation from published allocation', () => {
		const generationRef = {current: 4};
		const publishGeneration = jest.fn();
		const onGenerationAllocated = jest.fn();
		const allocator = createPlaybackGenerationAllocator({
			generationRef,
			publishGeneration,
			onGenerationAllocated
		});

		expect(allocator.invalidate('decision-restart')).toBe(5);
		expect(generationRef.current).toBe(5);
		expect(publishGeneration).not.toHaveBeenCalled();

		expect(allocator.allocate('new-playback-load')).toBe(6);
		expect(generationRef.current).toBe(6);
		expect(publishGeneration).toHaveBeenCalledWith(6, 'new-playback-load');
		expect(onGenerationAllocated).toHaveBeenCalledWith(6, 'new-playback-load');
	});

	it('starts at zero and remains monotonic if the ref is externally advanced', () => {
		const generationRef = {current: null};
		const allocator = createPlaybackGenerationAllocator({generationRef});

		expect(allocator.current()).toBe(0);
		expect(allocator.allocate()).toBe(1);
		generationRef.current = 4;
		expect(allocator.current()).toBe(4);
		expect(allocator.allocate()).toBe(5);
		generationRef.current = 2;
		expect(allocator.current()).toBe(5);
		expect(generationRef.current).toBe(5);
	});

	it('rejects stale generation checks after a replacement', () => {
		const allocator = createPlaybackGenerationAllocator();
		const firstGeneration = allocator.allocate('first');
		const secondGeneration = allocator.allocate('second');

		expect(allocator.isCurrent(firstGeneration)).toBe(false);
		expect(allocator.isCurrent(secondGeneration)).toBe(true);
		expect(allocator.isCurrent(null)).toBe(false);
	});
});
