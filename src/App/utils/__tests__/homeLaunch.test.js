import {createHomeLaunchInbox, installHomeLaunchListener, parseHomeLaunch} from '../homeLaunch';

const payload = (requestId = 'request-1') => ({breezyfinHome: {
	version: 1, action: 'play', requestId, itemId: 'a'.repeat(32), serverId: 'b'.repeat(32),
	userId: 'c'.repeat(32), serverUrl: 'https://jellyfin.example.test/base/'
}});

describe('Home launch contract', () => {
	it('normalizes only the supported launch fields and ignores ordinary launches', () => {
		expect(parseHomeLaunch({})).toBeNull();
		expect(parseHomeLaunch(JSON.stringify(payload()))).toEqual({...payload().breezyfinHome, serverUrl: 'https://jellyfin.example.test/base'});
		expect(parseHomeLaunch({breezyfinHome: {...payload().breezyfinHome, token: 'ignored'}})).not.toHaveProperty('token');
	});
	it.each([
		{version: 2}, {action: 'details'}, {itemId: '../file'}, {serverId: ''}, {userId: ''},
		{requestId: ''}, {serverUrl: 'file:///tmp/item'}, {serverUrl: 'https://user:pass@example.test'},
		{serverUrl: 'https://example.test?token=value'}
	])('rejects an invalid request: %j', (override) => {
		expect(() => parseHomeLaunch({breezyfinHome: {...payload().breezyfinHome, ...override}})).toThrow();
	});
	it('captures early parameters, processes relaunches once and retains the latest request', () => {
		const inbox = createHomeLaunchInbox();
		const listener = jest.fn();
		const unsubscribe = inbox.subscribe(listener);
		const uninstall = installHomeLaunchListener({PalmSystem: {launchParams: JSON.stringify(payload())}}, document, inbox);
		expect(inbox.getSnapshot().request.requestId).toBe('request-1');
		document.dispatchEvent(new CustomEvent('webOSLaunch', {detail: payload()}));
		expect(listener).toHaveBeenCalledTimes(1);
		document.dispatchEvent(new CustomEvent('webOSRelaunch', {detail: payload('request-2')}));
		expect(inbox.getSnapshot().request.requestId).toBe('request-2');
		inbox.clear();
		inbox.receive(payload('request-2'));
		expect(inbox.getSnapshot().request).toBeNull();
		inbox.receive('{bad json');
		expect(inbox.getSnapshot().error).toBeTruthy();
		unsubscribe(); uninstall();
	});
});
