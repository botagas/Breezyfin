import {
	HOME_SECTION_IDS,
	isMyRequestsHomeSection
} from '../homeSections';

describe('home section semantics', () => {
	it('recognizes built-in and HSS My Requests sections', () => {
		expect(isMyRequestsHomeSection(HOME_SECTION_IDS.MY_REQUESTS)).toBe(true);
		expect(isMyRequestsHomeSection({id: HOME_SECTION_IDS.MY_REQUESTS})).toBe(true);
		expect(isMyRequestsHomeSection({id: 'server:opaque', kind: 'MyRequests'})).toBe(true);
	});

	it('does not infer My Requests from a display title', () => {
		expect(isMyRequestsHomeSection({
			id: 'server:opaque',
			kind: 'JellyfinItems',
			title: 'My Requests'
		})).toBe(false);
	});
});
