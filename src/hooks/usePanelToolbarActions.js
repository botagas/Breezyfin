import {useCallback} from 'react';

import {usePanelBackHandler} from './usePanelBackHandler';
import {useToolbarActions} from './useToolbarActions';
import {useToolbarBackHandler} from './useToolbarBackHandler';

export const usePanelToolbarActions = ({
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	isActive = false,
	onPanelBack = null
}) => {
	const {
		registerToolbarBackHandler,
		runToolbarBackHandler
	} = useToolbarBackHandler();

	const handleInternalBack = useCallback(() => {
		if (typeof onPanelBack === 'function') {
			const handled = onPanelBack();
			if (handled === true) return true;
		}
		return runToolbarBackHandler();
	}, [onPanelBack, runToolbarBackHandler]);

	usePanelBackHandler(registerBackHandler, handleInternalBack, {enabled: isActive});

	return useToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler: registerToolbarBackHandler
	});
};
