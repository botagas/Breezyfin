import {useCallback, useState} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import {InputField} from '@enact/sandstone/Input';

import Button from '../../../components/BreezyButton';
import {KeyCodes} from '../../../utils/keyCodes';
import {normalizeHexColor} from '../../../utils/subtitleAppearance';
import css from '../../SettingsPanel.module.less';

const SubtitleCustomColorField = ({initialHex = '', onApply}) => {
    const [draft, setDraft] = useState(initialHex);
    const invalid = draft !== '' && !normalizeHexColor(draft);

    const handleChange = useCallback(({value}) => setDraft(value), []);
    const apply = useCallback(() => onApply(draft), [draft, onApply]);
    const handleKeyDown = useCallback((event) => {
        if (event.keyCode === KeyCodes.ENTER) apply();
    }, [apply]);

    return (
        <div className={css.popupCustomColor}>
            <BodyText className={css.popupMessage}>Custom color (hex RRGGBB or RGB)</BodyText>
            <div className={css.popupNumericActions}>
                <InputField
                    value={draft}
                    placeholder="RRGGBB"
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    invalid={invalid}
                    invalidMessage="Enter 3 or 6 hex digits"
                    maxLength={7}
                />
                <Button className={css.popupOption} onClick={apply} disabled={!normalizeHexColor(draft)}>
                    Apply
                </Button>
            </div>
        </div>
    );
};

export default SubtitleCustomColorField;