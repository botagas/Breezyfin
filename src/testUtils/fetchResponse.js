export const createJsonResponse = (data, ok = true, status = 200) => {
	const bodyText = JSON.stringify(data);
	return {
		ok,
		status,
		json: async () => data,
		text: async () => bodyText
	};
};

export const createTextResponse = (bodyText, ok = false, status = 400) => ({
	ok,
	status,
	text: async () => bodyText
});
