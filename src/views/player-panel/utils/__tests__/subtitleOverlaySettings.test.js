import {
	getSubtitleOverlayAttributes,
	groupSubtitleCuesByPlacement
} from '../subtitleOverlaySettings';

describe('subtitleOverlaySettings utilities', () => {
	it('builds overlay data attributes from subtitle appearance settings', () => {
		expect(getSubtitleOverlayAttributes({
			subtitleOverlayWeight: 'black',
			subtitleOverlayTextColor: 'yellow',
			subtitleOverlayBorderStyle: 'outline',
			subtitleOverlayBorderColor: 'white',
			subtitleOverlayBorderStrength: 'high'
		}, true)).toEqual({
			'data-size': 'medium',
			'data-position': 'standard',
			'data-background': 'medium',
			'data-weight': 'black',
			'data-text-color': 'yellow',
			'data-border-style': 'outline',
			'data-border-color': 'white',
			'data-border-strength': 'high',
			'data-controls-visible': 'true'
		});
	});

	it('falls back to readable defaults for invalid appearance settings', () => {
		expect(getSubtitleOverlayAttributes({
			subtitleOverlayWeight: 'invalid',
			subtitleOverlayTextColor: 'invalid',
			subtitleOverlayBorderStyle: 'invalid',
			subtitleOverlayBorderColor: 'invalid',
			subtitleOverlayBorderStrength: 'invalid'
		})).toMatchObject({
			'data-weight': 'bold',
			'data-text-color': 'white',
			'data-border-style': 'shadow',
			'data-border-color': 'black',
			'data-border-strength': 'medium'
		});
	});

	it('groups cues by source-driven vertical placement and horizontal alignment', () => {
		const groups = groupSubtitleCuesByPlacement([
			{placement: 'top', horizontalAlign: 'right', text: 'sign'},
			{placement: 'middle', horizontalAlign: 'left', text: 'middle'},
			{placement: 'unknown', horizontalAlign: 'unknown', text: 'dialogue'}
		]);

		expect(groups.top.right).toEqual([{placement: 'top', horizontalAlign: 'right', text: 'sign'}]);
		expect(groups.middle.left).toEqual([{placement: 'middle', horizontalAlign: 'left', text: 'middle'}]);
		expect(groups.bottom.center).toEqual([{placement: 'unknown', horizontalAlign: 'unknown', text: 'dialogue'}]);
	});
});
