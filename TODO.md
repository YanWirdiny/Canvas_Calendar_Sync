# TODO — Canvas Calendar Sync
<!-- Last reviewed: 2026-04-23 -->

## Bugs

- [x] **[manifest.json:40] Corrupted `content_scripts` key**
  Key reads `"contenhwb(214 10% 9%)ts"` instead of `"content_scripts"`.
  Content script is never injected into Canvas pages as a result.

- [ ] **[options.js:14-28] Calendar fetch runs before Google auth check**
  `fetchGoogleCalendars` is called immediately on options page load with no check
  for whether the user is authenticated. Silently fails when not connected.

- [ ] **[background.js:139] `syncAssignmentsToCalendar` misnamed — syncs to Tasks, not Calendar**
  Function calls `createGoogleTask()` for every assignment. `createGoogleCalendarEvent()`
  exists in background.js but is never called anywhere.

- [ ] **[webpackConfig.js] Build pipeline references non-existent `src/` directory**
  Entry points point to `./src/background/background.js` etc. but all source files
  live at root. Webpack cannot run as configured.

## Gaps / Missing Features

- [ ] **[background.js:144] No deduplication — every sync creates duplicate tasks**
  `syncAssignmentsToCalendar()` fetches all Canvas assignments and calls
  `createGoogleTask()` for each one on every sync run, with no check for whether
  a task for that assignment already exists. Fix: store a
  `{ [assignmentId]: googleTaskId }` map in `chrome.storage.sync` and skip
  assignments already present in the map.
