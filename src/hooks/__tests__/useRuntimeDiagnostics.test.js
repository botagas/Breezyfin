import {screen} from '@testing-library/react';
import {renderWithBreezyfin} from '../../testUtils/renderWithBreezyfin';
import {RuntimeDiagnosticsProvider, useRuntimeDiagnosticsEnabled} from '../useRuntimeDiagnostics';
import {
	getMediaPerformanceSnapshot,
	registerMediaCardImage,
	resetMediaPerformanceMetrics
} from '../../utils/mediaPerformanceMetrics';

describe('runtime diagnostics context', () => {
	afterEach(() => resetMediaPerformanceMetrics());

	it('defaults diagnostics collection to disabled', () => {
		const Probe = () => <span data-testid="state">{String(useRuntimeDiagnosticsEnabled())}</span>;
		renderWithBreezyfin(<Probe />);
		expect(screen.getByTestId('state').textContent).toBe('false');
	});

	it('exposes enabled state and clears metrics when disabled', () => {
		const Probe = () => <span data-testid="state">{String(useRuntimeDiagnosticsEnabled())}</span>;
		const {rerender} = renderWithBreezyfin(
			<RuntimeDiagnosticsProvider enabled><Probe /></RuntimeDiagnosticsProvider>
		);
		expect(screen.getByTestId('state').textContent).toBe('true');
		registerMediaCardImage(Symbol('card'), 'pending');
		expect(getMediaPerformanceSnapshot().mountedCards).toBe(1);
		rerender(<RuntimeDiagnosticsProvider enabled={false}><Probe /></RuntimeDiagnosticsProvider>);
		expect(screen.getByTestId('state').textContent).toBe('false');
		expect(getMediaPerformanceSnapshot().mountedCards).toBe(0);
	});
});
