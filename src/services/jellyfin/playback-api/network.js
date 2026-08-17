import {buildTokenAuthHeaders} from '../../../utils/auth';

export const fetchPlaybackInfo = async (service, itemId, payload) => {
	const requestServerUrl = service.serverUrl;
	const requestAccessToken = service.accessToken;
	const requestUserId = service.userId;
	const requestSessionGeneration = service.sessionGeneration;
	const response = await fetch(`${requestServerUrl}/Items/${itemId}/PlaybackInfo?userId=${requestUserId}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...buildTokenAuthHeaders(requestAccessToken)
		},
		body: JSON.stringify(payload)
	});
	if (!response.ok) {
		service._handleAuthFailureStatus(response.status, {
			accessToken: requestAccessToken,
			serverUrl: requestServerUrl,
			sessionGeneration: requestSessionGeneration
		});
		const errorText = await response.text();
		console.error('PlaybackInfo error response:', errorText);
		const compactError = String(errorText || '').replace(/\s+/g, ' ').trim().slice(0, 280);
		throw new Error(`HTTP ${response.status}: ${response.statusText}${compactError ? ` - ${compactError}` : ''}`);
	}
	return response.json();
};

export const buildPlaystatePayload = (basePayload, session = {}) => {
	const payload = {
		...basePayload,
		PlayMethod: session.playMethod || basePayload.PlayMethod || 'DirectStream'
	};
	if (session.playSessionId) payload.PlaySessionId = session.playSessionId;
	if (session.mediaSourceId) payload.MediaSourceId = session.mediaSourceId;
	if (session.playlistItemId) payload.PlaylistItemId = session.playlistItemId;
	if (Number.isInteger(session.audioStreamIndex)) payload.AudioStreamIndex = session.audioStreamIndex;
	if (session.subtitleStreamIndex === -1 || Number.isInteger(session.subtitleStreamIndex)) {
		payload.SubtitleStreamIndex = session.subtitleStreamIndex;
	}
	return payload;
};
