import { useState, useEffect, useCallback } from 'react';
import Spottable from '@enact/spotlight/Spottable';
import BodyText from '@enact/sandstone/BodyText';
import {applyImageFormatFallbackFromEvent} from '../utils/imageFormat';
import imageLoadCss from './ImageLoadReveal.module.less';

const SpottableDiv = Spottable('div');

const joinClasses = (...names) => names.filter(Boolean).join(' ');

const PosterMediaCard = ({
	itemId,
	title,
	subtitle,
	imageUrl,
	imageAlt,
	className,
	imageClassName,
	placeholderClassName,
	placeholderInnerClassName,
	infoClassName,
	titleClassName,
	subtitleClassName,
	onClick,
	onKeyDown,
	onFocus,
	onPointerDown,
	overlayContent = null,
	placeholderText = '?',
	usePlaceholderClassWhenNoImage = false,
	...rest
}) => {
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageFailed, setImageFailed] = useState(false);
	const hasImage = Boolean(imageUrl);

	useEffect(() => {
		setImageLoaded(false);
		setImageFailed(false);
	}, [imageUrl]);

	const handleImageLoad = useCallback(() => {
		setImageLoaded(true);
	}, []);

	const handleImageError = useCallback((event) => {
		if (applyImageFormatFallbackFromEvent(event)) {
			setImageLoaded(false);
			return;
		}
		setImageLoaded(false);
		setImageFailed(true);
	}, []);

	const showImage = hasImage && !imageFailed;
	const showLoadingHint = showImage && !imageLoaded;
	const imageContainerClassName = joinClasses(
		imageClassName,
		((!hasImage && usePlaceholderClassWhenNoImage) || imageFailed) && placeholderClassName
	);

	return (
		<SpottableDiv
			data-item-id={itemId}
			className={className}
			onClick={onClick}
			onKeyDown={onKeyDown}
			onFocus={onFocus}
			onPointerDown={onPointerDown}
			{...rest}
		>
			<div className={imageContainerClassName}>
				{showImage ? (
					<img
						src={imageUrl}
						alt={imageAlt || title}
						className={joinClasses(
							imageLoadCss.imageReveal,
							imageLoaded && imageLoadCss.imageRevealLoaded
						)}
						onLoad={handleImageLoad}
						onError={handleImageError}
						loading="lazy"
						decoding="async"
						draggable={false}
					/>
				) : placeholderInnerClassName ? (
					<div className={placeholderInnerClassName}>
						<BodyText>{placeholderText}</BodyText>
					</div>
				) : null}
				{showLoadingHint ? (
					<div
						className={imageLoadCss.imageLoadingHint}
						aria-hidden="true"
					/>
				) : null}
				{overlayContent}
			</div>
			{infoClassName ? (
				<div className={infoClassName}>
					{title ? <BodyText className={titleClassName}>{title}</BodyText> : null}
					{subtitle ? <BodyText className={subtitleClassName}>{subtitle}</BodyText> : null}
				</div>
			) : (
				<>
					{title ? <BodyText className={titleClassName}>{title}</BodyText> : null}
					{subtitle ? <BodyText className={subtitleClassName}>{subtitle}</BodyText> : null}
				</>
			)}
		</SpottableDiv>
	);
};

export default PosterMediaCard;
