import {useRef} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';
import {useMediaDetailsNavigation} from '../useMediaDetailsNavigation';
import css from '../../MediaDetailsPanel.module.less';
import {configureHorizontalPointerRow, horizontalPointerRevealCases} from '../../../testUtils/horizontalPointerRevealCases';

const EpisodeRow = (props) => {
	const containerRef = useRef(null);
	const navigation = useMediaDetailsNavigation({
		containerRef, isActive: true, ready: false, pickerOpen: false,
		hasSecondarySection: false, isSidewaysEpisodeLayout: true, onScrollStop: jest.fn(), ...props
	});
	return (
		<div id="details_content">
			<div ref={containerRef} {...navigation.containerHandlers}>
				<div ref={navigation.firstSectionRef}><button data-md-nav="audio">Audio</button></div>
				<div ref={navigation.contentSectionRef} data-testid="content">
					<div className={css.episodeCardsSideways} data-testid="row">
						{[0, 1, 2, 3, 4].map((index) => (
							<div key={index} tabIndex={0} data-md-nav="episode" data-index={index} data-testid={`episode-${index}`}>
								<button data-md-nav="episode-action" data-index={index}>Favorite {index}</button>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

const setup = (props) => {
	const view = render(<EpisodeRow {...props} />);
	const row = screen.getByTestId('row');
	const cards = [0, 1, 2, 3, 4].map((index) => screen.getByTestId(`episode-${index}`));
	const hover = configureHorizontalPointerRow(row, cards);
	return {...view, row, cards, hover};
};

describe('Media Details pointer episode reveal', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(Spotlight, 'getPointerMode').mockReturnValue(true);
		jest.spyOn(Spotlight, 'isPaused').mockReturnValue(false);
	});
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	horizontalPointerRevealCases({
        setup,
        setPointerMode: (value) => Spotlight.getPointerMode.mockReturnValue(value),
        focusBehavior: 'smooth'
    });

	it.each([
		{isActive: false}, {pickerOpen: true}, {isSidewaysEpisodeLayout: false},
		{pointer: false}, {paused: true}
	])('ignores hover without measuring when unavailable: %j', ({pointer, paused, ...props}) => {
		Spotlight.getPointerMode.mockReturnValue(pointer !== false);
		Spotlight.isPaused.mockReturnValue(paused === true);
		const {row, cards, hover} = setup(props);
		hover(cards[2]);
		expect(row.getBoundingClientRect).not.toHaveBeenCalled();
		expect(row.scrollTo).not.toHaveBeenCalled();
	});

	it('does not reveal episodes during a vertical section transition', () => {
		const {container, row, cards, hover} = setup({hasSecondarySection: true});
		const page = container.querySelector('#details_content');
		page.getBoundingClientRect = () => ({top: 0});
		page.scrollTo = jest.fn();
		screen.getByTestId('content').getBoundingClientRect = () => ({top: 1000});
		fireEvent.wheel(row, {deltaY: 80});
		expect(page.scrollTo).toHaveBeenCalled();
		hover(cards[2]);
		expect(row.scrollTo).not.toHaveBeenCalled();
	});

	it('clears pending hover suppression on deactivation and unmount', () => {
		const {row, cards, hover, rerender, unmount} = setup();
		hover(cards[2]);
		rerender(<EpisodeRow isActive={false} />);
		rerender(<EpisodeRow />);
		hover(cards[3]);
		expect(row.scrollTo).toHaveBeenCalledTimes(2);
		unmount();
		expect(jest.getTimerCount()).toBe(0);
	});
});
