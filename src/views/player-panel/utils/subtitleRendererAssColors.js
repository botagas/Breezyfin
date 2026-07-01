export const normalizeAssColorHex = (value) => {
	const match = String(value || '').trim().match(/^&H([0-9a-f]+)&?$/i);
	if (!match) return null;
	const hex = match[1].padStart(6, '0').toUpperCase();
	const color = hex.length > 6 ? hex.slice(-6) : hex;
	const alphaHex = hex.length > 6 ? hex.slice(0, hex.length - 6).slice(-2) : '00';
	const blue = parseInt(color.slice(0, 2), 16);
	const green = parseInt(color.slice(2, 4), 16);
	const red = parseInt(color.slice(4, 6), 16);
	const alpha = parseInt(alphaHex, 16);
	if ([red, green, blue, alpha].some((part) => !Number.isFinite(part))) return null;
	const opacity = Math.max(0, Math.min(1, 1 - (alpha / 255)));
	return opacity >= 0.995
		? `rgb(${red}, ${green}, ${blue})`
		: `rgba(${red}, ${green}, ${blue}, ${opacity.toFixed(3)})`;
};

export const applyAssAlphaToColor = (color, alphaValue) => {
	const alphaMatch = String(alphaValue || '').trim().match(/^&H([0-9a-f]{1,2})&?$/i);
	if (!color || !alphaMatch) return color;
	const alpha = parseInt(alphaMatch[1], 16);
	if (!Number.isFinite(alpha)) return color;
	const opacity = Math.max(0, Math.min(1, 1 - (alpha / 255)));
	const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
	const rgbaMatch = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),/i);
	const match = rgbMatch || rgbaMatch;
	return match ? `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity.toFixed(3)})` : color;
};
