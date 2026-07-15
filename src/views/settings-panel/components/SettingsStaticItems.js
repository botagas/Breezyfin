import {ItemBase as SandstoneItemBase} from '@enact/sandstone/Item';
import {SwitchBase as SandstoneSwitchBase} from '@enact/sandstone/Switch';
import Skinnable from '@enact/sandstone/Skinnable';
import Spottable from '@enact/spotlight/Spottable';
import {ItemDecorator as UiItemDecorator} from '@enact/ui/Item';

const StaticItem = UiItemDecorator(Spottable(Skinnable(SandstoneItemBase)));
const StaticSwitch = Skinnable(SandstoneSwitchBase);

export const SettingsItem = StaticItem;

export const SettingsSwitchItem = ({
	children,
	disabled = false,
	onToggle,
	selected = false,
	slotAfter,
	...rest
}) => (
	<StaticItem
		{...rest}
		aria-pressed={selected}
		data-webos-voice-intent="SetToggleItem"
		disabled={disabled}
		onClick={disabled ? undefined : onToggle}
		role="button"
		selected={selected}
		slotAfter={(
			<>
				{slotAfter}
				<StaticSwitch aria-hidden disabled={disabled} selected={selected} />
			</>
		)}
	>
		{children}
	</StaticItem>
);
