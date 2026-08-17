import {act, renderHook} from '@testing-library/react';
import {usePanelBackHandlerRegistry} from '../usePanelBackHandlerRegistry';

describe('usePanelBackHandlerRegistry', () => {
	it('registers and runs the Login panel Back owner', () => {
		const handler = jest.fn(() => true);
		const {result} = renderHook(() => usePanelBackHandlerRegistry());
		act(() => result.current.registerLoginBackHandler(handler));

		expect(result.current.runPanelBackHandler(result.current.refs.loginBackHandlerRef)).toBe(true);
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
