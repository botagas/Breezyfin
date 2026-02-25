import { Jellyfin } from '@jellyfin/sdk';
import {APP_VERSION} from '../utils/appInfo';
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
	searchLibraryItems
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

class JellyfinService {
	constructor() {
		this.jellyfin = new Jellyfin({
			clientInfo: {
				name: 'Breezyfin',
				version: APP_VERSION
			},
			deviceInfo: {
				name: 'webOS TV',
				id: 'webos-tv-' + Date.now()
			}
		});
		this.api = null;
		this.userId = null;
		this.serverUrl = null;
		this.accessToken = null;
		this.serverName = null;
		this.username = null;
		this.sessionExpiredNotified = false;
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
			includeAuth = true,
			expectJson = true,
			context = 'request',
			suppressAuthHandling = false
		} = options;
		const url = this._buildRequestUrl(pathOrUrl);
		const response = await fetch(url, {
			method,
			headers: includeAuth ? this._getAuthHeaders(headers) : headers,
			body
		});

		if (!response.ok) {
			if (!suppressAuthHandling) {
				this._handleAuthFailureStatus(response.status);
			}
			const errorText = await response.text().catch(() => '');
			const compactError = String(errorText || '').replace(/\s+/g, ' ').trim().slice(0, 280);
			throw new Error(`${context} failed with status ${response.status}${compactError ? ` - ${compactError}` : ''}`);
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
		return connectToServer(this, serverUrl);
	}

	async authenticate(username, password) {
		return authenticateWithServer(this, username, password);
	}

	_applySessionFromStore(entry) {
		return applySessionFromStore(this, entry);
	}

	restoreSession(serverId = null, userId = null) {
		return restoreServiceSession(this, serverId, userId);
	}

	logout() {
		logoutSession(this);
	}

	switchUser() {
		switchUserSession(this);
	}

	setActiveServer(serverId, userId) {
		return setActiveServiceServer(this, serverId, userId);
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
				tag: options?.tag
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
				tag: options?.tag
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

	async getLatestMedia(includeItemTypes = ['Movie', 'Series'], limit = 16) {
		return getLatestMediaItems(this, includeItemTypes, limit);
	}

	async getRecentlyAdded(limit = 20) {
		return getRecentlyAddedItems(this, limit);
	}

	async getNextUp(limit = 24) {
		return getNextUpItems(this, limit);
	}

	async getResumeItems(limit = 10) {
		return getResumeMediaItems(this, limit);
	}

	async getCurrentUser() {
		return getCurrentServiceUser(this);
	}

	async getLibraryViews() {
		return getLibraryViewItems(this);
	}

	async getLibraryItems(parentId, itemTypes, limit = 100, startIndex = 0) {
		return getLibraryChildItems(this, parentId, itemTypes, limit, startIndex);
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

	async getFavorites(itemTypes = ['Movie', 'Series'], limit = 100) {
		return getFavoriteMediaItems(this, itemTypes, limit);
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

	async getMediaSegments(itemId) {
		return getItemMediaSegments(this, itemId);
	}
}

export default new JellyfinService();
