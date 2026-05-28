import {useCallback, useEffect, useMemo, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import {useDismissOnOutsideInteraction} from '../hooks/useDismissOnOutsideInteraction';

import css from './DebugErrorMenu.module.less';

const defaultGetActionLabel = (action) => action?.label || action?.id || 'Action';

const DebugErrorMenu = ({
	enabled = false,
	actions = [],
	onAction,
	ariaLabel = 'Debug error menu',
	open = false,
	onOpenChange
}) => {
	const menuRef = useRef(null);
	const isPointerMode = useCallback(() => Boolean(Spotlight?.getPointerMode?.()), []);

	const resolvedActions = useMemo(
		() => (Array.isArray(actions) ? actions.filter((action) => action && action.id) : []),
		[actions]
	);

	const setOpenState = useCallback((nextOpen) => {
		if (typeof onOpenChange === 'function') {
			onOpenChange(Boolean(nextOpen));
		}
	}, [onOpenChange]);

	const focusFirstAction = useCallback(() => {
		const firstAction = menuRef.current?.querySelector('[data-debug-error-action]');
		if (!firstAction) return;
		Spotlight.focus(firstAction);
	}, []);

	const handleToggleMenu = useCallback(() => {
		const nextOpen = !open;
		setOpenState(nextOpen);
		if (nextOpen && !isPointerMode()) {
			window.requestAnimationFrame(() => {
				focusFirstAction();
			});
		}
	}, [focusFirstAction, isPointerMode, open, setOpenState]);

	const handleMenuActionClick = useCallback((event) => {
		const actionId = event?.currentTarget?.dataset?.debugErrorAction || '';
		if (!actionId) return;
		if (typeof onAction === 'function') {
			onAction(actionId);
		}
		setOpenState(false);
	}, [onAction, setOpenState]);

	const handleMenuItemFocus = useCallback(() => {
		setOpenState(true);
	}, [setOpenState]);

	const handleMenuMouseEnter = useCallback(() => {
		if (isPointerMode()) {
			setOpenState(true);
		}
	}, [isPointerMode, setOpenState]);

	const handleMenuMouseLeave = useCallback(() => {
		if (isPointerMode()) {
			setOpenState(false);
		}
	}, [isPointerMode, setOpenState]);

	useDismissOnOutsideInteraction({
		enabled: enabled && open,
		scopeRef: menuRef,
		onDismiss: () => setOpenState(false)
	});

	useEffect(() => {
		if (!enabled && open) {
			setOpenState(false);
		}
	}, [enabled, open, setOpenState]);

	if (!enabled || resolvedActions.length === 0) return null;

	return (
		<div
			ref={menuRef}
			className={`${css.menuDock} ${open ? css.menuDockExpanded : ''}`}
			onMouseEnter={handleMenuMouseEnter}
			onMouseLeave={handleMenuMouseLeave}
		>
			<div
				className={`${css.menuActions} ${open ? css.menuActionsOpen : ''}`}
				aria-hidden={!open}
			>
				{resolvedActions.map((action) => (
					<button
						key={action.id}
						type="button"
						className={`${css.menuAction} spottable`}
						data-debug-error-action={action.id}
						onClick={handleMenuActionClick}
						onFocus={handleMenuItemFocus}
						tabIndex={open ? 0 : -1}
					>
						{defaultGetActionLabel(action)}
					</button>
				))}
			</div>
			<button
				type="button"
				className={`${css.menuToggle} spottable`}
				onClick={handleToggleMenu}
				onFocus={handleMenuItemFocus}
				aria-label={ariaLabel}
				aria-expanded={open}
			>
				<span className={`${css.menuToggleGlyph} ${open ? css.menuToggleGlyphOpen : ''}`}>+</span>
			</button>
		</div>
	);
};

export default DebugErrorMenu;
