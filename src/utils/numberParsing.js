export const toInteger = (value) => {
	if (Number.isInteger(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isInteger(parsed) ? parsed : null;
	}
	return null;
};

