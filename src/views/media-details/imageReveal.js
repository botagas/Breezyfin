import imageLoadCss from '../../components/ImageLoadReveal.module.less';
import {applyImageFormatFallbackFromEvent} from '../../utils/imageFormat';

// Image load state lives in the DOM so a loaded image never re-renders its section.
export const markImageLoaded = (image, loadedClass = imageLoadCss.imageRevealLoaded) => {
    if (!image) return;
    image.classList.add(loadedClass);
    image.parentElement
        ?.querySelector(`.${imageLoadCss.imageLoadingHint}`)
        ?.classList.add(imageLoadCss.imageLoadingHintHidden);
};

export const handleRevealImageLoad = (event) => {
    markImageLoaded(event.currentTarget);
};

export const hideFailedImage = (event) => {
    const image = event.currentTarget;
    if (applyImageFormatFallbackFromEvent(event)) return;
    image.style.display = 'none';
    markImageLoaded(image);
};

export const tryFallbackSources = (event, fallbackUrls) => {
    const image = event.currentTarget;
    if (applyImageFormatFallbackFromEvent(event)) return;
    const step = Number(image.dataset.fallbackStep || 0);
    const nextUrl = fallbackUrls[step];
    if (nextUrl) {
        image.dataset.fallbackStep = String(step + 1);
        image.src = nextUrl;
        return;
    }
    image.style.display = 'none';
    markImageLoaded(image);
};
