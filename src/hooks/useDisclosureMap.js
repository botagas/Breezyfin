import { useCallback, useState } from 'react';

const normalizeBooleanMap = (source = {}) => {
	const next = {};
	Object.entries(source).forEach(([key, value]) => {
		next[key] = value === true;
	});
	return next;
};

export const useDisclosureMap = (initialState = {}) => {
	const [disclosures, setDisclosures] = useState(() => normalizeBooleanMap(initialState));

	const setDisclosure = useCallback((key, isOpen) => {
		if (!key) return;
		setDisclosures((previous) => {
			const nextOpen = isOpen === true;
			if (previous[key] === nextOpen) return previous;
			return {
				...previous,
				[key]: nextOpen
			};
		});
	}, []);

	const openDisclosure = useCallback((key) => {
		setDisclosure(key, true);
	}, [setDisclosure]);

	const closeDisclosure = useCallback((key) => {
		setDisclosure(key, false);
	}, [setDisclosure]);

	const closeAllDisclosures = useCallback((keys = null) => {
		setDisclosures((previous) => {
			const targetKeys = Array.isArray(keys) ? keys : Object.keys(previous);
			let changed = false;
			const next = {...previous};
			targetKeys.forEach((key) => {
				if (next[key] === true) {
					next[key] = false;
					changed = true;
				}
			});
			return changed ? next : previous;
		});
	}, []);

	return {
		disclosures,
		openDisclosure,
		closeDisclosure,
		setDisclosure,
		closeAllDisclosures
	};
};

