import {useMemo} from 'react';

export const useToolbarActions = ({
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler,
	onBack
}) => {
	return useMemo(() => ({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		onBack
	}), [onBack, onExit, onLogout, onNavigate, onSwitchUser, registerBackHandler]);
};
