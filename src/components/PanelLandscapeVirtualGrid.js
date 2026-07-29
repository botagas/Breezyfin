import MediaVirtualGrid, {MEDIA_VIRTUAL_GRID_VARIANTS} from './MediaVirtualGrid';
import PanelPosterVirtualGridItem from './PanelPosterVirtualGridItem';

const PanelLandscapeVirtualGrid = ({
	id,
	focusedItemIdRef,
	focusFirstItemRef,
	...rest
}) => (
	<MediaVirtualGrid
		{...rest}
		id={id}
		spotlightId={id}
		variant={MEDIA_VIRTUAL_GRID_VARIANTS.LANDSCAPE}
		itemRenderer={PanelPosterVirtualGridItem}
		restoreItemId={focusedItemIdRef?.current || null}
		focusFirstItem={focusFirstItemRef?.current === true}
		focusedItemIdRef={focusedItemIdRef}
		focusFirstItemRef={focusFirstItemRef}
	/>
);

export default PanelLandscapeVirtualGrid;
