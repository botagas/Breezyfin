import PanelPosterMediaCard from './PanelPosterMediaCard';

const PanelPosterVirtualGridItem = ({
	index,
	items,
	onVirtualItemFocusEvent,
	onItemClick,
	cardClassName,
	imageOptions,
	...itemProps
}) => {
	const item = items[index];
	if (!item) return null;
	return (
		<PanelPosterMediaCard
			{...itemProps}
			data-index={index}
			item={item}
			index={index}
			variant="landscape-grid"
			className={cardClassName}
			imageOptions={imageOptions}
			onClick={onItemClick}
			onFocus={onVirtualItemFocusEvent}
		/>
	);
};

export default PanelPosterVirtualGridItem;
