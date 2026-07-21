import {buildExternalImageVariantUrl} from '../externalImageUrls';

describe('external image URL variants', () => {
	it('adds bounded backdrop transform parameters while preserving authentication', () => {
		const result = new URL(buildExternalImageVariantUrl(
			'https://media.test/Breezyfin/ExternalImages/signed?api_key=secret&width=500',
			{width: 960, quality: 70, blur: 20}
		));

		expect(result.searchParams.get('api_key')).toBe('secret');
		expect(result.searchParams.get('width')).toBe('960');
		expect(result.searchParams.get('quality')).toBe('70');
		expect(result.searchParams.get('blur')).toBe('20');
	});

	it('removes blur for Performance+ and bounds invalidly large values', () => {
		const result = new URL(buildExternalImageVariantUrl(
			'https://media.test/Breezyfin/ExternalImages/signed?api_key=secret&blur=20',
			{width: 4000, quality: 200}
		));

		expect(result.searchParams.get('width')).toBe('1920');
		expect(result.searchParams.get('quality')).toBe('100');
		expect(result.searchParams.has('blur')).toBe(false);
	});

	it('does not rewrite unrelated or malformed URLs', () => {
		expect(buildExternalImageVariantUrl('https://media.test/Items/1/Images/Primary', {
			width: 960,
			blur: 20
		})).toBe('https://media.test/Items/1/Images/Primary');
		expect(buildExternalImageVariantUrl('not a url', {width: 960})).toBe('not a url');
	});
});
