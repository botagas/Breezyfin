/* eslint-disable react/prop-types */
import {render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';
import MediaRow from '../MediaRow';
import {configureHorizontalPointerRow, horizontalPointerRevealCases} from '../../testUtils/horizontalPointerRevealCases';

jest.mock('../../services/jellyfinService', () => ({__esModule: true, default: {}}));
jest.mock('@enact/spotlight', () => ({__esModule: true, default: {
	getPointerMode: jest.fn(), isPaused: jest.fn()
}}));
jest.mock('@enact/spotlight/Spottable', () => ({__esModule: true, default: (Component) => (
	function TestSpottable({spotlightId, ...props}) { return <Component tabIndex={0} data-spotlight-id={spotlightId} {...props} />; }
)}));
jest.mock('@enact/sandstone/BodyText', () => ({children}) => <span>{children}</span>);
jest.mock('@enact/sandstone/Icon', () => ({children}) => <span>{children}</span>);
jest.mock('../../utils/spotlightContainerUtils', () => ({createLastFocusedSpotlightContainer: () => (
	function TestContainer({spotlightId, ...props}) { return <div data-spotlight-id={spotlightId} {...props} />; }
)}));
jest.mock('../../utils/platformCapabilities', () => ({getRuntimePlatformCapabilities: () => ({supportsAspectRatio: true, supportsFlexGap: true})}));
jest.mock('../BreezyLoadingOverlay', () => () => null);
jest.mock('../MediaCardImage', () => () => <span>Artwork</span>);

const items = Array.from({length: 5}, (_, index) => ({Id: String(index), Name: `Movie ${index}`, Type: 'Movie'}));
const setup = (props = {}) => {
	const onItemClick = jest.fn();
	const view = render(<MediaRow title="Movies" items={items} onItemClick={onItemClick} {...props} />);
	const cards = items.map((item) => screen.getByText(item.Name).closest('[data-card-index]'));
	const row = cards[0].parentElement;
	const hover = configureHorizontalPointerRow(row, cards);
	return {...view, row, cards, hover, onItemClick};
};

beforeEach(() => {
	jest.useFakeTimers();
	Spotlight.getPointerMode.mockReturnValue(true);
	Spotlight.isPaused.mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

horizontalPointerRevealCases({
    setup,
    setPointerMode: (value) => Spotlight.getPointerMode.mockReturnValue(value),
    focusBehavior: 'auto'
});

it.each(['5way', 'paused'])('ignores hover without geometry reads while %s', (mode) => {
	Spotlight.getPointerMode.mockReturnValue(mode !== '5way');
	Spotlight.isPaused.mockReturnValue(mode === 'paused');
	const {row, cards, hover} = setup();
	hover(cards[2]);
	expect(row.getBoundingClientRect).not.toHaveBeenCalled();
});
