import {useCallback, useEffect, useMemo, useState} from 'react';
import {applyImageFormatFallbackFromEvent} from '../../../utils/imageFormat';
import PlayerLoadingOverlay from './PlayerLoadingOverlay';
import PlayerSeekFeedback from './PlayerSeekFeedback';
import PlayerSubtitleOverlay from './PlayerSubtitleOverlay';

import css from '../../PlayerPanel.module.less';

const PlayerMediaSurface = ({
	item,
	videoRef,
	onLoadedData,
	onLoadedMetadata,
	onCanPlay,
	onTimeUpdate,
	onEnded,
	onError,
	onPlaying,
	onPause,
	onClick,
	error,
	loading,
	loadingStatusMessage,
	backdropUrls = [],
	showBackdrop,
	seekFeedback,
	externalSubtitleLayerRef,
	showControls,
	subtitleCues,
	mediaSourceData,
	playbackSettings,
	diagnosticsEnabled = false
}) => {
	const [backdropIndex, setBackdropIndex] = useState(0);
	const backdropKey = useMemo(() => backdropUrls.join('|'), [backdropUrls]);
	useEffect(() => {
		setBackdropIndex(0);
	}, [backdropKey, item?.Id]);
	const backdropUrl = backdropUrls[backdropIndex] || '';
	const hasBackdrop = Boolean(backdropUrl);
	const handleBackdropError = useCallback((event) => {
		if (applyImageFormatFallbackFromEvent(event)) return;
		setBackdropIndex((currentIndex) => currentIndex + 1);
	}, []);

	return (
		<>
			<video
				ref={videoRef}
				className={`${css.video} ${error ? css.videoHidden : ''}`}
				onLoadedData={onLoadedData}
				onLoadedMetadata={onLoadedMetadata}
				onCanPlay={onCanPlay}
				onTimeUpdate={onTimeUpdate}
				onEnded={onEnded}
				onError={onError}
				onPlaying={onPlaying}
				onPause={onPause}
				onClick={onClick}
				playsInline
				preload="auto"
			/>
			{showBackdrop ? (
				<div className={`${css.errorBackdrop} ${hasBackdrop ? '' : css.errorBackdropFallback}`}>
					{hasBackdrop ? (
						<img
							key={`${item?.Id || 'unknown'}:${backdropUrl}`}
							src={backdropUrl}
							alt={item?.Name || 'Playback'}
							onError={handleBackdropError}
							loading="lazy"
							decoding="async"
							draggable={false}
						/>
					) : null}
					<div className={css.errorBackdropGradient} />
				</div>
			) : null}
			<PlayerLoadingOverlay loading={loading} label={loadingStatusMessage} />
			<PlayerSeekFeedback seekFeedback={seekFeedback} />
			<div
				ref={externalSubtitleLayerRef}
				className={css.externalSubtitleLayer}
				data-controls-visible={!loading && !error && showControls ? 'true' : 'false'}
				aria-hidden
			/>
			<PlayerSubtitleOverlay
				controlsVisible={showControls}
				cues={subtitleCues}
				diagnosticsEnabled={diagnosticsEnabled}
				mediaSource={mediaSourceData}
				settings={playbackSettings}
				videoElement={videoRef.current}
				visible={!loading && !error}
			/>
		</>
	);
};

export default PlayerMediaSurface;
