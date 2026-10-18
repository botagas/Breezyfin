import {memo, useCallback, useState} from 'react';
import Heading from '@enact/sandstone/Heading';
import Icon from '@enact/sandstone/Icon';
import BodyText from '@enact/sandstone/BodyText';
import Spottable from '@enact/spotlight/Spottable';

import jellyfinService from '../../../services/jellyfinService';
import {buildMediaListItemKey} from '../../../utils/reactKeys';
import css from '../../MediaDetailsPanel.module.less';
import {hideFailedImage} from '../imageReveal';

const SpottableDiv = Spottable('div');

const handleCastImageLoad = (event) => {
    const image = event.currentTarget;
    image.classList.add(css.castAvatarImageLoaded);
    image.previousElementSibling?.classList.add(css.castAvatarLoadingHintHidden);
};

const CastCard = memo(({person}) => {
    const initial = person.Name?.charAt(0) || '?';
    return (
        <SpottableDiv className={css.castCard} data-md-nav="cast">
            <div className={css.castAvatar}>
                {person.PrimaryImageTag ? (
                    <>
                        <div className={css.castInitialFallback} aria-hidden="true">{initial}</div>
                        <div className={css.castAvatarLoadingHint} aria-hidden="true"/>
                        <img
                            src={jellyfinService.getImageUrl(person.Id, 'Primary', 240)}
                            alt={person.Name}
                            onLoad={handleCastImageLoad}
                            onError={hideFailedImage}
                            loading="lazy"
                            decoding="async"
                            className={css.castAvatarImage}
                        />
                    </>
                ) : (
                    <div className={css.castInitial}>{initial}</div>
                )}
            </div>
            <BodyText className={css.castName}>{person.Name}</BodyText>
            {person.Role && <BodyText className={css.castRole}>{person.Role}</BodyText>}
        </SpottableDiv>
    );
});

const CastSection = ({cast}) => {
    const [collapsed, setCollapsed] = useState(false);
    const toggleCollapsed = useCallback(() => setCollapsed((current) => !current), []);

    if (cast.length === 0) return null;
    const toggleLabel = collapsed ? 'Show cast' : 'Hide cast';

    return (
        <div className={css.castSection}>
            <SpottableDiv
                role="button"
                className={`${css.sectionHeaderRow} ${css.castToggleRow}`}
                aria-label={toggleLabel}
                title={toggleLabel}
                onClick={toggleCollapsed}
                data-md-nav="cast-toggle"
            >
                <Heading size="medium" className={`${css.sectionHeading} ${css.castToggleLabel}`}>Cast</Heading>
                <Icon className={css.castToggleIcon}>{collapsed ? 'arrowsmallup' : 'arrowsmalldown'}</Icon>
            </SpottableDiv>
            {!collapsed && (
                <div className={css.castScroller}>
                    <div className={css.castRow}>
                        {cast.map((person, index) => (
                            <CastCard key={buildMediaListItemKey('cast', person, index)} person={person}/>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(CastSection);
