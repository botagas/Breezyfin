export const createSyncPlayStartupBridge = () => {
	let startAuthoritativePlayback = null;
	let shouldBlockAutomaticStart = null;
	let reportVideoReady = null;

	return {
		shouldBlockAutomaticStart: () => Boolean(shouldBlockAutomaticStart?.()),
		reportVideoReady: () => reportVideoReady?.() ?? false,
		startAuthoritativePlayback: () => startAuthoritativePlayback?.() ?? false,
		registerStartupHandler: (handler) => {
			startAuthoritativePlayback = handler;
			return () => {
				if (startAuthoritativePlayback === handler) startAuthoritativePlayback = null;
			};
		},
		registerSyncPlayHandlers: (handlers) => {
			shouldBlockAutomaticStart = handlers?.shouldBlockAutomaticStart || null;
			reportVideoReady = handlers?.reportVideoReady || null;
			return () => {
				if (shouldBlockAutomaticStart === handlers?.shouldBlockAutomaticStart) {
					shouldBlockAutomaticStart = null;
				}
				if (reportVideoReady === handlers?.reportVideoReady) {
					reportVideoReady = null;
				}
			};
		}
	};
};
