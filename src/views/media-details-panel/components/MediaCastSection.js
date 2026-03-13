import {useCallback, useEffect, useState} from 'react';
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
	onCastToggleKeyDown,
	castScrollerRef,
	castRowRef,
	onCastCardFocus,
	onCastCardKeyDown,
	onCastImageError,
	getCastImageUrl
}) => {
	const castList = Array.isArray(cast) ? cast : [];
	const [loadedCastImageKeys, setLoadedCastImageKeys] = useState(() => new Set());
	const castKeysSignature = castList.map((person) => String(person?.Id || person?.Name || '?')).join('|');

	useEffect(() => {
		setLoadedCastImageKeys(new Set());
	}, [castKeysSignature]);

	const markCastImageLoaded = useCallback((personKey) => {
		setLoadedCastImageKeys((currentKeys) => {
			if (currentKeys.has(personKey)) return currentKeys;
			const nextKeys = new Set(currentKeys);
			nextKeys.add(personKey);
			return nextKeys;
		});
	}, []);

	const handleCastImageLoad = useCallback((event) => {
		const personKey = event.currentTarget?.dataset?.castImageKey;
		if (!personKey) return;
		markCastImageLoaded(personKey);
	}, [markCastImageLoaded]);
	if (castList.length === 0) return null;

	return (
		<div className={css.castSection}>
			<SpottableDiv
				role="button"
				className={`${css.sectionHeaderRow} ${css.castToggleRow}`}
				aria-label={isCastCollapsed ? 'Show cast' : 'Hide cast'}
				title={isCastCollapsed ? 'Show cast' : 'Hide cast'}
				onClick={onToggleCastCollapsed}
				onKeyDown={onCastToggleKeyDown}
			>
				<Heading size="medium" className={`${css.sectionHeading} ${css.castToggleLabel}`}>Cast</Heading>
				<Icon className={css.castToggleIcon}>
					{isCastCollapsed ? 'arrowsmallup' : 'arrowsmalldown'}
				</Icon>
			</SpottableDiv>
			{!isCastCollapsed && (
				<div className={css.castScroller} ref={castScrollerRef}>
					<div className={css.castRow} ref={castRowRef}>
						{castList.map((person) => {
							const personKey = String(person?.Id || person?.Name || '?');
							const imageLoaded = loadedCastImageKeys.has(personKey);
							return (
								<SpottableDiv
									key={personKey}
									className={css.castCard}
									onFocus={onCastCardFocus}
									onKeyDown={onCastCardKeyDown}
								>
									<div className={css.castAvatar}>
										{person.PrimaryImageTag ? (
											<>
												<div className={css.castInitialFallback} aria-hidden="true">
													{person.Name?.charAt(0) || '?'}
												</div>
												<div
													className={`${css.castAvatarLoadingHint} ${imageLoaded ? css.castAvatarLoadingHintHidden : ''}`}
													aria-hidden="true"
												/>
												<img
													src={getCastImageUrl(person.Id)}
													alt={person.Name}
													data-cast-image-key={personKey}
													onLoad={handleCastImageLoad}
													onError={onCastImageError}
													loading="lazy"
													decoding="async"
													className={`${css.castAvatarImage} ${imageLoaded ? css.castAvatarImageLoaded : ''}`}
												/>
											</>
										) : (
											<div className={css.castInitial}>{person.Name?.charAt(0) || '?'}</div>
										)}
									</div>
									<BodyText className={css.castName}>{person.Name}</BodyText>
									{person.Role && (
										<BodyText className={css.castRole}>{person.Role}</BodyText>
									)}
								</SpottableDiv>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

export default MediaCastSection;
