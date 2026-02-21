import {useMemo} from 'react';

// Builds stable open/close handlers keyed by disclosure id to avoid panel-level callback boilerplate.
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
