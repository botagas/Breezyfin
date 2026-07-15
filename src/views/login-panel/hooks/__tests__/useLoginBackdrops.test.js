import {render, waitFor} from '@testing-library/react';
import {useLoginBackdrops} from '../useLoginBackdrops';
import {
	buildShuffledBackdropList,
	fetchBackdropsForSavedServer,
	resolveSavedUserBackdrop,
	selectAvailableBackdropServers
} from '../../utils/loginBackdropSources';

jest.mock('../../utils/loginBackdropSources', () => ({
	buildShuffledBackdropList: jest.fn(() => []),
	fetchBackdropsForSavedServer: jest.fn(() => Promise.resolve([])),
	resolveSavedUserBackdrop: jest.fn(() => Promise.resolve('')),
	selectAvailableBackdropServers: jest.fn((entries) => entries)
}));

const SAVED_SERVERS = [{
	serverId: 'server-1',
	userId: 'user-1',
	url: 'http://media.local',
	accessToken: 'token-1'
}];

const BackdropHarness = (props) => {
	useLoginBackdrops(props);
	return null;
};

describe('useLoginBackdrops startup restore gating', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		buildShuffledBackdropList.mockReturnValue([]);
		fetchBackdropsForSavedServer.mockResolvedValue([]);
		resolveSavedUserBackdrop.mockResolvedValue('');
		selectAvailableBackdropServers.mockImplementation((entries) => entries);
	});

	it('defers saved-account requests until startup session restoration finishes', async () => {
		const {rerender} = render(
			<BackdropHarness isActive deferLoading savedServers={SAVED_SERVERS} />
		);

		expect(fetchBackdropsForSavedServer).not.toHaveBeenCalled();
		expect(resolveSavedUserBackdrop).not.toHaveBeenCalled();

		rerender(
			<BackdropHarness isActive deferLoading={false} savedServers={SAVED_SERVERS} />
		);

		await waitFor(() => {
			expect(fetchBackdropsForSavedServer).toHaveBeenCalledTimes(1);
			expect(resolveSavedUserBackdrop).toHaveBeenCalledTimes(1);
		});
	});

	it('loads immediately for a normal Login or Switch User visit', async () => {
		render(
			<BackdropHarness isActive deferLoading={false} savedServers={SAVED_SERVERS} />
		);

		await waitFor(() => {
			expect(fetchBackdropsForSavedServer).toHaveBeenCalledTimes(1);
			expect(resolveSavedUserBackdrop).toHaveBeenCalledTimes(1);
		});
	});
});
