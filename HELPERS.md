# Helpers & Hooks Reference

This file documents shared hooks/helpers used across Breezyfin so panel code stays consistent and maintainable.

## How To Choose

| Need | Preferred Helper |
|---|---|
| Save/restore panel scroll + cache scrollTop | `usePanelScrollState` |
| Wire panel back handling | `usePanelBackHandler` |
| Wire toolbar callbacks consistently | `useToolbarActions` |
| Bridge toolbar-level back handler into panel back flow | `useToolbarBackHandler` |
| Open/close multiple popups/menus | `useDisclosureMap` |
| Close popup when focus/pointer leaves scope | `useDismissOnOutsideInteraction` |
| Keep component state synced to settings changes | `useBreezyfinSettingsSync` |
| Fast lookup of items by id/key | `useMapById` |
| Fetch item metadata with cancel-safe effect | `useItemMetadata` |
| Reusable toast lifecycle | `useToastMessage` |
| Reusable image fallback behavior | `useImageErrorFallback` |
| Audio/subtitle preference pick + persist | `useTrackPreferences` |

---

## Hooks

### `usePanelScrollState`
- File: `src/hooks/usePanelScrollState.js`
- Purpose: one-stop panel scroll memory hook; combines normalized `scrollTop`, `Scroller` restore wiring, and optional cache persistence callbacks.
- Signature:
```js
usePanelScrollState({
  cachedState = null,
  isActive = false,
  onCacheState = null,
  cacheKey = null,
  requireCacheKey = false
})
```
- Returns:
  - `scrollTop`
  - `setScrollTop`
  - `captureScrollTo` (pass to `Scroller` `cbScrollTo`)
  - `handleScrollStop` (pass to `Scroller` `onScrollStop`)
- Use when:
  - panel has cached state and should restore scroll on return.
  - panel wants keyed cache (`cacheKey`), e.g. per library id/item id.
- Example:
```js
const {
  captureScrollTo,
  handleScrollStop
} = usePanelScrollState({
  cachedState,
  isActive,
  onCacheState,
  cacheKey: library?.Id,
  requireCacheKey: true
});
```

### `useScrollerScrollMemory` and `useCachedScrollTopState`
- File: `src/hooks/useScrollerScrollMemory.js`
- Purpose:
  - `useCachedScrollTopState`: normalizes persisted `scrollTop` and keeps state stable.
  - `useScrollerScrollMemory`: low-level restore/capture primitives.
- Use when:
  - panel has special behavior not covered by `usePanelScrollState`.

### `usePanelBackHandler`
- File: `src/hooks/usePanelBackHandler.js`
- Purpose: register/unregister panel-local back callback safely.
- Signature:
```js
usePanelBackHandler(registerBackHandler, handler, { enabled = true })
```
- Use when:
  - panel needs custom back behavior (close popup first, then fallback).

### `useToolbarActions`
- File: `src/hooks/useToolbarActions.js`
- Purpose: builds stable toolbar callback bundle for `Toolbar`/`SettingsToolbar`.
- Signature:
```js
useToolbarActions({
  onNavigate,
  onSwitchUser,
  onLogout,
  onExit,
  registerBackHandler
})
```
- Use when:
  - passing toolbar props repeatedly in a panel.

### `useToolbarBackHandler`
- File: `src/hooks/useToolbarBackHandler.js`
- Purpose: bridge toolbar-provided back handler into panel back flow.
- Returns:
  - `registerToolbarBackHandler(handler)`
  - `runToolbarBackHandler()` -> `boolean`
- Typical pattern:
```js
const { registerToolbarBackHandler, runToolbarBackHandler } = useToolbarBackHandler();
const handleInternalBack = useCallback(() => runToolbarBackHandler(), [runToolbarBackHandler]);
```

### `useDisclosureMap`
- File: `src/hooks/useDisclosureMap.js`
- Purpose: manage many popup/menu open states in one map.
- Returns:
  - `disclosures`
  - `openDisclosure(key)`
  - `closeDisclosure(key)`
  - `setDisclosure(key, bool)`
  - `closeAllDisclosures(keys?)`
