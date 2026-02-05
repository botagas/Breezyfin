import { Panels as SandstonePanels, Panel as SandstonePanel, Header as SandstoneHeader } from '@enact/sandstone/Panels';

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(' ');

const mergeCssClass = (defaultClassName, mappedClassName) => joinClassNames(defaultClassName, mappedClassName);

export const Panels = SandstonePanels;

export const Panel = ({ css, ...rest }) => (
	<SandstonePanel
		{...rest}
		css={{
			...css,
			panel: mergeCssClass('bf-panel', css?.panel),
			body: mergeCssClass('bf-panel-body', css?.body)
		}}
	/>
);

export const Header = ({ css, ...rest }) => (
	<SandstoneHeader
		{...rest}
		css={{
			...css,
			header: mergeCssClass('bf-header', css?.header)
		}}
	/>
);
