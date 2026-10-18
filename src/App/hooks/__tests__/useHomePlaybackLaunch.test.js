import {act, renderHook, waitFor} from '@testing-library/react';
import jellyfinService from '../../../services/jellyfinService';
import {createHomeLaunchInbox} from '../../utils/homeLaunch';
import {useHomePlaybackLaunch} from '../useHomePlaybackLaunch';

jest.mock('../../../services/jellyfinService', () => ({__esModule: true, default: {
	getPublicServerInfo: jest.fn(), getItem: jest.fn()
}}));
const itemId = 'a'.repeat(32), serverId = 'b'.repeat(32), userId = 'c'.repeat(32);
const request = (id = 'first', requestedItemId = itemId) => ({breezyfinHome: {
	version: 1, action: 'play', requestId: id, itemId: requestedItemId, serverId, userId, serverUrl: 'https://jellyfin.example.test'
}});
const item = {Id: itemId, Type: 'Episode', UserData: {PlaybackPositionTicks: 123000000}};
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return {promise, resolve}; };

describe('Home playback admission', () => {
	let inbox, options;
	beforeEach(() => {
		jest.clearAllMocks();
		Object.assign(jellyfinService, {sessionGeneration: 1, serverUrl: 'https://jellyfin.example.test', userId, accessToken: 'local-test-token'});
		jellyfinService.getPublicServerInfo.mockResolvedValue({Id: serverId});
		jellyfinService.getItem.mockResolvedValue(item);
		Object.defineProperty(document, 'hidden', {configurable: true, value: false});
		inbox = createHomeLaunchInbox();
		options = {inbox, authenticated: true, restoring: false, currentView: 'home', selectedItem: null,
			onPrepare: jest.fn(), onPlay: jest.fn().mockResolvedValue(), onChooseAccount: jest.fn(), onRevealPlayer: jest.fn()};
	});
	it('waits for restore, stages Details and uses normal playback with fresh progress and no track overrides', async () => {
		inbox.receive(request());
		const view = renderHook((props) => useHomePlaybackLaunch(props), {initialProps: {...options, restoring: true}});
		expect(jellyfinService.getItem).not.toHaveBeenCalled();
		view.rerender(options);
		await waitFor(() => expect(options.onPrepare).toHaveBeenCalledWith(item));
		expect(options.onPlay).not.toHaveBeenCalled();
		view.rerender({...options, currentView: 'details', selectedItem: item});
		await waitFor(() => expect(options.onPlay).toHaveBeenCalledWith(item, null, expect.objectContaining({isCurrent: expect.any(Function)})));
		await waitFor(() => expect(inbox.getSnapshot().request).toBeNull());
	});
	it('asks for the matching account and continues after explicit account selection', async () => {
		jellyfinService.userId = 'd'.repeat(32);
		inbox.receive(request());
		const view = renderHook((props) => useHomePlaybackLaunch(props), {initialProps: options});
		await waitFor(() => expect(view.result.current.notice?.account).toBe(true));
		expect(jellyfinService.getItem).not.toHaveBeenCalled();
		act(() => view.result.current.chooseAccount({hideOnly: true}));
		act(() => view.result.current.chooseAccount());
		expect(options.onChooseAccount).toHaveBeenCalledTimes(1);
		view.rerender({...options, authenticated: false, currentView: 'login'});
		expect(view.result.current.notice).toBeNull();
		jellyfinService.userId = userId; jellyfinService.sessionGeneration += 1;
		view.rerender(options);
		await waitFor(() => expect(options.onPrepare).toHaveBeenCalledWith(item));
	});
	it('rejects another Jellyfin server even when the URL or user matches', async () => {
		jellyfinService.getPublicServerInfo.mockResolvedValue({Id: 'e'.repeat(32)});
		inbox.receive(request());
		const view = renderHook(() => useHomePlaybackLaunch(options));
		await waitFor(() => expect(view.result.current.notice?.account).toBe(true));
		expect(jellyfinService.getItem).not.toHaveBeenCalled();
	});
	it('waits for the progress popup to finish hiding before transferring focus to Player', async () => {
		const pending = deferred(); jellyfinService.getItem.mockReturnValue(pending.promise);
		inbox.receive(request());
		const view = renderHook((props) => useHomePlaybackLaunch(props), {initialProps: options});
		await waitFor(() => expect(jellyfinService.getItem).toHaveBeenCalled());
		act(() => view.result.current.noticeShown());
		await act(async () => { pending.resolve(item); await pending.promise; });
		view.rerender({...options, currentView: 'details', selectedItem: item});
		expect(options.onPlay).not.toHaveBeenCalled();
		act(() => view.result.current.noticeHidden());
		await waitFor(() => expect(options.onPlay).toHaveBeenCalledTimes(1));
	});
	it.each(['cancel', 'hide', 'session', 'unmount'])('discards a late item after %s', async (reason) => {
		const pending = deferred(); jellyfinService.getItem.mockReturnValue(pending.promise);
		inbox.receive(request());
		const view = renderHook(() => useHomePlaybackLaunch(options));
		await waitFor(() => expect(jellyfinService.getItem).toHaveBeenCalled());
		act(() => {
			if (reason === 'cancel') view.result.current.cancel();
			if (reason === 'hide') { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); }
			if (reason === 'session') jellyfinService.sessionGeneration += 1;
			if (reason === 'unmount') view.unmount();
		});
		await act(async () => { pending.resolve(item); await pending.promise; });
		expect(options.onPrepare).not.toHaveBeenCalled();
		expect(options.onPlay).not.toHaveBeenCalled();
	});
	it('keeps the newest request when lookups complete out of order', async () => {
		const old = deferred(); jellyfinService.getItem.mockReturnValueOnce(old.promise);
		inbox.receive(request()); renderHook(() => useHomePlaybackLaunch(options));
		await waitFor(() => expect(jellyfinService.getItem).toHaveBeenCalledTimes(1));
		const newer = {...item, Id: 'f'.repeat(32)}; jellyfinService.getItem.mockResolvedValue(newer);
		act(() => inbox.receive(request('second', newer.Id)));
		await waitFor(() => expect(options.onPrepare).toHaveBeenCalledWith(newer));
		await act(async () => { old.resolve(item); await old.promise; });
		expect(options.onPrepare).toHaveBeenCalledTimes(1);
	});
	it('reveals matching playback without restarting and gives crash recovery precedence', async () => {
		inbox.receive(request());
		const view = renderHook((props) => useHomePlaybackLaunch(props), {initialProps: {...options, currentView: 'player', selectedItem: item}});
		await waitFor(() => expect(options.onRevealPlayer).toHaveBeenCalledTimes(1));
		expect(jellyfinService.getItem).not.toHaveBeenCalled();
		act(() => inbox.receive(request('second')));
		view.rerender({...options, crashRecoveryPending: true});
		await waitFor(() => expect(inbox.getSnapshot().request).toBeNull());
		expect(options.onPlay).not.toHaveBeenCalled();
	});
	it('shows an unavailable-item failure without trying another client or item', async () => {
		jellyfinService.getItem.mockResolvedValue(null); inbox.receive(request());
		const view = renderHook(() => useHomePlaybackLaunch(options));
		await waitFor(() => expect(view.result.current.notice?.message).toContain('could not be opened'));
		expect(options.onPlay).not.toHaveBeenCalled();
	});
});
