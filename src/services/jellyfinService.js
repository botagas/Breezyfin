import { Jellyfin } from '@jellyfin/sdk';
import {getAppVersion, loadAppVersion} from '../utils/appInfo';
import {getDeviceId} from '../utils/deviceIdentity';
import {applyPreferredImageFormatToParams} from '../utils/imageFormat';
import {SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE} from '../constants/session';
import {
	applySessionFromStore,
	authenticateWithServer,
	connectToServer,
	forgetServiceServer,
	getCurrentServiceUser,
	listSavedServers,
	logoutSession,
	restoreServiceSession,
	setActiveServiceServer,
	switchUserSession
} from './jellyfin/sessionApi';
import {
	getFavoriteMediaItems,
	getItemDetails,
	getItemMediaSegments,
	getLatestMediaItems,
	getLibraryChildItems,
	getLibraryViewItems,
	getNextUpEpisodeForSeries,
	getNextUpItems,
	getPublicSystemInfo,
	getRecentlyAddedItems,
	getResumeMediaItems,
	getSeasonEpisodes,
	getSeriesSeasons,
	getSystemInfo,
	getUnwatchedSeriesEpisodes,
	searchLibraryItems,
	searchLibraryItemsPage
} from './jellyfin/libraryApi';
import {
	markFavoriteItem,
	markItemUnwatched,
	markItemWatched,
	toggleFavoriteItem,
	toggleItemWatched,
	unmarkFavoriteItem
} from './jellyfin/itemStateApi';
import {
	getItemPlaybackInfo,
	getPlaybackStreamUrl,
	getTranscodePlaybackUrl,
	reportPlaybackProgressState,
	reportPlaybackStarted,
	reportPlaybackStoppedState
} from './jellyfin/playbackApi';
import {getBreezyfinCapabilities, getMyRequestItems} from './jellyfin/requestsApi';
import {getHomeSectionDescriptors, getHomeSectionItems} from './jellyfin/homeSectionsApi';
import {getDiscoveryDetails, getDiscoveryFeed} from './jellyfin/discoveryApi';
import {getCalendarEvents} from './jellyfin/calendarApi';
import {
	addItemToLikesWatchlist,
	getLikesWatchlist,
	removeItemFromLikesWatchlist
} from './jellyfin/watchlistApi';
import {
	getWatchlistMovieHistory,
	getWatchlistSeriesInsights,
	getWatchlistStatistics
} from './jellyfin/watchlistInsightsApi';
import {startJellyfinWebSocket, stopJellyfinWebSocket} from './jellyfin/websocketApi';
import * as syncPlayApi from './jellyfin/syncPlayApi';
import * as watchPartyApi from './jellyfin/watchPartyApi';
import {
	buildSubtitleStreamUrl,
	getBitmapSubtitleDeliveryCandidates,
	getSubtitleTrackEvents,
	getSubtitleTrackBinary,
	getSubtitleTrackText
} from './jellyfin/subtitleApi';
import {createJellyfinRequestError} from './jellyfin/requestErrors';

class JellyfinService {
	constructor() {
		this.deviceId = getDeviceId();
		this.clientVersion = getAppVersion();
		this.clientVersionPromise = null;
		this.jellyfin = this._createJellyfinClient(this.clientVersion);
		this.api = null;
		this.userId = null;
		this.serverUrl = null;
		this.accessToken = null;
		this.serverName = null;
		this.username = null;
		this.sessionExpiredNotified = false;
		this.webSocketSession = null;
		void this.resolveClientVersion();
	}

	_createJellyfinClient(version) {
		return new Jellyfin({
			clientInfo: {
				name: 'Breezyfin',
				version
			},
			deviceInfo: {
				name: 'webOS TV',
				id: this.deviceId
			}
		});
	}

	_applyClientVersion(version) {
		if (!version || version === this.clientVersion) return;
		this.clientVersion = version;
		this.jellyfin = this._createJellyfinClient(version);
		if (this.serverUrl) {
			this.api = this.jellyfin.createApi(this.serverUrl, this.accessToken || undefined);
		}
	}

	getClientVersion() {
		return this.clientVersion || getAppVersion();
	}

	getDeviceId() {
		return this.deviceId || getDeviceId();
	}

