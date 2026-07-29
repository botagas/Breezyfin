const enactConfig = require('@enact/cli/config/eslintWebpackPluginConfig');

module.exports = [
	...enactConfig,
	{
		ignores: [
			'build/**',
			'coverage/**',
			'dist/**',
			'node_modules/**'
		]
	},
	{
		// Breezyfin remains on React 18 without the React Compiler. These rules
		// describe compiler eligibility rather than runtime hook correctness.
		rules: {
			'react-hooks/preserve-manual-memoization': 'off',
			'react-hooks/refs': 'off',
			'react-hooks/set-state-in-effect': 'off'
		}
	}
];
