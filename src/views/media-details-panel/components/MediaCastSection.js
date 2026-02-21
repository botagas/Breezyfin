import Heading from '@enact/sandstone/Heading';
import Icon from '@enact/sandstone/Icon';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';
import css from '../../MediaDetailsPanel.module.less';

const SpottableDiv = Spottable('div');

const MediaCastSection = ({
	cast,
	isCastCollapsed,
	onToggleCastCollapsed,
	castScrollerRef,
	castRowRef,
	onCastCardFocus,
	onCastCardKeyDown,
	onCastImageError,
	getCastImageUrl
}) => {
	if (!Array.isArray(cast) || cast.length === 0) return null;

	return (
		<div className={css.castSection}>
			<SpottableDiv
				role="button"
				className={`${css.sectionHeaderRow} ${css.castToggleRow}`}
				aria-label={isCastCollapsed ? 'Show cast' : 'Hide cast'}
				title={isCastCollapsed ? 'Show cast' : 'Hide cast'}
				onClick={onToggleCastCollapsed}
			>
				<Heading size="medium" className={`${css.sectionHeading} ${css.castToggleLabel}`}>Cast</Heading>
				<Icon className={css.castToggleIcon}>
					{isCastCollapsed ? 'arrowsmallup' : 'arrowsmalldown'}
				</Icon>
			</SpottableDiv>
			{!isCastCollapsed && (
				<div className={css.castScroller} ref={castScrollerRef}>
					<div className={css.castRow} ref={castRowRef}>
						{cast.map((person) => (
							<div
								key={person.Id || person.Name}
								className={css.castCard}
								tabIndex={0}
								onFocus={onCastCardFocus}
								onKeyDown={onCastCardKeyDown}
							>
								<div className={css.castAvatar}>
									{person.PrimaryImageTag ? (
										<img
											src={getCastImageUrl(person.Id)}
											alt={person.Name}
											onError={onCastImageError}
											loading="lazy"
											decoding="async"
										/>
									) : (
										<div className={css.castInitial}>{person.Name?.charAt(0) || '?'}</div>
									)}
								</div>
								<BodyText className={css.castName}>{person.Name}</BodyText>
								{person.Role && (
									<BodyText className={css.castRole}>{person.Role}</BodyText>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default MediaCastSection;
