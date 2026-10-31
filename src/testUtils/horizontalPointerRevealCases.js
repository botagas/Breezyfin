import {act, fireEvent} from '@testing-library/react';
import {expect, it, jest} from '@jest/globals';

export const configureHorizontalPointerRow = (row, cards) => {
    Object.defineProperties(row, {
        clientWidth: {value: 1000}, scrollWidth: {value: 2080}, scrollLeft: {value: 0, writable: true}
    });
    row.scrollTo = jest.fn(({left}) => { row.scrollLeft = left; });
    row.getBoundingClientRect = jest.fn(() => ({left: 0, right: 1000}));
    cards.forEach((card, index) => {
        Object.defineProperties(card, {
            offsetLeft: {value: index * 420}, offsetWidth: {value: 400}, offsetParent: {value: row}
        });
        card.getBoundingClientRect = jest.fn(() => ({left: index * 420 - row.scrollLeft, right: index * 420 + 400 - row.scrollLeft}));
    });
    return (card, x = 950, relatedTarget = null) => fireEvent.mouseOver(card, {clientX: x, clientY: 300, relatedTarget});
};

export const horizontalPointerRevealCases = ({setup, setPointerMode, focusBehavior}) => {
	it.each(['right', 'left'])('reveals a card clipped at the %s edge without focusing or opening it', (edge) => {
		const {row, cards, hover, onItemClick} = setup();
		const previousFocus = document.activeElement;
		if (edge === 'left') row.scrollLeft = 420;
		hover(cards[edge === 'right' ? 2 : 0]);
		expect(row.scrollTo).toHaveBeenCalledWith({left: edge === 'right' ? 360 : 0, behavior: 'smooth'});
		expect(document.activeElement).toBe(previousFocus);
		if (onItemClick) expect(onItemClick).not.toHaveBeenCalled();
	});

	it('leaves fully visible cards and pointer focus alone', () => {
		const {row, cards, hover} = setup();
		hover(cards[1]);
		fireEvent.focus(cards[2]);
		act(() => jest.advanceTimersByTime(1000));
		expect(row.scrollTo).not.toHaveBeenCalled();
	});

	it('ignores nested artwork transitions', () => {
		const {row, cards, hover} = setup();
		hover(cards[2]);
		act(() => jest.advanceTimersByTime(1000));
		hover(cards[2].firstChild, 950, cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
	});

	it('suppresses scrolling feedback and stationary-pointer entries', () => {
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

	it('waits for an already scrolling row to settle', () => {
		const {row, cards, hover} = setup();
		fireEvent.scroll(row);
		hover(cards[2]);
		expect(row.getBoundingClientRect).not.toHaveBeenCalled();
		act(() => jest.advanceTimersByTime(1000));
		hover(cards[2]);
		expect(row.scrollTo).toHaveBeenCalledTimes(1);
	});

	it('permits re-entry at the same position and clears timers on unmount', () => {
		const {row, cards, hover, unmount} = setup();
		hover(cards[2]);
		act(() => jest.advanceTimersByTime(1000));
		fireEvent.mouseOut(cards[2], {relatedTarget: document.body});
		hover(cards[3]);
		expect(row.scrollTo).toHaveBeenCalledTimes(2);
		unmount();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('retains 5-way RIGHT navigation and focus reveal', () => {
		setPointerMode(false);
		const {row, cards} = setup();
		cards[1].focus();
		fireEvent.keyDown(cards[1], {keyCode: 39});
		expect(document.activeElement).toBe(cards[2]);
		act(() => jest.advanceTimersByTime(50));
		expect(row.scrollTo).toHaveBeenCalledWith({left: 360, behavior: focusBehavior});
	});
};
