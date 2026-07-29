import {renderHook} from '@testing-library/react';
import {usePanelToolbarActions} from '../usePanelToolbarActions';

describe('usePanelToolbarActions', () => {
	it('exposes the layered panel Back handler to the visible Toolbar action', () => {
		const onPanelBack = jest.fn(() => true);
		const registerBackHandler = jest.fn();
		const {result} = renderHook(() => usePanelToolbarActions({
			onNavigate: jest.fn(),
			registerBackHandler,
			isActive: true,
			onPanelBack
		}));

		expect(result.current.onBack()).toBe(true);
		expect(onPanelBack).toHaveBeenCalledTimes(1);
	});

	it('falls through when neither the panel nor Toolbar owns Back', () => {
		const onPanelBack = jest.fn(() => false);
		const {result} = renderHook(() => usePanelToolbarActions({
			onNavigate: jest.fn(),
			registerBackHandler: jest.fn(),
			isActive: true,
			onPanelBack
		}));

		expect(result.current.onBack()).toBe(false);
	});
});
