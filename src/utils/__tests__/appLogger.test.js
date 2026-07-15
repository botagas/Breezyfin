describe('app logger diagnostics policy', () => {
	let logger;
	let warnSpy;
	let infoSpy;

	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();
		localStorage.clear();
		warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
		logger = require('../appLogger');
		logger.clearAppLogs();
	});

	afterEach(() => {
		logger.configureAppDiagnostics({enabled: false, verbose: false});
		warnSpy.mockRestore();
		infoSpy.mockRestore();
		jest.useRealTimers();
	});

	it('keeps ordinary console traffic dormant while retaining critical records', () => {
		logger.configureAppDiagnostics({enabled: false, verbose: true});
		console.warn('ordinary warning');
		logger.appendCriticalAppLog('error', 'critical failure');
		expect(logger.getAppLogs().map((entry) => entry.message)).toEqual(['critical failure']);
	});

	it('captures warn and error only when diagnostics is enabled', () => {
		logger.configureAppDiagnostics({enabled: true, verbose: false});
		console.warn('captured warning');
		console.info('ignored info');
		logger.flushAppLogs();
		expect(logger.getAppLogs().map((entry) => entry.message)).toEqual(['captured warning']);
	});

	it('adds log and info capture only in verbose mode and restores console on disable', () => {
		logger.configureAppDiagnostics({enabled: true, verbose: true});
		const patchedInfo = console.info;
		console.info('verbose info');
		logger.configureAppDiagnostics({enabled: false, verbose: true});
		expect(console.info).not.toBe(patchedInfo);
		console.info('not captured after disable');
		expect(logger.getAppLogs().map((entry) => entry.message)).toEqual(['verbose info']);
	});

	it('does not wrap console more than once when diagnostics is reconfigured', () => {
		const nativeWarn = console.warn;
		logger.configureAppDiagnostics({enabled: true, verbose: false});
		const patchedWarn = console.warn;
		logger.configureAppDiagnostics({enabled: true, verbose: true});
		expect(console.warn).toBe(patchedWarn);
		logger.configureAppDiagnostics({enabled: false, verbose: false});
		expect(console.warn).toBe(nativeWarn);
	});

	it('redacts secrets before native console output and persistence', () => {
		logger.configureAppDiagnostics({enabled: true, verbose: false});
		console.warn('request', {
			ApiKey: 'native-secret',
			url: 'https://example.test/video?api_key=url-secret'
		});
		logger.flushAppLogs();
		const nativeOutput = JSON.stringify(warnSpy.mock.calls);
		const persistedOutput = JSON.stringify(logger.getAppLogs());
		expect(nativeOutput).not.toContain('native-secret');
		expect(nativeOutput).not.toContain('url-secret');
		expect(persistedOutput).not.toContain('native-secret');
		expect(persistedOutput).not.toContain('url-secret');
	});

	it('honors the absolute persistent-logging disable for critical records', () => {
		const previousDisableValue = process.env.REACT_APP_DISABLE_PERSISTENT_LOGS;
		logger.configureAppDiagnostics({enabled: false, verbose: false});
		process.env.REACT_APP_DISABLE_PERSISTENT_LOGS = '1';
		jest.resetModules();
		const disabledLogger = require('../appLogger');

		disabledLogger.appendCriticalAppLog('error', 'must not persist');
		expect(disabledLogger.getAppLogs()).toEqual([]);

		if (previousDisableValue === undefined) {
			delete process.env.REACT_APP_DISABLE_PERSISTENT_LOGS;
		} else {
			process.env.REACT_APP_DISABLE_PERSISTENT_LOGS = previousDisableValue;
		}
		jest.resetModules();
		logger = require('../appLogger');
	});
});
