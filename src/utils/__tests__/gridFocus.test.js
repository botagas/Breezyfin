jest.mock('@enact/spotlight', () => ({
	focus: jest.fn((target) => {
		target?.focus?.();
		return true;
	})
}));

import {findDirectionalGridTarget} from '../gridFocus';

const createCard = ({left, top, width = 100, height = 150}) => ({
	getBoundingClientRect: () => ({left, top, width, height})
});

describe('grid directional focus', () => {
	it('moves from a short final row to the nearest card in the immediately previous row', () => {
		const previousRow = [0, 120, 240, 360].map((left) => createCard({left, top: 180}));
		const finalCard = createCard({left: 0, top: 360});
		const cards = [...previousRow, finalCard];

		expect(findDirectionalGridTarget({
			currentCard: finalCard,
			cards,
			direction: 'up'
		})).toBe(previousRow[0]);
	});

	it('preserves the closest horizontal column when moving vertically', () => {
		const upperLeft = createCard({left: 0, top: 0});
		const upperRight = createCard({left: 240, top: 0});
		const current = createCard({left: 220, top: 180});

		expect(findDirectionalGridTarget({
			currentCard: current,
			cards: [upperLeft, upperRight, current],
			direction: 'up'
		})).toBe(upperRight);
	});

	it('uses row tops instead of card centers when titles create variable card heights', () => {
		const previousLeft = createCard({left: 0, top: 180, height: 190});
		const previousRight = createCard({left: 120, top: 180, height: 150});
		const current = createCard({left: 120, top: 400, height: 210});

		expect(findDirectionalGridTarget({
			currentCard: current,
			cards: [previousLeft, previousRight, current],
			direction: 'up'
		})).toBe(previousRight);
	});

	it('does not treat a variable-height card from the same row as an up target', () => {
		const upper = createCard({left: 0, top: 0, height: 150});
		const sameRowTall = createCard({left: 0, top: 180, height: 210});
		const current = createCard({left: 120, top: 180, height: 150});

		expect(findDirectionalGridTarget({
			currentCard: current,
			cards: [upper, sameRowTall, current],
			direction: 'up'
		})).toBe(upper);
	});
});
