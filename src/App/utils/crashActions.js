import {CRASH_RECOVERY_ACTIONS} from '../../utils/crashRecovery';

export const getCrashActionFromElement = (element) => {
	if (typeof element === 'string') {
		if (element === 'crash-action-home') return CRASH_RECOVERY_ACTIONS.HOME;
		if (element === 'crash-action-back') return CRASH_RECOVERY_ACTIONS.BACK;
		return null;
	}
	const target = element?.closest?.('[data-crash-action]');
	if (target?.dataset?.crashAction) return target.dataset.crashAction;
	const spotlightId = element?.dataset?.spotlightId ||
		element?.closest?.('[data-spotlight-id]')?.dataset?.spotlightId ||
		element?.closest?.('[spotlightId]')?.getAttribute?.('spotlightId');
	if (spotlightId === 'crash-action-home') return CRASH_RECOVERY_ACTIONS.HOME;
	if (spotlightId === 'crash-action-back') return CRASH_RECOVERY_ACTIONS.BACK;
	return null;
};
