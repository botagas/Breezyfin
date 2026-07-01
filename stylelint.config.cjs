module.exports = {
	customSyntax: 'postcss-less',
	rules: {
		'block-no-empty': true,
		'declaration-block-no-duplicate-properties': [true, {
			ignore: ['consecutive-duplicates-with-different-values']
		}],
		'declaration-block-no-shorthand-property-overrides': true,
		'font-family-no-duplicate-names': true,
		'function-linear-gradient-no-nonstandard-direction': true,
		'no-duplicate-selectors': true,
		'selector-pseudo-class-no-unknown': [true, {
			ignorePseudoClasses: ['global', 'local']
		}],
		'unit-no-unknown': true
	}
};
