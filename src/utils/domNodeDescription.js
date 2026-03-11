export const describeDomNode = (node) => {
	if (!node || typeof node !== 'object') return '(none)';
	const element = node;
	const tag = element.tagName ? element.tagName.toLowerCase() : 'node';
	const idPart = element.id ? `#${element.id}` : '';
	const className = typeof element.className === 'string' ? element.className.trim() : '';
	const classPart = className ? `.${className.split(/\s+/).slice(0, 2).join('.')}` : '';
	const spotlightId = element.getAttribute?.('data-spotlight-id');
	const role = element.getAttribute?.('role');
	const spotlightPart = spotlightId ? ` [spotlight=${spotlightId}]` : '';
	const rolePart = role ? ` [role=${role}]` : '';
	return `${tag}${idPart}${classPart}${spotlightPart}${rolePart}`;
};

