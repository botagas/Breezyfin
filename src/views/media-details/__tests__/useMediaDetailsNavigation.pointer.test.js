import {useRef} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import Spotlight from '@enact/spotlight';
import {useMediaDetailsNavigation} from '../useMediaDetailsNavigation';
import css from '../../MediaDetailsPanel.module.less';

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
	Object.defineProperties(row, {
		clientWidth: {value: 1000}, scrollWidth: {value: 2080}, scrollLeft: {value: 0, writable: true}
	});
	row.scrollTo = jest.fn(({left}) => { row.scrollLeft = left; });
	row.getBoundingClientRect = jest.fn(() => ({left: 0, right: 1000}));
	const cards = [0, 1, 2, 3, 4].map((index) => {
		const card = screen.getByTestId(`episode-${index}`);
		Object.defineProperties(card, {
			offsetLeft: {value: index * 420}, offsetWidth: {value: 400}, offsetParent: {value: row}
		});
		card.getBoundingClientRect = jest.fn(() => ({left: index * 420 - row.scrollLeft, right: index * 420 + 400 - row.scrollLeft}));
		return card;
	});
	const hover = (card, x = 950, relatedTarget = null) => fireEvent.mouseOver(card, {clientX: x, clientY: 300, relatedTarget});
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

	it.each(['right', 'left'])('reveals a card clipped at the %s edge without selecting or focusing it', (edge) => {
		const {row, cards, hover} = setup();
		const priorFocus = document.activeElement;
		if (edge === 'left') row.scrollLeft = 420;
		hover(cards[edge === 'right' ? 2 : 0]);
		expect(row.scrollTo).toHaveBeenCalledWith({left: edge === 'right' ? 360 : 0, behavior: 'smooth'});
		expect(document.activeElement).toBe(priorFocus);
	});

	it('does not move a fully visible card', () => {
		const {row, cards, hover} = setup();
		hover(cards[1]);
		expect(row.scrollTo).not.toHaveBeenCalled();
	});

	it('ignores transitions between a card and its nested action', () => {
		const {row, cards, hover} = setup();
		hover(cards[2]);
		act(() => jest.advanceTimersByTime(1000));
		hover(cards[2].firstChild, 960, cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
	});

	it('blocks new requests during scroll and ignores stationary-pointer entries after settling', () => {
		const {row, cards, hover} = setup();
		hover(cards[2]);
		hover(cards[3], 970, cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
		fireEvent.scroll(row);
		act(() => jest.advanceTimersByTime(100));
		fireEvent.scroll(row);
		act(() => jest.advanceTimersByTime(100));
		hover(cards[3], 980, cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
		act(() => jest.advanceTimersByTime(1000));
		hover(cards[3], 950, cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
		hover(cards[3], 980, cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(2);
	});

	it('waits for an already scrolling row to settle before measuring hover', () => {
		const {row, cards, hover} = setup();
		fireEvent.scroll(row);
		hover(cards[2]);
		expect(row.getBoundingClientRect).not.toHaveBeenCalled();
		act(() => jest.advanceTimersByTime(1000));
		hover(cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
	});

	it('allows the same pointer position after leaving and re-entering the panel', () => {
		const {row, cards, hover} = setup();
		hover(cards[2]);
		act(() => jest.advanceTimersByTime(1000));
		fireEvent.mouseOut(cards[2], {relatedTarget: document.body});
		hover(cards[3]);
		expect(row.scrollTo).toHaveBeenCalledTimes(2);
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

	it('preserves 5-way focus reveal and directional movement', () => {
		Spotlight.getPointerMode.mockReturnValue(false);
		const {row, cards} = setup();
		cards[1].focus();
		fireEvent.keyDown(cards[1], {keyCode: 39});
		expect(document.activeElement).toBe(cards[2]);
		act(() => jest.advanceTimersByTime(50));
		expect(row.scrollTo).toHaveBeenCalledWith({left: 360, behavior: 'smooth'});
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
