export const buildRuntimeDataAttributes = ({
	navbarTheme,
	animationsDisabled,
	allAnimationsDisabled,
	inputMode,
	performanceOverlayEnabled,
	runtimeCapabilities
}) => ({
	'data-bf-nav-theme': navbarTheme,
	'data-bf-animations': animationsDisabled ? 'off' : 'on',
	'data-bf-all-animations': allAnimationsDisabled ? 'off' : 'on',
	'data-bf-performance-overlay': performanceOverlayEnabled ? 'on' : 'off',
	'data-bf-input-mode': inputMode,
	'data-bf-platform-webos': runtimeCapabilities.webos ? 'on' : 'off',
	'data-bf-webos-version': runtimeCapabilities.version ?? 'unknown',
	'data-bf-webos-v6-compat': runtimeCapabilities.webosV6Compat ? 'on' : 'off',
	'data-bf-webos-v22-compat': runtimeCapabilities.webosV22Compat ? 'on' : 'off',
	'data-bf-webos-legacy': runtimeCapabilities.legacyWebOS ? 'on' : 'off',
	'data-bf-flex-gap': runtimeCapabilities.supportsFlexGap ? 'on' : 'off',
	'data-bf-aspect-ratio': runtimeCapabilities.supportsAspectRatio ? 'on' : 'off',
	'data-bf-backdrop-filter': runtimeCapabilities.supportsBackdropFilter ? 'on' : 'off'
});
