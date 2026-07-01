import {
	hasAttachedVideoSource,
	waitForAttachedVideoSource
} from '../subtitle-renderers/videoSourceReady';

describe('videoSourceReady utilities', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('detects an already attached video source', async () => {
		const video = document.createElement('video');
		video.setAttribute('src', '/video.mkv');

		expect(hasAttachedVideoSource(video)).toBe(true);
		await expect(waitForAttachedVideoSource(video)).resolves.toEqual({
			status: 'ready',
			waitedMs: 0
		});
	});

	it('resolves when the source is attached after waiting', async () => {
		const video = document.createElement('video');
		const waitPromise = waitForAttachedVideoSource(video);

		video.setAttribute('src', '/video.mkv');
		video.dispatchEvent(new Event('loadstart'));

		await expect(waitPromise).resolves.toEqual({
			status: 'ready',
			waitedMs: 0
		});
	});

	it('treats srcObject playback as an attached source', () => {
		const video = document.createElement('video');
		Object.defineProperty(video, 'srcObject', {
			configurable: true,
			value: {}
		});

		expect(hasAttachedVideoSource(video)).toBe(true);
	});

	it('treats metadata-ready playback as an attached source when src is unavailable', async () => {
		const video = document.createElement('video');
		Object.defineProperty(video, 'readyState', {
			configurable: true,
			value: 1
		});

		expect(hasAttachedVideoSource(video)).toBe(true);
		await expect(waitForAttachedVideoSource(video)).resolves.toEqual({
			status: 'ready',
			waitedMs: 0
		});
	});

	it('times out if the video source is never attached', async () => {
		const video = document.createElement('video');
		const waitPromise = waitForAttachedVideoSource(video, {timeoutMs: 100});

		jest.advanceTimersByTime(100);

		await expect(waitPromise).resolves.toEqual({
			status: 'timeout',
			waitedMs: 100
		});
	});
});
