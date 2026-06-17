jest.mock('../../../../utils/platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getRuntimePlatformCapabilities} from '../../../../utils/platformCapabilities';
import {buildUserPrimaryImageUrl} from '../loginImageUrls';

const mockNoWebpSupport = () => {
	getRuntimePlatformCapabilities.mockReturnValue({
		playback: {
			supportsWebpImage: false
		}
	});
};

describe('login image url helpers', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockNoWebpSupport();
	});

	it('builds user primary image urls without requiring an avatar tag', () => {
		const url = buildUserPrimaryImageUrl({
			baseUrl: 'http://media.local/',
			userId: 'user-1',
			accessToken: 'token-1',
			width: 88
		});
		const parsedUrl = new URL(url);

		expect(parsedUrl.origin).toBe('http://media.local');
		expect(parsedUrl.pathname).toBe('/Users/user-1/Images/Primary');
		expect(parsedUrl.searchParams.get('api_key')).toBe('token-1');
		expect(parsedUrl.searchParams.get('width')).toBe('88');
		expect(parsedUrl.searchParams.has('tag')).toBe(false);
	});

	it('uses avatar tags when available for cache busting', () => {
		const url = buildUserPrimaryImageUrl({
			baseUrl: 'http://media.local',
			userId: 'user-1',
			accessToken: 'token-1',
			width: 88,
			tag: 'avatar-1'
		});

		expect(new URL(url).searchParams.get('tag')).toBe('avatar-1');
	});
});
