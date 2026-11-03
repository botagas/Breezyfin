/* eslint-disable react/prop-types */
import {jest} from '@jest/globals';
jest.mock('../services/jellyfinService', () => ({__esModule: true, default: {
 serverUrl: 'https://media.test', userId: 'user', sessionGeneration: 1, username: 'user',
 getRecentlyAdded: jest.fn(), getResumeItems: jest.fn(), getNextUp: jest.fn(), getLatestMedia: jest.fn(), getMyRequests: jest.fn(), getLikesWatchlist: jest.fn(),
 getBreezyfinHomeSections: jest.fn(), getBreezyfinHomeSectionItems: jest.fn(), getImageUrl: () => '', getBackdropUrl: () => ''
}}));
jest.mock('../components/BreezyPanels', () => ({Panel: ({children}) => <div>{children}</div>}));
jest.mock('../components/AppScroller', () => ({children}) => <div>{children}</div>);
jest.mock('../components/HeroBanner', () => () => null);
jest.mock('../components/Toolbar', () => () => null);
jest.mock('../components/BreezyLoadingOverlay', () => () => null);
jest.mock('../components/MediaPanelBackdrop', () => () => null);
jest.mock('../components/ProviderItemPopup', () => () => null);
jest.mock('../hooks/useBreezyfinSettingsSync', () => ({useBreezyfinSettingsSync: jest.fn()}));
jest.mock('../hooks/usePanelToolbarActions', () => ({usePanelToolbarActions: () => ({})}));
jest.mock('../hooks/usePanelScrollState', () => ({usePanelScrollState: () => ({})}));
jest.mock('../hooks/useRuntimeDiagnostics', () => ({useRuntimeDiagnosticsEnabled: () => false}));
jest.mock('../hooks/usePluginMediaItemPopup', () => ({usePluginMediaItemPopup: () => ({})}));
jest.mock('../utils/integrationPreferences', () => ({INTEGRATION_PREFERENCES_CHANGED_EVENT: 'test-preferences', readIntegrationPreferences: jest.fn(() => ({homeSource: 'builtin', watchlistEnabled: true}))}));
