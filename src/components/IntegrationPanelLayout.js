import {useCallback} from 'react';
import BodyText from '@enact/sandstone/BodyText';
import {Panel, Header} from './BreezyPanels';
import AppScroller from './AppScroller';
import Toolbar from './Toolbar';
import BreezyLoadingOverlay from './BreezyLoadingOverlay';
import MediaPanelBackdrop from './MediaPanelBackdrop';
import Button from './BreezyButton';
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
	captureScrollTo,
	onScrollStop,
	children,
	...rest
}) => {
	const errorRetryId = retrySpotlightId || `${activeSection || 'integration'}-panel-retry`;
	const entryFocusId = errorMessage && typeof onRetry === 'function' ? errorRetryId : firstFocusId;
	const handleNavigateDown = useCallback(() => focusSpotlightTarget(entryFocusId), [entryFocusId]);
	return (
		<Panel {...rest}>
			<Header title={title} />
			<Toolbar
				activeSection={activeSection}
				isActive={isActive}
				onNavigateDown={handleNavigateDown}
				{...toolbarActions}
			/>
			<MediaPanelBackdrop
				item={backdropItem}
				imageUrl={backdropUrl || backdropItem?.AuthenticatedImageUrl || ''}
			/>
			{loading ? (
				<div className={css.loading}><BreezyLoadingOverlay label={loadingMessage} /></div>
			) : (
				<AppScroller
					className={css.scroller}
					cbScrollTo={captureScrollTo}
					onScrollStop={onScrollStop}
				>
					<div className={css.content} data-bf-integration-panel-content="true">
						{errorMessage ? (
							<div className={css.stateSurface} role="alert">
								<BodyText>{errorMessage}</BodyText>
								{typeof onRetry === 'function' ? (
									<Button spotlightId={errorRetryId} onClick={onRetry}>Retry</Button>
								) : null}
							</div>
						) : null}
						{!errorMessage && emptyMessage ? (
							<div className={css.stateSurface}><BodyText>{emptyMessage}</BodyText></div>
						) : null}
						{children}
					</div>
				</AppScroller>
			)}
		</Panel>
	);
};

export default IntegrationPanelLayout;
