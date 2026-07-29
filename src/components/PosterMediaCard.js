import {memo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import BodyText from '@enact/sandstone/BodyText';
import {
	POSTER_MEDIA_CARD_VARIANTS,
	normalizePosterMediaCardVariant
} from '../utils/posterMediaCardVariants';
import MediaCardStatusOverlay from './MediaCardStatusOverlay';
import MediaCardImage from './MediaCardImage';
import css from './PosterMediaCard.module.less';

const SpottableDiv = Spottable('div');

const joinClasses = (...names) => names.filter(Boolean).join(' ');

const PosterMediaCard = ({
	itemId,
	title,
	subtitle,
	imageUrl,
	imageCandidates = null,
	imageAlt,
	className,
	variant = POSTER_MEDIA_CARD_VARIANTS.POSTER_GRID,
	onClick,
	onKeyDown,
	onFocus,
	onPointerDown,
	onMouseDown,
	spotlightDisabled = false,
	overlayContent = null,
	showWatched = false,
	watchedContent = '\u2713',
	watchedVariant = 'watched',
	progressPercent = null,
	contextBadge = '',
	contextBadgeExtras = null,
	ariaLabel,
	placeholderText = 'No Image',
	spottable = true,
	...rest
}) => {
	const resolvedImageCandidates = Array.isArray(imageCandidates)
		? imageCandidates
		: imageUrl ? [imageUrl] : [];
	const normalizedVariant = normalizePosterMediaCardVariant(variant);
	const variantClassName = normalizedVariant === POSTER_MEDIA_CARD_VARIANTS.LANDSCAPE_GRID
		? css.landscapeGrid
		: css.posterGrid;
	const imageContainerClassName = joinClasses(
		css.image,
		resolvedImageCandidates.length === 0 && css.placeholder
	);
	const RootComponent = spottable ? SpottableDiv : 'div';
	const rootProps = {
		'data-item-id': itemId,
		'data-card-variant': normalizedVariant,
		'aria-label': ariaLabel || [title, subtitle, typeof contextBadge === 'string' ? contextBadge : ''].filter(Boolean).join(' - '),
		className: joinClasses(css.card, variantClassName, className),
		onClick,
		onKeyDown,
		onFocus,
		onPointerDown,
		onMouseDown,
		...rest
	};
	if (spottable) {
		rootProps.spotlightDisabled = spotlightDisabled;
	}

	return (
		<RootComponent {...rootProps}>
			<div className={imageContainerClassName}>
				<MediaCardImage
					candidates={resolvedImageCandidates}
					alt={imageAlt || title}
					width={normalizedVariant === POSTER_MEDIA_CARD_VARIANTS.LANDSCAPE_GRID ? 640 : 400}
					height={normalizedVariant === POSTER_MEDIA_CARD_VARIANTS.LANDSCAPE_GRID ? 360 : 600}
					loading="eager"
					placeholder={(
						<div className={css.placeholderInner}>
							<BodyText>{placeholderText}</BodyText>
						</div>
					)}
				/>
				<MediaCardStatusOverlay
					showWatched={showWatched}
					watchedContent={watchedContent}
					watchedClassName={watchedVariant === 'progress' ? css.progressBadge : css.watchedBadge}
					progressPercent={progressPercent}
					progressBarClassName={css.progressBar}
					progressClassName={css.progress}
				>
					{contextBadge || contextBadgeExtras ? (
							<div className={css.contextBadgeStack}>
								{contextBadge ? <span className={css.contextBadge}>{contextBadge}</span> : null}
								{contextBadgeExtras}
							</div>
					) : null}
					{overlayContent}
				</MediaCardStatusOverlay>
			</div>
			<div className={css.info}>
				{title ? <BodyText className={css.title}>{title}</BodyText> : null}
				{subtitle ? <BodyText className={css.subtitle}>{subtitle}</BodyText> : null}
			</div>
		</RootComponent>
	);
};

export default memo(PosterMediaCard);
