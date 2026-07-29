import {
	getMediaPerformanceSnapshot,
	registerMediaCardImage,
	registerMediaGridProfile,
	resetMediaPerformanceMetrics,
	subscribeMediaPerformanceMetrics,
	unregisterMediaCardImage,
	unregisterMediaGridProfile,
	updateMediaCardImage
} from '../mediaPerformanceMetrics';

describe('media performance metrics', () => {
	beforeEach(() => resetMediaPerformanceMetrics());
	afterEach(() => resetMediaPerformanceMetrics());

	it('tracks mounted image lifecycle and active grid overhang', () => {
		jest.useFakeTimers();
		const imageToken = Symbol('image');
		const gridToken = Symbol('grid');
		const snapshots = [];
		const unsubscribe = subscribeMediaPerformanceMetrics((snapshot) => snapshots.push(snapshot));

		registerMediaCardImage(imageToken, 'pending');
		registerMediaGridProfile(gridToken, {overhang: 1, active: true});
		expect(getMediaPerformanceSnapshot()).toMatchObject({
			mountedCards: 1,
			pendingImages: 1,
			failedImages: 0,
			gridOverhang: '1'
		});

		updateMediaCardImage(imageToken, 'failed');
		expect(getMediaPerformanceSnapshot()).toMatchObject({
			pendingImages: 0,
			failedImages: 1
		});

		unregisterMediaCardImage(imageToken);
		unregisterMediaGridProfile(gridToken);
		jest.advanceTimersByTime(250);
		unsubscribe();
		expect(snapshots.length).toBeGreaterThan(1);
		jest.useRealTimers();
	});

	it('batches rapid virtual-card metric changes into one overlay update', () => {
		jest.useFakeTimers();
		const snapshots = [];
		const tokens = Array.from({length: 12}, (_, index) => Symbol(`image-${index}`));
		const unsubscribe = subscribeMediaPerformanceMetrics((snapshot) => snapshots.push(snapshot));

		tokens.forEach((token) => registerMediaCardImage(token, 'pending'));
		tokens.forEach((token) => updateMediaCardImage(token, 'loaded', 10));
		expect(snapshots).toHaveLength(1);
		jest.advanceTimersByTime(250);
		expect(snapshots).toHaveLength(2);

		tokens.forEach(unregisterMediaCardImage);
		unsubscribe();
		jest.useRealTimers();
	});

	it('clears accumulated records, latency, and pending notifications', () => {
		jest.useFakeTimers();
		const snapshots = [];
		const unsubscribe = subscribeMediaPerformanceMetrics((snapshot) => snapshots.push(snapshot));
		const token = Symbol('image');
		registerMediaCardImage(token, 'pending');
		updateMediaCardImage(token, 'loaded', 25);
		resetMediaPerformanceMetrics();
		expect(getMediaPerformanceSnapshot()).toEqual({
			mountedCards: 0,
			pendingImages: 0,
			failedImages: 0,
			imageLoadLatency: 0,
			gridOverhang: '-'
		});
		expect(snapshots.at(-1)).toEqual(getMediaPerformanceSnapshot());
		unsubscribe();
		jest.useRealTimers();
	});
});
