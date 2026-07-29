import {useCallback} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import {Panel, Header} from './BreezyPanels';
import AppScroller from './AppScroller';
import Toolbar from './Toolbar';
import BreezyLoadingOverlay from './BreezyLoadingOverlay';
import MediaPanelBackdrop from './MediaPanelBackdrop';
import PanelActionButton from './PanelActionButton';
import {focusSpotlightTarget} from '../utils/gridFocus';

import css from './IntegrationPanelLayout.module.less';

const IntegrationPanelLayout = ({
	title,
	activeSection,
	isActive = false,
	toolbarActions,
	firstFocusId = '',
	backdropItem = null,
	backdropUrl = '',
	loading = false,
	loadingMessage = 'Loading...',
	emptyMessage = '',
	errorMessage = '',
	onRetry = null,
	retrySpotlightId = '',
	scrollable = true,
	captureScrollTo,
	onScrollStop,
	children,
	...rest
}) => {
	const errorRetryId = retrySpotlightId || `${activeSection || 'integration'}-panel-retry`;
	const entryFocusId = errorMessage && typeof onRetry === 'function' ? errorRetryId : firstFocusId;
	const handleNavigateDown = useCallback(() => focusSpotlightTarget(entryFocusId), [entryFocusId]);
	const content = (
		<div
			className={`${css.content} ${scrollable ? '' : css.staticContent}`}
			data-bf-integration-panel-content="true"
		>
			{errorMessage ? (
				<div className={css.stateSurface} role="alert">
					<BodyText>{errorMessage}</BodyText>
					{typeof onRetry === 'function' ? (
						<PanelActionButton spotlightId={errorRetryId} onClick={onRetry}>Retry</PanelActionButton>
					) : null}
				</div>
			) : null}
			{!errorMessage && emptyMessage ? (
				<div className={css.stateSurface}><BodyText>{emptyMessage}</BodyText></div>
			) : null}
			{children}
		</div>
	);
	return (
		<Panel {...rest}>
			<Header title={title} />
			<Toolbar
				activeSection={activeSection}
				isActive={isActive}
				panelTitle={title}
				onNavigateDown={handleNavigateDown}
				{...toolbarActions}
			/>
			<MediaPanelBackdrop
				item={backdropItem}
				imageUrl={backdropUrl || backdropItem?.AuthenticatedImageUrl || ''}
			/>
			{loading ? (
				<div className={css.loading}><BreezyLoadingOverlay label={loadingMessage} /></div>
			) : scrollable ? (
				<AppScroller
					className={css.scroller}
					cbScrollTo={captureScrollTo}
					onScrollStop={onScrollStop}
				>
					{content}
				</AppScroller>
			) : (
				<div className={`${css.scroller} ${css.staticViewport}`}>
					{content}
				</div>
			)}
		</Panel>
	);
};

export default IntegrationPanelLayout;
