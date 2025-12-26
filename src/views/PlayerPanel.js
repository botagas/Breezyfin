import { useState, useEffect, useRef, useCallback } from 'react';
import { Panel } from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Slider from '@enact/sandstone/Slider';
import BodyText from '@enact/sandstone/BodyText';
import Spinner from '@enact/sandstone/Spinner';
import Popup from '@enact/sandstone/Popup';
import Item from '@enact/sandstone/Item';
import Scroller from '@enact/sandstone/Scroller';
import Hls from 'hls.js';
import jellyfinService from '../services/jellyfinService';
import {KeyCodes, isBackKey} from '../utils/keyCodes';

import css from './PlayerPanel.module.less';

const PlayerPanel = ({ item, playbackOptions, onBack, onPlay, isActive = false, ...rest }) => {
	const videoRef = useRef(null);
	const hlsRef = useRef(null);
	const progressIntervalRef = useRef(null);
	const seekOffsetRef = useRef(0); // Track offset for transcoded stream seeking
	const playbackSettingsRef = useRef({}); // Persist user playback settings between re-requests
	const startupFallbackTimerRef = useRef(null);
	const transcodeFallbackAttemptedRef = useRef(false);
	const trackPreferenceRef = useRef(null);
	const lastProgressRef = useRef({ time: 0, timestamp: 0 });
	const loadVideoRef = useRef(null);
	const [toastMessage, setToastMessage] = useState('');
	
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [showControls, setShowControls] = useState(true);
	const [volume, setVolume] = useState(100);
	const [muted, setMuted] = useState(false);
	
	// Track selection state
	const [audioTracks, setAudioTracks] = useState([]);
	const [subtitleTracks, setSubtitleTracks] = useState([]);
	const [currentAudioTrack, setCurrentAudioTrack] = useState(null);
	const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(null);
	const [showAudioPopup, setShowAudioPopup] = useState(false);
	const [showSubtitlePopup, setShowSubtitlePopup] = useState(false);
	const [mediaSourceData, setMediaSourceData] = useState(null);
	const [playSessionId, setPlaySessionId] = useState(null);
	const [hasNextEpisode, setHasNextEpisode] = useState(false);
	const [hasPreviousEpisode, setHasPreviousEpisode] = useState(false);
	const [mediaSegments, setMediaSegments] = useState([]);
	const [currentSkipSegment, setCurrentSkipSegment] = useState(null);
	const [skipCountdown, setSkipCountdown] = useState(null);
	const [skipOverlayVisible, setSkipOverlayVisible] = useState(false);
	const [nextEpisodeData, setNextEpisodeData] = useState(null);
	const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(null);

	// Build playback options to carry current selections to the next item
	const buildPlaybackOptions = useCallback(() => {
		const opts = { ...playbackSettingsRef.current };
		if (Number.isInteger(currentAudioTrack)) {
			opts.audioStreamIndex = currentAudioTrack;
		}
		if (currentSubtitleTrack === -1 || Number.isInteger(currentSubtitleTrack)) {
			opts.subtitleStreamIndex = currentSubtitleTrack;
		}
		return opts;
	}, [currentAudioTrack, currentSubtitleTrack]);

	// Find the next episode relative to the current one
	const getNextEpisode = useCallback(async (currentItem) => {
		if (!currentItem || currentItem.Type !== 'Episode' || !currentItem.SeriesId) return null;

		const seasonId = currentItem.SeasonId || currentItem.ParentId;
		if (!seasonId) return null;

		// Try to find next episode in the same season
		const seasonEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, seasonId);
		const currentIndex = seasonEpisodes.findIndex(ep => ep.Id === currentItem.Id);
		if (currentIndex >= 0 && currentIndex < seasonEpisodes.length - 1) {
			return seasonEpisodes[currentIndex + 1];
		}

		// Otherwise, move to the next season and pick its first episode
		const seasons = await jellyfinService.getSeasons(currentItem.SeriesId);
		if (!seasons || seasons.length === 0) return null;

		// Sort seasons by index for predictable order
		seasons.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
		const currentSeasonIndex = seasons.findIndex(s => s.Id === seasonId);
		if (currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1) {
			const nextSeason = seasons[currentSeasonIndex + 1];
			const nextEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, nextSeason.Id);
			return nextEpisodes?.[0] || null;
		}

		return null;
	}, []);

	const getPreviousEpisode = useCallback(async (currentItem) => {
		if (!currentItem || currentItem.Type !== 'Episode' || !currentItem.SeriesId) return null;

		const seasonId = currentItem.SeasonId || currentItem.ParentId;
		if (!seasonId) return null;

		const seasonEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, seasonId);
		const currentIndex = seasonEpisodes.findIndex(ep => ep.Id === currentItem.Id);
		if (currentIndex > 0) {
			return seasonEpisodes[currentIndex - 1];
		}

		const seasons = await jellyfinService.getSeasons(currentItem.SeriesId);
		if (!seasons || seasons.length === 0) return null;
		seasons.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0));
		const currentSeasonIndex = seasons.findIndex(s => s.Id === seasonId);
		if (currentSeasonIndex > 0) {
			const previousSeason = seasons[currentSeasonIndex - 1];
			const previousEpisodes = await jellyfinService.getEpisodes(currentItem.SeriesId, previousSeason.Id);
			return previousEpisodes?.[previousEpisodes.length - 1] || null;
		}

		return null;
	}, []);

	// Pre-compute whether a next episode exists to control button visibility/behavior
	useEffect(() => {
		let cancelled = false;
		const checkNext = async () => {
			if (!item || item.Type !== 'Episode') {
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
					setNextEpisodeData(null);
				}
				return;
			}
			try {
				const nextEp = await getNextEpisode(item);
				const prevEp = await getPreviousEpisode(item);
				if (!cancelled) {
					setHasNextEpisode(!!nextEp);
					setHasPreviousEpisode(!!prevEp);
					setNextEpisodeData(nextEp || null);
				}
			} catch (err) {
				console.error('Failed to check next episode:', err);
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
					setNextEpisodeData(null);
				}
			}
		};
		checkNext();
		return () => { cancelled = true; };
	}, [getNextEpisode, getPreviousEpisode, item]);

	// Start progress reporting to Jellyfin server
	const startProgressReporting = useCallback(() => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
		}

		progressIntervalRef.current = setInterval(async () => {
			if (videoRef.current && item) {
				const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
				await jellyfinService.reportPlaybackProgress(item.Id, positionTicks, false);
			}
		}, 10000);
	}, [item]);

	// Stop playback and clean up
	const handleStop = useCallback(async () => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current);
			progressIntervalRef.current = null;
		}
		if (startupFallbackTimerRef.current) {
			clearTimeout(startupFallbackTimerRef.current);
			startupFallbackTimerRef.current = null;
		}

		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}

		if (videoRef.current && item) {
			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStopped(item.Id, positionTicks);
		}
	}, [item]);

	// Attempt to fall back to transcoding if direct playback looks unhealthy
	const attemptTranscodeFallback = useCallback(async (reason) => {
		// If user already forced transcoding or we've tried already, bail
		if (playbackSettingsRef.current.forceTranscoding || transcodeFallbackAttemptedRef.current) {
			return false;
		}
		// Only try if the server can transcode
		if (!mediaSourceData?.SupportsTranscoding) {
			return false;
		}
		transcodeFallbackAttemptedRef.current = true;
		console.warn('[Player] Attempting transcode fallback. Reason:', reason);
		setToastMessage('Switching to transcoding...');
		await handleStop();
		setError(null);
		setLoading(true);
		// Re-run loadVideo with a forced transcode override
		if (loadVideoRef.current) {
			loadVideoRef.current(true);
		}
		return true;
	}, [handleStop, mediaSourceData]);

	// Track preference helpers
	const loadTrackPreferences = useCallback(() => {
		try {
			const stored = localStorage.getItem('breezyfinTrackPrefs');
			return stored ? JSON.parse(stored) : null;
		} catch (err) {
			console.warn('Failed to load track preferences:', err);
			return null;
		}
	}, []);

	const saveTrackPreferences = useCallback((prefs) => {
		try {
			localStorage.setItem('breezyfinTrackPrefs', JSON.stringify(prefs));
			trackPreferenceRef.current = prefs;
		} catch (err) {
			console.warn('Failed to save track preferences:', err);
		}
	}, []);

	const pickPreferredAudio = (audioStreams, providedAudio, defaultAudio) => {
		if (!audioStreams.length) return null;
		const pref = trackPreferenceRef.current?.audio;
		if (Number.isInteger(providedAudio) && audioStreams.some(s => s.Index === providedAudio)) {
			return providedAudio;
		}
		if (pref) {
			const languageMatch = audioStreams.find(s => s.Language && s.Language.toLowerCase() === pref.language?.toLowerCase());
			if (languageMatch) return languageMatch.Index;
		}
		return (defaultAudio?.Index ?? audioStreams[0]?.Index ?? null);
	};

	const pickPreferredSubtitle = (subtitleStreams, providedSubtitle, defaultSubtitle) => {
		if (providedSubtitle === -1) return -1;
		if (Number.isInteger(providedSubtitle) && subtitleStreams.some(s => s.Index === providedSubtitle)) {
			return providedSubtitle;
		}
		const pref = trackPreferenceRef.current?.subtitle;
		// Respect "off" preference
		if (pref?.off) return -1;

		if (pref?.language) {
			// Prefer non-forced match in the same language
			const nonForced = subtitleStreams.find(s =>
				s.Language && s.Language.toLowerCase() === pref.language.toLowerCase() && !s.IsForced
			);
			if (nonForced) return nonForced.Index;
			// Fall back to any in that language
			const anyLang = subtitleStreams.find(s =>
				s.Language && s.Language.toLowerCase() === pref.language.toLowerCase()
			);
			if (anyLang) return anyLang.Index;
		}
		// Default Jellyfin pick
		return (defaultSubtitle?.Index ?? -1);
	};

	// Load and play video
	const loadVideo = useCallback(async (forceTranscodeOverride = false) => {
		if (!item) return;
		
		// Wait for video element to be available
		if (!videoRef.current) {
			console.log('Video element not ready, waiting...');
			setTimeout(() => loadVideo(forceTranscodeOverride), 100);
			return;
		}
		
		setLoading(true);
		setError(null);
		seekOffsetRef.current = 0; // Reset seek offset for new video
		trackPreferenceRef.current = loadTrackPreferences();

		// Clean up any existing HLS instance
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}

		loadVideoRef.current = loadVideo;

		try {
			console.log('=== Loading video ===');
			console.log('Item:', item.Name, item.Id);

			// Load user settings to check for force transcoding
			const settingsJson = localStorage.getItem('breezyfinSettings');
			const settings = settingsJson ? JSON.parse(settingsJson) : {};
			let forceTranscoding = forceTranscodeOverride || settings.forceTranscoding || false;
			const enableTranscoding = settings.enableTranscoding !== false;
			const maxBitrate = settings.maxBitrate;
			const autoPlayNext = settings.autoPlayNext !== false;
			
			// Check if we should force transcoding for subtitles
			const hasSubtitles = playbackOptions?.subtitleStreamIndex !== undefined && playbackOptions?.subtitleStreamIndex >= 0;
			if (!forceTranscoding && hasSubtitles && settings.forceTranscodingWithSubtitles !== false) {
				forceTranscoding = true;
				console.log('Force Transcoding enabled due to subtitle selection');
			}
			
			console.log('Force Transcoding:', forceTranscoding);
			playbackSettingsRef.current = { forceTranscoding, enableTranscoding, maxBitrate, autoPlayNext };

			// Get playback info from Jellyfin
			let playbackInfo = null;
			try {
				const options = { 
					...(playbackOptions || {}), 
					...playbackSettingsRef.current
				};
				playbackInfo = await jellyfinService.getPlaybackInfo(item.Id, options);
				console.log('Playback info received:', playbackInfo);
			} catch (infoError) {
				console.error('Failed to get playback info:', infoError);
			}

			const mediaSource = playbackInfo?.MediaSources?.[0];
			if (!mediaSource) {
				throw new Error('No media source available');
			}

			// Guard: if user forced transcoding but the server didn't provide a transcoding URL, bail with a clear message
			if (playbackSettingsRef.current.forceTranscoding && !mediaSource.TranscodingUrl) {
				throw new Error('Transcoding was forced, but the server did not return a transcoding URL.');
			}

			console.log('Media source:', {
				Id: mediaSource.Id,
				Container: mediaSource.Container,
				SupportsDirectPlay: mediaSource.SupportsDirectPlay,
				SupportsDirectStream: mediaSource.SupportsDirectStream,
				SupportsTranscoding: mediaSource.SupportsTranscoding,
				TranscodingUrl: mediaSource.TranscodingUrl,
				TranscodingContainer: mediaSource.TranscodingContainer,
				RunTimeTicks: mediaSource.RunTimeTicks
			});

			// Store media source and session for track switching
			setMediaSourceData(mediaSource);
			setPlaySessionId(playbackInfo.PlaySessionId);

			// Set duration from media source (in ticks, 10,000,000 ticks = 1 second)
			// This is the actual duration, not from the video element which may report incorrect values during transcoding
			if (mediaSource.RunTimeTicks) {
				const totalDuration = mediaSource.RunTimeTicks / 10000000;
				console.log('Setting duration from media source:', totalDuration, 'seconds');
				setDuration(totalDuration);
			} else if (item.RunTimeTicks) {
				const totalDuration = item.RunTimeTicks / 10000000;
				console.log('Setting duration from item:', totalDuration, 'seconds');
				setDuration(totalDuration);
			}

			// Extract audio and subtitle tracks
			const audioStreams = mediaSource.MediaStreams?.filter(s => s.Type === 'Audio') || [];
			const subtitleStreams = mediaSource.MediaStreams?.filter(s => s.Type === 'Subtitle') || [];
			
			setAudioTracks(audioStreams);
			setSubtitleTracks(subtitleStreams);
			
			// Set default selected tracks
			const defaultAudio = audioStreams.find(s => s.IsDefault) || audioStreams[0];
			const defaultSubtitle = subtitleStreams.find(s => s.IsDefault);
			
			// Use subtitle from playbackOptions if provided (selected from MediaDetailsPanel)
			const providedAudio = Number.isInteger(playbackOptions?.audioStreamIndex)
				? playbackOptions.audioStreamIndex
				: null;
			const initialAudio = pickPreferredAudio(audioStreams, providedAudio, defaultAudio);

			const providedSubtitle = Number.isInteger(playbackOptions?.subtitleStreamIndex)
				? playbackOptions.subtitleStreamIndex
				: null;
			const initialSubtitle = pickPreferredSubtitle(subtitleStreams, providedSubtitle, defaultSubtitle);
			
			setCurrentAudioTrack(initialAudio);
			setCurrentSubtitleTrack(initialSubtitle);
			console.log('Initial tracks set to:', { audio: initialAudio, subtitle: initialSubtitle });
			
			console.log('Audio tracks:', audioStreams.map(s => ({ index: s.Index, language: s.Language, title: s.Title })));
			console.log('Subtitle tracks:', subtitleStreams.map(s => ({ index: s.Index, language: s.Language, title: s.Title })));

			// Determine video URL and playback method
			let videoUrl;
			let isHls = false;

			if (mediaSource.TranscodingUrl) {
				// Server wants to transcode - use the transcoding URL
				videoUrl = `${jellyfinService.serverUrl}${mediaSource.TranscodingUrl}`;
				isHls = mediaSource.TranscodingUrl.includes('.m3u8') || 
				        mediaSource.TranscodingUrl.includes('/hls/') ||
				        mediaSource.TranscodingContainer?.toLowerCase() === 'ts';
				console.log('✅ TRANSCODING - Server is transcoding the video');
				console.log('Transcoding container:', mediaSource.TranscodingContainer);
			} else if (!playbackSettingsRef.current.forceTranscoding && mediaSource.SupportsDirectStream) {
				// Direct stream - server remuxes without transcoding
				videoUrl = jellyfinService.getPlaybackUrl(
					item.Id,
					mediaSource.Id,
					playbackInfo.PlaySessionId,
					mediaSource.ETag,
					mediaSource.Container,
					mediaSource.LiveStreamId
				);
				console.log('⚠️ DIRECT STREAM - Server is remuxing (not transcoding)');
			} else if (!playbackSettingsRef.current.forceTranscoding && mediaSource.SupportsDirectPlay) {
				// Direct play - play file as-is
				videoUrl = `${jellyfinService.serverUrl}/Videos/${item.Id}/stream?static=true&mediaSourceId=${mediaSource.Id}&api_key=${jellyfinService.accessToken}`;
				console.log('⚠️ DIRECT PLAY - Playing original file (may cause black video)');
			} else {
				throw new Error('No supported playback method available');
			}

			console.log('Video URL:', videoUrl);
			console.log('Is HLS:', isHls);

			const video = videoRef.current;
			if (!video) {
				throw new Error('Video element not available');
			}

			// If we picked a direct path, set a startup timeout to fall back to transcode if it stalls
			if (!mediaSource.TranscodingUrl && mediaSource.SupportsTranscoding) {
				if (startupFallbackTimerRef.current) {
					clearTimeout(startupFallbackTimerRef.current);
				}
				startupFallbackTimerRef.current = setTimeout(() => {
					console.warn('[Player] Direct playback startup timeout, attempting transcode fallback');
					attemptTranscodeFallback('Startup timeout');
				}, 12000);
			}

			// Log browser codec support
			console.log('Browser codec support:', {
				'video/mp4': video.canPlayType('video/mp4'),
				'video/mp4; codecs="avc1.42E01E"': video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
				'video/webm': video.canPlayType('video/webm'),
				'application/x-mpegURL': video.canPlayType('application/x-mpegURL'),
				'video/mp2t': video.canPlayType('video/mp2t')
			});

			if (isHls) {
				// Handle HLS playback
				// Check for native HLS support
				const nativeHls = video.canPlayType('application/vnd.apple.mpegURL') || 
				                  video.canPlayType('application/x-mpegURL');

				// Try native HLS first on webOS, fallback to HLS.js if it fails
				if (nativeHls) {
					console.log('Attempting native HLS playback');
					let fallbackTriggered = false;
					
					const tryHlsJsFallback = () => {
						if (fallbackTriggered || !Hls.isSupported()) return;
						fallbackTriggered = true;
						
						console.log('Native HLS failed, falling back to HLS.js');
						video.src = '';
						video.removeAttribute('src');
						
						const hls = new Hls({
							enableWorker: true,
							lowLatencyMode: false,
							backBufferLength: 90,
							maxBufferLength: 30,
							maxMaxBufferLength: 600
						});
						hlsRef.current = hls;

						hls.loadSource(videoUrl);
						hls.attachMedia(video);

						hls.on(Hls.Events.MANIFEST_PARSED, () => {
							console.log('HLS.js manifest parsed, starting playback');
						});

						hls.on(Hls.Events.ERROR, (event, data) => {
							console.error('HLS.js error:', data);
							if (data.fatal) {
								if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
									console.log('Attempting HLS.js recovery (network)...');
									hls.startLoad();
								} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
									console.log('Attempting HLS.js recovery (media)...');
									hls.recoverMediaError();
								} else {
									setError('HLS playback error: ' + data.details);
									setLoading(false);
								}
							}
						});
					};
					
					// Fallback after 3 seconds if not loaded
					const fallbackTimer = setTimeout(() => {
						if (video.readyState === 0) {
							tryHlsJsFallback();
						}
					}, 3000);
					
					// Immediate fallback if video errors
					const errorHandler = (e) => {
						console.error('Native HLS error:', e);
						clearTimeout(fallbackTimer);
						tryHlsJsFallback();
					};
					video.addEventListener('error', errorHandler, { once: true });
					
					// Clear timer if video starts loading successfully
					video.addEventListener('loadstart', () => {
						console.log('Native HLS loadstart event fired');
						clearTimeout(fallbackTimer);
						video.removeEventListener('error', errorHandler);
					}, { once: true });
					
					video.src = videoUrl;
				} else if (Hls.isSupported()) {
					console.log('Using HLS.js library');
					const hls = new Hls({
						enableWorker: true,
						lowLatencyMode: false,
						backBufferLength: 90,
						maxBufferLength: 30,
						maxMaxBufferLength: 600
					});
					hlsRef.current = hls;

					hls.loadSource(videoUrl);
					hls.attachMedia(video);

					hls.on(Hls.Events.MANIFEST_PARSED, () => {
						console.log('HLS manifest parsed, starting playback');
					});

					hls.on(Hls.Events.ERROR, (event, data) => {
						console.error('HLS error:', data);
						if (data.fatal) {
							if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
								console.log('Attempting HLS recovery (network)...');
								hls.startLoad();
							} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
								console.log('Attempting HLS recovery (media)...');
								hls.recoverMediaError();
							} else {
								setError('HLS playback error: ' + data.details);
								setLoading(false);
							}
						}
					});
				} else {
					throw new Error('HLS playback not supported on this device');
				}
			} else {
				// Direct MP4/WebM playback
				console.log('Setting video source directly');
				video.src = videoUrl;
			}

			// Load the video
			video.load();
			console.log('video.load() called');

			// Note: Position will be set in handleLoadedMetadata after metadata loads

		} catch (err) {
			console.error('Failed to load video:', err);
			setError('Failed to load video: ' + err.message);
			setLoading(false);
		}
	}, [attemptTranscodeFallback, item, playbackOptions]);

	// Video event handlers
	const handleLoadedMetadata = useCallback(() => {
		console.log('Video metadata loaded');
		if (videoRef.current) {
			// Note: For transcoded streams, video.duration may be inaccurate (only shows buffered duration)
			// We use the duration from media source RunTimeTicks instead, set in loadVideo
			console.log('Video element duration:', videoRef.current.duration, 'seconds (may be inaccurate for transcoding)');
			
			// Set start position after metadata is loaded
			if (item.UserData?.PlaybackPositionTicks) {
				const startPosition = item.UserData.PlaybackPositionTicks / 10000000;
				console.log('Setting resume position:', startPosition, 'seconds');
				videoRef.current.currentTime = startPosition;
				setCurrentTime(startPosition);
			}
		}
	}, [item]);

	const handleCanPlay = useCallback(async () => {
		console.log('Video can play');
		if (!videoRef.current || !loading) return;

		setLoading(false);
		
		try {
			console.log('Attempting to start playback...');
			await videoRef.current.play();
			setPlaying(true);
			console.log('Playback started successfully');
			if (startupFallbackTimerRef.current) {
				clearTimeout(startupFallbackTimerRef.current);
				startupFallbackTimerRef.current = null;
			}

			// Report to Jellyfin
			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStart(item.Id, positionTicks);
			startProgressReporting();
		} catch (playError) {
			console.error('Auto-play failed:', playError);
			// User may need to click play manually (browser autoplay policy)
			setPlaying(false);
			// If direct playback fails immediately, try a one-time transcode fallback
			if (!mediaSourceData?.TranscodingUrl) {
				attemptTranscodeFallback('Auto-play failed');
			}
		}
	}, [attemptTranscodeFallback, loading, item, mediaSourceData?.TranscodingUrl, startProgressReporting]);

	// Detect skip intro/credits segments based on current playback position
	const checkSkipSegments = useCallback((positionSeconds) => {
		if (!mediaSegments || mediaSegments.length === 0) return;

		// Optional opt-out if setting exists
		try {
			const settingsJson = localStorage.getItem('breezyfinSettings');
			if (settingsJson) {
				const settings = JSON.parse(settingsJson);
				if (settings.skipIntro === false) {
					if (skipOverlayVisible) {
						setSkipOverlayVisible(false);
						setCurrentSkipSegment(null);
						setSkipCountdown(null);
					}
					return;
				}
			}
		} catch (_) {
			// ignore parse issues
		}

		const positionTicks = positionSeconds * 10000000;
		const activeSegment = mediaSegments.find(
			(segment) => positionTicks >= segment.StartTicks && positionTicks <= segment.EndTicks
		);

		if (activeSegment) {
			if (!currentSkipSegment || currentSkipSegment.Id !== activeSegment.Id) {
				setCurrentSkipSegment(activeSegment);
			}
			setSkipOverlayVisible(true);
			const remainingSeconds = Math.max(0, (activeSegment.EndTicks / 10000000) - positionSeconds);
			setSkipCountdown(Math.ceil(remainingSeconds));
		} else if (skipOverlayVisible) {
			setSkipOverlayVisible(false);
			setCurrentSkipSegment(null);
			setSkipCountdown(null);
		}
	}, [currentSkipSegment, mediaSegments, skipOverlayVisible]);

	const handleTimeUpdate = useCallback(() => {
		if (videoRef.current) {
			// Add seek offset to get actual position (for transcoded streams that restart from 0)
			const actualTime = videoRef.current.currentTime + seekOffsetRef.current;
			setCurrentTime(actualTime);
			checkSkipSegments(actualTime);
			lastProgressRef.current = { time: actualTime, timestamp: Date.now() };
		}
	}, [checkSkipSegments]);

	const handleVideoError = useCallback(async (e) => {
		const video = videoRef.current;
		const mediaError = video?.error;

		console.error('=== Video Error ===');
		console.error('Event:', e);
		console.error('Video src:', video?.src);
		console.error('Network state:', video?.networkState);
		console.error('Ready state:', video?.readyState);

		let errorMessage = 'Failed to play video';
		if (mediaError) {
			const errorMessages = {
				1: 'Playback aborted',
				2: 'Network error',
				3: 'Decode error',
				4: 'Format not supported'
			};
			errorMessage = errorMessages[mediaError.code] || `Error code: ${mediaError.code}`;
			console.error('MediaError code:', mediaError.code, '-', errorMessage);
		}

		// Try falling back to transcoding once if we were on a direct path
		if (!mediaSourceData?.TranscodingUrl) {
			const didFallback = await attemptTranscodeFallback(errorMessage);
			if (didFallback) {
				return;
			}
		}

		// Clean up the playback session on error
		await handleStop();

		setError(errorMessage);
		setLoading(false);
	}, [attemptTranscodeFallback, handleStop, mediaSourceData]);

	const handleEnded = useCallback(async () => {
		console.log('Video ended');
		await handleStop();
		
		// Auto-play next episode if enabled
		if (playbackSettingsRef.current.autoPlayNext && item?.Type === 'Episode' && onPlay) {
			try {
				const nextEpisode = hasNextEpisode ? await getNextEpisode(item) : null;
				if (nextEpisode) {
					console.log('Auto-playing next episode:', nextEpisode.Name);
					onPlay(nextEpisode, buildPlaybackOptions());
					return;
				}
			} catch (err) {
				console.error('Failed to auto-play next episode:', err);
			}
		}

		onBack();
	}, [getNextEpisode, handleStop, hasNextEpisode, item, onBack, onPlay]);

	// Playback controls
	const handlePlay = async () => {
		if (videoRef.current) {
			try {
				await videoRef.current.play();
				setPlaying(true);
				setShowControls(true);

				const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
				await jellyfinService.reportPlaybackStart(item.Id, positionTicks);
				startProgressReporting();
			} catch (err) {
				console.error('Play failed:', err);
			}
		}
	};

	const handlePause = async () => {
		if (videoRef.current) {
			videoRef.current.pause();
			setPlaying(false);
			setShowControls(true);

			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackProgress(item.Id, positionTicks, true);
		}
	};

	const handleSeek = async (e) => {
		const seekTime = e.value;
		setCurrentTime(seekTime);
		
		if (!videoRef.current) return;
		
		// For HLS streams (native or HLS.js), let the player handle seeking
		const isHls = mediaSourceData?.TranscodingUrl?.includes('.m3u8') || 
		              mediaSourceData?.TranscodingUrl?.includes('/hls/');
		
		if (isHls) {
			// HLS supports native seeking via currentTime
			console.log('Seeking HLS stream to:', seekTime);
			videoRef.current.currentTime = seekTime;
			
			// Report seek to Jellyfin
			const seekTicks = Math.floor(seekTime * 10000000);
			await jellyfinService.reportPlaybackProgress(item.Id, seekTicks, videoRef.current.paused);
		} else if (mediaSourceData?.TranscodingUrl) {
			// For non-HLS transcoded streams, we need to reload from the new position
			try {
				const seekTicks = Math.floor(seekTime * 10000000);
				console.log('Seeking transcoded stream to:', seekTime, 'seconds (', seekTicks, 'ticks)');
				setLoading(true);
				
				const newPlaybackInfo = await jellyfinService.getPlaybackInfo(item.Id, {
					...playbackOptions,
					audioStreamIndex: currentAudioTrack,
					subtitleStreamIndex: currentSubtitleTrack >= 0 ? currentSubtitleTrack : undefined,
					startTimeTicks: seekTicks
				});
				
				const newMediaSource = newPlaybackInfo?.MediaSources?.[0];
				if (newMediaSource?.TranscodingUrl) {
					// Set the offset so time displays correctly
					seekOffsetRef.current = seekTime;
					
					// Build URL and ensure StartTimeTicks is included
					let videoUrl = `${jellyfinService.serverUrl}${newMediaSource.TranscodingUrl}`;
					if (!videoUrl.includes('StartTimeTicks')) {
						videoUrl += `&StartTimeTicks=${seekTicks}`;
					}
					console.log('Seek URL:', videoUrl);
					
					videoRef.current.src = videoUrl;
					videoRef.current.load();
				}
			} catch (err) {
				console.error('Failed to seek:', err);
				setLoading(false);
			}
		} else {
			// For direct play/stream, we can seek directly
			videoRef.current.currentTime = seekTime;
		}
	};

	const handleVolumeChange = (e) => {
		if (videoRef.current) {
			const newVolume = e.value;
			videoRef.current.volume = newVolume / 100;
			setVolume(newVolume);
			if (newVolume > 0) setMuted(false);
		}
	};

	const toggleMute = () => {
		if (videoRef.current) {
			const newMuted = !muted;
			videoRef.current.muted = newMuted;
			setMuted(newMuted);
		}
	};

	// Change audio track - requires reloading with new parameters
	const handleAudioTrackChange = async (trackIndex) => {
		setCurrentAudioTrack(trackIndex);
		setShowAudioPopup(false);
		// Persist preference
		const chosen = audioTracks.find(s => s.Index === trackIndex);
		saveTrackPreferences({
			...(trackPreferenceRef.current || {}),
			audio: {
				index: trackIndex,
				language: chosen?.Language || null
			},
			subtitle: trackPreferenceRef.current?.subtitle
		});
		
		// For HLS streams using HLS.js, use native audio track switching
		if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
			console.log('Switching HLS audio track to index:', trackIndex);
			// HLS.js audio tracks are 0-based, find matching track by stream index
			const hlsTrackIndex = hlsRef.current.audioTracks.findIndex(t => {
				// Try to match by language or other properties
				const mediaTrack = audioTracks.find(at => at.Index === trackIndex);
				return t.lang === mediaTrack?.Language || t.name === mediaTrack?.Title;
			});
			if (hlsTrackIndex >= 0) {
				hlsRef.current.audioTrack = hlsTrackIndex;
				return;
			}
		}
		
		// For transcoded non-HLS streams, we need to restart playback with new audio track
		// Note: This won't work well for HLS, use native track switching above instead
		if (mediaSourceData?.TranscodingUrl && videoRef.current && !hlsRef.current) {
			const currentPosition = videoRef.current.currentTime;
			
			// Reload with new audio track
			try {
				const newPlaybackInfo = await jellyfinService.getPlaybackInfo(item.Id, {
					...playbackOptions,
					...playbackSettingsRef.current,
					audioStreamIndex: trackIndex,
					subtitleStreamIndex: currentSubtitleTrack >= 0 ? currentSubtitleTrack : undefined,
					startTimeTicks: Math.floor(currentPosition * 10000000)
				});
				
				const newMediaSource = newPlaybackInfo?.MediaSources?.[0];
				if (newMediaSource?.TranscodingUrl) {
					const videoUrl = `${jellyfinService.serverUrl}${newMediaSource.TranscodingUrl}`;
					videoRef.current.src = videoUrl;
					videoRef.current.load();
				}
			} catch (err) {
				console.error('Failed to change audio track:', err);
			}
		}
	};

	// Change subtitle track
	const handleSubtitleTrackChange = async (trackIndex) => {
		setCurrentSubtitleTrack(trackIndex);
		setShowSubtitlePopup(false);
		// Persist preference (including "off")
		const chosen = subtitleTracks.find(s => s.Index === trackIndex);
		saveTrackPreferences({
			...(trackPreferenceRef.current || {}),
			subtitle: trackIndex === -1 ? { off: true } : {
				index: trackIndex,
				language: chosen?.Language || null,
				isForced: !!chosen?.IsForced
			},
			audio: trackPreferenceRef.current?.audio
		});
		
		// For HLS streams, subtitle switching via source reload doesn't work well
		// External subtitles would need to be handled separately
		// For now, skip subtitle switching on HLS to avoid breaking playback
		if (hlsRef.current) {
			if (typeof hlsRef.current.subtitleTrack === 'number' && hlsRef.current.subtitleTracks) {
				const hlsTrackIndex = hlsRef.current.subtitleTracks.findIndex(t => {
					const mediaTrack = subtitleTracks.find(st => st.Index === trackIndex);
					return mediaTrack && (t.lang === mediaTrack.Language || t.name === mediaTrack.Title);
				});
				if (hlsTrackIndex >= 0) {
					console.log('Switching HLS subtitle track to', hlsTrackIndex);
					hlsRef.current.subtitleTrack = hlsTrackIndex;
					return;
				}
			}
			console.log('Subtitle switching not yet supported for this HLS stream');
			return;
		}
		
		// For transcoded or direct streams, reload with selected subtitle
		if (mediaSourceData && videoRef.current) {
			const currentPosition = videoRef.current.currentTime;
			
			try {
				const newPlaybackInfo = await jellyfinService.getPlaybackInfo(item.Id, {
					...playbackOptions,
					...playbackSettingsRef.current,
					audioStreamIndex: currentAudioTrack,
					subtitleStreamIndex: trackIndex >= 0 ? trackIndex : undefined,
					startTimeTicks: Math.floor(currentPosition * 10000000)
				});
				
				const newMediaSource = newPlaybackInfo?.MediaSources?.[0];
				if (newMediaSource?.TranscodingUrl) {
					const videoUrl = `${jellyfinService.serverUrl}${newMediaSource.TranscodingUrl}`;
					videoRef.current.src = videoUrl;
					videoRef.current.load();
				} else if (newMediaSource) {
					// Direct path: reload with direct stream URL including subtitle choice
					const videoUrl = jellyfinService.getPlaybackUrl(
						item.Id,
						newMediaSource.Id,
						newPlaybackInfo.PlaySessionId,
						newMediaSource.ETag,
						newMediaSource.Container,
						newMediaSource.LiveStreamId
					);
					videoRef.current.src = videoUrl;
					videoRef.current.load();
				}
			} catch (err) {
				console.error('Failed to change subtitle track:', err);
			}
		}
	};

	const getTrackLabel = (track) => {
		const parts = [];
		if (track.Title) parts.push(track.Title);
		if (track.Language) parts.push(track.Language.toUpperCase());
		if (track.Codec) parts.push(track.Codec.toUpperCase());
		if (track.Channels) parts.push(`${track.Channels}ch`);
		return parts.join(' - ') || `Track ${track.Index}`;
	};

	// Manually trigger next episode from the player controls
	const handlePlayNextEpisode = useCallback(async () => {
		if (!item || item.Type !== 'Episode' || !onPlay || !hasNextEpisode) return;
		try {
			const nextEpisode = nextEpisodeData || await getNextEpisode(item);
			if (nextEpisode) {
				await handleStop();
				onPlay(nextEpisode, buildPlaybackOptions());
			}
		} catch (err) {
			console.error('Failed to play next episode:', err);
		}
	}, [buildPlaybackOptions, getNextEpisode, handleStop, hasNextEpisode, item, nextEpisodeData, onPlay]);

	const handlePlayPreviousEpisode = useCallback(async () => {
		if (!item || item.Type !== 'Episode' || !onPlay || !hasPreviousEpisode) return;
		try {
			const prevEpisode = await getPreviousEpisode(item);
			if (prevEpisode) {
				await handleStop();
				onPlay(prevEpisode, buildPlaybackOptions());
			}
		} catch (err) {
			console.error('Failed to play previous episode:', err);
		}
	}, [buildPlaybackOptions, getPreviousEpisode, handleStop, hasPreviousEpisode, item, onPlay]);

	const handleBackButton = async () => {
		await handleStop();
		onBack();
	};

	const toggleControls = () => {
		setShowControls(prev => !prev);
	};

	const seekBySeconds = useCallback((deltaSeconds) => {
		const video = videoRef.current;
		if (!video || !Number.isFinite(deltaSeconds)) return;
		const nextTime = Math.min(Math.max(0, video.currentTime + deltaSeconds), duration || video.duration || 0);
		video.currentTime = nextTime;
		setCurrentTime(nextTime);
	}, [duration]);

	// Format time for display
	const formatTime = (seconds) => {
		if (!isFinite(seconds) || seconds < 0) return '0:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);

		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	};

	const getSkipButtonLabel = (segmentType) => {
		switch (segmentType) {
			case 'Intro':
				return 'Skip Intro';
			case 'Recap':
				return 'Skip Recap';
			case 'Preview':
				return 'Skip Preview';
			case 'Outro':
			case 'Credits':
				return nextEpisodeData ? 'Next Episode' : 'Skip Credits';
			default:
				return 'Skip';
		}
	};

	const handleSkipSegment = () => {
		if (!currentSkipSegment) return;
		const isOutro = currentSkipSegment.Type === 'Outro' || currentSkipSegment.Type === 'Credits';
		if (isOutro && nextEpisodeData) {
			handlePlayNextEpisode();
			return;
		}
		const skipTo = currentSkipSegment.EndTicks / 10000000;
		if (videoRef.current) {
			videoRef.current.currentTime = skipTo;
			setCurrentTime(skipTo);
		}
		setSkipOverlayVisible(false);
		setCurrentSkipSegment(null);
		setSkipCountdown(null);
	};

	// Effects
	useEffect(() => {
		if (item) {
			transcodeFallbackAttemptedRef.current = false;
			setSkipOverlayVisible(false);
			setCurrentSkipSegment(null);
			setSkipCountdown(null);
			loadVideo();
			// Prefetch skip segments for intro/credits
			jellyfinService.getMediaSegments(item.Id).then(setMediaSegments).catch(() => setMediaSegments([]));
		}
		return () => {
			handleStop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [item]);

useEffect(() => {
	let hideTimer;
	if (showControls && playing) {
		hideTimer = setTimeout(() => setShowControls(false), 5000);
	}
	return () => clearTimeout(hideTimer);
}, [showControls, playing]);

// Playback health watchdog: if direct playback stalls, try transcode fallback
useEffect(() => {
	if (!mediaSourceData || mediaSourceData.TranscodingUrl) return undefined;
	const interval = setInterval(() => {
		const now = Date.now();
		const last = lastProgressRef.current;
		// If we haven't moved at least 0.5s in 12s of playback, consider it stalled
		if (playing && now - last.timestamp > 12000) {
			if (videoRef.current && Math.abs(videoRef.current.currentTime - last.time) < 0.5) {
				console.warn('[Player] Playback stall detected, attempting transcode fallback');
				attemptTranscodeFallback('Playback stalled');
			}
		}
	}, 5000);
	return () => clearInterval(interval);
	}, [attemptTranscodeFallback, mediaSourceData, playing]);

	// Auto-hide toast messages
	useEffect(() => {
		if (!toastMessage) return undefined;
		const t = setTimeout(() => setToastMessage(''), 2000);
		return () => clearTimeout(t);
	}, [toastMessage]);

	// Auto-start a countdown to next episode when credits/outro segment is active
	useEffect(() => {
		if (!currentSkipSegment || !nextEpisodeData || playbackSettingsRef.current.autoPlayNext === false) {
			setNextEpisodeCountdown(null);
			return undefined;
		}

		const isOutro = currentSkipSegment.Type === 'Outro' || currentSkipSegment.Type === 'Credits';
		if (!isOutro) {
			setNextEpisodeCountdown(null);
			return undefined;
		}

		setNextEpisodeCountdown(8);
		const timer = setInterval(() => {
			setNextEpisodeCountdown((prev) => {
				if (prev === null) return null;
				if (prev <= 1) {
					clearInterval(timer);
					handlePlayNextEpisode();
					return null;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [currentSkipSegment, handlePlayNextEpisode, nextEpisodeData]);

	// Handle remote/keyboard controls for play/pause, seek, back, and control visibility
	useEffect(() => {
		if (!isActive) return undefined;

		const handleKeyDown = (e) => {
			const code = e.keyCode || e.which;
			const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
			const SEEK_STEP = 10; // seconds
			const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, 179]; // enter/OK, space, media play/pause
			const PLAY_ONLY_KEYS = [KeyCodes.PLAY];
			const PAUSE_KEYS = [KeyCodes.PAUSE];

			// If we're not showing controls, bring them up on any navigation key
			if ([KeyCodes.LEFT, KeyCodes.UP, KeyCodes.RIGHT, KeyCodes.DOWN].includes(code) && !showControls) {
				e.preventDefault();
				setShowControls(true);
			}

			switch (code) {
				case KeyCodes.LEFT:
					e.preventDefault();
					seekBySeconds(-SEEK_STEP);
					break;
				case KeyCodes.RIGHT:
					e.preventDefault();
					seekBySeconds(SEEK_STEP);
					break;
				case KeyCodes.UP:
					e.preventDefault();
					setShowControls(true);
					break;
				case KeyCodes.DOWN:
					e.preventDefault();
					setShowControls(false);
					break;
				default:
					break;
			}

			if (BACK_KEYS.includes(code)) {
				e.preventDefault();
				// Close secondary UI first before leaving the player
				if (showAudioPopup) {
					setShowAudioPopup(false);
					return;
				}
				if (showSubtitlePopup) {
					setShowSubtitlePopup(false);
					return;
				}
				handleBackButton();
				return;
			}

			if (PLAY_KEYS.includes(code)) {
				e.preventDefault();
				playing ? handlePause() : handlePlay();
				return;
			}

			if (PLAY_ONLY_KEYS.includes(code)) {
				e.preventDefault();
				handlePlay();
				return;
			}

			if (PAUSE_KEYS.includes(code)) {
				e.preventDefault();
				handlePause();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [handleBackButton, handlePause, handlePlay, isActive, playing, seekBySeconds, showAudioPopup, showControls, showSubtitlePopup]);

	return (
		<Panel {...rest} noCloseButton>
			<div className={css.playerContainer}>
				<video
					ref={videoRef}
					className={css.video}
					onLoadStart={() => console.log('Event: loadstart')}
					onLoadedData={() => console.log('Event: loadeddata')}
					onLoadedMetadata={handleLoadedMetadata}
					onCanPlay={handleCanPlay}
					onCanPlayThrough={() => console.log('Event: canplaythrough')}
					onTimeUpdate={handleTimeUpdate}
					onEnded={handleEnded}
					onError={handleVideoError}
					onWaiting={() => console.log('Event: waiting (buffering)')}
					onPlaying={() => { console.log('Event: playing'); setPlaying(true); }}
					onPause={() => { console.log('Event: pause'); setPlaying(false); }}
					onStalled={() => console.log('Event: stalled')}
					onClick={toggleControls}
					autoPlay
					playsInline
					preload="auto"
				/>

				{loading && (
					<div className={css.loading}>
						<Spinner />
						<BodyText>Loading...</BodyText>
					</div>
				)}

				{error && (
					<div className={css.error}>
						<BodyText>{error}</BodyText>
						<Button onClick={handleBackButton} size="large">Go Back</Button>
					</div>
				)}

				{skipOverlayVisible && currentSkipSegment && (
					<div className={css.skipOverlay}>
						<div className={css.skipPill}>
							<div className={css.skipText}>
								<BodyText className={css.skipTitle}>{getSkipButtonLabel(currentSkipSegment.Type)}</BodyText>
								{skipCountdown !== null && (
									<BodyText className={css.skipCountdown}>Ends in {skipCountdown}s</BodyText>
								)}
								{nextEpisodeCountdown !== null && (
									<BodyText className={css.skipCountdown}>Next episode in {nextEpisodeCountdown}s</BodyText>
								)}
							</div>
							<Button size="small" onClick={handleSkipSegment} className={css.skipButton}>
								Skip
							</Button>
						</div>
					</div>
				)}

				{toastMessage && (
					<div className={css.playerToast}>{toastMessage}</div>
				)}

				{showControls && !loading && !error && (
					<div className={css.controls}>
						<div className={css.topBar}>
							<Button
								onClick={handleBackButton}
								size="large"
								icon="arrowlargeleft"
							/>
							<BodyText className={css.title}>{item?.Name}</BodyText>
						</div>

						<div className={css.bottomBar}>
							<div className={css.progressContainer}>
								<BodyText className={css.time}>
									{formatTime(currentTime)}
								</BodyText>
								<Slider
									className={css.progressSlider}
									min={0}
									max={Math.floor(duration) || 1}
									step={5}
									value={Math.floor(currentTime)}
									onChange={handleSeek}
								/>
								<BodyText className={css.time}>
									-{formatTime(Math.max(0, duration - currentTime))}
								</BodyText>
							</div>

							<div className={css.controlButtons}>
								{item?.Type === 'Episode' && (
									<Button 
										onClick={handlePlayPreviousEpisode} 
										size="large" 
										icon="jumpbackward" 
										disabled={!hasPreviousEpisode}
									/>
								)}

								{playing ? (
									<Button onClick={handlePause} size="large" icon="pause" />
								) : (
									<Button onClick={handlePlay} size="large" icon="play" />
								)}

								{item?.Type === 'Episode' && (
									<Button 
										onClick={handlePlayNextEpisode} 
										size="large" 
										icon="jumpforward" 
										disabled={!hasNextEpisode}
									/>
								)}

								<div className={css.trackButtons}>
									{audioTracks.length > 1 && (
										<Button 
											size="small" 
											icon="speaker" 
											onClick={() => setShowAudioPopup(true)}
										/>
									)}
									{subtitleTracks.length > 0 && (
										<Button 
											size="small" 
											icon="subtitle" 
											onClick={() => setShowSubtitlePopup(true)}
										/>
									)}
								</div>

								<div className={css.volumeControl}>
									<Button 
										size="small" 
										icon={muted || volume === 0 ? 'soundmute' : 'sound'} 
										onClick={toggleMute}
									/>
									<Slider
										className={css.volumeSlider}
										min={0}
										max={100}
										value={muted ? 0 : volume}
										onChange={handleVolumeChange}
									/>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Audio Track Selection Popup */}
				<Popup
					open={showAudioPopup}
					onClose={() => setShowAudioPopup(false)}
					position="center"
				>
					<div className={css.trackPopup}>
						<BodyText className={css.popupTitle}>Audio Track</BodyText>
						<Scroller className={css.trackList}>
							{audioTracks.map((track) => (
								<Item
									key={track.Index}
									selected={currentAudioTrack === track.Index}
									onClick={() => handleAudioTrackChange(track.Index)}
								>
									{getTrackLabel(track)}
								</Item>
							))}
						</Scroller>
					</div>
				</Popup>

				{/* Subtitle Track Selection Popup */}
				<Popup
					open={showSubtitlePopup}
					onClose={() => setShowSubtitlePopup(false)}
					position="center"
				>
					<div className={css.trackPopup}>
						<BodyText className={css.popupTitle}>Subtitles</BodyText>
						<Scroller className={css.trackList}>
							<Item
								selected={currentSubtitleTrack === -1}
								onClick={() => handleSubtitleTrackChange(-1)}
							>
								Off
							</Item>
							{subtitleTracks.map((track) => (
								<Item
									key={track.Index}
									selected={currentSubtitleTrack === track.Index}
									onClick={() => handleSubtitleTrackChange(track.Index)}
								>
									{getTrackLabel(track)}
								</Item>
							))}
						</Scroller>
					</div>
				</Popup>
			</div>
		</Panel>
	);
};

export default PlayerPanel;
