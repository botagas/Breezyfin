import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import jellyfinService from '../../services/jellyfinService';
import {captureRuntimeSessionIdentity, isRuntimeSessionIdentityCurrent} from '../../utils/savedSessionIdentity';
import {homeLaunchInbox} from '../utils/homeLaunch';

export const useHomePlaybackLaunch = ({
	authenticated, restoring, currentView, selectedItem, crashRecoveryPending,
	onPrepare, onPlay, onChooseAccount, onRevealPlayer, onWake,
	inbox = homeLaunchInbox
}) => {
	const {request, error} = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot, inbox.getSnapshot);
	const [notice, setNotice] = useState(null);
	const [prepared, setPrepared] = useState(null);
	const [noticeHiddenRevision, setNoticeHiddenRevision] = useState(0);
	const [visibilityRevision, setVisibilityRevision] = useState(0);
	const noticeVisible = useRef(false);
	const waitingForForeground = useRef(false);
	const generation = useRef(0);
	const choosingAccount = useRef(null);
	const admittedSession = useRef(null);
	const latest = useRef(null);
	const sessionKey = `${jellyfinService.sessionGeneration}:${jellyfinService.serverUrl}:${jellyfinService.userId}`;
	latest.current = {request, currentView, selectedItem, onPrepare, onPlay, onChooseAccount, onRevealPlayer, onWake};
	const noticeShown = useCallback(() => { noticeVisible.current = true; }, []);
	const noticeHidden = useCallback(() => {
		noticeVisible.current = false;
		setNoticeHiddenRevision((value) => value + 1);
	}, []);
	const cancel = useCallback(() => {
		generation.current += 1;
		setPrepared(null);
		setNotice(null);
		choosingAccount.current = null;
		waitingForForeground.current = false;
		inbox.clear();
	}, [inbox]);
	const chooseAccount = useCallback((options = {}) => {
		choosingAccount.current = latest.current.request;
		setNotice(null);
		if (options.hideOnly) return;
		latest.current.onChooseAccount();
	}, []);
	useEffect(() => {
		if (!request) { setNotice(error ? {message: error} : null); return undefined; }
		if (crashRecoveryPending) { cancel(); return undefined; }
		if (document.hidden) { waitingForForeground.current = true; setNotice(null); return undefined; }
		latest.current.onWake?.();
		if (restoring) return undefined;
		if (admittedSession.current?.request === request && admittedSession.current.key !== sessionKey && choosingAccount.current !== request) {
			cancel();
			return undefined;
		}
		admittedSession.current = {request, key: sessionKey};
		if (!authenticated) {
			if (choosingAccount.current !== request) setNotice({message: `Sign in to the Home account on ${request.serverUrl} to play this item.`, account: true});
			return undefined;
		}
		choosingAccount.current = null;
		const token = ++generation.current;
		const identity = captureRuntimeSessionIdentity(jellyfinService);
		const ownsRequest = () => generation.current === token && inbox.getSnapshot().request === request;
		const current = () => ownsRequest() &&
			!document.hidden && isRuntimeSessionIdentityCurrent(identity, jellyfinService);
		const admitCompletion = () => {
			if (!ownsRequest()) return false;
			if (current()) return true;
			cancel();
			return false;
		};
		setNotice({message: 'Opening the Home item…', loading: true});
		(async () => {
			if (identity?.userId.replace(/-/g, '').toLowerCase() !== request.userId) {
				if (admitCompletion()) setNotice({message: `Choose the same account as Home on ${request.serverUrl}.`, account: true});
				return;
			}
			const server = await jellyfinService.getPublicServerInfo();
			if (!admitCompletion()) return;
			if (!server?.Id) throw new Error('The server could not be verified. Check the connection and try the Home card again.');
			if (server.Id.replace(/-/g, '').toLowerCase() !== request.serverId) {
				setNotice({message: `Choose the same server and account as Home: ${request.serverUrl}.`, account: true});
				return;
			}
			if (latest.current.currentView === 'player' && latest.current.selectedItem?.Id === request.itemId) {
				latest.current.onRevealPlayer();
				cancel();
				return;
			}
			const item = await jellyfinService.getItem(request.itemId);
			if (!admitCompletion()) return;
			if (!item || !['Movie', 'Episode'].includes(item.Type) || item.Id !== request.itemId) {
				throw new Error('This Home item is unavailable to the selected account. Refresh Home and try again.');
			}
			setNotice(null);
			latest.current.onPrepare(item);
			setPrepared({item, current, admitCompletion, request});
		})().catch(() => {
			if (admitCompletion()) setNotice({message: 'The Home item could not be opened. Check access and the server connection, then try again.'});
		});
		return () => { generation.current += 1; };
	}, [request, error, authenticated, restoring, crashRecoveryPending, sessionKey, visibilityRevision, inbox, cancel]);
	useEffect(() => {
		if (prepared && prepared.request !== request) { setPrepared(null); return; }
		if (!prepared || currentView !== 'details' || selectedItem?.Id !== prepared.item.Id) return;
		if (noticeVisible.current) return;
		if (!prepared.current()) { cancel(); return; }
		setPrepared(null);
		Promise.resolve(latest.current.onPlay(prepared.item, null, {isCurrent: prepared.current})).then(() => {
			if (prepared.admitCompletion()) { setNotice(null); inbox.clear(); }
		}).catch(() => {
			if (prepared.admitCompletion()) setNotice({message: 'Playback could not start. Try the Home card again.'});
		});
	}, [prepared, request, currentView, selectedItem, noticeHiddenRevision, inbox, cancel]);
	useEffect(() => {
		const visibilityChanged = () => {
			if (document.hidden) {
				if (inbox.getSnapshot().request) cancel();
			} else if (waitingForForeground.current) {
				waitingForForeground.current = false;
				setVisibilityRevision((value) => value + 1);
			}
		};
		document.addEventListener('visibilitychange', visibilityChanged);
		return () => document.removeEventListener('visibilitychange', visibilityChanged);
	}, [cancel, inbox]);
	return {notice, pending: Boolean(request), cancel, chooseAccount, noticeShown, noticeHidden};
};
