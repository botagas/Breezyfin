import PropTypes from 'prop-types';
import ThemeDecorator from '@enact/sandstone/ThemeDecorator';
import {render} from '@testing-library/react';

const BreezyfinTestRoot = ({children, className = ''}) => (
	<div
		id="root"
		className={className}
		data-navbar-theme="elegant"
		data-performance-mode="normal"
	>
		{children}
	</div>
);

BreezyfinTestRoot.propTypes = {
	children: PropTypes.node,
	className: PropTypes.string
};

const DecoratedBreezyfinTestRoot = ThemeDecorator({
	accessible: false,
	disableFullscreen: true,
	i18n: false,
	noAutoFocus: true,
	ri: false
}, BreezyfinTestRoot);

export const renderWithBreezyfin = (ui, options = {}) => render(ui, {
	wrapper: DecoratedBreezyfinTestRoot,
	...options
});

export default renderWithBreezyfin;
