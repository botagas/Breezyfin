export const runSyncPlayQueueAction = async ({action, logMessage, toastMessage, setToastMessage}) => {
	if (typeof action !== 'function') return false;
	try {
		await action();
	} catch (error) {
		console.error(logMessage, error);
		setToastMessage({message: toastMessage, severity: 'warning'});
	}
	return true;
};
