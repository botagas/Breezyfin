import {
	updateItemsPlayedState,
	withItemPlayedState
} from '../mediaDetailsHelpers';

describe('media details watched-state helpers', () => {
	it('updates the matching season without mutating the source item', () => {
		const season = {
			Id: 'season-1',
			UserData: {Played: true, PlayedPercentage: 100, IsFavorite: true}
		};

		const updated = withItemPlayedState(season, 'season-1', false);

		expect(updated).not.toBe(season);
		expect(updated.UserData).toEqual({
			Played: false,
			PlayedPercentage: 0,
			IsFavorite: true
		});
		expect(season.UserData.Played).toBe(true);
	});

	it('supports repeated unwatched and watched transitions in a season list', () => {
		const seasons = [
			{Id: 'season-1', UserData: {Played: true, PlayedPercentage: 100}},
			{Id: 'season-2', UserData: {Played: false, PlayedPercentage: 0}}
		];

		const unwatched = updateItemsPlayedState(seasons, 'season-1', false);
		const watchedAgain = updateItemsPlayedState(unwatched, 'season-1', true);

		expect(unwatched[0].UserData).toMatchObject({Played: false, PlayedPercentage: 0});
		expect(watchedAgain[0].UserData).toMatchObject({Played: true, PlayedPercentage: 100});
		expect(watchedAgain[1]).toBe(seasons[1]);
	});
});
