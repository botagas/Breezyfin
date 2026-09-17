import {memo} from 'react';

import Button from '../../../components/BreezyButton';
import css from '../../MediaDetailsPanel.module.less';
import PlaybackControls from './PlaybackControls';

const SeriesControls = ({
                            episode,
                            isSideways,
                            audioTracks,
                            subtitleTracks,
                            audioSummary,
                            subtitleSummary,
                            playLabel,
                            onOpenEpisodePicker,
                            onOpenAudioPicker,
                            onOpenSubtitlePicker,
                            onPlay
                        }) => (
    <div className={`${css.stickyControls} ${isSideways ? css.stickyControlsInline : ''}`}>
        <div className={css.controlsMain}>
            <Button
                size="large"
                onClick={onOpenEpisodePicker}
                className={`${css.dropdown} ${css.episodeSelectorButton}`}
                spotlightId="episode-selector-button"
                data-md-nav="episode-selector"
            >
                Episode {episode.IndexNumber}: {episode.Name}
            </Button>
        </div>
        <Button size="small" icon="play" className={css.primaryButton} onClick={onPlay}>
            {playLabel}
        </Button>
        <div className={css.controlsActions}>
            <PlaybackControls
                audioTracks={audioTracks}
                subtitleTracks={subtitleTracks}
                audioSummary={audioSummary}
                subtitleSummary={subtitleSummary}
                showPlay={false}
                onOpenAudioPicker={onOpenAudioPicker}
                onOpenSubtitlePicker={onOpenSubtitlePicker}
            />
        </div>
    </div>
);

export default memo(SeriesControls);
