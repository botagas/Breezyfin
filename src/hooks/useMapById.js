import { useMemo } from 'react';

export const useMapById = (items = [], keySelector = 'Id') => {
	return useMemo(() => {
		const map = new Map();
		if (!Array.isArray(items)) return map;

		items.forEach((item, index) => {
			const rawKey =
				typeof keySelector === 'function'
					? keySelector(item, index)
					: item?.[keySelector];
			if (rawKey === undefined || rawKey === null || rawKey === '') return;
			map.set(String(rawKey), item);
		});

		return map;
	}, [items, keySelector]);
};

export default useMapById;
