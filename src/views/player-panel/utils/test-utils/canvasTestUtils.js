/* global jest */

export const mockCanvasElementCreation = (getContextFactory = () => null) => {
	const originalCreateElement = document.createElement.bind(document);
	return jest.spyOn(document, 'createElement').mockImplementation((tagName, ...args) => {
		const element = originalCreateElement(tagName, ...args);
		if (String(tagName).toLowerCase() === 'canvas') {
			element.getContext = jest.fn(getContextFactory);
		}
		return element;
	});
};
