import {useMemo} from 'react';

export const useDisclosureHandlers = (keys, openDisclosure, closeDisclosure) => {
	return useMemo(() => {
		const handlers = {};
		keys.forEach((key) => {
			handlers[key] = {
				open: () => openDisclosure(key),
				close: () => closeDisclosure(key)
			};
		});
		return handlers;
	}, [closeDisclosure, keys, openDisclosure]);
};