	async resolveClientVersion() {
		if (this.clientVersionPromise) return this.clientVersionPromise;
		this.clientVersionPromise = (async () => {
			const resolvedVersion = await loadAppVersion().catch(() => null);
			const nextVersion = resolvedVersion || getAppVersion();
			this._applyClientVersion(nextVersion);
			return this.getClientVersion();
		})();
		try {
			return await this.clientVersionPromise;
		} finally {
			this.clientVersionPromise = null;
		}
	}

	_isAuthFailureStatus(status) {
		return status === 401 || status === 403;
	}

	_notifySessionExpired(message = SESSION_EXPIRED_MESSAGE) {
		if (this.sessionExpiredNotified) return;
		this.sessionExpiredNotified = true;
		if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
		window.dispatchEvent(
			new CustomEvent(SESSION_EXPIRED_EVENT, {
				detail: {message}
			})
		);
	}

	_handleAuthFailureStatus(status) {
		if (this._isAuthFailureStatus(status)) {
			this._notifySessionExpired();
			return true;
		}
		return false;
	}

	_buildRequestUrl(pathOrUrl) {
		if (!pathOrUrl) return '';
		if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
		const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
		return `${this.serverUrl}${normalizedPath}`;
	}

	_getAuthHeaders(extraHeaders = {}) {
		return {
			'X-Emby-Token': this.accessToken,
			...extraHeaders
		};
	}

