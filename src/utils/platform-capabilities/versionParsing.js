const CHROME_TO_WEBOS = [
	[120, 25],
	[108, 24],
	[94, 23],
	[87, 22],
	[79, 6],
	[68, 5],
	[53, 4],
	[38, 3],
	[34, 2],
	[26, 1]
];

export const parseMajorVersion = (value) => {
	if (value == null) return null;
	if (typeof value === 'number') {
		return Number.isFinite(value) ? Math.trunc(value) : null;
	}
	if (typeof value !== 'string') return null;
	const match = value.match(/(\d{1,3})/);
	if (!match) return null;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeWebOSVersionCandidate = (value) => {
	if (!Number.isFinite(value)) return null;
	if (value >= 7 && value <= 15) return value + 15;
	return value;
};

export const isPlausibleWebOSVersion = (value) => Number.isFinite(value) && value >= 1 && value <= 30;

export const mapChromeToWebOSVersion = (chromeVersion) => {
	for (const [chrome, webosVersion] of CHROME_TO_WEBOS) {
		if (chromeVersion >= chrome) {
			return webosVersion;
		}
	}
	return null;
};
