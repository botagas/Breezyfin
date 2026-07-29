jest.mock('../../services/jellyfinService', () => ({
	__esModule: true,
	default: {
		serverUrl: 'http://jellyfin.test',
		accessToken: 'token',
		getImageUrl: jest.fn(() => 'primary-url'),
		getBackdropUrl: jest.fn(() => 'backdrop-url')
	}
}));

import jellyfinService from '../../services/jellyfinService';
import {
	getEpisodeLocator,
	getLandscapeCardImageUrl,
	getLandscapeCardImageUrls,
	getMediaPanelBackdropUrls,
	getPosterCardImageUrls,
	isPlayableMediaItem,
	mergeMediaItemImageCandidates,
	uniqueImageCandidates
} from '../mediaItemUtils';

beforeEach(() => {
	jest.clearAllMocks();
	jellyfinService.getImageUrl.mockImplementation(() => 'primary-url');
	jellyfinService.getBackdropUrl.mockImplementation(() => 'backdrop-url');
});

describe('mediaItemUtils playback eligibility', () => {
	it('accepts playable video items', () => {
		expect(isPlayableMediaItem({Type: 'Movie'})).toBe(true);
		expect(isPlayableMediaItem({Type: 'Episode'})).toBe(true);
		expect(isPlayableMediaItem({Type: 'Unknown', MediaType: 'Video'})).toBe(true);
	});

	it('rejects browse containers and missing items', () => {
		expect(isPlayableMediaItem({Type: 'Series'})).toBe(false);
		expect(isPlayableMediaItem({Type: 'Season'})).toBe(false);
		expect(isPlayableMediaItem(null)).toBe(false);
	});
});

describe('mediaItemUtils episode labels', () => {
	it('formats only real season and episode values', () => {
		expect(getEpisodeLocator({ParentIndexNumber: 2, IndexNumber: 7})).toBe('S2:E7');
		expect(getEpisodeLocator({ParentIndexNumber: 0, IndexNumber: 1}, {separator: ''})).toBe('S0E1');
	});

	it('does not invent episode numbers when metadata is missing', () => {
		expect(getEpisodeLocator({})).toBe('');
		expect(getEpisodeLocator({ParentIndexNumber: 1})).toBe('');
	});
});

