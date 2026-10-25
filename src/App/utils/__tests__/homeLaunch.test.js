import {createHomeLaunchInbox, installHomeLaunchListener, parseHomeLaunch} from '../homeLaunch';
import {wipeAllAppCache} from '../../../utils/cacheMaintenance';

const payload = (requestId = 'request-1') => ({breezyfinHome: {
	version: 1, action: 'play', requestId, itemId: 'a'.repeat(32), serverId: 'b'.repeat(32),
	userId: 'c'.repeat(32), serverUrl: 'https://jellyfin.example.test/base/'
}});

describe('Home launch contract', () => {
	beforeEach(() => sessionStorage.clear());
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
	it.each([false, true])('does not replay retained launch parameters after reload (cache wipe: %s)', async (wipeCache) => {
		const platform = {
			webOSSystem: {launchParams: JSON.stringify(payload())},
			addEventListener: window.addEventListener.bind(window),
			removeEventListener: window.removeEventListener.bind(window)
		};
		const createInbox = () => createHomeLaunchInbox({getStorage: () => sessionStorage});
		const first = createInbox();
		const uninstall = installHomeLaunchListener(platform, document, first);
		expect(first.getSnapshot().request?.requestId).toBe('request-1');
		first.clear();
		if (wipeCache) await wipeAllAppCache();
		window.dispatchEvent(new Event('beforeunload'));
		uninstall();
		const reloaded = createInbox();
		const finish = installHomeLaunchListener(platform, document, reloaded);
		expect(reloaded.getSnapshot().request).toBeNull();
		document.dispatchEvent(new CustomEvent('webOSRelaunch', {detail: payload('fresh-request')}));
		expect(reloaded.getSnapshot().request?.requestId).toBe('fresh-request');
		finish();
	});
	it('retains only bounded opaque request receipts and tolerates unavailable storage', () => {
		const inbox = createHomeLaunchInbox({getStorage: () => sessionStorage});
		for (let i = 0; i < 130; i += 1) inbox.receive(payload(`request-${i}`));
		const stored = JSON.parse(sessionStorage.getItem(sessionStorage.key(0)));
		expect(stored).toHaveLength(128);
		expect(stored).toEqual(Array.from({length: 128}, (_, index) => `request-${index + 2}`));
		const unavailable = createHomeLaunchInbox({getStorage: () => { throw new Error('storage unavailable'); }});
		expect(() => unavailable.receive(payload())).not.toThrow();
		expect(unavailable.getSnapshot().request?.requestId).toBe('request-1');
	});
});
