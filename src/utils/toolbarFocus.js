import Spotlight from '@enact/spotlight';

const focusNode = (node) => {
	if (!node?.focus) return false;
	try {
		node.focus({preventScroll: true});
	} catch (_) {
		node.focus();
	}
	return true;
};

export const focusToolbarSpotlightTargets = (spotlightIds = []) => {
	for (const spotlightId of spotlightIds) {
		if (!spotlightId) continue;
		if (Spotlight?.focus?.(spotlightId)) return true;
		const node = document.querySelector?.(`[data-spotlight-id="${spotlightId}"]`);
		if (focusNode(node)) return true;
	}
	return false;
};

