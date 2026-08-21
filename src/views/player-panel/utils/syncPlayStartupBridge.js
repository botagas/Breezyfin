export const createSyncPlayStartupBridge = () => {
	let startAuthoritativePlayback = null;
	let shouldBlockAutomaticStart = null;
	let reportVideoReady = null;
	let getAuthoritativePosition = null;

	return {
		shouldBlockAutomaticStart: () => Boolean(shouldBlockAutomaticStart?.()),
		reportVideoReady: () => reportVideoReady?.() ?? false,
		startAuthoritativePlayback: () => startAuthoritativePlayback?.() ?? false,
		getAuthoritativePosition: (fallbackSeconds = 0) => {
			const position = Number(getAuthoritativePosition?.());
			return Number.isFinite(position) ? Math.max(0, position) : Math.max(0, Number(fallbackSeconds) || 0);
		},
		registerStartupHandler: (handler) => {
			startAuthoritativePlayback = handler;
			return () => {
				if (startAuthoritativePlayback === handler) startAuthoritativePlayback = null;
			};
		},
		registerSyncPlayHandlers: (handlers) => {
			shouldBlockAutomaticStart = handlers?.shouldBlockAutomaticStart || null;
			reportVideoReady = handlers?.reportVideoReady || null;
			getAuthoritativePosition = handlers?.getAuthoritativePosition || null;
			return () => {
				if (shouldBlockAutomaticStart === handlers?.shouldBlockAutomaticStart) {
					shouldBlockAutomaticStart = null;
				}
				if (reportVideoReady === handlers?.reportVideoReady) {
					reportVideoReady = null;
				}
				if (getAuthoritativePosition === handlers?.getAuthoritativePosition) {
					getAuthoritativePosition = null;
				}
			};
		}
	};
};