- Use when:
  - a panel has multiple popups and back handling should close whichever is open.

### `useDismissOnOutsideInteraction`
- File: `src/hooks/useDismissOnOutsideInteraction.js`
- Purpose: close overlays when focus/pointer/touch happens outside a scope node.
- Signature:
```js
useDismissOnOutsideInteraction({
  enabled = true,
  scopeRef,
  onDismiss
})
```

### `useBreezyfinSettingsSync`
- File: `src/hooks/useBreezyfinSettingsSync.js`
- Purpose: subscribe to settings updates from:
  - `breezyfin-settings-changed` custom event
  - `storage` event (cross-tab/window)
- Signature:
```js
useBreezyfinSettingsSync(onSettings, { enabled = true, applyOnMount = true })
```

### `useMapById`
- File: `src/hooks/useMapById.js`
- Purpose: `Array -> Map` lookup helper by `Id` or custom key selector.
- Signature:
```js
useMapById(items, keySelector = 'Id')
```
- Use when:
  - click handlers need constant-time lookup from `data-*` id to item object.

### `useItemMetadata`
- File: `src/hooks/useItemMetadata.js`
- Purpose: fetch item details with effect cancel guard.
- Signature:
```js
useItemMetadata(itemId, { enabled = true, errorContext = 'item metadata' })
```

### `useImageErrorFallback`
- File: `src/hooks/useImageErrorFallback.js`
- Purpose: shared `onError` behavior for images:
  - hide broken image
  - mark container with placeholder class
  - optional callback
- Signature:
```js
useImageErrorFallback(placeholderClassName, { onError })
```

### `useToastMessage`
- File: `src/hooks/useToastMessage.js`
- Purpose: standard toast lifecycle with optional fade-out staging.
- Signature:
```js
useToastMessage({ durationMs = 2000, fadeOutMs = 0 })
```
- Returns:
  - `toastMessage`
  - `toastVisible`
  - `setToastMessage`
  - `clearToast`

### `useTrackPreferences`
- File: `src/hooks/useTrackPreferences.js`
- Purpose: pick/apply/save audio/subtitle track preferences consistently.
- Returns key methods:
  - `resolveDefaultTrackSelection(mediaStreams, options)`
  - `saveAudioSelection(trackIndex, audioStreams)`
  - `saveSubtitleSelection(trackIndex, subtitleStreams)`
  - `loadTrackPreferences()`
  - `saveTrackPreferences()`

---

## Utility Helpers

### `getPosterCardClassProps`
- File: `src/utils/posterCardClassProps.js`
- Purpose: map common card class names from a CSS module into props for `PosterMediaCard`.

### `focusToolbarSpotlightTargets`
- File: `src/utils/toolbarFocus.js`
- Purpose: focus first available toolbar spotlight target id safely.

### `createLastFocusedSpotlightContainer`
- File: `src/utils/spotlightContainerUtils.js`
- Purpose: create `SpotlightContainerDecorator` with `enterTo: 'last-focused'`.

### `scrollElementIntoHorizontalView`
- File: `src/utils/horizontalScroll.js`
- Purpose: keep focused cards visible in horizontal scrollers with configurable edge buffer.

### Settings and track storage helpers
- `src/utils/settingsStorage.js`
  - `readBreezyfinSettings(rawOverride?)`
  - `writeBreezyfinSettings(settings)` (also emits `breezyfin-settings-changed`)
- `src/utils/trackPreferences.js`
  - `readTrackPreferences(rawOverride?)`
  - `writeTrackPreferences(preferences)`
  - `createAudioPreference(index, stream)`
  - `createSubtitlePreference(index, stream)`

---

## Related Docs

- [`README.md`](./README.md)
- [`THEMES.md`](./THEMES.md)

---

## Conventions

- Prefer the highest-level helper first (`usePanelScrollState` over raw scroll hooks).
- Keep popup state in a disclosure map, not separate booleans.
- Route toolbar callbacks through `useToolbarActions`.
- Keep panel back flow layered:
  1. close local disclosure(s)
  2. run toolbar back handler
  3. fallback to app-level navigation.
