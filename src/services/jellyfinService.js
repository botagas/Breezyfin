import { Jellyfin } from '@jellyfin/sdk';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';

class JellyfinService {
	constructor() {
		this.jellyfin = new Jellyfin({
			clientInfo: {
				name: 'Breezyfin',
				version: '1.0.0'
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
	}

	// Initialize connection to Jellyfin server
	async connect(serverUrl) {
		try {
			this.serverUrl = serverUrl;
			this.api = this.jellyfin.createApi(serverUrl);
			
			// Test connection
			const response = await fetch(`${serverUrl}/System/Info/Public`);
			if (!response.ok) throw new Error('Server not reachable');
			
			return await response.json();
		} catch (error) {
			console.error('Failed to connect to server:', error);
			throw error;
		}
	}

	// Authenticate user
	async authenticate(username, password) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/AuthenticateByName`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Emby-Authorization': `MediaBrowser Client="Breezyfin", Device="webOS", DeviceId="breezyfin-webos", Version="1.0.0"`
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

				// Update API with auth token
				this.api.accessToken = this.accessToken;

				// Store credentials
				localStorage.setItem('jellyfinAuth', JSON.stringify({
					serverUrl: this.serverUrl,
					accessToken: this.accessToken,
					userId: this.userId
				}));

				return data.User;
			}
		} catch (error) {
			console.error('Authentication failed:', error);
			throw error;
		}
	}

	// Restore session from storage
	restoreSession() {
		const stored = localStorage.getItem('jellyfinAuth');
		if (stored) {
			const { serverUrl, accessToken, userId } = JSON.parse(stored);
			this.serverUrl = serverUrl;
			this.accessToken = accessToken;
			this.userId = userId;
			this.api = this.jellyfin.createApi(serverUrl, accessToken);
			return true;
		}
		return false;
	}

	// Logout
	logout() {
		localStorage.removeItem('jellyfinAuth');
		this.api = null;
		this.userId = null;
		this.serverUrl = null;
		this.accessToken = null;
	}

	// Get image URL for item
	getImageUrl(itemId, imageType = 'Primary', width = 400) {
		if (!this.serverUrl) return null;
		return `${this.serverUrl}/Items/${itemId}/Images/${imageType}?width=${width}&api_key=${this.accessToken}`;
	}

	// Get backdrop image URL
	getBackdropUrl(itemId, index = 0, width = 1920) {
		if (!this.serverUrl) return null;
		return `${this.serverUrl}/Items/${itemId}/Images/Backdrop/${index}?width=${width}&api_key=${this.accessToken}`;
	}

	// Get latest media
	async getLatestMedia(includeItemTypes = ['Movie', 'Series'], limit = 16) {
		try {
			const types = Array.isArray(includeItemTypes) ? includeItemTypes.join(',') : includeItemTypes;
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/Items?includeItemTypes=${types}&limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			console.log(`Latest ${types} response:`, data);
			return data.Items || [];
		} catch (error) {
			console.error(`getLatestMedia ${includeItemTypes} error:`, error);
			return [];
		}
	}

	// Get recently added across all libraries
	async getRecentlyAdded(limit = 20) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/Items?limit=${limit}&sortBy=DateCreated&sortOrder=Descending&recursive=true&includeItemTypes=Movie,Series&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			console.log('Recently added response:', data);
			return data.Items || [];
		} catch (error) {
			console.error('getRecentlyAdded error:', error);
			return [];
		}
	}

	// Get next up episodes
	async getNextUp(limit = 24) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Shows/NextUp?userId=${this.userId}&limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1&enableTotalRecordCount=false`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			return data.Items || [];
		} catch (error) {
			console.error('Failed to get next up:', error);
			return [];
		}
	}

	// Get resume items
	async getResumeItems(limit = 10) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/Items/Resume?limit=${limit}&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,SeriesId,ParentIndexNumber,IndexNumber&imageTypeLimit=1`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			console.log('Resume items response:', data);
			return data.Items || [];
		} catch (error) {
			console.error('getResumeItems error:', error);
			return [];
		}
	}

	// Get current user info
	getCurrentUser() {
		if (!this.userId) return null;
		return fetch(`${this.serverUrl}/Users/${this.userId}`, {
			headers: {
				'X-Emby-Token': this.accessToken
			}
		})
			.then(res => res.json())
			.catch(err => {
				console.error('Failed to get current user:', err);
				return null;
			});
	}

	// Get library views
	async getLibraryViews() {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/Views`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			console.log('Library views response:', data);
			return data.Items || [];
		} catch (error) {
			console.error('getLibraryViews error:', error);
			return [];
		}
	}

	// Get items from a library
	async getLibraryItems(parentId, itemTypes, limit = 100, startIndex = 0) {
		try {
			let url = `${this.serverUrl}/Users/${this.userId}/Items?parentId=${parentId}&limit=${limit}&startIndex=${startIndex}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber,UserData`;
			
			if (itemTypes) {
				const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
				url += `&includeItemTypes=${types}`;
			}
			
			const response = await fetch(url, {
				headers: {
					'X-Emby-Token': this.accessToken
				}
			});
			const data = await response.json();
			return data.Items || [];
		} catch (error) {
			console.error('getLibraryItems error:', error);
			return [];
		}
	}

	// Get item details
	async getItem(itemId) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/Items/${itemId}?fields=Overview,Genres,People,Studios,MediaStreams`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			return data;
		} catch (error) {
			console.error('getItem error:', error);
			return null;
		}
	}

	// Get seasons for a series
	async getSeasons(seriesId) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}&fields=Overview`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			return data.Items || [];
		} catch (error) {
			console.error('getSeasons error:', error);
			return [];
		}
	}

	// Get episodes for a season
	async getEpisodes(seriesId, seasonId) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Shows/${seriesId}/Episodes?seasonId=${seasonId}&userId=${this.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			return data.Items || [];
		} catch (error) {
			console.error('getEpisodes error:', error);
			return [];
		}
	}

	// Get first unwatched episode for a series
	async getNextUpEpisode(seriesId) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Shows/NextUp?seriesId=${seriesId}&userId=${this.userId}&fields=Overview,SeriesName,ParentIndexNumber,IndexNumber`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			// Return first episode if available
			if (data.Items && data.Items.length > 0) {
				return data.Items[0];
			}
			
			// If no next up, get first episode of first season
			const seasonsResponse = await fetch(
				`${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const seasonsData = await seasonsResponse.json();
			if (seasonsData.Items && seasonsData.Items.length > 0) {
				// Get first non-special season (IndexNumber > 0)
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

	// Get playback info and URL
	async getPlaybackInfo(itemId, options = {}) {
		try {
			const payload = {};
			if (options.mediaSourceId) {
				payload.MediaSourceId = options.mediaSourceId;
			}
			if (Number.isInteger(options.audioStreamIndex)) {
				payload.AudioStreamIndex = options.audioStreamIndex;
			}
			if (options.subtitleStreamIndex !== undefined && options.subtitleStreamIndex !== null) {
				payload.SubtitleStreamIndex = options.subtitleStreamIndex;
			}
			if (options.startTimeTicks !== undefined) {
				payload.StartTimeTicks = options.startTimeTicks;
			}

			// Settings-driven knobs
			const forceTranscoding = options.forceTranscoding === true;
			const enableTranscoding = options.enableTranscoding !== false; // default on
			const maxBitrateSetting = options.maxBitrate ? parseInt(options.maxBitrate, 10) : null;
			console.log('Force Transcoding Enabled:', forceTranscoding);

			// webOS-optimized device profile
			payload.EnableDirectPlay = !forceTranscoding;
			payload.EnableDirectStream = !forceTranscoding;
			payload.EnableTranscoding = enableTranscoding;
			payload.AllowVideoStreamCopy = enableTranscoding && !forceTranscoding;
			payload.AllowAudioStreamCopy = enableTranscoding && !forceTranscoding;
			payload.AutoOpenLiveStream = true;
			if (maxBitrateSetting) {
				payload.MaxStreamingBitrate = maxBitrateSetting * 1000000; // convert Mbps to bps
			}
			payload.DeviceProfile = {
				Name: 'Breezyfin webOS TV',
				MaxStreamingBitrate: maxBitrateSetting ? maxBitrateSetting * 1000000 : 120000000,
				MaxStaticBitrate: 100000000,
				MusicStreamingTranscodingBitrate: 384000,
				DirectPlayProfiles: forceTranscoding ? [] : [
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
				],
				TranscodingProfiles: [
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
				],
				SubtitleProfiles: [
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
				],
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

			// Log the full payload for debugging
			console.log('PlaybackInfo request payload:', {
				EnableDirectPlay: payload.EnableDirectPlay,
				EnableDirectStream: payload.EnableDirectStream,
				EnableTranscoding: payload.EnableTranscoding,
				AllowVideoStreamCopy: payload.AllowVideoStreamCopy,
				AllowAudioStreamCopy: payload.AllowAudioStreamCopy,
				DirectPlayProfiles: payload.DeviceProfile.DirectPlayProfiles.length,
				CodecProfiles: payload.DeviceProfile.CodecProfiles.length
			});

			// Use POST with populated profile
			const response = await fetch(`${this.serverUrl}/Items/${itemId}/PlaybackInfo?userId=${this.userId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Emby-Token': this.accessToken
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('PlaybackInfo error response:', errorText);
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			console.log('Playback info:', data);
			return data;
		} catch (error) {
			console.error('Failed to get playback info:', error);
			throw error;
		}
	}

	// Get playback URL
	getPlaybackUrl(itemId, mediaSourceId, playSessionId, tag, container, liveStreamId) {
		// Use static=true for direct play
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

	// Get HLS stream URL for transcoding
	getTranscodeUrl(playSessionId, mediaSource) {
		if (mediaSource.TranscodingUrl) {
			return `${this.serverUrl}${mediaSource.TranscodingUrl}`;
		}
		return null;
	}

	// Report playback started
	async reportPlaybackStart(itemId, positionTicks = 0) {
		const playstateApi = getPlaystateApi(this.api);
		await playstateApi.reportPlaybackStart({
			playbackStartInfo: {
				ItemId: itemId,
				PositionTicks: positionTicks,
				IsPaused: false,
				IsMuted: false,
				PlayMethod: 'DirectStream'
			}
		});
	}

	// Report playback progress
	async reportPlaybackProgress(itemId, positionTicks, isPaused = false) {
		const playstateApi = getPlaystateApi(this.api);
		await playstateApi.reportPlaybackProgress({
			playbackProgressInfo: {
				ItemId: itemId,
				PositionTicks: positionTicks,
				IsPaused: isPaused,
				IsMuted: false,
				PlayMethod: 'DirectStream'
			}
		});
	}

	// Report playback stopped
	async reportPlaybackStopped(itemId, positionTicks) {
		const playstateApi = getPlaystateApi(this.api);
		await playstateApi.reportPlaybackStopped({
			playbackStopInfo: {
				ItemId: itemId,
				PositionTicks: positionTicks,
				PlayMethod: 'DirectStream'
			}
		});
	}

	// Search with type filtering
	async search(searchTerm, itemTypes = null, limit = 25) {
		try {
			let url = `${this.serverUrl}/Users/${this.userId}/Items?searchTerm=${encodeURIComponent(searchTerm)}&limit=${limit}&recursive=true&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1&enableTotalRecordCount=false`;
			
			if (itemTypes && itemTypes.length > 0) {
				const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
				url += `&includeItemTypes=${types}`;
			}
			
			const response = await fetch(url, {
				headers: {
					'X-Emby-Token': this.accessToken
				}
			});
			const data = await response.json();
			return data.Items || [];
		} catch (error) {
			console.error('search error:', error);
			return [];
		}
	}

	// Get all favorites
	async getFavorites(itemTypes = ['Movie', 'Series'], limit = 100) {
		try {
			const types = Array.isArray(itemTypes) ? itemTypes.join(',') : itemTypes;
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/Items?filters=IsFavorite&includeItemTypes=${types}&limit=${limit}&recursive=true&sortBy=SortName&sortOrder=Ascending&fields=Overview,PrimaryImageAspectRatio,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber,UserData&imageTypeLimit=1`,
				{
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			const data = await response.json();
			return data.Items || [];
		} catch (error) {
			console.error('getFavorites error:', error);
			return [];
		}
	}

	// Toggle favorite status
	async toggleFavorite(itemId, isFavorite) {
		try {
			const method = isFavorite ? 'DELETE' : 'POST';
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/FavoriteItems/${itemId}`,
				{
					method: method,
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			
			if (!response.ok) {
				throw new Error(`Failed to toggle favorite: ${response.status}`);
			}
			
			// Return the new favorite status
			return !isFavorite;
		} catch (error) {
			console.error('toggleFavorite error:', error);
			throw error;
		}
	}

	// Mark item as favorite
	async markFavorite(itemId) {
		return this.toggleFavorite(itemId, false);
	}

	// Unmark item as favorite
	async unmarkFavorite(itemId) {
		return this.toggleFavorite(itemId, true);
	}

	// Mark item as watched/played
	async markWatched(itemId) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/PlayedItems/${itemId}`,
				{
					method: 'POST',
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			
			if (!response.ok) {
				throw new Error(`Failed to mark watched: ${response.status}`);
			}
			
			return true;
		} catch (error) {
			console.error('markWatched error:', error);
			throw error;
		}
	}

	// Mark item as unwatched/unplayed
	async markUnwatched(itemId) {
		try {
			const response = await fetch(
				`${this.serverUrl}/Users/${this.userId}/PlayedItems/${itemId}`,
				{
					method: 'DELETE',
					headers: {
						'X-Emby-Token': this.accessToken
					}
				}
			);
			
			if (!response.ok) {
				throw new Error(`Failed to mark unwatched: ${response.status}`);
			}
			
			return false;
		} catch (error) {
			console.error('markUnwatched error:', error);
			throw error;
		}
	}

	// Toggle watched status
	async toggleWatched(itemId, isWatched) {
		if (isWatched) {
			return this.markUnwatched(itemId);
		} else {
			return this.markWatched(itemId);
		}
	}

	// Get server info for settings display
	async getServerInfo() {
		try {
			const response = await fetch(`${this.serverUrl}/System/Info`, {
				headers: {
					'X-Emby-Token': this.accessToken
				}
			});
			return await response.json();
		} catch (error) {
			console.error('getServerInfo error:', error);
			return null;
		}
	}

	// Get public server info (no auth required)
	async getPublicServerInfo() {
		try {
			const response = await fetch(`${this.serverUrl}/System/Info/Public`);
			return await response.json();
		} catch (error) {
			console.error('getPublicServerInfo error:', error);
			return null;
		}
	}
}

export default new JellyfinService();
