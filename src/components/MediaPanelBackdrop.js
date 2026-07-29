import {useCallback, useEffect, useMemo, useState} from 'react';
import {applyImageFormatFallbackFromEvent} from '../utils/imageFormat';
import {getMediaPanelBackdropUrls, uniqueImageCandidates} from '../utils/mediaItemUtils';
import {buildExternalImageVariantUrl} from '../utils/externalImageUrls';
import {usePerformanceMode} from '../hooks/usePerformanceMode';
import {getMediaBackdropProfile} from '../utils/performanceMode';
import css from './MediaPanelBackdrop.module.less';

const MediaPanelBackdrop = ({item = null, imageUrl = '', className = ''}) => {
	const performanceMode = usePerformanceMode();
	const backdropProfile = useMemo(
		() => getMediaBackdropProfile(performanceMode),
		[performanceMode]
	);
	const imageCandidates = useMemo(() => uniqueImageCandidates([
		...getMediaPanelBackdropUrls(item, backdropProfile),
		buildExternalImageVariantUrl(imageUrl, backdropProfile)
	]), [backdropProfile, imageUrl, item]);
	const candidateSignature = imageCandidates.join('|');
	const [candidateIndex, setCandidateIndex] = useState(0);
	const resolvedImageUrl = imageCandidates[candidateIndex] || '';

	useEffect(() => {
		setCandidateIndex(0);
	}, [candidateSignature]);

	const handleImageError = useCallback((event) => {
		if (applyImageFormatFallbackFromEvent(event)) return;
		setCandidateIndex((currentIndex) => currentIndex + 1);
	}, []);

	return (
		<div
			className={[css.backdrop, className].filter(Boolean).join(' ')}
			data-bf-media-panel-backdrop="true"
			data-bf-backdrop-profile={performanceMode}
			aria-hidden="true"
		>
			{resolvedImageUrl ? (
				<img
					key={resolvedImageUrl}
					className={css.image}
					src={resolvedImageUrl}
					alt=""
					onError={handleImageError}
					loading="eager"
					decoding="async"
					draggable={false}
				/>
			) : null}
			<div className={css.scrim} />
		</div>
	);
};

export default MediaPanelBackdrop;
