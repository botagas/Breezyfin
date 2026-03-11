const LoginBackdropLayer = ({
	css,
	imageLoadCss,
	isBackdropTransitioning,
	previousBackdropUrl,
	currentBackdropUrl,
	backdropImageErrors,
	previousBackdropLoaded,
	currentBackdropLoaded,
	onBackdropLoad,
	onBackdropError
}) => (
	<div className={css.backdropLayer} aria-hidden="true">
		{isBackdropTransitioning && previousBackdropUrl && !backdropImageErrors[previousBackdropUrl] ? (
			<img
				src={previousBackdropUrl}
				alt=""
				data-bf-src-key={previousBackdropUrl}
				className={`${css.backdropImage} ${css.backdropImageOutgoing} ${previousBackdropLoaded ? '' : css.backdropImageHidden}`}
				onLoad={onBackdropLoad}
				onError={onBackdropError}
				loading="lazy"
				decoding="async"
				draggable={false}
			/>
		) : null}
		{currentBackdropUrl && !backdropImageErrors[currentBackdropUrl] ? (
			<img
				src={currentBackdropUrl}
				alt=""
				data-bf-src-key={currentBackdropUrl}
				className={`${css.backdropImage} ${isBackdropTransitioning ? css.backdropImageIncoming : css.backdropImageCurrent} ${currentBackdropLoaded ? '' : css.backdropImageHidden}`}
				onLoad={onBackdropLoad}
				onError={onBackdropError}
				loading="lazy"
				decoding="async"
				draggable={false}
			/>
		) : null}
		{currentBackdropUrl && !backdropImageErrors[currentBackdropUrl] && !currentBackdropLoaded ? (
			<div className={`${imageLoadCss.imageLoadingHint} ${css.backdropLoadingHint}`} aria-hidden="true" />
		) : null}
		<div className={css.backdropGradient} />
	</div>
);

export default LoginBackdropLayer;
