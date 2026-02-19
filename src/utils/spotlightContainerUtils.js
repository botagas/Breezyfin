import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

export const createLastFocusedSpotlightContainer = (tag = 'div', options = {}) => (
	SpotlightContainerDecorator({
		...options,
		enterTo: 'last-focused'
	}, tag)
);

