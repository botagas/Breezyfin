import {buildLunaCapabilityOverrides} from './lunaOverrides';
import {isWebOsRuntime} from './runtimeSignature';

export const probeRuntimeLunaCapabilityOverrides = async (timeoutMs) => {
	if (!isWebOsRuntime()) return null;
	try {
		// Lazy require to avoid pulling webOS-only modules into non-webOS execution paths.
		const LS2Request = require('@enact/webos/LS2Request')?.default;
		if (typeof LS2Request !== 'function') return null;
		const configs = await new Promise((resolve) => {
			let settled = false;
			const finish = (value) => {
				if (settled) return;
				settled = true;
				resolve(value);
			};
			const timeoutId = setTimeout(() => finish(null), timeoutMs);
			try {
				new LS2Request().send({
					service: 'luna://com.webos.service.config',
					method: 'getConfigs',
					parameters: {
						configNames: [
							'tv.model.supportDolbyVisionHDR',
							'tv.model.supportHDR'
						]
					},
					onSuccess: (response) => {
						clearTimeout(timeoutId);
						finish(response?.configs || null);
					},
					onFailure: () => {
						clearTimeout(timeoutId);
						finish(null);
					}
				});
			} catch (_) {
				clearTimeout(timeoutId);
				finish(null);
			}
		});
		return buildLunaCapabilityOverrides(configs);
	} catch (_) {
		return null;
	}
};
