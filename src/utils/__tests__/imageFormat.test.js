jest.mock('../platformCapabilities', () => ({
	getRuntimePlatformCapabilities: jest.fn()
}));

import {getRuntimePlatformCapabilities} from '../platformCapabilities';
import {
	applyImageFormatFallbackFromEvent,
	applyImageFormatFallbackOnElement,
	applyPreferredImageFormatToParams,
	getPreferredImageFormat,
	isWebpImageFormat,
	stripPreferredImageFormatFromUrl
} from '../imageFormat';

describe('imageFormat utilities', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getRuntimePlatformCapabilities.mockReturnValue({
			playback: {
				supportsWebpImage: false
			}
		});
	});

	it('detects accepted WebP format tokens', () => {
		expect(isWebpImageFormat('Webp')).toBe(true);
		expect(isWebpImageFormat('image/webp')).toBe(true);
		expect(isWebpImageFormat('jpg')).toBe(false);
	});

	it('resolves preferred format only when runtime supports WebP image decode', () => {
		expect(getPreferredImageFormat()).toBe(null);

		getRuntimePlatformCapabilities.mockReturnValue({
			playback: {
				supportsWebpImage: true
			}
		});
		expect(getPreferredImageFormat()).toBe('Webp');
	});

	it('applies explicit or preferred image format to request params', () => {
		const explicitParams = new URLSearchParams();
		expect(applyPreferredImageFormatToParams(explicitParams, {format: 'Jpg'})).toBe('Jpg');
		expect(explicitParams.get('format')).toBe('Jpg');

		const preferredParams = new URLSearchParams();
		getRuntimePlatformCapabilities.mockReturnValue({
			playback: {
				supportsWebpImage: true
			}
		});
		expect(applyPreferredImageFormatToParams(preferredParams)).toBe('Webp');
		expect(preferredParams.get('format')).toBe('Webp');

		const disabledParams = new URLSearchParams();
		expect(applyPreferredImageFormatToParams(disabledParams, {disablePreferredFormat: true})).toBe(null);
		expect(disabledParams.has('format')).toBe(false);
	});

	it('strips WebP format query only when present and recognized', () => {
		expect(stripPreferredImageFormatFromUrl('/Items/1/Images/Primary?tag=a&format=Webp'))
			.toBe('/Items/1/Images/Primary?tag=a');
		expect(stripPreferredImageFormatFromUrl('http://media.local/path/image.jpg?format=image/webp&x=1'))
			.toBe('http://media.local/path/image.jpg?x=1');
		expect(stripPreferredImageFormatFromUrl('/Items/1/Images/Primary?format=Jpg')).toBe(null);
	});

	it('applies downgrade fallback to image elements once per resolved src', () => {
		const image = {
			currentSrc: 'http://media.local/image.jpg?format=Webp&tag=1',
			src: 'http://media.local/image.jpg?format=Webp&tag=1',
			dataset: {},
			style: {display: 'none'}
		};

		expect(applyImageFormatFallbackOnElement(image)).toBe(true);
		expect(image.src).toBe('http://media.local/image.jpg?tag=1');
		expect(image.dataset.bfImageFormatFallback).toBe('http://media.local/image.jpg?tag=1');
		expect(image.style.display).toBe('');

		expect(applyImageFormatFallbackOnElement(image)).toBe(false);
	});

	it('handles fallback from event targets', () => {
		const image = {
			currentSrc: '/Items/1/Images/Primary?format=Webp',
			src: '/Items/1/Images/Primary?format=Webp',
			dataset: {},
			style: {display: 'none'}
		};

		expect(applyImageFormatFallbackFromEvent({currentTarget: image})).toBe(true);
		expect(image.src).toBe('/Items/1/Images/Primary');
		expect(applyImageFormatFallbackFromEvent({currentTarget: image})).toBe(false);
	});
});

