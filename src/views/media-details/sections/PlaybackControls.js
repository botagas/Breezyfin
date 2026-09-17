import {memo} from 'react';

import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';

const PlaybackControls = ({
                              audioTracks,
                              subtitleTracks,
                              audioSummary,
                              subtitleSummary,
                              playLabel,
                              playClassName,
                              withNavigation,
                              showPlay = true,
                              onOpenAudioPicker,
                              onOpenSubtitlePicker,
                              onPlay
                          }) => (
    <>
        {showPlay && (
            <Button
                size="small"
                icon="play"
                className={`${css.primaryButton} ${playClassName || ''}`}
                onClick={onPlay}
                data-md-nav={withNavigation ? 'play' : undefined}
            >
                {playLabel}
            </Button>
        )}
        {subtitleTracks.length > 1 && (
            <Button
                size="small"
                icon="subtitle"
                onClick={onOpenSubtitlePicker}
                className={`${css.compactSelectorButton} ${css.trackSelectorPrimary}`}
                aria-label={`Subtitle track ${subtitleSummary}`}
                data-md-nav={withNavigation ? 'subtitle' : undefined}
            >
                {subtitleSummary}
            </Button>
        )}
        {audioTracks.length > 0 && (
            <Button
                size="small"
                icon="speaker"
                onClick={onOpenAudioPicker}
                className={`${css.compactSelectorButton} ${css.trackSelectorPrimary}`}
                aria-label={`Audio track ${audioSummary}`}
                data-md-nav={withNavigation ? 'audio' : undefined}
            >
                {audioSummary}
            </Button>
        )}
    </>
);

export default memo(PlaybackControls);
