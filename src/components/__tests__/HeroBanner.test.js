/* eslint-disable react/prop-types */
import {render, screen} from '@testing-library/react';
import HeroBanner from '../HeroBanner';

jest.mock('../BreezyButton', () => function TestButton({children, spotlightId, ...rest}) {
	return <button type="button" data-spotlight-id={spotlightId} {...rest}>{children}</button>;
});

jest.mock('@enact/sandstone/BodyText', () => function TestBodyText({children, ...rest}) {
	return <div {...rest}>{children}</div>;
});

jest.mock('@enact/sandstone/Heading', () => function TestHeading({children, ...rest}) {
	return <h2 {...rest}>{children}</h2>;
});

jest.mock('@enact/sandstone/Marquee', () => function TestMarquee({children}) {
	return <span>{children}</span>;
});

jest.mock('../../services/jellyfinService', () => ({
	getBackdropUrl: jest.fn(() => 'https://media.example/backdrop.jpg'),
	getImageUrl: jest.fn(() => 'https://media.example/logo.png')
}));

jest.mock('../../hooks/useBreezyfinSettingsSync', () => ({
	useBreezyfinSettingsSync: jest.fn()
}));

jest.mock('../../utils/imageFormat', () => ({
	applyImageFormatFallbackFromEvent: jest.fn(() => false)
}));

describe('HeroBanner', () => {
	it('renders community rating with a compact star rather than a Rating label', () => {
		render(
			<HeroBanner
				items={[{
					Id: 'movie-1',
					Name: 'Feature',
					Overview: 'Feature overview',
					CommunityRating: 8.25,
					ImageTags: {}
				}]}
				onPlayClick={jest.fn()}
			/>
		);

		expect(screen.getByText('★')).toBeTruthy();
		expect(screen.getByText('8.3')).toBeTruthy();
		expect(screen.queryByText('Rating 8.3')).toBeNull();
		expect(screen.getByLabelText('Rating 8.3 out of 10')).toBeTruthy();
	});
});
