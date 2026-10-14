import {act, renderHook} from '@testing-library/react';
import {useTrackPreferences} from '../useTrackPreferences';

describe('scoped subtitle preference fallback', () => {
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem('breezyfinSettings', JSON.stringify({preferredSubtitleLanguage: 'eng'}));
	});

	it.each([false, true])('uses the file default when the preferred language is unavailable (forced: %s)', (isForced) => {
		const fileDefault = {Type: 'Subtitle', Index: 2, Language: 'spa', IsDefault: true, IsForced: isForced};
		const {result} = renderHook(() => useTrackPreferences('movie-1'));
		expect(result.current.resolveDefaultTrackSelection([fileDefault]).selectedSubtitleTrack).toBe(2);
	});

	it('keeps a saved None selection scoped to its show', () => {
		const streams = [{Type: 'Subtitle', Index: 2, Language: 'spa', IsDefault: true}];
		const {result} = renderHook(() => useTrackPreferences('series-1'));
		act(() => result.current.saveSubtitleSelection(-1, streams));
		expect(result.current.resolveDefaultTrackSelection(streams).selectedSubtitleTrack).toBe(-1);
		const {result: otherResult} = renderHook(() => useTrackPreferences('series-2'));
		expect(otherResult.current.resolveDefaultTrackSelection(streams).selectedSubtitleTrack).toBe(2);
	});

	it('honors global None before a file default', () => {
		localStorage.setItem('breezyfinSettings', JSON.stringify({preferredSubtitleLanguage: 'none'}));
		const {result} = renderHook(() => useTrackPreferences('movie-1'));
		expect(result.current.resolveDefaultTrackSelection([{Type: 'Subtitle', Index: 2, IsDefault: true}]).selectedSubtitleTrack).toBe(-1);
	});

	it('selects a preferred-language track before the file default', () => {
		const {result} = renderHook(() => useTrackPreferences('movie-1'));
		expect(result.current.resolveDefaultTrackSelection([
			{Type: 'Subtitle', Index: 2, Language: 'spa', IsDefault: true},
			{Type: 'Subtitle', Index: 3, Language: 'eng'}
		]).selectedSubtitleTrack).toBe(3);
	});
});
