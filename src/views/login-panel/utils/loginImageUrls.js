export {
	buildItemImageUrl,
	buildUserPrimaryImageUrl,
	getFirstImageTag,
	normalizeImageTag
} from '../../../utils/imageUrls';

export const LOGIN_BACKDROP_ITEM_LIMIT = 40;
export const LOGIN_BACKDROP_WIDTH = 1920;
export const LOGIN_BACKDROP_MAX_IMAGES = 24;
export const LOGIN_BACKDROP_ROTATE_INTERVAL_MS = 9000;
export const LOGIN_BACKDROP_TRANSITION_MS = 500;
export const LOGIN_BACKDROP_IMAGE_FIELDS = [
	'BackdropImageTags',
	'ImageTags',
	'PrimaryImageTag',
	'SeriesId',
	'SeriesPrimaryImageTag',
	'ParentBackdropItemId',
	'ParentBackdropImageTags'
].join(',');
