import {getDroppedFrameEstimate, getFrameCadence} from '../framePerformance';

describe('frame performance helpers', () => {
	it('calibrates common 60 Hz and 30 Hz frame cadences', () => {
		expect(getFrameCadence([16.4, 16.8, 17.1]).hz).toBe(60);
		expect(getFrameCadence([32.8, 33.4, 34.1]).hz).toBe(30);
	});

	it('counts missed refresh opportunities separately from next-frame delay', () => {
		expect(getDroppedFrameEstimate(16.7, 16.67)).toBe(0);
		expect(getDroppedFrameEstimate(50, 16.67)).toBe(2);
		expect(getDroppedFrameEstimate(66, 33.33)).toBe(1);
	});
});
