export const PLAYER_REVEAL_TOP_EDGE_PX = 120;
export const PLAYER_REVEAL_BOTTOM_EDGE_PX = 160;

export const shouldRevealControlsForPointerY = (
	clientY,
	{
		viewportHeight,
		topEdgePx = PLAYER_REVEAL_TOP_EDGE_PX,
		bottomEdgePx = PLAYER_REVEAL_BOTTOM_EDGE_PX
	} = {}
) => {
	const y = Number(clientY);
	const height = Number(viewportHeight);
	if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return false;
	return y <= topEdgePx || y >= Math.max(0, height - bottomEdgePx);
};

export const getInteractionClientY = (event) => {
	const value = Number(event?.clientY);
	return Number.isFinite(value) ? value : null;
};