	_buildImageAssetUrl(path, params = {}, options = {}) {
		if (!this.serverUrl || !this.accessToken || !path) return null;
		const search = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value === undefined || value === null || value === '') return;
			search.set(key, String(value));
		});
		search.set('api_key', this.accessToken);
		applyPreferredImageFormatToParams(search, options);
		return `${this.serverUrl}${path}?${search.toString()}`;
	}

	async _request(pathOrUrl, options = {}) {
		const {
			method = 'GET',
			headers = {},
			body,
			signal,
			includeAuth = true,
			expectJson = true,
			context = 'request',
			suppressAuthHandling = false
		} = options;
		const url = this._buildRequestUrl(pathOrUrl);
		const response = await fetch(url, {
			method,
			headers: includeAuth ? this._getAuthHeaders(headers) : headers,
			body,
			...(signal ? {signal} : {})
		});

		if (!response.ok) {
			if (!suppressAuthHandling) {
				this._handleAuthFailureStatus(response.status);
			}
			const errorText = await response.text().catch(() => '');
			throw createJellyfinRequestError({
				status: response.status,
				context,
				bodyText: errorText
			});
		}

		if (!expectJson) return response;
		return response.json();
	}

	async _fetchItems(pathOrUrl, options = {}, context = 'request') {
		const data = await this._request(pathOrUrl, {
			...options,
			context
		});
		return Array.isArray(data?.Items) ? data.Items : [];
	}

	async connect(serverUrl) {
		watchPartyApi.stopJellyWatchParty(this);
		stopJellyfinWebSocket(this);
		return connectToServer(this, serverUrl);
	}

	async authenticate(username, password) {
		watchPartyApi.stopJellyWatchParty(this);
		const user = await authenticateWithServer(this, username, password);
		if (this.accessToken) startJellyfinWebSocket(this);
		return user;
	}

	_applySessionFromStore(entry) {
		watchPartyApi.stopJellyWatchParty(this);
		const applied = applySessionFromStore(this, entry);
		if (applied) startJellyfinWebSocket(this);
		return applied;
	}

	restoreSession(serverId = null, userId = null) {
		watchPartyApi.stopJellyWatchParty(this);
		const restored = restoreServiceSession(this, serverId, userId);
		if (restored) startJellyfinWebSocket(this);
		return restored;
	}

	logout() {
		watchPartyApi.stopJellyWatchParty(this);
		stopJellyfinWebSocket(this);
		logoutSession(this);
	}

	switchUser() {
		watchPartyApi.stopJellyWatchParty(this);
		stopJellyfinWebSocket(this);
		switchUserSession(this);
	}

	setActiveServer(serverId, userId) {
		watchPartyApi.stopJellyWatchParty(this);
		stopJellyfinWebSocket(this);
		const applied = setActiveServiceServer(this, serverId, userId);
		if (applied) startJellyfinWebSocket(this);
		return applied;
	}

	getSavedServers() {
		return listSavedServers();
	}

	forgetServer(serverId, userId) {
		forgetServiceServer(this, serverId, userId);
	}

	getImageUrl(itemId, imageType = 'Primary', width = 400, options = {}) {
		if (!itemId || !imageType) return null;
		return this._buildImageAssetUrl(
			`/Items/${itemId}/Images/${imageType}`,
			{
				width,
				tag: options?.tag,
				quality: options?.quality,
				blur: options?.blur
			},
			options
		);
	}

	getBackdropUrl(itemId, index = 0, width = 1920, options = {}) {
		if (!itemId) return null;
		return this._buildImageAssetUrl(
			`/Items/${itemId}/Images/Backdrop/${index}`,
			{
				width,
				tag: options?.tag,
				quality: options?.quality,
				blur: options?.blur
			},
			options
		);
	}

	getUserImageUrl(userId, width = 96, options = {}) {
		if (!userId) return null;
		return this._buildImageAssetUrl(
			`/Users/${userId}/Images/Primary`,
			{
				width,
				tag: options?.tag
			},
			options
		);
	}

	async getLatestMedia(includeItemTypes = ['Movie', 'Series'], limit = 16, startIndex = 0) {
		return getLatestMediaItems(this, includeItemTypes, limit, startIndex);
	}

	async getRecentlyAdded(limit = 20, startIndex = 0) {
		return getRecentlyAddedItems(this, limit, startIndex);
	}

	async getNextUp(limit = 24, startIndex = 0) {
		return getNextUpItems(this, limit, startIndex);
	}

	async getResumeItems(limit = 10, startIndex = 0) {
		return getResumeMediaItems(this, limit, startIndex);
	}

	async getCurrentUser() {
		return getCurrentServiceUser(this);
	}

	async getLibraryViews() {
		return getLibraryViewItems(this);
	}

	async getLibraryItems(parentId, itemTypes, limit = 100, startIndex = 0, options = {}) {
		return getLibraryChildItems(this, parentId, itemTypes, limit, startIndex, options);
	}

	async getItem(itemId) {
		return getItemDetails(this, itemId);
	}

	async getSeasons(seriesId) {
		return getSeriesSeasons(this, seriesId);
	}

	async getEpisodes(seriesId, seasonId) {
		return getSeasonEpisodes(this, seriesId, seasonId);
	}

	async getUnwatchedSeriesEpisodes(seriesId, limit = 30, startIndex = 0) {
		return getUnwatchedSeriesEpisodes(this, seriesId, limit, startIndex);
	}

	async getNextUpEpisode(seriesId) {
		return getNextUpEpisodeForSeries(this, seriesId);
	}

	async getPlaybackInfo(itemId, options = {}) {
		return getItemPlaybackInfo(this, itemId, options);
	}

	getPlaybackUrl(itemId, mediaSourceId, playSessionId, tag, container, liveStreamId) {
		return getPlaybackStreamUrl(this, itemId, mediaSourceId, playSessionId, tag, container, liveStreamId);
	}

	getTranscodeUrl(playSessionId, mediaSource) {
		return getTranscodePlaybackUrl(this, playSessionId, mediaSource);
	}

	async reportPlaybackStart(itemId, positionTicks = 0, session = {}) {
		return reportPlaybackStarted(this, itemId, positionTicks, session);
	}

	async reportPlaybackProgress(itemId, positionTicks, isPaused = false, session = {}) {
		return reportPlaybackProgressState(this, itemId, positionTicks, isPaused, session);
	}

	async reportPlaybackStopped(itemId, positionTicks, session = {}) {
		return reportPlaybackStoppedState(this, itemId, positionTicks, session);
	}

	async search(searchTerm, itemTypes = null, limit = 25, startIndex = 0) {
		return searchLibraryItems(this, searchTerm, itemTypes, limit, startIndex);
	}

	async searchPage(searchTerm, itemTypes = null, limit = 25, startIndex = 0) {
		return searchLibraryItemsPage(this, searchTerm, itemTypes, limit, startIndex);
	}

	async getMyRequests(parentId, itemTypes = null, limit = 60, startIndex = 0, username = '') {
		return getMyRequestItems(this, {
			parentId,
			itemTypes,
			limit,
			startIndex,
			username
		});
	}

	async getBreezyfinCapabilities() {
		return getBreezyfinCapabilities(this);
	}

	async getBreezyfinHomeSections(limit = 20, startIndex = 0) {
		return getHomeSectionDescriptors(this, limit, startIndex);
	}

	async getBreezyfinHomeSectionItems(sectionId, limit = 60, startIndex = 0) {
		return getHomeSectionItems(this, sectionId, limit, startIndex);
	}

	async getDiscoveryFeed(feed, options = {}) {
		return getDiscoveryFeed(this, feed, options);
	}

	async getDiscoveryDetails(item, options = {}) {
		return getDiscoveryDetails(this, item, options);
	}

	async getCalendarEvents(options = {}) {
		return getCalendarEvents(this, options);
	}

	async getLikesWatchlist(limit = 60, startIndex = 0, itemTypes = ['Movie', 'Series']) {
		return getLikesWatchlist(this, limit, startIndex, itemTypes);
	}

	async getWatchlistSeriesInsights(state, limit = 30, startIndex = 0) {
		return getWatchlistSeriesInsights(this, state, limit, startIndex);
	}

	async getWatchlistMovieHistory(limit = 30, startIndex = 0) {
		return getWatchlistMovieHistory(this, limit, startIndex);
	}

	async getWatchlistStatistics() {
		return getWatchlistStatistics(this);
	}

	async addToLikesWatchlist(itemId) {
		return addItemToLikesWatchlist(this, itemId);
	}

	async removeFromLikesWatchlist(itemId) {
		return removeItemFromLikesWatchlist(this, itemId);
	}

	onWebSocketMessage(messageType, handler) {
		if (!this.webSocketSession && this.accessToken) startJellyfinWebSocket(this);
		return this.webSocketSession?.on(messageType, handler) || (() => {});
	}

	async getSyncPlayGroups() { return syncPlayApi.listSyncPlayGroups(this); }
	async getSyncPlayGroup(groupId) { return syncPlayApi.getSyncPlayGroup(this, groupId); }
	async createSyncPlayGroup(groupName) {
		if (watchPartyApi.getWatchPartyState(this).room) throw new Error('Leave JellyWatchParty before starting SyncPlay');
		return syncPlayApi.createSyncPlayGroup(this, groupName);
	}
	async joinSyncPlayGroup(groupId) {
		if (watchPartyApi.getWatchPartyState(this).room) throw new Error('Leave JellyWatchParty before joining SyncPlay');
		return syncPlayApi.joinSyncPlayGroup(this, groupId);
	}
	async leaveSyncPlayGroup() { return syncPlayApi.leaveSyncPlayGroup(this); }
	async syncPlayQueue(request) { return syncPlayApi.syncPlayQueue(this, request); }
	async syncPlaySetQueue(request) { return syncPlayApi.syncPlaySetQueue(this, request); }
	async syncPlayMoveQueueItem(request) { return syncPlayApi.syncPlayMoveQueueItem(this, request); }
	async syncPlayRemoveQueueItems(request) { return syncPlayApi.syncPlayRemoveQueueItems(this, request); }
	async syncPlaySetQueueItem(request) { return syncPlayApi.syncPlaySetQueueItem(this, request); }
	async syncPlayNext(request) { return syncPlayApi.syncPlayNext(this, request); }
	async syncPlayPrevious(request) { return syncPlayApi.syncPlayPrevious(this, request); }
	async syncPlayPlay() { return syncPlayApi.syncPlayPlay(this); }
	async syncPlayPause() { return syncPlayApi.syncPlayPause(this); }
	async syncPlayStop() { return syncPlayApi.syncPlayStop(this); }
	async syncPlaySeek(request) { return syncPlayApi.syncPlaySeek(this, request); }
	async syncPlayBuffering(request) { return syncPlayApi.syncPlayBuffering(this, request); }
	async syncPlayReady(request) { return syncPlayApi.syncPlayReady(this, request); }
	async syncPlaySetIgnoreWait(ignoreWait) {
		return syncPlayApi.syncPlaySetIgnoreWait(this, ignoreWait);
	}
	async syncPlaySetRepeatMode(request) { return syncPlayApi.syncPlaySetRepeatMode(this, request); }
	async syncPlaySetShuffleMode(request) { return syncPlayApi.syncPlaySetShuffleMode(this, request); }
	async syncPlayPing(request) { return syncPlayApi.syncPlayPing(this, request); }
	async sampleSyncPlayClock() { return syncPlayApi.sampleSyncPlayClock(this); }
	getSyncPlayState() { return syncPlayApi.getSyncPlayState(this); }
	setSyncPlayGroup(group) { return syncPlayApi.setSyncPlayGroup(this, group); }
	subscribeSyncPlayState(listener) { return syncPlayApi.subscribeSyncPlayState(this, listener); }

	async detectJellyWatchParty() { return watchPartyApi.detectJellyWatchParty(this); }
	getWatchPartyState() { return watchPartyApi.getWatchPartyState(this); }
	subscribeWatchPartyState(listener) { return watchPartyApi.subscribeWatchPartyState(this, listener); }
	onWatchPartyMessage(type, listener) { return watchPartyApi.onWatchPartyMessage(this, type, listener); }
	listWatchPartyRooms() { return watchPartyApi.listWatchPartyRooms(this); }
	createWatchPartyRoom(options) {
		if (syncPlayApi.getSyncPlayState(this)) throw new Error('Leave SyncPlay before creating a watch party');
		return watchPartyApi.createWatchPartyRoom(this, options);
	}
	joinWatchPartyRoom(roomId, password) {
		if (syncPlayApi.getSyncPlayState(this)) throw new Error('Leave SyncPlay before joining a watch party');
		return watchPartyApi.joinWatchPartyRoom(this, roomId, password);
	}
	leaveWatchPartyRoom() { return watchPartyApi.leaveWatchPartyRoom(this); }
	sendWatchPartyReady(mediaId) { return watchPartyApi.sendWatchPartyReady(this, mediaId); }
	sendWatchPartyPlayerEvent(action, position) {
		return watchPartyApi.sendWatchPartyPlayerEvent(this, action, position);
	}
	sendWatchPartyStateUpdate(position, playing) {
		return watchPartyApi.sendWatchPartyStateUpdate(this, position, playing);
	}
	sendWatchPartyChat(text) { return watchPartyApi.sendWatchPartyChat(this, text); }
	getWatchPartyServerNow() { return watchPartyApi.getWatchPartyServerNow(this); }

	async getFavorites(itemTypes = ['Movie', 'Series'], limit = 100, startIndex = 0, options = {}) {
		return getFavoriteMediaItems(this, itemTypes, limit, startIndex, options);
	}

	async toggleFavorite(itemId, isFavorite) {
		return toggleFavoriteItem(this, itemId, isFavorite);
	}

	async markFavorite(itemId) {
		return markFavoriteItem(this, itemId);
	}

	async unmarkFavorite(itemId) {
		return unmarkFavoriteItem(this, itemId);
	}

	async markWatched(itemId) {
		return markItemWatched(this, itemId);
	}

	async markUnwatched(itemId) {
		return markItemUnwatched(this, itemId);
	}

	async toggleWatched(itemId, isWatched) {
		return toggleItemWatched(this, itemId, isWatched);
	}

	async getServerInfo() {
		return getSystemInfo(this);
	}

	async getPublicServerInfo() {
		return getPublicSystemInfo(this);
	}

	async getMediaSegments(itemId, options = {}) {
		return getItemMediaSegments(this, itemId, options);
	}

	async getSubtitleEvents(itemId, mediaSourceId, subtitleStreamIndex) {
		return getSubtitleTrackEvents(this, itemId, mediaSourceId, subtitleStreamIndex);
	}

	async getSubtitleText(itemId, mediaSourceId, subtitleStreamIndex, format) {
		return getSubtitleTrackText(this, itemId, mediaSourceId, subtitleStreamIndex, format);
	}

	async getSubtitleBinary(itemId, mediaSourceId, subtitleStreamIndex, format) {
		return getSubtitleTrackBinary(this, itemId, mediaSourceId, subtitleStreamIndex, format);
	}

	getBitmapSubtitleDeliveryCandidates(itemId, mediaSource, subtitleStreamIndex, formats) {
		return getBitmapSubtitleDeliveryCandidates(this, itemId, mediaSource, subtitleStreamIndex, formats);
	}

	getSubtitleStreamUrl(itemId, mediaSourceId, subtitleStreamIndex, format) {
		return buildSubtitleStreamUrl(this, itemId, mediaSourceId, subtitleStreamIndex, format);
	}
}

export default new JellyfinService();
