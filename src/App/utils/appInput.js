export const emitAppDebugEvent = (name, detail) => {
	if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof window.CustomEvent !== 'function') {
		return;
	}
	try {
		window.dispatchEvent(new CustomEvent(name, {detail}));
	} catch (_) {
		// Debug telemetry must never alter runtime behavior.
	}
};

export const isEditableTarget = (target) => {
	if (!target || target.nodeType !== 1) return false;
	if (target.isContentEditable) return true;
	const tagName = target.tagName?.toLowerCase();
	if (tagName === 'input' || tagName === 'textarea') return true;
	return Boolean(target.closest?.('input, textarea, [contenteditable="true"], [role="textbox"]'));
};
