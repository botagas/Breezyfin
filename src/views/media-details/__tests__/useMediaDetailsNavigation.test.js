import {act, renderHook} from '@testing-library/react';
import {useMediaDetailsNavigation} from '../useMediaDetailsNavigation';
import {KeyCodes} from '../../../utils/keyCodes';

describe('Media Details playback-first focus', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = '';
	});

	it.each([
		[['audio', 'subtitle', 'play', 'intro-action'], 'audio'],
		[['subtitle', 'play', 'intro-action'], 'subtitle'],
		[['play', 'intro-action'], 'play'],
		[['intro-action', 'back'], 'back']
	])('seeds focus among available controls: %j', (names, expected) => {
		const root = document.createElement('div');
		root.innerHTML = names.map((name) => `<button data-md-nav="${name}">${name}</button>`).join('');
		document.body.appendChild(root);
		const props = {containerRef: {current: root}, isActive: true, ready: false, pickerOpen: false, hasSecondarySection: false, onScrollStop: jest.fn()};
		const {result, rerender} = renderHook(() => useMediaDetailsNavigation(props));
		result.current.firstSectionRef.current = root;
		props.ready = true;
		rerender();
		act(() => jest.advanceTimersByTime(20));
		expect(document.activeElement.dataset.mdNav).toBe(expected);
	});

	it('returns DOWN from the breadcrumb to Audio', () => {
		const root = document.createElement('div');
		root.innerHTML = ['breadcrumb', 'audio', 'subtitle', 'play'].map((name) => `<button data-md-nav="${name}">${name}</button>`).join('');
		document.body.appendChild(root);
		const {result} = renderHook(() => useMediaDetailsNavigation({containerRef: {current: root}, isActive: true, ready: false, onScrollStop: jest.fn()}));
		result.current.firstSectionRef.current = root;
		const breadcrumb = root.querySelector('[data-md-nav="breadcrumb"]');
		breadcrumb.focus();
		act(() => result.current.containerHandlers.onKeyDown({keyCode: KeyCodes.DOWN, target: breadcrumb, preventDefault: jest.fn(), stopPropagation: jest.fn()}));
		expect(document.activeElement.dataset.mdNav).toBe('audio');
	});
});
