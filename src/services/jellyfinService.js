import { Jellyfin } from '@jellyfin/sdk';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import serverManager from './serverManager';
import {APP_VERSION} from '../utils/appInfo';
import {SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE} from '../constants/session';

const WEBOS_AUDIO_CODEC_PRIORITY = ['eac3', 'ec3', 'ac3', 'dolby', 'aac', 'mp3', 'mp2', 'flac', 'opus', 'vorbis', 'pcm_s24le', 'pcm_s16le', 'lpcm', 'wav'];
const WEBOS_SUPPORTED_AUDIO_CODECS = new Set(WEBOS_AUDIO_CODEC_PRIORITY);
const WEBOS_DIRECTPLAY_TEXT_SUBTITLE_CODECS = new Set([
	'srt',
	'subrip',
	'vtt',
	'webvtt',
	'txt',
	'smi',
	'sami',
	'ttml',
	'dfxp'
]);

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
		try {
			this.serverUrl = serverUrl;
			this.api = this.jellyfin.createApi(serverUrl);
			const response = await fetch(`${serverUrl}/System/Info/Public`);
			if (!response.ok) throw new Error('Server not reachable');

			const info = await response.json();
			this.serverName = info?.ServerName || info?.Name || serverUrl;
			return info;
		} catch (error) {
			console.error('Failed to connect to server:', error);
			throw error;
		}
	}

	async authenticate(username, password) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/AuthenticateByName`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Emby-Authorization': `MediaBrowser Client="Breezyfin", Device="webOS", DeviceId="breezyfin-webos", Version="${APP_VERSION}"`
					},
					body: JSON.stringify({
						Username: username,
						Pw: password
					})
				}
			);

			const data = await response.json();

			if (data.AccessToken) {
				this.accessToken = data.AccessToken;
				this.userId = data.User.Id;
				this.username = data.User?.Name || username;
				this.serverName = data?.ServerName || this.serverName || this.serverUrl;
				this.sessionExpiredNotified = false;

				this.api.accessToken = this.accessToken;
				localStorage.setItem('jellyfinAuth', JSON.stringify({
					serverUrl: this.serverUrl,
					accessToken: this.accessToken,
					userId: this.userId
				}));

					const saved = serverManager.addServer({
						serverUrl: this.serverUrl,
						serverName: this.serverName,
						userId: this.userId,
						username: this.username,
						accessToken: this.accessToken,
						avatarTag: data.User?.PrimaryImageTag || null
					});
				if (saved) {
					serverManager.setActiveServer(saved.serverId, saved.userId);
				}

				return data.User;
			}
		} catch (error) {
			console.error('Authentication failed:', error);
			throw error;
		}
	}

	_applySessionFromStore(entry) {
		if (!entry) return false;
		this.serverUrl = entry.url;
		this.accessToken = entry.accessToken;
		this.userId = entry.userId;
		this.serverName = entry.serverName;
		this.username = entry.username;
		this.api = this.jellyfin.createApi(entry.url, entry.accessToken);
		this.sessionExpiredNotified = false;
		return true;
	}

	restoreSession(serverId = null, userId = null) {
		const active = serverManager.getActiveServer(serverId, userId);
		if (active && active.activeUser) {
			return this._applySessionFromStore({
				url: active.url,
				accessToken: active.activeUser.accessToken,
				userId: active.activeUser.userId,
				serverName: active.name,
				username: active.activeUser.username
			});
		}

		const stored = localStorage.getItem('jellyfinAuth');
		if (stored) {
			let parsedLegacySession = null;
			try {
				parsedLegacySession = JSON.parse(stored);
			} catch (error) {
				console.warn('[jellyfinService] Failed to parse legacy jellyfinAuth payload:', error);
				localStorage.removeItem('jellyfinAuth');
				return false;
			}
			const { serverUrl, accessToken, userId: storedUserId } = parsedLegacySession || {};
			if (!serverUrl || !accessToken || !storedUserId) {
				localStorage.removeItem('jellyfinAuth');
				return false;
			}
			this.serverUrl = serverUrl;
			this.accessToken = accessToken;
			this.userId = storedUserId;
			this.api = this.jellyfin.createApi(serverUrl, accessToken);

				const saved = serverManager.addServer({
					serverUrl,
					serverName: serverUrl,
					userId: storedUserId,
					username: 'User',
					accessToken: accessToken,
					avatarTag: null
				});
			if (saved) {
				serverManager.setActiveServer(saved.serverId, saved.userId);
			}
			return true;
		}
		return false;
	}

	logout() {
		localStorage.removeItem('jellyfinAuth');
		const active = serverManager.getActiveServer();
		if (active?.id && active?.activeUser?.userId) {
			serverManager.removeUser(active.id, active.activeUser.userId);
		}
		serverManager.clearActive();
		this.api = null;
		this.userId = null;
		this.serverUrl = null;
		this.accessToken = null;
		this.serverName = null;
		this.username = null;
		this.sessionExpiredNotified = false;
	}

	switchUser() {
		localStorage.removeItem('jellyfinAuth');
		serverManager.clearActive();
		this.api = null;
		this.userId = null;
		this.serverUrl = null;
		this.accessToken = null;
		this.serverName = null;
		this.username = null;
		this.sessionExpiredNotified = false;
	}

	setActiveServer(serverId, userId) {
		const active = serverManager.setActiveServer(serverId, userId);
		if (!active || !active.activeUser) {
			throw new Error('Server selection failed: not found');
		}
		return this._applySessionFromStore({
			url: active.url,
			accessToken: active.activeUser.accessToken,
			userId: active.activeUser.userId,
			serverName: active.name,
			username: active.activeUser.username
		});
	}

	getSavedServers() {
		return serverManager.listServers();
	}

	forgetServer(serverId, userId) {
		serverManager.removeUser(serverId, userId);
		const active = serverManager.getActiveServer();
		if (!active || !active.activeUser) {
			this.api = null;
			this.userId = null;
			this.serverUrl = null;
			this.accessToken = null;
			this.serverName = null;
			this.username = null;
			this.sessionExpiredNotified = false;
		}
	}

	getImageUrl(itemId, imageType = 'Primary', width = 400) {
		if (!this.serverUrl) return null;
		return `${this.serverUrl}/Items/${itemId}/Images/${imageType}?width=${width}&api_key=${this.accessToken}`;
	}

	getBackdropUrl(itemId, index = 0, width = 1920) {
		if (!this.serverUrl) return null;
		return `${this.serverUrl}/Items/${itemId}/Images/Backdrop/${index}?width=${width}&api_key=${this.accessToken}`;
	}

	async getLatestMedia(includeItemTypes = ['Movie', 'Series'], limit = 16) {
		try {
			const types = Array.isArray(includeItemTypes) ? includeItemTypes.join(',') : includeItemTypes;
			return await this._fetchItems(
				`/Users/${this.userId}/Items?includeItemTypes=${types}&limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,Tags,TagItems,UserData,ChildCount&imageTypeLimit=1`,
				{},
				'getLatestMedia'
			);
		} catch (error) {
			console.error(`getLatestMedia ${includeItemTypes} error:`, error);
			return [];
		}
	}

	async getRecentlyAdded(limit = 20) {
		try {
			return await this._fetchItems(
				`/Users/${this.userId}/Items?limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&includeItemTypes=Movie,Series&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
				{},
				'getRecentlyAdded'
			);
		} catch (error) {
			console.error('getRecentlyAdded error:', error);
			return [];
		}
	}

	async getNextUp(limit = 24) {
		try {
			return await this._fetchItems(
				`/Shows/NextUp?userId=${this.userId}&limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1&enableTotalRecordCount=false`,
				{},
				'getNextUp'
			);
		} catch (error) {
			console.error('Failed to get next up:', error);
			return [];
		}
	}

	async getResumeItems(limit = 10) {
		try {
			return await this._fetchItems(
				`/Users/${this.userId}/Items/Resume?limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
				{},
				'getResumeItems'
			);
		} catch (error) {
			console.error('getResumeItems error:', error);
			return [];
		}
	}

	async getCurrentUser() {
		if (!this.userId) return null;
		try {
			const user = await this._request(`/Users/${this.userId}`, {
				context: 'getCurrentUser'
			});
			const active = serverManager.getActiveServer();
			if (active?.id && active?.activeUser?.userId) {
				serverManager.updateUser(active.id, active.activeUser.userId, {
					username: user?.Name || active.activeUser.username || 'User',
					avatarTag: user?.PrimaryImageTag || null
				});
			}
			return user;
		} catch (err) {
			console.error('Failed to get current user:', err);
			return null;
		}
	}

	async getLibraryViews() {
		try {
			return await this._fetchItems(
				`/Users/${this.userId}/Views`,
				{},
				'getLibraryViews'
			);
		} catch (error) {
			console.error('getLibraryViews error:', error);
			return [];
		}
	}

	async getLibraryItems(parentId, itemTypes, limit = 100, startIndex = 0) {
		try {
			let url = `${this.serverUrl}/Users/${this.userId}/Items?parentId=${parentId}&limit=${limit}&startIndex=${startIndex}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber,UserData,ChildCount`;

			if (itemTypes) {
				const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
				url += `&includeItemTypes=${types}`;
			}

			return await this._fetchItems(url, {}, 'getLibraryItems');
		} catch (error) {
			console.error('getLibraryItems error:', error);
			return [];
		}
	}

	async getItem(itemId) {
		try {
			return await this._request(
				`/Users/${this.userId}/Items/${itemId}?fields=Overview,Genres,People,Studios,MediaStreams`,
				{
					context: 'getItem'
				}
			);
		} catch (error) {
			console.error('getItem error:', error);
			return null;
		}
	}

	async getSeasons(seriesId) {
		try {
			return await this._fetchItems(
				`/Shows/${seriesId}/Seasons?userId=${this.userId}&fields=Overview`,
				{},
				'getSeasons'
			);
		} catch (error) {
			console.error('getSeasons error:', error);
			return [];
		}
	}

	async getEpisodes(seriesId, seasonId) {
		try {
			return await this._fetchItems(
				`/Shows/${seriesId}/Episodes?seasonId=${seasonId}&userId=${this.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
				{},
				'getEpisodes'
			);
		} catch (error) {
			console.error('getEpisodes error:', error);
			return [];
		}
	}

	async getNextUpEpisode(seriesId) {
		try {
			const data = await this._request(
				`/Shows/NextUp?seriesId=${seriesId}&userId=${this.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
				{
					context: 'getNextUpEpisode'
				}
			);
			if (data.Items && data.Items.length > 0) {
				return data.Items[0];
			}
			const seasonsData = await this._request(
				`/Shows/${seriesId}/Seasons?userId=${this.userId}`,
				{
					context: 'getNextUpEpisode seasons'
				}
			);
			if (seasonsData.Items && seasonsData.Items.length > 0) {
				const firstSeason = seasonsData.Items.find(s => s.IndexNumber > 0) || seasonsData.Items[0];
				const episodes = await this.getEpisodes(seriesId, firstSeason.Id);
				return episodes[0] || null;
			}

			return null;
		} catch (error) {
			console.error('getNextUpEpisode error:', error);
			return null;
		}
	}

	_normalizeCodec(codec) {
		return (codec || '').toString().trim().toLowerCase();
	}

	_toInteger(value) {
		if (Number.isInteger(value)) return value;
		if (typeof value === 'string' && value.trim() !== '') {
			const parsed = Number(value);
			return Number.isInteger(parsed) ? parsed : null;
		}
		return null;
	}

	_getAudioStreams(mediaSource) {
		return mediaSource?.MediaStreams?.filter((stream) => stream.Type === 'Audio') || [];
	}

	_getSubtitleStreams(mediaSource) {
		return mediaSource?.MediaStreams?.filter((stream) => stream.Type === 'Subtitle') || [];
	}

	_getVideoStream(mediaSource) {
		return mediaSource?.MediaStreams?.find((stream) => stream.Type === 'Video') || null;
	}

	_isSupportedAudioCodec(codec) {
		const normalized = this._normalizeCodec(codec);
		return !normalized || WEBOS_SUPPORTED_AUDIO_CODECS.has(normalized);
	}

	_getDefaultAudioStreamIndex(mediaSource) {
		const explicitDefault = this._toInteger(mediaSource?.DefaultAudioStreamIndex);
		if (explicitDefault !== null) return explicitDefault;
		const defaultStream = this._getAudioStreams(mediaSource).find((stream) => stream.IsDefault);
		return this._toInteger(defaultStream?.Index);
	}

	_getSubtitleStreamByIndex(mediaSource, streamIndex) {
		const index = this._toInteger(streamIndex);
		if (index === null || index < 0) return null;
		return this._getSubtitleStreams(mediaSource).find((stream) => this._toInteger(stream.Index) === index) || null;
	}

	_normalizeSubtitleCodec(stream) {
		const candidates = [
			stream?.Codec,
			stream?.CodecTag,
			stream?.DeliveryMethod,
			stream?.DisplayTitle
		];
		for (const candidate of candidates) {
			const normalized = this._normalizeCodec(candidate);
			if (normalized) return normalized;
		}
		return '';
	}

	_isTextSubtitleCodec(codec) {
		const normalized = this._normalizeCodec(codec);
		return WEBOS_DIRECTPLAY_TEXT_SUBTITLE_CODECS.has(normalized);
	}

	_shouldTranscodeForSubtitleSelection(mediaSource, subtitleStreamIndex) {
		const subtitleStream = this._getSubtitleStreamByIndex(mediaSource, subtitleStreamIndex);
		if (!subtitleStream) return false;
		const codec = this._normalizeSubtitleCodec(subtitleStream);
		// Fail-safe: only keep direct-play for known text subtitle codecs.
		return !this._isTextSubtitleCodec(codec);
	}

	_findBestCompatibleAudioStreamIndex(mediaSource) {
		const audioStreams = this._getAudioStreams(mediaSource);
		if (!audioStreams.length) return null;
		let best = null;
		for (const stream of audioStreams) {
			const codec = this._normalizeCodec(stream.Codec);
			if (codec && !this._isSupportedAudioCodec(codec)) continue;
			const priority = WEBOS_AUDIO_CODEC_PRIORITY.indexOf(codec);
			const priorityScore = priority >= 0 ? (WEBOS_AUDIO_CODEC_PRIORITY.length - priority) : 1;
			const channels = Number.isFinite(stream.Channels) ? stream.Channels : 0;
			const score = priorityScore * 100 + channels;
			if (!best || score > best.score) {
				best = {index: this._toInteger(stream.Index), score};
			}
		}
		return best?.index ?? null;
	}

	_scoreMediaSource(mediaSource, {forceTranscoding = false} = {}) {
		if (!mediaSource) return Number.NEGATIVE_INFINITY;
		const videoStream = this._getVideoStream(mediaSource);
		const audioStreams = this._getAudioStreams(mediaSource);
		const hasCompatibleAudio = !audioStreams.length || audioStreams.some((stream) => this._isSupportedAudioCodec(stream.Codec));
		let score = 0;

		if (forceTranscoding) {
			if (mediaSource.SupportsTranscoding) score += 1200;
			if (mediaSource.TranscodingUrl) score += 900;
			if (mediaSource.TranscodingContainer) score += 120;
		} else {
			if (mediaSource.SupportsDirectPlay) score += 1400;
			if (mediaSource.SupportsDirectStream) score += 1000;
			if (!mediaSource.TranscodingUrl) score += 150;
			if (mediaSource.SupportsTranscoding) score += 50;
			if (hasCompatibleAudio) score += 180;
			else if (audioStreams.length > 0) score -= 250;
		}

		if (videoStream?.Width >= 3840) score += 60;
		else if (videoStream?.Width >= 1920) score += 40;
		else if (videoStream?.Width >= 1280) score += 20;
		if (videoStream?.BitRate && videoStream.BitRate <= 120000000) score += 20;

		return score;
	}

	_selectMediaSource(mediaSources, {preferredMediaSourceId = null, forceTranscoding = false} = {}) {
		if (!Array.isArray(mediaSources) || mediaSources.length === 0) {
			return {source: null, index: -1, score: Number.NEGATIVE_INFINITY, reason: 'none'};
		}

		if (preferredMediaSourceId) {
			const preferredIndex = mediaSources.findIndex((source) => source.Id === preferredMediaSourceId);
			if (preferredIndex >= 0) {
				return {
					source: mediaSources[preferredIndex],
					index: preferredIndex,
					score: Number.POSITIVE_INFINITY,
					reason: 'requested'
				};
			}
		}

		let bestIndex = 0;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (let index = 0; index < mediaSources.length; index += 1) {
			const score = this._scoreMediaSource(mediaSources[index], {forceTranscoding});
			if (score > bestScore) {
				bestScore = score;
				bestIndex = index;
			}
		}
		return {
			source: mediaSources[bestIndex],
			index: bestIndex,
			score: bestScore,
			reason: 'scored'
		};
	}

	_reorderMediaSources(mediaSources, selectedIndex) {
		if (!Array.isArray(mediaSources) || selectedIndex <= 0 || selectedIndex >= mediaSources.length) {
			return mediaSources;
		}
		const selected = mediaSources[selectedIndex];
		const reordered = mediaSources.slice();
		reordered.splice(selectedIndex, 1);
		reordered.unshift(selected);
		return reordered;
	}

	_determinePlayMethod(mediaSource, {forceTranscoding = false} = {}) {
		if (!mediaSource) return 'DirectStream';
		if (forceTranscoding) return 'Transcode';
		const audioStreams = this._getAudioStreams(mediaSource);
		const hasCompatibleAudio = !audioStreams.length || audioStreams.some((stream) => this._isSupportedAudioCodec(stream.Codec));
		if (!hasCompatibleAudio && mediaSource.TranscodingUrl) return 'Transcode';
		if (mediaSource.SupportsDirectPlay) return 'DirectPlay';
		if (mediaSource.SupportsDirectStream) return 'DirectStream';
		if (mediaSource.TranscodingUrl) return 'Transcode';
		return 'DirectStream';
	}

	async _fetchPlaybackInfo(itemId, payload) {
		const response = await fetch(`${this.serverUrl}/Items/${itemId}/PlaybackInfo?userId=${this.userId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Emby-Token': this.accessToken
			},
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			this._handleAuthFailureStatus(response.status);
			const errorText = await response.text();
			console.error('PlaybackInfo error response:', errorText);
			const compactError = String(errorText || '').replace(/\s+/g, ' ').trim().slice(0, 280);
			throw new Error(`HTTP ${response.status}: ${response.statusText}${compactError ? ` - ${compactError}` : ''}`);
		}
		return response.json();
	}

	_buildPlaystatePayload(basePayload, session = {}) {
		const payload = {
			...basePayload,
			PlayMethod: session.playMethod || basePayload.PlayMethod || 'DirectStream'
		};
		if (session.playSessionId) payload.PlaySessionId = session.playSessionId;
		if (session.mediaSourceId) payload.MediaSourceId = session.mediaSourceId;
		if (Number.isInteger(session.audioStreamIndex)) payload.AudioStreamIndex = session.audioStreamIndex;
		if (session.subtitleStreamIndex === -1 || Number.isInteger(session.subtitleStreamIndex)) {
			payload.SubtitleStreamIndex = session.subtitleStreamIndex;
		}
		return payload;
	}

	async getPlaybackInfo(itemId, options = {}) {
		try {
			const relaxedPlaybackProfile = options.relaxedPlaybackProfile === true;
			const payload = {};
			if (options.mediaSourceId) {
				payload.MediaSourceId = options.mediaSourceId;
			}
			if (Number.isInteger(options.audioStreamIndex)) {
				payload.AudioStreamIndex = options.audioStreamIndex;
			}
			if (options.subtitleStreamIndex !== undefined && options.subtitleStreamIndex !== null) {
				payload.SubtitleStreamIndex = options.subtitleStreamIndex;
				// In strict/default mode prefer burned-in subtitles for webOS compatibility.
				// Relaxed profile lets Jellyfin choose alternate subtitle handling paths.
				if (!relaxedPlaybackProfile && options.subtitleStreamIndex >= 0) {
					payload.SubtitleMethod = 'Encode';
				}
			}
			if (options.startTimeTicks !== undefined) {
				payload.StartTimeTicks = options.startTimeTicks;
			}

			const forceTranscoding = options.forceTranscoding === true;
			const enableTranscoding = options.enableTranscoding !== false; // default on
			// Keep stream copy available on transcode sessions unless explicitly disabled.
			// This mirrors Jellyfin client behavior and prevents fragile full re-encode failures.
			const allowStreamCopyOnTranscode = options.allowStreamCopyOnTranscode !== false;
			const allowStreamCopy = enableTranscoding && (!forceTranscoding || allowStreamCopyOnTranscode);
			const maxBitrateSetting = options.maxBitrate ? parseInt(options.maxBitrate, 10) : null;
			let requestedAudioStreamIndex = Number.isInteger(options.audioStreamIndex) ? options.audioStreamIndex : null;
			const directPlayProfiles = forceTranscoding ? [] : [
				// webOS natively supports HLS
				{ Container: 'hls', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,ac3,eac3,mp3' },
				// MP4 container - webOS TVs have excellent MP4 support
				{ Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc,mpeg4,mpeg2video', AudioCodec: 'aac,ac3,eac3,mp3,mp2' },
				// MKV support varies by webOS version, but newer versions support it
				// Drop DTS from the direct-play list so Jellyfin will transcode DTS/DTS-HD
				{ Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc,mpeg4,mpeg2video', AudioCodec: 'aac,ac3,eac3,mp3,mp2' },
				// Audio direct play
				{ Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3' },
				{ Container: 'aac', Type: 'Audio', AudioCodec: 'aac' },
				{ Container: 'flac', Type: 'Audio', AudioCodec: 'flac' },
				{ Container: 'webm', Type: 'Audio', AudioCodec: 'vorbis,opus' }
			];
			if (relaxedPlaybackProfile && !forceTranscoding) {
				directPlayProfiles.push({
					Container: 'mkv',
					Type: 'Video',
					VideoCodec: 'h264,hevc,mpeg4,mpeg2video,vp9,av1',
					AudioCodec: 'aac,ac3,eac3,mp3,mp2,flac,opus,vorbis,pcm,dts,dca,truehd'
				});
			}

			const transcodingProfiles = [
				// HLS transcoding - BEST for webOS (hardware accelerated)
				// Use stereo for maximum compatibility
				{
					Container: 'ts',
					Type: 'Video',
					AudioCodec: 'aac',
					VideoCodec: 'h264',
					Context: 'Streaming',
					Protocol: 'hls',
					MaxAudioChannels: '2',
					MinSegments: '1',
					BreakOnNonKeyFrames: false
				},
				// HLS Audio
				{
					Container: 'ts',
					Type: 'Audio',
					AudioCodec: 'aac',
					Context: 'Streaming',
					Protocol: 'hls',
					MaxAudioChannels: '2',
					BreakOnNonKeyFrames: false
				},
				// HTTP Audio fallback
				{ Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Context: 'Streaming', Protocol: 'http', MaxAudioChannels: '2' }
			];

			if (relaxedPlaybackProfile) {
				transcodingProfiles.push(
					{
						Container: 'ts',
						Type: 'Video',
						AudioCodec: 'aac,ac3,mp3',
						VideoCodec: 'h264',
						Context: 'Streaming',
						Protocol: 'hls',
						MaxAudioChannels: '6',
						MinSegments: '1',
						BreakOnNonKeyFrames: false
					},
					{
						Container: 'mp4',
						Type: 'Video',
						AudioCodec: 'aac,ac3,mp3',
						VideoCodec: 'h264',
						Context: 'Streaming',
						Protocol: 'http',
						MaxAudioChannels: '6'
					}
				);
			}

			const subtitleProfiles = relaxedPlaybackProfile
				? [
					{ Format: 'ass', Method: 'External' },
					{ Format: 'ssa', Method: 'External' },
					{ Format: 'srt', Method: 'External' },
					{ Format: 'subrip', Method: 'External' },
					{ Format: 'vtt', Method: 'External' },
					{ Format: 'webvtt', Method: 'External' },
					{ Format: 'ass', Method: 'Encode' },
					{ Format: 'ssa', Method: 'Encode' },
					{ Format: 'srt', Method: 'Encode' },
					{ Format: 'subrip', Method: 'Encode' },
					{ Format: 'vtt', Method: 'Encode' },
					{ Format: 'webvtt', Method: 'Encode' },
					{ Format: 'pgs', Method: 'Encode' },
					{ Format: 'pgssub', Method: 'Encode' },
					{ Format: 'dvbsub', Method: 'Encode' },
					{ Format: 'dvdsub', Method: 'Encode' }
				]
				: [
					// Burn-in all subtitles for webOS compatibility
					// webOS has limited native subtitle support, so we transcode with burn-in
					{ Format: 'ass', Method: 'Encode' },
					{ Format: 'ssa', Method: 'Encode' },
					{ Format: 'srt', Method: 'Encode' },
					{ Format: 'subrip', Method: 'Encode' },
					{ Format: 'vtt', Method: 'Encode' },
					{ Format: 'webvtt', Method: 'Encode' },
					{ Format: 'pgs', Method: 'Encode' },
					{ Format: 'pgssub', Method: 'Encode' },
					{ Format: 'dvbsub', Method: 'Encode' },
					{ Format: 'dvdsub', Method: 'Encode' }
				];

			payload.EnableDirectPlay = !forceTranscoding;
			payload.EnableDirectStream = !forceTranscoding;
			payload.EnableTranscoding = enableTranscoding;
			payload.AllowVideoStreamCopy = allowStreamCopy;
			payload.AllowAudioStreamCopy = allowStreamCopy;
			payload.AutoOpenLiveStream = true;
			if (maxBitrateSetting) {
				payload.MaxStreamingBitrate = maxBitrateSetting * 1000000; // convert Mbps to bps
			}
			payload.DeviceProfile = {
				Name: relaxedPlaybackProfile ? 'Breezyfin webOS TV (Relaxed)' : 'Breezyfin webOS TV',
				MaxStreamingBitrate: maxBitrateSetting ? maxBitrateSetting * 1000000 : 120000000,
				MaxStaticBitrate: 100000000,
				MusicStreamingTranscodingBitrate: 384000,
				DirectPlayProfiles: directPlayProfiles,
				TranscodingProfiles: transcodingProfiles,
				SubtitleProfiles: subtitleProfiles,
				ContainerProfiles: [],
				CodecProfiles: [
					{
						Type: 'Video',
						Codec: 'h264',
						Conditions: [
							{ Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline' },
							{ Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '51' },
							{ Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false }
						]
					},
					{
						Type: 'Video',
						Codec: 'hevc',
						Conditions: [
							{ Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main' },
							{ Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '120' },
							{ Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false }
						]
					},
					{
						Type: 'VideoAudio',
						Codec: 'aac,mp3',
						Conditions: [
							{ Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '6' }
						]
					},
					{
						Type: 'VideoAudio',
						Codec: 'ac3,eac3',
						Conditions: [
							{ Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '6' }
						]
					}
				],
				ResponseProfiles: [
					{
						Type: 'Video',
						Container: 'm4v',
						MimeType: 'video/mp4'
					}
				]
			};

			let data = await this._fetchPlaybackInfo(itemId, payload);
			const adjustments = [];

			if (!data?.MediaSources?.length) {
				return data;
			}

			// Pick the most compatible source and move it to index 0 so the caller can use MediaSources[0].
			const sourceSelection = this._selectMediaSource(data.MediaSources, {
				preferredMediaSourceId: options.mediaSourceId,
				forceTranscoding
			});
			if (sourceSelection.index > 0) {
				data.MediaSources = this._reorderMediaSources(data.MediaSources, sourceSelection.index);
				adjustments.push({
					type: 'sourceSelection',
					toast: 'Playback source optimized for this TV.'
				});
			}

			let selectedSource = data.MediaSources[0];

			// If the default audio codec is unsupported, re-request with a compatible track.
			if (!Number.isInteger(options.audioStreamIndex) && !forceTranscoding && selectedSource) {
				const defaultAudioIndex = this._getDefaultAudioStreamIndex(selectedSource);
				const fallbackAudioIndex = this._findBestCompatibleAudioStreamIndex(selectedSource);
				if (defaultAudioIndex !== null && fallbackAudioIndex !== null && defaultAudioIndex !== fallbackAudioIndex) {
					const defaultAudioStream = this._getAudioStreams(selectedSource).find((stream) => this._toInteger(stream.Index) === defaultAudioIndex);
					const defaultCodecSupported = this._isSupportedAudioCodec(defaultAudioStream?.Codec);
					if (!defaultCodecSupported) {
						const retryPayload = {
							...payload,
							MediaSourceId: selectedSource.Id,
							AudioStreamIndex: fallbackAudioIndex
						};
						const retryData = await this._fetchPlaybackInfo(itemId, retryPayload);
						if (retryData?.MediaSources?.length) {
							data = retryData;
							const retrySelection = this._selectMediaSource(data.MediaSources, {
								preferredMediaSourceId: selectedSource.Id,
								forceTranscoding
							});
							if (retrySelection.index > 0) {
								data.MediaSources = this._reorderMediaSources(data.MediaSources, retrySelection.index);
							}
							selectedSource = data.MediaSources[0];
							requestedAudioStreamIndex = fallbackAudioIndex;
							adjustments.push({
								type: 'audioFallback',
								toast: 'Switched audio track for compatibility.'
							});
						}
					}
				}
			}

			// If we determined playback needs transcoding but no URL was returned, force a transcode-only request.
			const selectedSubtitleStreamIndex = this._toInteger(payload.SubtitleStreamIndex);
			const subtitleNeedsTranscoding =
				selectedSubtitleStreamIndex !== null &&
				selectedSubtitleStreamIndex >= 0 &&
				this._shouldTranscodeForSubtitleSelection(selectedSource, selectedSubtitleStreamIndex);
			let playMethod = this._determinePlayMethod(selectedSource, {
				forceTranscoding: forceTranscoding || subtitleNeedsTranscoding
			});
			if (subtitleNeedsTranscoding) {
				adjustments.push({
					type: 'subtitleTranscodeGuard',
					toast: 'Using transcoding for subtitle compatibility.'
				});
			}
			if (playMethod === 'Transcode' && !selectedSource?.TranscodingUrl && enableTranscoding) {
				const transcodePayload = {
					...payload,
					EnableDirectPlay: false,
					EnableDirectStream: false,
					EnableTranscoding: true
				};
				if (selectedSource?.Id) {
					transcodePayload.MediaSourceId = selectedSource.Id;
				}
				if (Number.isInteger(requestedAudioStreamIndex)) {
					transcodePayload.AudioStreamIndex = requestedAudioStreamIndex;
				}
				const transcodedData = await this._fetchPlaybackInfo(itemId, transcodePayload);
				if (transcodedData?.MediaSources?.length) {
					data = transcodedData;
					const transcodeSelection = this._selectMediaSource(data.MediaSources, {
						preferredMediaSourceId: selectedSource?.Id,
						forceTranscoding: true
					});
					if (transcodeSelection.index > 0) {
						data.MediaSources = this._reorderMediaSources(data.MediaSources, transcodeSelection.index);
					}
					selectedSource = data.MediaSources[0];
					playMethod = 'Transcode';
					adjustments.push({
						type: 'forcedTranscode',
						toast: 'Using transcoding for compatibility.'
					});
				}
			}

			data.__breezyfin = {
				playMethod,
				selectedMediaSourceId: selectedSource?.Id || null,
				selectedAudioStreamIndex: requestedAudioStreamIndex,
				adjustments
			};
			return data;
		} catch (error) {
			console.error('Failed to get playback info:', error);
			throw error;
		}
	}

	getPlaybackUrl(itemId, mediaSourceId, playSessionId, tag, container, liveStreamId) {
		let url = `${this.serverUrl}/Videos/${itemId}/stream?static=true&api_key=${this.accessToken}`;
		if (mediaSourceId) {
			url += `&mediaSourceId=${mediaSourceId}`;
		}
		if (playSessionId) {
			url += `&playSessionId=${playSessionId}`;
		}
		if (tag) {
			url += `&tag=${tag}`;
		}
		if (container) {
			url += `&container=${container}`;
		}
		if (liveStreamId) {
			url += `&liveStreamId=${liveStreamId}`;
		}
		return url;
	}

	getTranscodeUrl(playSessionId, mediaSource) {
		if (mediaSource.TranscodingUrl) {
			return `${this.serverUrl}${mediaSource.TranscodingUrl}`;
		}
		return null;
	}

	async reportPlaybackStart(itemId, positionTicks = 0, session = {}) {
		const playstateApi = getPlaystateApi(this.api);
		await playstateApi.reportPlaybackStart({
			playbackStartInfo: this._buildPlaystatePayload({
				ItemId: itemId,
				PositionTicks: positionTicks,
				IsPaused: false,
				IsMuted: false,
				PlayMethod: 'DirectStream'
			}, session)
		});
	}

	async reportPlaybackProgress(itemId, positionTicks, isPaused = false, session = {}) {
		const playstateApi = getPlaystateApi(this.api);
		await playstateApi.reportPlaybackProgress({
			playbackProgressInfo: this._buildPlaystatePayload({
				ItemId: itemId,
				PositionTicks: positionTicks,
				IsPaused: isPaused,
				IsMuted: false,
				PlayMethod: 'DirectStream'
			}, session)
		});
	}

	async reportPlaybackStopped(itemId, positionTicks, session = {}) {
		const playstateApi = getPlaystateApi(this.api);
		await playstateApi.reportPlaybackStopped({
			playbackStopInfo: this._buildPlaystatePayload({
				ItemId: itemId,
				PositionTicks: positionTicks,
				PlayMethod: 'DirectStream'
			}, session)
		});
	}

	async search(searchTerm, itemTypes = null, limit = 25, startIndex = 0) {
		try {
			let url = `${this.serverUrl}/Users/${this.userId}/Items?searchTerm=${encodeURIComponent(searchTerm)}&limit=${limit}&startIndex=${Math.max(0, Number(startIndex) || 0)}&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1&enableTotalRecordCount=false`;

			if (itemTypes && itemTypes.length > 0) {
				const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
				url += `&includeItemTypes=${types}`;
			}

			return await this._fetchItems(url, {}, 'search');
		} catch (error) {
			console.error('search error:', error);
			return [];
		}
	}

	async getFavorites(itemTypes = ['Movie', 'Series'], limit = 100) {
		try {
			const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
			return await this._fetchItems(
				`/Users/${this.userId}/Items?filters=IsFavorite&includeItemTypes=${types}&limit=${limit}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,ImageTags,PrimaryImageTag,SeriesPrimaryImageTag,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1`,
				{},
				'getFavorites'
			);
		} catch (error) {
			console.error('getFavorites error:', error);
			return [];
		}
	}

	async toggleFavorite(itemId, isFavorite) {
		try {
			const method = isFavorite ? 'DELETE' : 'POST';
			await this._request(
				`/Users/${this.userId}/FavoriteItems/${itemId}`,
				{
					method,
					expectJson: false,
					context: 'toggleFavorite'
				}
			);

			return !isFavorite;
		} catch (error) {
			console.error('toggleFavorite error:', error);
			throw error;
		}
	}

	async markFavorite(itemId) {
		return this.toggleFavorite(itemId, false);
	}

	async unmarkFavorite(itemId) {
		return this.toggleFavorite(itemId, true);
	}

	async markWatched(itemId) {
		try {
			await this._request(
				`/Users/${this.userId}/PlayedItems/${itemId}`,
				{
					method: 'POST',
					expectJson: false,
					context: 'markWatched'
				}
			);

			return true;
		} catch (error) {
			console.error('markWatched error:', error);
			throw error;
		}
	}

	async markUnwatched(itemId) {
		try {
			await this._request(
				`/Users/${this.userId}/PlayedItems/${itemId}`,
				{
					method: 'DELETE',
					expectJson: false,
					context: 'markUnwatched'
				}
			);

			return false;
		} catch (error) {
			console.error('markUnwatched error:', error);
			throw error;
		}
	}

	async toggleWatched(itemId, isWatched) {
		if (isWatched) {
			return this.markUnwatched(itemId);
		} else {
			return this.markWatched(itemId);
		}
	}

	async getServerInfo() {
		try {
			return await this._request('/System/Info', {
				context: 'getServerInfo'
			});
		} catch (error) {
			console.error('getServerInfo error:', error);
			return null;
		}
	}

	async getPublicServerInfo() {
		try {
			return await this._request('/System/Info/Public', {
				includeAuth: false,
				context: 'getPublicServerInfo',
				suppressAuthHandling: true
			});
		} catch (error) {
			console.error('getPublicServerInfo error:', error);
			return null;
		}
	}

	async getMediaSegments(itemId) {
		if (!this.serverUrl || !this.accessToken || !itemId) return [];
		try {
			const data = await this._request(`/MediaSegments/${itemId}`, {
				context: 'getMediaSegments'
			});
			return Array.isArray(data?.Items) ? data.Items : [];
		} catch (error) {
			console.error('getMediaSegments error:', error);
			return [];
		}
	}
}

export default new JellyfinService();
