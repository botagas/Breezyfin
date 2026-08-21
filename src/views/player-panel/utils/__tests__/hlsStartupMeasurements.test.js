import {
	createHlsStartupMeasurements,
	getBufferedSecondsAhead
} from '../hlsStartupMeasurements';

const createSourceToken = () => ({
	generation: 3,
	sourceGeneration: 7,
	itemId: 'item-1',
	mediaSourceId: 'source-1'
});

describe('hlsStartupMeasurements', () => {
	it('performs no work while diagnostics are disabled', () => {
		const appendDiagnostic = jest.fn();
		const tracker = createHlsStartupMeasurements({enabled: false, appendDiagnostic});
		const sourceToken = createSourceToken();

		expect(tracker.begin(sourceToken)).toBe(false);
		expect(tracker.fragmentBuffered(sourceToken, {type: 'main'}, null)).toBe(false);
		expect(tracker.snapshot()).toBeNull();
		expect(appendDiagnostic).not.toHaveBeenCalled();
	});

	it('records bounded current-source startup and early recovery measurements', () => {
		let timestamp = 1000;
		const appendDiagnostic = jest.fn();
		const tracker = createHlsStartupMeasurements({
			enabled: true,
			appendDiagnostic,
			now: () => timestamp
		});
		const sourceToken = createSourceToken();
		const video = {
			currentTime: 4,
			buffered: {
				length: 1,
				start: () => 0,
				end: () => 10
			}
		};

		expect(tracker.begin(sourceToken)).toBe(true);
		timestamp = 1100;
		tracker.mediaAttached(sourceToken);
		timestamp = 1200;
		tracker.manifestParsed(sourceToken);
		timestamp = 1600;
		tracker.fragmentBuffered(sourceToken, {type: 'main'}, video);
		timestamp = 1700;
		tracker.fragmentBuffered(sourceToken, {type: 'audio'}, video);
		timestamp = 1900;
		tracker.playbackSignal(sourceToken, 'playing');
		timestamp = 2000;
		tracker.playbackSignal(sourceToken, 'timeline-progress');
		timestamp = 2100;
		tracker.playbackSignal(sourceToken, 'timeline-progress');
		timestamp = 2500;
		tracker.recovery(sourceToken, 'buffer-stall');

		const snapshot = tracker.snapshot();
		expect(snapshot).toMatchObject({
			firstFragmentType: 'main',
			bufferedSecondsAtReady: 6,
			playingAt: 1900,
			firstTimelineProgressAt: 2000,
			earlyRecoveryReasons: ['buffer-stall']
		});
		expect(appendDiagnostic).toHaveBeenCalledTimes(4);
	});

	it('ignores stale tokens and late recovery events', () => {
		let timestamp = 0;
		const tracker = createHlsStartupMeasurements({enabled: true, now: () => timestamp});
		const sourceToken = createSourceToken();
		const staleToken = {...sourceToken};
		tracker.begin(sourceToken);

		expect(tracker.fragmentBuffered(staleToken, {type: 'main'}, null)).toBe(false);
		timestamp = 11000;
		expect(tracker.recovery(sourceToken, 'late-stall')).toBe(false);
	});
});

describe('getBufferedSecondsAhead', () => {
	it('uses the range containing the current playback position', () => {
		expect(getBufferedSecondsAhead({
			currentTime: 5,
			buffered: {
				length: 2,
				start: (index) => index === 0 ? 0 : 4,
				end: (index) => index === 0 ? 2 : 9
			}
		})).toBe(4);
	});
});
