import {createJsonResponse, createTextResponse} from '../fetchResponse';

describe('Fetch response test utilities', () => {
	it('provides matching JSON and text bodies', async () => {
		const response = createJsonResponse({value: 1}, false, 503);

		expect(response.ok).toBe(false);
		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({value: 1});
		await expect(response.text()).resolves.toBe('{"value":1}');
	});

	it('provides text-only responses', async () => {
		const response = createTextResponse('<html>Error</html>', true, 200);

		expect(response.ok).toBe(true);
		expect(response.status).toBe(200);
		await expect(response.text()).resolves.toBe('<html>Error</html>');
	});
});
