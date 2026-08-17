import {createJellyfinRequestError} from './requestErrors';
import {commitAuthenticationResult, resolveClientAuthHeaders} from './sessionApi';

const readResponseText = async (response) => response.text().catch(() => '');

const parseResponseJson = (bodyText, context) => {
	try {
		return JSON.parse(bodyText);
	} catch (_) {
		throw new Error(`${context} response was not valid JSON`);
	}
};

const requestQuickConnect = async (service, path, options = {}) => {
	if (!service?.serverUrl) {
		throw new Error('Connect to a Jellyfin server before using Quick Connect');
	}
	const clientHeaders = await resolveClientAuthHeaders(service);
	const response = await fetch(`${String(service.serverUrl).replace(/\/+$/, '')}${path}`, {
		method: options.method || 'GET',
		headers: {
			...clientHeaders,
			...(options.body ? {'Content-Type': 'application/json'} : {})
		},
		...(options.body ? {body: JSON.stringify(options.body)} : {}),
		...(options.signal ? {signal: options.signal} : {})
	});
	const bodyText = await readResponseText(response);
	return {response, bodyText};
};

const assertSuccessfulResponse = ({response, bodyText}, context) => {
	if (response.ok) return;
	throw createJellyfinRequestError({
		status: response.status,
		context,
		bodyText
	});
};

export const getQuickConnectEnabled = async (service, options = {}) => {
	const result = await requestQuickConnect(service, '/QuickConnect/Enabled', options);
	if (result.response.status === 401 || result.response.status === 404) return false;
	assertSuccessfulResponse(result, 'Quick Connect availability');
	return parseResponseJson(result.bodyText, 'Quick Connect availability') === true;
};

export const initiateQuickConnect = async (service, options = {}) => {
	const result = await requestQuickConnect(service, '/QuickConnect/Initiate', {
		...options,
		method: 'POST'
	});
	assertSuccessfulResponse(result, 'Quick Connect initiation');
	const data = parseResponseJson(result.bodyText, 'Quick Connect initiation');
	if (!data?.Code || !data?.Secret) {
		throw new Error('Quick Connect initiation did not return a code and secret');
	}
	return data;
};

export const getQuickConnectState = async (service, secret, options = {}) => {
	if (!secret) throw new Error('Quick Connect secret is required');
	const search = new URLSearchParams({Secret: secret});
	const result = await requestQuickConnect(service, `/QuickConnect/Connect?${search.toString()}`, options);
	assertSuccessfulResponse(result, 'Quick Connect status');
	return parseResponseJson(result.bodyText, 'Quick Connect status');
};

export const authenticateWithQuickConnect = async (service, secret, options = {}) => {
	if (!secret) throw new Error('Quick Connect secret is required');
	const result = await requestQuickConnect(service, '/Users/AuthenticateWithQuickConnect', {
		...options,
		method: 'POST',
		body: {Secret: secret}
	});
	assertSuccessfulResponse(result, 'Quick Connect authentication');
	const data = parseResponseJson(result.bodyText, 'Quick Connect authentication');
	return commitAuthenticationResult(service, data);
};
