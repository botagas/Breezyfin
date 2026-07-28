import Button from '../BreezyButton';
import BodyText from '@enact/sandstone/BodyText';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import css from '../Toolbar.module.less';
import popupStyles from '../../styles/popupStyles.module.less';

const LibraryPickerSpotlightContainer = SpotlightContainerDecorator({
	enterTo: 'first',
	restrict: 'self-only'
}, 'div');

const ToolbarLibraryPicker = ({
	useElegantGlass,
	libraries,
	activeSection,
	activeLibraryId,
	onLibrarySelect,
	contentRef
}) => {
	const contentClassName = [
		popupStyles.popupSurface,
		css.libraryNativeContent,
		useElegantGlass ? css.libraryNativeContentGlass : ''
	].filter(Boolean).join(' ');

	return (
		<LibraryPickerSpotlightContainer
			spotlightId="toolbar-library-picker"
		>
			<div
				ref={contentRef}
				className={contentClassName}
				data-popup-focus-scope="true"
				role="region"
				aria-label="Library selection"
			>
				<div className={css.libraryNativeInner}>
					<BodyText className={css.libraryNativeTitle}>Libraries</BodyText>
					<div className={css.libraryNativeGrid}>
						{libraries.length === 0 && (
							<BodyText className={css.libraryNativeEmpty}>No libraries available</BodyText>
						)}
						{libraries.map((library) => (
							<Button
								key={library.Id}
								size="small"
								minWidth={false}
								data-library-id={library.Id}
								selected={activeSection === 'library' && activeLibraryId === library.Id}
								onClick={onLibrarySelect}
								spotlightId={`toolbar-library-picker-${library.Id}`}
								className={css.libraryNativeButton}
							>
								{library.Name}
							</Button>
						))}
					</div>
				</div>
			</div>
		</LibraryPickerSpotlightContainer>
	);
};

export default ToolbarLibraryPicker;
