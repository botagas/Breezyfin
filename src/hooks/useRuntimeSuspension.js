import {useEffect, useState} from 'react';

const suspensionReasons = new Set();
const listeners = new Set();

const notify = () => {
	const suspended = suspensionReasons.size > 0;
	if (typeof document !== 'undefined') {
		document.documentElement?.setAttribute('data-bf-runtime-suspended', suspended ? 'true' : 'false');
	}
	listeners.forEach((listener) => listener(suspended));
};

export const setRuntimeSuspension = (reason, suspended) => {
	const key = String(reason || '').trim();
	if (!key) return suspensionReasons.size > 0;
	const changed = suspended ? !suspensionReasons.has(key) : suspensionReasons.has(key);
	if (suspended) suspensionReasons.add(key);
	else suspensionReasons.delete(key);
	if (changed) notify();
	return suspensionReasons.size > 0;
};

export const getRuntimeSuspended = () => suspensionReasons.size > 0;

export const useRuntimeSuspended = () => {
	const [suspended, setSuspended] = useState(getRuntimeSuspended);
	useEffect(() => {
		listeners.add(setSuspended);
		setSuspended(getRuntimeSuspended());
		return () => listeners.delete(setSuspended);
	}, []);
	return suspended;
};
