import {createContext, useContext} from 'react';

const EMPTY_SYNC_PLAY = Object.freeze({
	group: null,
	groupState: null,
	queue: null,
	followMode: 'suspended',
	notification: null,
	playDecision: null,
	joinGroup: async () => {},
	createGroup: async () => {},
	leaveGroup: async () => {},
	resumeSession: async () => {},
	suspend: () => {},
	dismissNotification: () => {},
	requestPlay: async () => false,
	confirmReplacePlayback: async () => {},
	joinCurrentPlayback: async () => {},
	startGroupPlayback: async () => false,
	cancelPlayDecision: () => {},
	next: async () => {},
	previous: async () => {}
});

export const SyncPlayContext = createContext(EMPTY_SYNC_PLAY);
export const SyncPlayProvider = SyncPlayContext.Provider;
export const useSyncPlay = () => useContext(SyncPlayContext);
