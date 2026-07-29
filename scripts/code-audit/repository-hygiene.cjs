const BACKUP_ARTIFACT_PATTERN = /(?:\.(?:bak|old|orig|rej|temp|tmp)|~)$/u;

const parseLocalLiterals = (source, sourceName = 'local hygiene configuration') => {
	let parsed;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error(`${sourceName} is not valid JSON: ${error.message}`);
	}

	if (
		!parsed ||
		!Array.isArray(parsed.literals) ||
		parsed.literals.length === 0 ||
		parsed.literals.some((literal) => typeof literal !== 'string' || !literal.trim())
	) {
		throw new Error(`${sourceName} must contain a non-empty string array named "literals".`);
	}

	return [...new Set(parsed.literals.map((literal) => literal.trim()))];
};

const findLiteralMatches = (source, literals) => {
	const normalizedSource = source.toLocaleLowerCase('en-US');
	const matches = [];

	literals.forEach((literal, patternIndex) => {
		const normalizedLiteral = literal.toLocaleLowerCase('en-US');
		let fromIndex = 0;

		while (fromIndex < normalizedSource.length) {
			const index = normalizedSource.indexOf(normalizedLiteral, fromIndex);
			if (index === -1) break;
			matches.push({index, patternIndex});
			fromIndex = index + normalizedLiteral.length;
		}
	});

	return matches;
};

module.exports = {
	BACKUP_ARTIFACT_PATTERN,
	findLiteralMatches,
	parseLocalLiterals
};