describe('mediaItemUtils landscape artwork', () => {
	it('uses tagged episode primary artwork before broader fallbacks', () => {
		const result = getLandscapeCardImageUrl({
			Id: 'episode-1',
			Type: 'Episode',
			ImageTags: {Primary: 'episode-tag'},
			BackdropImageTags: ['backdrop-tag']
		}, {width: 960});

		expect(result).toBe('primary-url');
		expect(jellyfinService.getImageUrl).toHaveBeenCalledWith(
			'episode-1',
			'Primary',
			960,
			{tag: 'episode-tag', quality: 76}
		);
	});

	it('uses tagged item backdrops when available', () => {
		const result = getLandscapeCardImageUrl({
			Id: 'movie-1',
			Type: 'Movie',
			BackdropImageTags: ['movie-backdrop-tag']
		});

		expect(result).toBe('backdrop-url');
		expect(jellyfinService.getBackdropUrl).toHaveBeenCalledWith(
			'movie-1',
			0,
			640,
			{tag: 'movie-backdrop-tag', quality: 76}
		);
	});

	it('prefers the explicit parent backdrop item over a series fallback id', () => {
		getLandscapeCardImageUrl({
			Id: 'episode-2',
			Type: 'Episode',
			SeriesId: 'series-1',
			ParentBackdropItemId: 'parent-backdrop-1',
			ParentBackdropImageTags: ['parent-tag']
		});

		expect(jellyfinService.getBackdropUrl).toHaveBeenCalledWith(
			'parent-backdrop-1',
			0,
			640,
			{tag: 'parent-tag', quality: 76}
		);
	});

	it('builds ordered poster candidates and removes duplicate urls', () => {
		jellyfinService.getImageUrl.mockImplementation((itemId, type, width, options = {}) => (
			`primary:${itemId}:${options.tag || 'untagged'}:${width}:${options.quality}`
		));
		jellyfinService.getBackdropUrl.mockImplementation((itemId, index, width, options = {}) => (
			`backdrop:${itemId}:${options.tag || 'untagged'}:${width}:${options.quality}`
		));

		expect(getPosterCardImageUrls({
			Id: 'episode-ordered',
			Type: 'Episode',
			SeriesId: 'series-ordered',
			ImageTags: {Primary: 'episode-primary'},
			BackdropImageTags: ['episode-backdrop'],
			SeriesPrimaryImageTag: 'series-primary'
		})).toEqual([
			'primary:episode-ordered:episode-primary:400:78',
			'backdrop:episode-ordered:episode-backdrop:400:78',
			'primary:series-ordered:series-primary:400:78',
			'primary:episode-ordered:untagged:400:78'
		]);

		expect(uniqueImageCandidates(['same', '', 'same', null, 'next'])).toEqual(['same', 'next']);
	});

	it('builds ordered landscape candidates from item and parent artwork', () => {
		jellyfinService.getImageUrl.mockImplementation((itemId, type, width, options = {}) => (
			`primary:${itemId}:${options.tag || 'untagged'}`
		));
		jellyfinService.getBackdropUrl.mockImplementation((itemId, index, width, options = {}) => (
			`backdrop:${itemId}:${options.tag || 'untagged'}`
		));

		expect(getLandscapeCardImageUrls({
			Id: 'episode-landscape',
			Type: 'Episode',
			SeriesId: 'series-landscape',
			ParentBackdropItemId: 'series-landscape',
			ImageTags: {Primary: 'episode-primary'},
			BackdropImageTags: ['episode-backdrop'],
			ParentBackdropImageTags: ['series-backdrop'],
			SeriesPrimaryImageTag: 'series-primary'
		})).toEqual([
			'primary:episode-landscape:episode-primary',
			'backdrop:episode-landscape:episode-backdrop',
			'backdrop:series-landscape:series-backdrop',
			'primary:series-landscape:series-primary',
			'primary:episode-landscape:untagged'
		]);
	});

	it('keeps provider artwork ahead of generated Jellyfin fallbacks', () => {
		expect(mergeMediaItemImageCandidates({
			ImageCandidates: ['provider-image', 'shared-image'],
			AuthenticatedImageUrl: 'authenticated-image'
		}, ['shared-image', 'jellyfin-fallback'])).toEqual([
			'provider-image',
			'shared-image',
			'authenticated-image',
			'jellyfin-fallback'
		]);
	});

	it('builds a panel-backdrop fallback chain from backdrop to primary artwork', () => {
		jellyfinService.getBackdropUrl
			.mockImplementationOnce(() => 'episode-backdrop-url')
			.mockImplementationOnce(() => 'parent-backdrop-url')
			.mockImplementationOnce(() => 'series-backdrop-url');
		jellyfinService.getImageUrl
			.mockImplementationOnce(() => 'episode-primary-url')
			.mockImplementationOnce(() => 'episode-primary-url')
			.mockImplementationOnce(() => 'series-primary-url');

		const candidates = getMediaPanelBackdropUrls({
			Id: 'episode-3',
			Type: 'Episode',
			SeriesId: 'series-3',
			ParentBackdropItemId: 'series-3',
			ParentBackdropImageTags: ['parent-tag'],
			ImageTags: {Primary: 'episode-tag'},
			SeriesPrimaryImageTag: 'series-primary-tag'
		});

		expect(candidates).toEqual([
			'episode-backdrop-url',
			'parent-backdrop-url',
			'episode-primary-url',
			'series-backdrop-url',
			'series-primary-url'
		]);
	});

	it('still resolves backdrop candidates when optional image tags are absent', () => {
		jellyfinService.getBackdropUrl.mockImplementation(() => 'untagged-backdrop-url');
		jellyfinService.getImageUrl.mockImplementation(() => 'untagged-primary-url');

		expect(getMediaPanelBackdropUrls({Id: 'movie-with-sparse-fields', Type: 'Movie'})).toEqual([
			'untagged-backdrop-url',
			'untagged-primary-url'
		]);
	});

	it('does not treat provider-only discovery IDs as Jellyfin image IDs', () => {
		const item = {
			Id: 'movie:provider:123',
			Type: 'Movie',
			IsDiscoveryItem: true,
			JellyfinItemId: null
		};

		expect(getLandscapeCardImageUrls(item)).toEqual([]);
		expect(getMediaPanelBackdropUrls(item)).toEqual([]);
		expect(jellyfinService.getBackdropUrl).not.toHaveBeenCalled();
		expect(jellyfinService.getImageUrl).not.toHaveBeenCalled();
	});

	it('uses the linked Jellyfin item ID for discovery image fallbacks', () => {
		jellyfinService.getBackdropUrl.mockImplementation((id) => `backdrop:${id}`);
		jellyfinService.getImageUrl.mockImplementation((id) => `primary:${id}`);
		const item = {
			Id: 'movie:provider:123',
			Type: 'Movie',
			IsDiscoveryItem: true,
			JellyfinItemId: 'jellyfin-movie-123'
		};

		expect(getMediaPanelBackdropUrls(item)).toEqual([
			'backdrop:jellyfin-movie-123',
			'primary:jellyfin-movie-123'
		]);
	});
});
