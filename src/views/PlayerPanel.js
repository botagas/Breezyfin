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

import css from './PlayerPanel.module.less';

const PlayerPanel = ({ item, playbackOptions, onBack, onPlay, ...rest }) => {
	const videoRef = useRef(null);
	const hlsRef = useRef(null);
	const progressIntervalRef = useRef(null);
	const seekOffsetRef = useRef(0); // Track offset for transcoded stream seeking
	const playbackSettingsRef = useRef({}); // Persist user playback settings between re-requests
	
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
				}
				return;
			}
			try {
				const nextEp = await getNextEpisode(item);
				const prevEp = await getPreviousEpisode(item);
				if (!cancelled) {
					setHasNextEpisode(!!nextEp);
					setHasPreviousEpisode(!!prevEp);
				}
			} catch (err) {
				console.error('Failed to check next episode:', err);
				if (!cancelled) {
					setHasNextEpisode(false);
					setHasPreviousEpisode(false);
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

		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}

		if (videoRef.current && item) {
			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStopped(item.Id, positionTicks);
		}
	}, [item]);

	// Load and play video
	const loadVideo = useCallback(async () => {
		if (!item) return;
		
		// Wait for video element to be available
		if (!videoRef.current) {
			console.log('Video element not ready, waiting...');
			setTimeout(() => loadVideo(), 100);
			return;
		}
		
		setLoading(true);
		setError(null);
		seekOffsetRef.current = 0; // Reset seek offset for new video

		// Clean up any existing HLS instance
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}

		try {
			console.log('=== Loading video ===');
			console.log('Item:', item.Name, item.Id);

			// Load user settings to check for force transcoding
			const settingsJson = localStorage.getItem('breezyfinSettings');
			const settings = settingsJson ? JSON.parse(settingsJson) : {};
			let forceTranscoding = settings.forceTranscoding || false;
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
			const initialAudio = audioStreams.some(s => s.Index === providedAudio)
				? providedAudio
				: (defaultAudio?.Index ?? null);

			const providedSubtitle = Number.isInteger(playbackOptions?.subtitleStreamIndex)
				? playbackOptions.subtitleStreamIndex
				: null;
			const initialSubtitle = (providedSubtitle === -1 || subtitleStreams.some(s => s.Index === providedSubtitle))
				? providedSubtitle
				: (defaultSubtitle?.Index ?? -1);
			
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
			} else if (mediaSource.SupportsDirectStream) {
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
			} else if (mediaSource.SupportsDirectPlay) {
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
	}, [item, playbackOptions]);

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

			// Report to Jellyfin
			const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
			await jellyfinService.reportPlaybackStart(item.Id, positionTicks);
			startProgressReporting();
		} catch (playError) {
			console.error('Auto-play failed:', playError);
			// User may need to click play manually (browser autoplay policy)
			setPlaying(false);
		}
	}, [loading, item, startProgressReporting]);

	const handleTimeUpdate = useCallback(() => {
		if (videoRef.current) {
			// Add seek offset to get actual position (for transcoded streams that restart from 0)
			const actualTime = videoRef.current.currentTime + seekOffsetRef.current;
			setCurrentTime(actualTime);
		}
	}, []);

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

		// Clean up the playback session on error
		await handleStop();

		setError(errorMessage);
		setLoading(false);
	}, [handleStop]);

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
		
		// For HLS streams, subtitle switching via source reload doesn't work well
		// External subtitles would need to be handled separately
		// For now, skip subtitle switching on HLS to avoid breaking playback
		if (hlsRef.current) {
			console.log('Subtitle switching not yet supported for HLS streams');
			return;
		}
		
		// For transcoded non-HLS streams with burned-in subtitles, we need to restart
		if (mediaSourceData?.TranscodingUrl && videoRef.current) {
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
			const nextEpisode = await getNextEpisode(item);
			if (nextEpisode) {
				await handleStop();
				onPlay(nextEpisode, buildPlaybackOptions());
			}
		} catch (err) {
			console.error('Failed to play next episode:', err);
		}
	}, [buildPlaybackOptions, getNextEpisode, handleStop, hasNextEpisode, item, onPlay]);

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

	// Effects
	useEffect(() => {
		if (item) {
			loadVideo();
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

	// Handle key events to show controls on any key press
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Arrow keys, OK/Enter button
			const navKeys = [37, 38, 39, 40, 13]; // left, up, right, down, enter
			if (navKeys.includes(e.keyCode)) {
				if (!showControls) {
					e.preventDefault();
					setShowControls(true);
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [showControls]);

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
