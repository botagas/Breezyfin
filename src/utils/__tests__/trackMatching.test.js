import {
	applyNativeAudioTrackSelection,
	createAudioTrackIdentity,
	getLanguageOrdinal,
	resolveRuntimeTrackIndex
} from '../trackMatching';

const audio = (Index, Language, DisplayTitle, extra = {}) => ({
	Index,
	Language,
	DisplayTitle,
	Type: 'Audio',
	...extra
});

describe('trackMatching', () => {
	it('computes same-language ordinals from Jellyfin stream order', () => {
		const tracks = [
			audio(0, 'rus', 'RU Dub 1'),
			audio(1, 'rus', 'RU Dub 2'),
			audio(2, 'eng', 'English')
		];
		expect(getLanguageOrdinal(tracks, tracks[0])).toBe(0);
		expect(getLanguageOrdinal(tracks, tracks[1])).toBe(1);
		expect(getLanguageOrdinal(tracks, tracks[2])).toBe(0);
	});

	it('stores richer audio track identity metadata', () => {
		const tracks = [
			audio(0, 'rus', 'RU Dub 1', {Codec: 'aac', Channels: 2}),
			audio(1, 'rus', 'RU Dub 2', {Codec: 'ac3', Channels: 6, IsDefault: true})
		];
		expect(createAudioTrackIdentity(tracks[1], tracks)).toEqual({
			index: 1,
			language: 'rus',
			title: null,
			displayTitle: 'RU Dub 2',
			codec: 'ac3',
			channels: 6,
			isDefault: true,
			languageOrdinal: 1
		});
	});

	it('resolves duplicate-language runtime tracks by same-language ordinal', () => {
		const mediaTracks = [
			audio(0, 'rus', 'RU Dub 1'),
			audio(1, 'rus', 'RU Dub 2'),
			audio(2, 'eng', 'English')
		];
		const runtimeTracks = [
			{language: 'rus', label: ''},
			{language: 'rus', label: ''},
			{language: 'eng', label: ''}
		];
		expect(resolveRuntimeTrackIndex({
			runtimeTracks,
			mediaTracks,
			selectedTrackIndex: 1,
			getLanguage: (track) => track.language,
			getTitle: (track) => track.label
		})).toEqual({index: 1, method: 'same-language-ordinal'});
	});

	it('uses positional fallback only when runtime and media counts align', () => {
		const mediaTracks = [
			audio(5, '', ''),
			audio(6, '', '')
		];
		expect(resolveRuntimeTrackIndex({
			runtimeTracks: [{}, {}],
			mediaTracks,
			selectedTrackIndex: 6,
			allowPositionalFallback: true
		})).toEqual({index: 1, method: 'position'});
		expect(resolveRuntimeTrackIndex({
			runtimeTracks: [{}],
			mediaTracks,
			selectedTrackIndex: 6,
			allowPositionalFallback: true
		})).toEqual({index: -1, method: 'no-match'});
	});

	it('applies native audio selection by resolved runtime track', () => {
		const nativeTracks = [
			{language: 'rus', label: '', enabled: true},
			{language: 'rus', label: '', enabled: false},
			{language: 'eng', label: '', enabled: false}
		];
		const video = {audioTracks: nativeTracks};
		const result = applyNativeAudioTrackSelection({
			video,
			mediaTracks: [
				audio(0, 'rus', 'RU Dub 1'),
				audio(1, 'rus', 'RU Dub 2'),
				audio(2, 'eng', 'English')
			],
			selectedTrackIndex: 1
		});
		expect(result).toEqual(expect.objectContaining({
			applied: true,
			status: 'native-applied',
			index: 1,
			method: 'same-language-ordinal'
		}));
		expect(nativeTracks.map((track) => track.enabled)).toEqual([false, true, false]);
	});
});
