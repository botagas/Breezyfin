import {useEffect, useState} from 'react';

export const MEDIA_DETAILS_REVEAL_STAGES = Object.freeze({
	HIDDEN: 'hidden',
	BACKDROP: 'backdrop',
	LOGO: 'logo',
	CONTENT: 'content'
});

const BACKDROP_REVEAL_DELAY_MS = 80;
const BACKDROP_REVEAL_FALLBACK_MS = 360;
const CONTENT_REVEAL_DELAY_MS = 120;
const CONTENT_REVEAL_FALLBACK_MS = 900;

export const useMediaDetailsStagedReveal = ({
	itemId,
	loading,
	hasBackdropImage,
	isBackdropImageLoaded,
	useHeaderLogo,
	isHeaderLogoLoaded
}) => {
	const [revealStage, setRevealStage] = useState(MEDIA_DETAILS_REVEAL_STAGES.HIDDEN);

	useEffect(() => {
		if (!itemId || loading) {
			setRevealStage(MEDIA_DETAILS_REVEAL_STAGES.HIDDEN);
			return undefined;
		}
		setRevealStage(MEDIA_DETAILS_REVEAL_STAGES.BACKDROP);
		return undefined;
	}, [itemId, loading]);

	useEffect(() => {
		if (loading || revealStage !== MEDIA_DETAILS_REVEAL_STAGES.BACKDROP) return undefined;
		const backdropSettled = !hasBackdropImage || isBackdropImageLoaded;
		const timeoutMs = backdropSettled ? BACKDROP_REVEAL_DELAY_MS : BACKDROP_REVEAL_FALLBACK_MS;
		const timer = window.setTimeout(() => {
			setRevealStage((current) => (
				current === MEDIA_DETAILS_REVEAL_STAGES.BACKDROP ? MEDIA_DETAILS_REVEAL_STAGES.LOGO : current
			));
		}, timeoutMs);
		return () => window.clearTimeout(timer);
	}, [hasBackdropImage, isBackdropImageLoaded, loading, revealStage]);

	useEffect(() => {
		if (loading || revealStage !== MEDIA_DETAILS_REVEAL_STAGES.LOGO) return undefined;
		const logoSettled = !useHeaderLogo || isHeaderLogoLoaded;
		const timeoutMs = logoSettled ? CONTENT_REVEAL_DELAY_MS : CONTENT_REVEAL_FALLBACK_MS;
		const timer = window.setTimeout(() => {
			setRevealStage((current) => (
				current === MEDIA_DETAILS_REVEAL_STAGES.LOGO ? MEDIA_DETAILS_REVEAL_STAGES.CONTENT : current
			));
		}, timeoutMs);
		return () => window.clearTimeout(timer);
	}, [isHeaderLogoLoaded, loading, revealStage, useHeaderLogo]);

	const showBackdropStage = revealStage !== MEDIA_DETAILS_REVEAL_STAGES.HIDDEN;
	const showLogoStage = revealStage === MEDIA_DETAILS_REVEAL_STAGES.LOGO || revealStage === MEDIA_DETAILS_REVEAL_STAGES.CONTENT;
	const showContentStage = revealStage === MEDIA_DETAILS_REVEAL_STAGES.CONTENT;

	return {
		revealStage,
		showBackdropStage,
		showLogoStage,
		showContentStage
	};
};
