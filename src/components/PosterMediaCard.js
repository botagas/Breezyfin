import Spottable from '@enact/spotlight/Spottable';
import BodyText from '@enact/sandstone/BodyText';
import { useImageErrorFallback } from '../hooks/useImageErrorFallback';

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
	overlayContent = null,
	placeholderText = '?',
	usePlaceholderClassWhenNoImage = false,
	...rest
}) => {
	const handleImageError = useImageErrorFallback(placeholderClassName);
	const hasImage = Boolean(imageUrl);
	const imageContainerClassName = joinClasses(
		imageClassName,
		!hasImage && usePlaceholderClassWhenNoImage && placeholderClassName
	);

	return (
		<SpottableDiv
			data-item-id={itemId}
			className={className}
			onClick={onClick}
			onKeyDown={onKeyDown}
			onFocus={onFocus}
			{...rest}
		>
			<div className={imageContainerClassName}>
				{hasImage ? (
					<img
						src={imageUrl}
						alt={imageAlt || title}
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
