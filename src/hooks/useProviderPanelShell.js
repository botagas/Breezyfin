import {useCallback, useEffect, useRef, useState} from 'react';
import {usePanelScrollState} from './usePanelScrollState';
import {usePanelToolbarActions} from './usePanelToolbarActions';
import {useRuntimeDiagnosticsEnabled} from './useRuntimeDiagnostics';
import {buildProviderDiagnosticSummary} from '../utils/providerDiagnostics';

export const useProviderPanelShell = ({
	cachedState,
	isActive,
	onCacheState,
	onNavigate,
	onSwitchUser,
	onLogout,
	onExit,
	registerBackHandler
}) => {
	const diagnosticsEnabled = useRuntimeDiagnosticsEnabled();
	const diagnosticsEnabledRef = useRef(diagnosticsEnabled);
	diagnosticsEnabledRef.current = diagnosticsEnabled;
	const [externalItem, setExternalItem] = useState(null);
	const [externalItemOpen, setExternalItemOpen] = useState(false);
	const requestIdRef = useRef(0);
	const cacheSnapshotRef = useRef(cachedState || {});
	useEffect(() => {
		if (cachedState && typeof cachedState === 'object') cacheSnapshotRef.current = cachedState;
	}, [cachedState]);
	const cachePanelState = useCallback((nextState) => {
		if (typeof onCacheState !== 'function') return;
		const merged = {...cacheSnapshotRef.current, ...(nextState || {})};
		cacheSnapshotRef.current = merged;
		onCacheState(merged);
	}, [onCacheState]);
	const {captureScrollTo, handleScrollStop} = usePanelScrollState({
		cachedState,
		isActive,
		onCacheState: cachePanelState
	});
	const openExternalItem = useCallback((item) => {
		setExternalItem(item);
		setExternalItemOpen(Boolean(item));
	}, []);
	const closeExternalItem = useCallback(() => setExternalItemOpen(false), []);
	const handleExternalItemHide = useCallback(() => setExternalItem(null), []);
	const handlePanelBack = useCallback(() => {
		if (!externalItemOpen) return false;
		closeExternalItem();
		return true;
	}, [closeExternalItem, externalItemOpen]);
	const toolbarActions = usePanelToolbarActions({
		onNavigate,
		onSwitchUser,
		onLogout,
		onExit,
		registerBackHandler,
		isActive,
		onPanelBack: handlePanelBack
	});
	const reportProviderFailure = useCallback((scope, failure) => {
		if (!diagnosticsEnabledRef.current) return;
		const summary = buildProviderDiagnosticSummary(failure);
		console.warn(`[${scope}] Provider request failed ${JSON.stringify(summary)}`);
	}, []);
	const reportProviderDiagnostic = useCallback((scope, diagnostic) => {
		if (!diagnosticsEnabledRef.current) return;
		console.warn(`[${scope}] Provider diagnostic ${JSON.stringify(diagnostic || {})}`);
	}, []);

	return {
		externalItem,
		externalItemOpen,
		setExternalItem: openExternalItem,
		openExternalItem,
		requestIdRef,
		captureScrollTo,
		handleScrollStop,
		toolbarActions,
		closeExternalItem,
		handleExternalItemHide,
		cachePanelState,
		reportProviderFailure,
		reportProviderDiagnostic
	};
};
