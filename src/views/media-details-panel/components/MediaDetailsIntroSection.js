import Heading from '@enact/sandstone/Heading';
import BodyText from '@enact/sandstone/BodyText';
import Icon from '@enact/sandstone/Icon';
import Button from '../../../components/BreezyButton';
import MediaTrackSelectorRow from './MediaTrackSelectorRow';
import css from '../../MediaDetailsPanel.module.less';

const MediaDetailsIntroSection = ({
	details,
	media,
	actions,
	refs
}) => {
	const {
		item,
		pageTitle,
		isElegantTheme,
		useHeaderLogo,
		headerLogoUrl,
		headerTitle,
		hasCreatorCredits,
		directorNames,
		writerNames,
		isFavorite,
		isWatched,
		hasOverviewText,
		overviewExpanded,
		hasOverviewOverflow,
		overviewPlayLabel
	} = details;
	const {
		audioTracks,
		subtitleTracks,
		audioSummary,
		subtitleSummary
	} = media;
	const {
		onBack,
		onOpenEpisodeSeries,
		onOpenEpisodePicker,
		onHeaderLogoError,
		renderCreditNames,
		onToggleFavorite,
		onToggleWatchedMain,
		onOverviewActivate,
		onOpenAudioPicker,
		onOpenSubtitlePicker,
		onAudioSelectorKeyDown,
		onSubtitleSelectorKeyDown,
		onPlay,
		onNonSeriesPlayKeyDown,
		showSectionHints,
		onIntroActionKeyDown,
		onIntroTopNavKeyDown
	} = actions;
	const {
		firstSectionRef,
		favoriteActionButtonRef,
		watchedActionButtonRef,
		overviewTextRef,
		audioSelectorButtonRef,
		subtitleSelectorButtonRef,
		playPrimaryButtonRef
	} = refs;

	if (!item) return null;

	return (
		<div className={css.firstSection} ref={firstSectionRef}>
			<div className={css.detailsHeadingStack}>
				<div className={css.detailsTopBar}>
					<Button
						size="small"
						icon="arrowsmallleft"
						onClick={onBack}
						onKeyDown={onIntroTopNavKeyDown}
						onKeyDownCapture={onIntroTopNavKeyDown}
						className={css.detailsBackButton}
						aria-label="Back"
						data-bf-md-nav="back"
					/>
					<BodyText className={css.detailsTopTitle}>{pageTitle}</BodyText>
				</div>
				{item.Type === 'Episode' && (
					<div className={css.episodeBreadcrumb}>
						<div className={css.episodeNavActions}>
							<Button
								size="small"
								className={`${css.episodeNavButton} ${css.episodeSeriesButton}`}
								onClick={onOpenEpisodeSeries}
								onKeyDown={onIntroTopNavKeyDown}
								onKeyDownCapture={onIntroTopNavKeyDown}
								data-bf-md-nav="breadcrumb"
							>
								{item.SeriesName}
							</Button>
							<span className={css.breadcrumbDivider} aria-hidden="true">/</span>
							{item.ParentIndexNumber !== undefined && item.ParentIndexNumber !== null && (
								<>
									<Button
										size="small"
										className={css.episodeNavButton}
										onClick={onOpenEpisodeSeries}
										onKeyDown={onIntroTopNavKeyDown}
										onKeyDownCapture={onIntroTopNavKeyDown}
										data-bf-md-nav="breadcrumb"
									>
										Season {item.ParentIndexNumber}
									</Button>
									<span className={css.breadcrumbDivider} aria-hidden="true">/</span>
								</>
							)}
							<Button
								size="small"
								className={`${css.episodeNavButton} ${css.episodeCurrentButton}`}
								onClick={onOpenEpisodePicker}
								onKeyDown={onIntroTopNavKeyDown}
								onKeyDownCapture={onIntroTopNavKeyDown}
								data-bf-md-nav="breadcrumb"
							>
								Episode {item.IndexNumber}
							</Button>
						</div>
					</div>
				)}
			</div>
			<div className={`${css.introSection} ${isElegantTheme ? css.introSectionElegant : ''}`}>
				<div className={css.introContent}>
					<div className={css.introTopSpacer} />
					<div className={css.introHeaderRow}>
						<div className={css.pageHeader}>
							{useHeaderLogo ? (
								<div className={css.headerLogoWrap}>
									<img
										src={headerLogoUrl}
										alt={item?.Name || 'Details'}
										className={css.headerLogo}
										onError={onHeaderLogoError}
									/>
								</div>
							) : (
								<Heading size="large" className={css.pageHeaderTitle}>
									{headerTitle}
								</Heading>
							)}
						</div>
						{hasCreatorCredits && (
							<div className={css.introCredits}>
								{directorNames.length > 0 && (
									<BodyText className={css.creditLine}>
										<span className={css.creditLabel}>Directed by</span>
										<span className={css.creditNames}>
											{renderCreditNames(directorNames, 'director')}
										</span>
									</BodyText>
								)}
								{writerNames.length > 0 && (
									<BodyText className={css.creditLine}>
										<span className={css.creditLabel}>Written by</span>
										<span className={css.creditNames}>
											{renderCreditNames(writerNames, 'writer')}
										</span>
									</BodyText>
								)}
							</div>
						)}
					</div>
					<div className={css.header}>
						<div className={css.metadataRow}>
							<div className={css.metadata}>
								{item.ProductionYear && (
									<div className={css.metadataItem}>{item.ProductionYear}</div>
								)}
								{item.OfficialRating && (
									<div className={`${css.metadataItem} ${css.metadataRating}`}>{item.OfficialRating}</div>
								)}
								{item.CommunityRating && (
									<div className={`${css.metadataItem} ${css.metadataScore}`}>
										<Icon size="small" className={css.ratingStar}>star</Icon> {item.CommunityRating.toFixed(1)}
									</div>
								)}
								{item.RunTimeTicks && (
									<div className={css.metadataItem}>
										{Math.floor(item.RunTimeTicks / 600000000)} min
									</div>
								)}
								{item.Genres && item.Genres.length > 0 && (
									<div className={`${css.metadataItem} ${css.metadataItemWide}`}>
										{item.Genres.join(', ')}
									</div>
								)}
							</div>
							<div className={css.actionsRow}>
								<Button
									size="small"
									icon={isFavorite ? 'heart' : 'hearthollow'}
									onClick={onToggleFavorite}
									onKeyDown={onIntroActionKeyDown}
									css={{icon: css.actionIcon}}
									componentRef={favoriteActionButtonRef}
									spotlightId="details-favorite-action"
									className={`${css.actionButton} ${css.favoriteAction} ${isFavorite ? css.favoriteActive : ''}`}
									title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
								/>
								<Button
									size="small"
									icon="check"
									onClick={onToggleWatchedMain}
									onKeyDown={onIntroActionKeyDown}
									css={{icon: css.actionIcon}}
									componentRef={watchedActionButtonRef}
									spotlightId="details-watched-action"
									className={`${css.actionButton} ${css.watchedAction} ${isWatched ? css.watchedActive : ''}`}
									title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
								/>
							</div>
						</div>
						<div className={css.overviewBlock}>
							{hasOverviewText ? (
								<div
									ref={overviewTextRef}
									className={`${css.overview} ${isElegantTheme && !overviewExpanded ? css.overviewCollapsed : ''} ${isElegantTheme && hasOverviewOverflow ? css.overviewInteractive : ''}`}
									onClick={onOverviewActivate}
									onKeyDown={onOverviewActivate}
									role={isElegantTheme && hasOverviewOverflow ? 'button' : undefined}
									tabIndex={isElegantTheme && hasOverviewOverflow ? 0 : undefined}
									aria-expanded={isElegantTheme && hasOverviewOverflow ? overviewExpanded : undefined}
									aria-label={isElegantTheme && hasOverviewOverflow ? (overviewExpanded ? 'Collapse description' : 'Expand description') : undefined}
								>
									<span className={css.overviewText}>{item.Overview}</span>
								</div>
							) : (
								<BodyText className={`${css.overview} ${css.overviewMissing}`}>
									No description available.
								</BodyText>
							)}
							<div className={css.introControlsRow}>
								<MediaTrackSelectorRow
									audioTracks={audioTracks}
									subtitleTracks={subtitleTracks}
									onOpenAudioPicker={onOpenAudioPicker}
									onOpenSubtitlePicker={onOpenSubtitlePicker}
									audioSummary={audioSummary}
									subtitleSummary={subtitleSummary}
									audioSelectorButtonRef={audioSelectorButtonRef}
									subtitleSelectorButtonRef={subtitleSelectorButtonRef}
									onAudioSelectorKeyDown={onAudioSelectorKeyDown}
									onSubtitleSelectorKeyDown={onSubtitleSelectorKeyDown}
								/>
								<Button
									size="small"
									icon="play"
									className={`${css.primaryButton} ${css.overviewPlayButton} ${css.introPlayButton}`}
									onClick={onPlay}
									componentRef={playPrimaryButtonRef}
									onKeyDown={onNonSeriesPlayKeyDown}
								>
									{overviewPlayLabel}
								</Button>
								{showSectionHints && (
									<BodyText className={css.sectionHint}>
										More
										<Icon className={css.sectionHintArrow}>arrowsmalldown</Icon>
									</BodyText>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default MediaDetailsIntroSection;
