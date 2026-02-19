const toPlaybackProgressPercent = (value) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return null;
	if (numeric <= 0 || numeric >= 100) return null;
	return Math.max(0, Math.min(100, numeric));
};

const MediaCardStatusOverlay = ({
	showWatched = false,
	watchedContent = '\u2713',
	watchedClassName = '',
	progressPercent = null,
	progressBarClassName = '',
	progressClassName = '',
	children = null
}) => {
	const safeProgress = toPlaybackProgressPercent(progressPercent);
	const hasProgress = safeProgress !== null;

	return (
		<>
			{children}
			{showWatched && watchedClassName ? (
				<div className={watchedClassName}>{watchedContent}</div>
			) : null}
			{hasProgress && progressBarClassName && progressClassName ? (
				<div className={progressBarClassName}>
					<div className={progressClassName} style={{width: `${safeProgress}%`}} />
				</div>
			) : null}
		</>
	);
};

export default MediaCardStatusOverlay;
