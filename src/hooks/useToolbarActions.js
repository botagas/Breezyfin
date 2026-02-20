import {useMemo} from 'react';

export const useToolbarActions = ({
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler
}) => {
	return useMemo(() => ({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler
	}), [onExit, onLogout, onNavigate, onSwitchUser, registerBackHandler]);
};
