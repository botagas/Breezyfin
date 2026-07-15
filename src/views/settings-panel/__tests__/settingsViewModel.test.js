import {
	DEFAULT_SETTINGS_TAB_KEY,
	SETTINGS_TABS,
	getAssSubtitleRendererControlState,
	getBitmapSubtitleRendererControlState,
	getSettingsSectionKeys,
	getSubtitleBurnInFormatsControlState,
	getWipeCacheConfirmCopy,
	isSettingsTabKey,
	isSmartSubtitleHandlingEnabled,
	isSubtitleBurnInCodecSelected,
	isSubtitleOptionSelected,
	shouldRenderSettingsSection
} from '../utils/settingsViewModel';
import {DEFAULT_SETTINGS} from '../constants';

describe('settings view model', () => {
	it('keeps diagnostics dormant by default', () => {
		expect(DEFAULT_SETTINGS.enableDiagnostics).toBe(false);
	});
	it('defines stable Settings tab order and section visibility', () => {
		expect(DEFAULT_SETTINGS_TAB_KEY).toBe('info');
		expect(SETTINGS_TABS.map((tab) => tab.key)).toEqual([
			'info',
			'home',
			'playback',
			'subtitles',
			'display',
			'about',
			'diagnostics'
		]);

		expect(getSettingsSectionKeys('info')).toEqual(['serverInfo', 'savedServers', 'account']);
		expect(getSettingsSectionKeys('subtitles')).toEqual(['subtitles', 'subtitleAppearance']);
		expect(getSettingsSectionKeys('missing')).toEqual(['serverInfo', 'savedServers', 'account']);
		expect(isSettingsTabKey('playback')).toBe(true);
		expect(isSettingsTabKey('missing')).toBe(false);
		expect(shouldRenderSettingsSection('subtitles', 'subtitleAppearance')).toBe(true);
		expect(shouldRenderSettingsSection('subtitles', 'serverInfo')).toBe(false);
	});

	it('keeps Smart Subtitle Handling enabled unless explicitly disabled', () => {
		expect(isSmartSubtitleHandlingEnabled({})).toBe(true);
		expect(isSmartSubtitleHandlingEnabled({smartSubtitleTranscoding: true})).toBe(true);
		expect(isSmartSubtitleHandlingEnabled({smartSubtitleTranscoding: false})).toBe(false);
	});

	it('enables ASS renderer selection only while Smart Subtitle Handling is active', () => {
		expect(getAssSubtitleRendererControlState(
			{smartSubtitleTranscoding: true},
			'Auto (Breezyfin Lightweight)'
		)).toEqual({
			enabled: true,
			label: 'Auto (Breezyfin Lightweight)'
		});

		expect(getAssSubtitleRendererControlState(
			{smartSubtitleTranscoding: false},
			'Auto (Breezyfin Lightweight)'
		)).toEqual({
			enabled: false,
			label: 'Manual mode'
		});
	});

	it('enables bitmap renderer selection only while Smart Subtitle Handling is active', () => {
		expect(getBitmapSubtitleRendererControlState(
			{smartSubtitleTranscoding: true},
			'Auto (libbitsub first)'
		)).toEqual({
			enabled: true,
			label: 'Auto (libbitsub first)'
		});

		expect(getBitmapSubtitleRendererControlState(
			{smartSubtitleTranscoding: false},
			'Auto (libbitsub first)'
		)).toEqual({
			enabled: false,
			label: 'Manual mode'
		});
	});

	it('keeps manual burn-in format selection inactive in Smart mode', () => {
		expect(getSubtitleBurnInFormatsControlState(
			{smartSubtitleTranscoding: true, enableSubtitleBurnIn: true},
			'ASS, SSA'
		)).toEqual({
			enabled: false,
			label: 'Managed by Smart'
		});

		expect(getSubtitleBurnInFormatsControlState(
			{smartSubtitleTranscoding: false, enableSubtitleBurnIn: true},
			'ASS, SSA'
		)).toEqual({
			enabled: true,
			label: 'ASS, SSA'
		});

		expect(getSubtitleBurnInFormatsControlState(
			{smartSubtitleTranscoding: false, enableSubtitleBurnIn: false},
			'ASS, SSA'
		)).toEqual({
			enabled: true,
			label: 'Disabled'
		});
	});

	it('normalizes popup option selected states with expected fallbacks', () => {
		expect(isSubtitleOptionSelected(
			{assSubtitleRenderer: 'jassub'},
			'assSubtitleRenderer',
			'auto',
			'jassub'
		)).toBe(true);
		expect(isSubtitleOptionSelected(
			{},
			'assSubtitleRenderer',
			'auto',
			'auto'
		)).toBe(true);
		expect(isSubtitleOptionSelected(
			{subtitleOverlayBorderStyle: 'outline'},
			'subtitleOverlayBorderStyle',
			'outline',
			'shadow'
		)).toBe(false);
	});

	it('checks selected manual subtitle burn-in formats safely', () => {
		expect(isSubtitleBurnInCodecSelected({subtitleBurnInTextCodecs: ['ass', 'srt']}, 'ass')).toBe(true);
		expect(isSubtitleBurnInCodecSelected({subtitleBurnInTextCodecs: ['ass', 'srt']}, 'ssa')).toBe(false);
		expect(isSubtitleBurnInCodecSelected({}, 'ass')).toBe(false);
	});

	it('provides stable wipe-cache confirmation copy', () => {
		expect(getWipeCacheConfirmCopy(true)).toEqual({
			title: 'Wipe Cache (Keep Login)',
			message: 'This clears cache/storage data and reloads the app, while preserving saved login session data.',
			actionLabel: 'Wipe (Keep Login) & Reload'
		});
		expect(getWipeCacheConfirmCopy(false)).toEqual({
			title: 'Wipe App Cache',
			message: 'This clears local storage, session storage, cache storage, and IndexedDB, then reloads the app.',
			actionLabel: 'Wipe & Reload'
		});
	});
});
