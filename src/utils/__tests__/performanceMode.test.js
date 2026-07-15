import {
	getMediaBackdropProfile,
	getPerformanceMode,
	getVirtualGridOverhang,
	PERFORMANCE_MODES
} from '../performanceMode';

describe('performance mode profiles', () => {
	it('normalizes animation settings with Performance+ taking precedence', () => {
		expect(getPerformanceMode({})).toBe(PERFORMANCE_MODES.NORMAL);
		expect(getPerformanceMode({disableAnimations: true})).toBe(PERFORMANCE_MODES.PERFORMANCE);
		expect(getPerformanceMode({
			disableAnimations: true,
			disableAllAnimations: true
		})).toBe(PERFORMANCE_MODES.PERFORMANCE_PLUS);
	});

	it('uses bounded virtual-grid overhang by mode', () => {
		expect(getVirtualGridOverhang(PERFORMANCE_MODES.NORMAL)).toBe(2);
		expect(getVirtualGridOverhang(PERFORMANCE_MODES.PERFORMANCE)).toBe(1);
		expect(getVirtualGridOverhang(PERFORMANCE_MODES.PERFORMANCE_PLUS)).toBe(1);
	});

	it('keeps pre-blurred backdrops in Normal and Performance only', () => {
		expect(getMediaBackdropProfile(PERFORMANCE_MODES.NORMAL)).toEqual({
			width: 960,
			quality: 70,
			blur: 20
		});
		expect(getMediaBackdropProfile(PERFORMANCE_MODES.PERFORMANCE)).toEqual({
			width: 720,
			quality: 62,
			blur: 8
		});
		expect(getMediaBackdropProfile(PERFORMANCE_MODES.PERFORMANCE_PLUS)).toEqual({
			width: 640,
			quality: 55,
			blur: undefined
		});
	});
});
