import {waitForHlsTrackSwitch} from '../hlsTrackSwitch';

const createHls = () => {
	const handlers = new Map();
	return {
		handlers,
		on: jest.fn((event, handler) => handlers.set(event, handler)),
		off: jest.fn((event) => handlers.delete(event))
	};
};

describe('waitForHlsTrackSwitch', () => {
	it('ignores unrelated track events and confirms the requested track', async () => {
		const hls = createHls();
		const switching = waitForHlsTrackSwitch({
			hls,
			eventName: 'audio-switched',
			expectedTrackId: 2,
			apply: jest.fn(),
			isCurrent: () => true,
			timeoutMs: 100
		});
		const handler = hls.handlers.get('audio-switched');
		handler(null, {id: 1});
		handler(null, {id: 2});

		await expect(switching).resolves.toEqual(expect.objectContaining({
			confirmed: true,
			reason: 'event-confirmed'
		}));
	});

	it('rejects confirmation after the source becomes stale', async () => {
		const hls = createHls();
		let current = true;
		const switching = waitForHlsTrackSwitch({
			hls,
			eventName: 'audio-switched',
			expectedTrackId: 2,
			apply: jest.fn(),
			isCurrent: () => current,
			timeoutMs: 100
		});
		current = false;
		hls.handlers.get('audio-switched')(null, {id: 2});

		await expect(switching).resolves.toEqual(expect.objectContaining({
			confirmed: false,
			reason: 'stale-source'
		}));
	});
});
