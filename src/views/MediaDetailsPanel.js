import { useState, useEffect, useRef } from 'react';
import { Panel, Header } from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Heading from '@enact/sandstone/Heading';
import Scroller from '@enact/sandstone/Scroller';
import Spinner from '@enact/sandstone/Spinner';
import Icon from '@enact/sandstone/Icon';
import Popup from '@enact/sandstone/Popup';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import jellyfinService from '../services/jellyfinService';
import {scrollElementIntoHorizontalView} from '../utils/horizontalScroll';
import {KeyCodes} from '../utils/keyCodes';

import css from './MediaDetailsPanel.module.less';

const SpottableDiv = Spottable('div');

const MediaDetailsPanel = ({ item, onBack, onPlay, onItemSelect, isActive = false, ...rest }) => {
	const [loading, setLoading] = useState(true);
	const [playbackInfo, setPlaybackInfo] = useState(null);
	const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
	const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);
	const [seasons, setSeasons] = useState([]);
	const [episodes, setEpisodes] = useState([]);
	const [selectedSeason, setSelectedSeason] = useState(null);
	const [selectedEpisode, setSelectedEpisode] = useState(null);
	const [showAudioPicker, setShowAudioPicker] = useState(false);
	const [showSubtitlePicker, setShowSubtitlePicker] = useState(false);
	const [showEpisodePicker, setShowEpisodePicker] = useState(false);
	const [isFavorite, setIsFavorite] = useState(false);
	const [isWatched, setIsWatched] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const castRowRef = useRef(null);
	const castScrollerRef = useRef(null);
	const seasonScrollerRef = useRef(null);
	const episodesListRef = useRef(null);
	const episodeSelectorButtonRef = useRef(null);

	useEffect(() => {
		loadPlaybackInfo();
		if (item?.Type === 'Series') {
			loadSeasons();
		}
		// Initialize favorite and watched status
		if (item?.UserData) {
			setIsFavorite(item.UserData.IsFavorite || false);
			setIsWatched(item.UserData.Played || false);
		}
	}, [item]);

	// Pick sensible defaults based on the media streams we got back
	const applyDefaultTracks = (mediaStreams) => {
		if (!mediaStreams) return;
		const defaultAudio = mediaStreams.find(s => s.Type === 'Audio' && s.IsDefault);
		const firstAudio = mediaStreams.find(s => s.Type === 'Audio');
		const defaultSubtitle = mediaStreams.find(s => s.Type === 'Subtitle' && s.IsDefault);

		setSelectedAudioTrack((defaultAudio ?? firstAudio)?.Index ?? null);
		setSelectedSubtitleTrack(defaultSubtitle?.Index ?? -1);
	};

	const loadPlaybackInfo = async () => {
		if (!item) return;

		// Don't load playback info for Series - only for playable items
		if (item.Type === 'Series') {
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const info = await jellyfinService.getPlaybackInfo(item.Id);
			setPlaybackInfo(info);
			applyDefaultTracks(info.MediaSources?.[0]?.MediaStreams);
		} catch (error) {
			console.error('Failed to load playback info:', error);
		} finally {
			setLoading(false);
		}
	};

	const loadSeasons = async () => {
		if (!item) return;
		setLoading(true);
		try {
			const seasonsData = await jellyfinService.getSeasons(item.Id);
			setSeasons(seasonsData);
			if (seasonsData.length > 0) {
				setSelectedSeason(seasonsData[0]);
				await loadEpisodes(seasonsData[0].Id);
			}
		} catch (error) {
			console.error('Failed to load seasons:', error);
		} finally {
			setLoading(false);
		}
	};

	const loadEpisodes = async (seasonId) => {
		if (!item || !seasonId) return;
		try {
			const episodesData = await jellyfinService.getEpisodes(item.Id, seasonId);
			setEpisodes(episodesData);
			if (episodesData.length > 0) {
				setSelectedEpisode(episodesData[0]);
				// Load playback info for first episode
				const info = await jellyfinService.getPlaybackInfo(episodesData[0].Id);
				setPlaybackInfo(info);
				applyDefaultTracks(info.MediaSources?.[0]?.MediaStreams);
			}
		} catch (error) {
			console.error('Failed to load episodes:', error);
		}
	};

	const handlePlay = async () => {
		const mediaSourceId = playbackInfo?.MediaSources?.[0]?.Id || null;
		const options = { mediaSourceId };
		if (Number.isInteger(selectedAudioTrack)) {
			options.audioStreamIndex = selectedAudioTrack;
		}
		if (selectedSubtitleTrack === -1 || Number.isInteger(selectedSubtitleTrack)) {
			options.subtitleStreamIndex = selectedSubtitleTrack;
		}

		// If this is a series, play the selected episode
		if (item.Type === 'Series') {
			if (selectedEpisode) {
				onPlay(selectedEpisode, options);
			} else {
				console.error('No episode selected');
			}
		} else {
			onPlay(item, options);
		}
	};

	const handleSeasonClick = async (season) => {
		setSelectedSeason(season);
		setEpisodes([]);
		setSelectedEpisode(null);
		await loadEpisodes(season.Id);
	};

	// Handle back navigation - for episodes, go to series instead of home
	const handleBack = async () => {
		if (item.Type === 'Episode' && item.SeriesId) {
			try {
				const series = await jellyfinService.getItem(item.SeriesId);
				if (series && onItemSelect) {
					onItemSelect(series);
					return;
				}
			} catch (error) {
				console.error('Error fetching series for back navigation:', error);
			}
		}
		// Fall back to default back behavior
		onBack();
	};

	const handleEpisodeClick = async (episode) => {
		setSelectedEpisode(episode);
		// Load playback info for selected episode
		try {
			const info = await jellyfinService.getPlaybackInfo(episode.Id);
			setPlaybackInfo(info);
			applyDefaultTracks(info.MediaSources?.[0]?.MediaStreams);
		} catch (error) {
			console.error('Failed to load episode playback info:', error);
		}
	};

	const handleToggleFavorite = async () => {
		if (!item) return;
		try {
			const newStatus = await jellyfinService.toggleFavorite(item.Id, isFavorite);
			setIsFavorite(newStatus);
			// Refresh user data so UI stays in sync
			const updated = await jellyfinService.getItem(item.Id);
			if (updated?.UserData) {
				setIsWatched(updated.UserData.Played || false);
			}
			setToastMessage(newStatus ? 'Added to favorites' : 'Removed from favorites');
		} catch (error) {
			console.error('Failed to toggle favorite:', error);
			setToastMessage('Failed to update favorite');
		}
	};

	const handleToggleWatched = async (itemId, currentWatchedState) => {
		// If called with parameters (from episode list), use those
		const targetId = itemId || item?.Id;
		const targetWatchedState = currentWatchedState !== undefined ? currentWatchedState : isWatched;
		
		if (!targetId) return;
		try {
			await jellyfinService.toggleWatched(targetId, targetWatchedState);
			
			// If this is the main item, update the state
			if (!itemId || itemId === item?.Id) {
				setIsWatched(!targetWatchedState);
			}
			
			// If it's an episode, refresh the episode list
			if (itemId && item?.Type === 'Series' && selectedSeason) {
				const updatedEpisodes = await jellyfinService.getSeasonEpisodes(item.Id, selectedSeason.Id);
				setEpisodes(updatedEpisodes);
			} else {
				// Refresh main item user data
				const refreshed = await jellyfinService.getItem(targetId);
				if (refreshed?.UserData && (!itemId || itemId === item?.Id)) {
					setIsWatched(refreshed.UserData.Played || false);
				}
			}
			setToastMessage(!targetWatchedState ? 'Marked as watched' : 'Marked as unwatched');
		} catch (error) {
			console.error('Error toggling watched status:', error);
			setToastMessage('Failed to update watched status');
		}
	};

	// Map remote back/play keys when this panel is active
	useEffect(() => {
		if (!isActive) return undefined;

		const handleKeyDown = (e) => {
			const code = e.keyCode || e.which;
			const BACK_KEYS = [KeyCodes.BACK, KeyCodes.BACK_SOFT, KeyCodes.EXIT, KeyCodes.BACKSPACE, KeyCodes.ESC];
			const PLAY_KEYS = [KeyCodes.ENTER, KeyCodes.OK, KeyCodes.SPACE, KeyCodes.PLAY, 179];

			if (BACK_KEYS.includes(code)) {
				e.preventDefault();
				onBack();
				return;
			}

			if (PLAY_KEYS.includes(code)) {
				// Avoid triggering play when user is interacting with another control
				const target = e.target;
				const interactiveTarget = target?.closest?.(
					'button, input, select, textarea, [role=\"button\"], [role=\"textbox\"], [tabindex], .spottable, [data-spotlight-id]'
				);
				const isInteractive = !!interactiveTarget;
				if (isInteractive) {
					return;
				}
				e.preventDefault();
				handlePlay();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [handlePlay, isActive, onBack]);

	// Auto-hide toast after a short delay
	useEffect(() => {
		if (!toastMessage) return undefined;
		const t = setTimeout(() => setToastMessage(''), 2000);
		return () => clearTimeout(t);
	}, [toastMessage]);

	if (!item) return null;

	const backdropUrl = (() => {
		// Prefer backdrop if available
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 1920);
		}
		// For episodes/series, try series backdrop
		if (item?.SeriesId) {
			return jellyfinService.getBackdropUrl(item.SeriesId, 0, 1920);
		}
		// Fallback to primary image to avoid 404s
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 1920);
		}
		return '';
	})();

	const audioTracks = playbackInfo?.MediaSources?.[0]?.MediaStreams
		.filter(s => s.Type === 'Audio')
		.map((track) => ({
			children: `${track.Language || 'Unknown'} - ${track.DisplayTitle || track.Codec}`,
			key: track.Index
		})) || [];

	const subtitleTracks = [
		{ children: 'None', key: -1 },
		...(playbackInfo?.MediaSources?.[0]?.MediaStreams
			.filter(s => s.Type === 'Subtitle')
			.map((track) => ({
				children: `${track.Language || 'Unknown'} - ${track.DisplayTitle || 'Subtitle'}`,
				key: track.Index
			})) || [])
	];

	const cast = item?.People?.filter(p => p.Type === 'Actor') || [];
	const directors = (item?.People || []).filter(p => p.Type === 'Director');
	const writers = (item?.People || []).filter(p => p.Type === 'Writer');
	const focusSeasonWatchedButton = (seasonCard) => {
		const watchedTarget = seasonCard?.querySelector(
			`.${css.seasonWatchedButton} .spottable, .${css.seasonWatchedButton} [tabindex], .${css.seasonWatchedButton} button`
		);
		if (watchedTarget?.focus) watchedTarget.focus();
	};

	const scrollCastIntoView = (element) => {
		if (!element || !castScrollerRef.current) return;
		const scroller = castScrollerRef.current;
		scrollElementIntoHorizontalView(scroller, element, {minBuffer: 60, edgeRatio: 0.10});
	};

	const scrollSeasonIntoView = (element) => {
		if (!element || !seasonScrollerRef.current) return;
		const scroller = seasonScrollerRef.current;
		scrollElementIntoHorizontalView(scroller, element, {minBuffer: 60, edgeRatio: 0.10});
	};

	const focusEpisodeCardByIndex = (index) => {
		const cards = Array.from(episodesListRef.current?.querySelectorAll(`.${css.episodeCard}`) || []);
		if (index >= 0 && index < cards.length) {
			cards[index].focus();
		}
	};

	const focusEpisodeSelector = () => {
		if (Spotlight?.focus?.('episode-selector-button')) return true;
		const spotlightTarget = document.querySelector('[data-spotlight-id="episode-selector-button"]');
		if (spotlightTarget?.focus) {
			spotlightTarget.focus({preventScroll: true});
			return true;
		}
		const selector = episodeSelectorButtonRef.current?.nodeRef?.current || episodeSelectorButtonRef.current;
		if (selector?.focus) {
			selector.focus({preventScroll: true});
			return true;
		}
		return false;
	};

	const focusBelowSeasons = () => {
		if (focusEpisodeSelector()) return;
		focusEpisodeCardByIndex(0);
	};

	const getAudioLabel = () => {
		const track = audioTracks.find(t => t.key === selectedAudioTrack);
		return track?.children || 'Default';
	};

	const getSubtitleLabel = () => {
		if (selectedSubtitleTrack === -1) return 'None';
		const track = subtitleTracks.find(t => t.key === selectedSubtitleTrack);
		return track?.children || 'Default';
	};

	const renderToast = () => {
		if (!toastMessage) return null;
		return (
			<div className={css.toast} role="status">
				{toastMessage}
			</div>
		);
	};

	const getSeasonImageUrl = (season) => {
		if (season?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(season.Id, 'Primary', 500);
		}
		if (season?.ImageTags?.Thumb) {
			return jellyfinService.getImageUrl(season.Id, 'Thumb', 500);
		}
		// Fallback to series backdrop if available
		if (item?.BackdropImageTags && item.BackdropImageTags.length > 0) {
			return jellyfinService.getBackdropUrl(item.Id, 0, 800);
		}
		// Fallback to series primary
		if (item?.ImageTags?.Primary) {
			return jellyfinService.getImageUrl(item.Id, 'Primary', 500);
		}
		return '';
	};

	const renderTrackPopup = (type) => {
		const isAudio = type === 'audio';
		const tracks = isAudio ? audioTracks : subtitleTracks;
		const selectedKey = isAudio ? selectedAudioTrack : selectedSubtitleTrack;
		const onSelect = (key) => {
			if (isAudio) setSelectedAudioTrack(key);
			else setSelectedSubtitleTrack(key);
		};
		const onClose = () => {
			if (isAudio) setShowAudioPicker(false);
			else setShowSubtitlePicker(false);
		};

		return (
			<Popup open={isAudio ? showAudioPicker : showSubtitlePicker} onClose={onClose} noAutoDismiss>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					Select {isAudio ? 'Audio' : 'Subtitle'} Track
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>
						{tracks.map(track => (
							<Button
								key={track.key}
								size="large"
								selected={track.key === selectedKey}
								onClick={() => {
									onSelect(track.key);
									onClose();
								}}
								className={css.popupButton}
							>
								{track.children}
							</Button>
						))}
					</div>
				</Scroller>
			</Popup>
		);
	};

	const renderEpisodePopup = () => {
		if (item.Type !== 'Series' || !episodes?.length) return null;
		return (
			<Popup open={showEpisodePicker} onClose={() => setShowEpisodePicker(false)} noAutoDismiss>
				<Heading size="medium" spacing="none" className={css.popupHeading}>
					Select Episode
				</Heading>
				<Scroller className={css.popupScroller}>
					<div className={css.popupList}>
						{episodes.map(ep => (
							<Button
								key={ep.Id}
								size="large"
								selected={selectedEpisode?.Id === ep.Id}
								onClick={() => {
									handleEpisodeClick(ep);
									setShowEpisodePicker(false);
								}}
								className={css.popupButton}
							>
								Episode {ep.IndexNumber}: {ep.Name}
							</Button>
						))}
					</div>
				</Scroller>
			</Popup>
		);
	};

	return (
		<Panel {...rest}>
			<Header title={item?.Name || 'Details'} />
			{renderToast()}
			{!loading && (
				<div className={css.backdrop}>
					<img src={backdropUrl} alt={item.Name} />
					<div className={css.gradient} />
				</div>
			)}
			<Scroller className={css.scroller}>
				<div className={css.detailsContainer}>
					{loading ? (
						<div className={css.loading}>
							<Spinner />
						</div>
					) : (
						<>
							<div className={css.content}>
								<div className={css.header}>
									<Heading size="large" className={css.title}>
										{item.Name}
									</Heading>

									{item.Type === 'Episode' && (
										<BodyText className={css.episodeInfo}>
											{item.SeriesName} - S{item.ParentIndexNumber}:E{item.IndexNumber}
										</BodyText>
									)}

									<div className={css.metadata}>
										{item.ProductionYear && (
											<div className={css.metadataItem}>{item.ProductionYear}</div>
										)}
										{item.OfficialRating && (
											<div className={css.metadataItem}>{item.OfficialRating}</div>
										)}
										{item.CommunityRating && (
											<div className={css.metadataItem}>
												<Icon size="small">star</Icon> {item.CommunityRating.toFixed(1)}
											</div>
										)}
										{item.RunTimeTicks && (
											<div className={css.metadataItem}>
												{Math.floor(item.RunTimeTicks / 600000000)} min
											</div>
										)}
										<div className={css.actionsRow}>
											<Button
												size="small"
												icon={isFavorite ? 'heart' : 'hearthollow'}
												onClick={handleToggleFavorite}
												className={`${css.actionButton} ${isFavorite ? css.activeAction : ''}`}
											/>
											<Button
												size="small"
												icon="check"
												selected={isWatched}
												onClick={() => handleToggleWatched()}
												className={`${css.actionButton} ${isWatched ? css.activeAction : ''}`}
											/>
										</div>
									</div>
									{item.Genres && item.Genres.length > 0 && (
										<div className={css.metadataItem}>
											{item.Genres.join(', ')}
										</div>
									)}
									{item.Overview && (
										<BodyText className={css.overview}>
											{item.Overview}
										</BodyText>
									)}
								</div>

								{(directors.length > 0 || writers.length > 0 || cast.length > 0) && (
									<div className={css.richMeta}>
										{directors.length > 0 && (
											<div className={css.metaGroup}>
												<BodyText className={css.metaLabel}>Director</BodyText>
												<BodyText className={css.metaValue}>{directors.map(d => d.Name).join(', ')}</BodyText>
											</div>
										)}
										{writers.length > 0 && (
											<div className={css.metaGroup}>
												<BodyText className={css.metaLabel}>Writer</BodyText>
												<BodyText className={css.metaValue}>{writers.map(w => w.Name).join(', ')}</BodyText>
											</div>
										)}
									</div>
								)}

								{cast.length > 0 && (
									<div className={css.castSection}>
										<Heading size="medium" className={css.sectionHeading}>Cast</Heading>
										<div className={css.castScroller} ref={castScrollerRef}>
											<div className={css.castRow} ref={castRowRef}>
												{cast.map(person => (
													<div
														key={person.Id}
														className={css.castCard}
														tabIndex={0}
														onFocus={(e) => scrollCastIntoView(e.currentTarget)}
														onKeyDown={(e) => {
															const cards = Array.from(castRowRef.current?.querySelectorAll(`.${css.castCard}`) || []);
															const idx = cards.indexOf(e.currentTarget);
															if (e.keyCode === 37 && idx > 0) {
																e.preventDefault();
																cards[idx - 1].focus();
															} else if (e.keyCode === 39 && idx < cards.length - 1) {
																e.preventDefault();
																cards[idx + 1].focus();
															}
														}}
													>
														<div className={css.castAvatar}>
															{person.PrimaryImageTag ? (
																<img
																	src={jellyfinService.getImageUrl(person.Id, 'Primary', 240)}
																	alt={person.Name}
																	onError={(e) => { e.target.style.display = 'none'; }}
																/>
															) : (
																<div className={css.castInitial}>{person.Name?.charAt(0) || '?'}</div>
															)}
														</div>
														<BodyText className={css.castName}>{person.Name}</BodyText>
														{person.Role && (
															<BodyText className={css.castRole}>{person.Role}</BodyText>
														)}
													</div>
												))}
											</div>
										</div>
									</div>
								)}
										{item.Type === 'Series' && seasons.length > 0 && (
											<div className={css.seriesContent}>
											<div className={css.seasonsSection}>
												<Heading size="medium" className={css.sectionHeading}>Seasons</Heading>
												<div className={css.seasonCards} ref={seasonScrollerRef}>
												{seasons.map(season => (
													<SpottableDiv
														key={season.Id}
														className={`${css.seasonCard} ${selectedSeason?.Id === season.Id ? css.selected : ''}`}
														onClick={() => handleSeasonClick(season)}
														onFocus={(e) => scrollSeasonIntoView(e.currentTarget)}
														onKeyDown={(e) => {
															if (e.keyCode === KeyCodes.ENTER || e.keyCode === KeyCodes.OK) {
																e.preventDefault();
																e.stopPropagation();
																handleSeasonClick(season);
															} else if (e.keyCode === KeyCodes.UP) {
																e.preventDefault();
																e.stopPropagation();
																focusSeasonWatchedButton(e.currentTarget);
															} else if (e.keyCode === KeyCodes.DOWN) {
																e.preventDefault();
																e.stopPropagation();
																focusBelowSeasons();
															}
														}}
													>
													<div 
														className={css.seasonWatchedButton}
														onClick={(e) => {
															e.stopPropagation();
															handleToggleWatched(season.Id, season.UserData?.Played);
														}}
													>
														<Button
															size="small"
															icon="check"
															selected={season.UserData?.Played}
															backgroundOpacity="transparent"
															onKeyDown={(e) => {
																if (e.keyCode === KeyCodes.DOWN) {
																	e.preventDefault();
																	e.stopPropagation();
																	const card = e.currentTarget.closest(`.${css.seasonCard}`);
																	if (card?.focus) card.focus();
																} else if (e.keyCode === KeyCodes.UP) {
																	e.preventDefault();
																	e.stopPropagation();
																	const card = e.currentTarget.closest(`.${css.seasonCard}`);
																	if (card?.focus) card.focus();
																}
															}}
														/>
													</div>
														<img
															src={getSeasonImageUrl(season)}
															alt={season.Name}
															className={css.seasonPoster}
															onError={(e) => {
																if (item?.ImageTags?.Primary) {
																	e.target.src = jellyfinService.getImageUrl(item.Id, 'Primary', 500);
																} else {
																	e.target.style.display = 'none';
																}
															}}
														/>
														<BodyText className={css.seasonName}>{season.Name}</BodyText>
														{season.ChildCount && (
															<BodyText className={css.episodeCount}>{season.ChildCount} Episodes</BodyText>
														)}
													</SpottableDiv>
												))}
											</div>
										</div>

										{episodes.length > 0 && selectedEpisode && (
											<div className={css.stickyControls}>
												<div className={css.controlsTitle}>
													<Button
														size="large"
														onClick={() => setShowEpisodePicker(true)}
														className={css.dropdown}
														componentRef={episodeSelectorButtonRef}
														spotlightId="episode-selector-button"
														onKeyDown={(e) => {
															if (e.keyCode === KeyCodes.DOWN) {
																e.preventDefault();
																e.stopPropagation();
																focusEpisodeCardByIndex(0);
															}
														}}
													>
														Episode {selectedEpisode.IndexNumber}: {selectedEpisode.Name}
													</Button>
												</div>

												<div className={css.trackSelectors}>
													{audioTracks.length > 0 && (
														<div className={css.trackSection}>
															<BodyText className={css.trackLabel}>Audio Track</BodyText>
															<Button
																size="large"
																onClick={() => setShowAudioPicker(true)}
																className={css.dropdown}
															>
																{getAudioLabel()}
															</Button>
														</div>
													)}

													{subtitleTracks.length > 1 && (
														<div className={css.trackSection}>
															<BodyText className={css.trackLabel}>Subtitle Track</BodyText>
															<Button
																size="large"
																onClick={() => setShowSubtitlePicker(true)}
																className={css.dropdown}
															>
																{getSubtitleLabel()}
															</Button>
														</div>
													)}
												</div>

												<Button
													size="large"
													icon="play"
													onClick={handlePlay}
												>
													Play Episode
												</Button>
											</div>
										)}

										{episodes.length > 0 && (
											<div className={css.episodesSection}>
												<Heading size="medium" className={css.sectionHeading}>Episodes</Heading>
												<div className={css.episodeCards} ref={episodesListRef}>
													{episodes.map((episode, index) => (
														<SpottableDiv
															key={episode.Id}
															className={`${css.episodeCard} ${selectedEpisode?.Id === episode.Id ? css.selected : ''}`}
															onClick={() => handleEpisodeClick(episode)}
															onKeyDown={(e) => {
																if (e.keyCode === KeyCodes.DOWN) {
																	e.preventDefault();
																	e.stopPropagation();
																	focusEpisodeCardByIndex(index + 1);
																} else if (e.keyCode === KeyCodes.UP) {
																	e.preventDefault();
																	e.stopPropagation();
																	if (index === 0) {
																		focusEpisodeSelector();
																		return;
																	}
																	focusEpisodeCardByIndex(index - 1);
																}
															}}
														>
															<div className={css.episodeImageContainer}>
																<img
																	src={jellyfinService.getImageUrl(episode.Id, 'Primary', 400)}
																	alt={episode.Name}
																	className={css.episodeImage}
																/>
															</div>
															<div className={css.episodeInfo}>
																<BodyText className={css.episodeNumber}>Episode {episode.IndexNumber}</BodyText>
																<BodyText className={css.episodeName}>{episode.Name}</BodyText>
																{episode.Overview && (
																	<BodyText className={css.episodeOverview}>{episode.Overview}</BodyText>
																)}
																{episode.RunTimeTicks && (
																	<BodyText className={css.runtime}>
																		{Math.floor(episode.RunTimeTicks / 600000000)} min
																	</BodyText>
																)}
															</div>
														</SpottableDiv>
													))}
												</div>
											</div>
										)}
									</div>
								)}

								{item.Type !== 'Series' && (
									<>
										<div className={`${css.trackSelectors} ${css.movieTracks}`}>
											{audioTracks.length > 0 && (
												<div className={css.trackSection}>
													<BodyText className={css.trackLabel}>Audio Track</BodyText>
													<Button
														size="large"
														onClick={() => setShowAudioPicker(true)}
														className={css.dropdown}
													>
														{getAudioLabel()}
													</Button>
												</div>
											)}

											{subtitleTracks.length > 1 && (
												<div className={css.trackSection}>
													<BodyText className={css.trackLabel}>Subtitle Track</BodyText>
													<Button
														size="large"
														onClick={() => setShowSubtitlePicker(true)}
														className={css.dropdown}
													>
														{getSubtitleLabel()}
													</Button>
												</div>
											)}
										</div>

										<div className={css.buttons}>
											<Button
												size="large"
												icon="play"
												onClick={handlePlay}
											>
												Play
											</Button>
											<Button
												size="large"
												onClick={handleBack}
											>
												Back
											</Button>
										</div>
										</>
								)}

								{item.Type === 'Series' && (
									<div className={css.buttons}>
										<Button
											size="large"
											onClick={onBack}
										>
											Back
										</Button>
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</Scroller>
			{renderTrackPopup('audio')}
			{renderTrackPopup('subtitle')}
			{renderEpisodePopup()}
		</Panel>
	);
};

export default MediaDetailsPanel;
