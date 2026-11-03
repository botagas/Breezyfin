import {clearHomeContentCache, getHomeContentSessionKey, readHomeContentCache, writeHomeContentCache, markHomeContentCacheStale} from '../homeContentCache';
import {shouldReloadHomeContent} from '../serverHomeRows';

afterEach(clearHomeContentCache);

it('does not restore content from an earlier login by the same user', () => {
 const session = {serverUrl: 'https://media.test', userId: 'user', sessionGeneration: 1};
 writeHomeContentCache(getHomeContentSessionKey(session), 0, {recentlyAdded: [{Id: 'old'}]});
 session.sessionGeneration = 3;
 expect(readHomeContentCache(getHomeContentSessionKey(session), 0)).toBeNull();
});

it('keeps the original content age across cache writes and Back remounts', () => {
 writeHomeContentCache('session', 0, {}, {loadedAt: 1000});
 const first = readHomeContentCache('session', 0);
 writeHomeContentCache('session', 0, first.content, {loadedAt: first.loadedAt});
 const restored = readHomeContentCache('session', 0);
 expect(shouldReloadHomeContent({hasLoaded: true, loadedAt: restored.loadedAt, now: 121001, maxAgeMs: 120000})).toBe(true);
});

it('retains content for background revalidation and clears it on session teardown', () => {
 writeHomeContentCache('session', 0, {recentlyAdded: [{Id: 'retained'}]});
 markHomeContentCacheStale();
 expect(readHomeContentCache('session', 0)).toMatchObject({stale: true, content: {recentlyAdded: [{Id: 'retained'}]}});
 clearHomeContentCache();
 expect(readHomeContentCache('session', 0)).toBeNull();
});
