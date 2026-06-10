export const getPosterCardClassProps = (cssModule) => ({
	imageClassName: cssModule.cardImage,
	placeholderClassName: cssModule.placeholder,
	placeholderInnerClassName: cssModule.placeholderInner,
	infoClassName: cssModule.cardInfo,
	titleClassName: cssModule.cardTitle,
	subtitleClassName: cssModule.cardSubtitle
});

export const getPanelPosterCardClassProps = (cssModule) => ({
	gridCard: cssModule.gridCard,
	cardImage: cssModule.cardImage,
	placeholder: cssModule.placeholder,
	cardTitle: cssModule.cardTitle,
	cardSubtitle: cssModule.cardSubtitle,
	watchedBadge: cssModule.watchedBadge,
	progressBadge: cssModule.progressBadge,
	progressBar: cssModule.progressBar,
	progress: cssModule.progress
});
