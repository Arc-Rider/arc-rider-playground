# arcEvent — Tech Summit

A working MCP v2 App using the published `@arcrider/arcwidgets-react@0.1.0-alpha.6` package. Fictional event data only. Four compact views use Calendar Week, Calendar Timeline, arcTable and Progress Bar. Each view can be opened independently through an MCP render tool; the standalone demo shell also offers tabs.

## Run

From the playground root:

```sh
npm ci
npm run event:build
npm run event:start
```

- Browser preview: `http://127.0.0.1:4194`
- Streamable HTTP MCP: `http://127.0.0.1:4194/mcp`
- Stdio alternative: run `node dist/main.js --stdio` from this demo directory.
- Validation: `npm run event:test`

Node 22+ recommended. No OpenAI API key is needed: the host calls MCP tools.

## Demo flow

1. Call `show_event_calendar`, `show_event_timeline`, `show_event_table` or `show_event_capacity`. Each returns the shared snapshot with its requested `view` and the compact UI resource.
2. Week shows Monday 12 through Friday 16 October 2026. The Tech Summit has eight talks on Monday, Tuesday, Thursday and Friday. Each talk is 30-minute intro, 60–150-minute main talk and 30-minute demo, with one hour between morning and afternoon blocks. Wednesday is a highlighted break/organization day with three internal appointments. Filter by room or speaker to inspect overlapping sessions.
3. Drag a session natively to another day/time. Linked segment callbacks are saved atomically. Click a session or use Sessions to open its editor.
4. Sessions uses the actual arcTable with date/time, room, speakers and booking progress in cells.
5. Bookings uses a nested arcTable with individual bookings and capacity bars. Click a session to edit bookings or capacity. The server rejects negative, fractional and over-capacity counts.
6. The editor also supports date, time, room, segment duration and speaker assignments. The initial summit schedule has no conflicts.
7. In ChatGPT, ask: “Show the event week”, “Move the automation lab to Tuesday at 11:00”, or “Show bookings and increase the lab capacity to 35”. Connection is still required as described below.
8. Use Refresh in an existing view after a separate model tool call. UI mutations return authoritative snapshots immediately.

## Segments and state

Sessions contain ordered segments with a duration and zero or more speakers. Segment start/end times are derived from the session start, so there is no duplicated time state. Room conflicts use full session intervals; speaker conflicts and availability checks use only assigned segment intervals. Adjacent intervals do not overlap. Each session has an ISO date within the displayed Monday–Sunday week. Room and speaker overlaps are checked only on matching dates. Times are local wall-clock minutes after midnight in Europe/Berlin, in five-minute increments. Speaker availability is currently a recurring daily earliest time. Capacity is per session; booking counts are seats, not deduplicated event attendees.

The server owns state and writes an atomic JSON snapshot in `.local/arc-event.json`, relative to its working directory. Set `ARC_EVENT_STORE` to choose a stable absolute path; HTTP and stdio should not run as separate processes against the same file. Revision checks and a write queue protect edits within a single process. Local mode uses a single shared event. Hosted mode selects a separate event per trusted gateway session. It intentionally permits scheduling conflicts and shows them for resolution.

The alpha.6 native drag callback provides destination values and nested source indices. The app persists these values through its normal revision-checked update tool.

## MCP tools

- `show_event_calendar`: compact full-week calendar.
- `show_event_timeline`: native half-hour timeline by room or speaker.
- `show_event_table`: compact arcTable.
- `show_event_capacity`: compact capacity/booking progress.
- `get_event_plan`: reads current data and conflicts without rendering another UI.
- `preview_event_changes`: validates and calculates an unsaved candidate.
- `update_event_plan`: atomically saves session and/or speaker changes with `expectedRevision`.

For segment edits, send the complete ordered `segments` array for the affected session. Preview returns a hypothetical revision; apply using the original saved revision. Refresh after a stale-revision error.

## Connect to ChatGPT

The app is built and verified locally. A hosted demo is available through the [Arc Rider Playground](https://playground.arc-rider.com/), which issues a temporary session URL. Installation in ChatGPT is separate. A ChatGPT web connection needs an accessible deployed MCP URL; the local address above is for local testing. Use a controlled HTTPS deployment or development tunnel to `/mcp`, then follow the current [OpenAI connection guide](https://developers.openai.com/plugins/quickstart). Exact account access and developer-mode availability depend on the account.

Local HTTP still binds to loopback and uses one shared file. Setting `PLAYGROUND=1` switches to per-session storage keyed by the `x-playground-session` header — this is what lets any host serve the demo to multiple visitors at once (the actual hosted playground, session issuing and rate limiting live in a separate ops repo, not here). Keep local data and build artifacts out of Git.

UI implementation follows the [MCP Apps bridge guidance](https://developers.openai.com/plugins/build/chatgpt-ui): structured tool results, `ui.resourceUri`, `text/html;profile=mcp-app`, host tool calls and model-context updates.

## Verified

Automated tests exercise three conflict categories, linked timing, an atomic conflict-free repair, fixed lunch, invalid resources/ranges, stale revisions, preview isolation, concurrent writes, persistence after restart, MCP discovery, UI resources and tool readback. Streamable HTTP was also checked with the MCP client. Browser verification covered four views and a booking-count mutation. After removing the custom drag implementation, native cross-day dragging was verified with persistence after reload, and native entry click opened the correct editor. Automated tests also cover date boundaries, cross-day conflicts and capacity limits. ChatGPT-host rendering still needs an end-to-end check after connection.

### Segment and booking views

Week renders native linked calendar segments across Monday–Friday. Dragging uses the native widget implementation. Native destination callbacks persist changes, with one atomic update for all changed segments. Timeline (show_event_timeline) displays each segment by room or assigned speaker with a day selector. Clicking a segment opens the shared session editor.

Bookings uses arcTable nested items for individual fictional attendees, a two-column span in each parent row, uniform 12px cell text and the native outer table border. Booking counts reconcile the synthetic demo roster; this is not a live registration service.

### Implementation audit — alpha.6

Uses published @arcrider/arcwidgets-react 0.1.0-alpha.6. Native Week drag callbacks now supply end_data and source entry/segment indices. Synchronous segment callbacks are batched into one revision-checked server change; invalid drops remount the saved state. Native drag and native resize persist consecutive segment spans. No pointer listeners or geometry extraction.

Removed preview-only restriction, custom Timeline content buttons, Week toolbar/settings hiding and Time label replacement, redundant Week radius CSS, and the table collapse type assertion (uses typed supported options). Stage has no border; both tables retain their own outer border.

Timeline defaults to a native five-day overview with 76px day columns and native zoom controls. Select a day for the native 30-minute grid with 40px columns. Overview dragging changes the session date while retaining its times; multi-day resizing is rejected because summit sessions occupy one day. All Timeline header CSS overrides were removed. Inclusive Timeline end cells require subtracting one 30-minute slot. Remaining adaptations: Scoped table typography overrides retain uniform cell sizing. These are presentation/data adaptations, not replacement drag implementations. Timeline uses native drag/resize and end_data persistence. Moving a segment shifts the whole session to keep its sequence intact; resizing changes that segment duration. Room-row drops reassign the session room; speaker-row drops replace that segment’s source speaker with the target speaker. Fixed sessions cannot be dragged. Booking identities are synthetic demo data.

### Talk layout

Week uses 56px hours and a 34px time gutter. Intro/demo have native dotted inset borders and distinct topic-tinted fills; main talks have solid inset borders. The supported customLayout slot contains a native ArcWidgetBadge for the main speaker, followed by topic and title. Intro/demo have no speaker assignment or badge. Content is pointer-transparent so native entry interactions remain in charge. Wednesday uses native date highlights in both calendars. No weekend columns are shown.

## Compact MCP previews and validation

The demo shell links to `?mcp=calendar`, `?mcp=timeline`, `?mcp=table`, and `?mcp=capacity`. These render only a simple header and the selected widget (plus an editor/status when needed). Embedded MCP rendering always uses this same compact layout; tool results select the view.

After a successful save, the header shows a native ArcWidgetButton labelled Validate Plan. Clicking reads the latest server snapshot. In a host it sends one explicit user follow-up through app.sendMessage, asking the model to read get_event_plan and check the plan without modifying it. Host rejection leaves the button available and reports the error. Dragging itself does not send a chat message. Local previews report scheduling conflicts and overbooked sessions; no AI call is simulated. Validation-request state is per mounted UI instance. Real ChatGPT message dispatch still needs a host integration test.

### Hosting contract

`PLAYGROUND=1` requires a trusted gateway to validate session lifetime and overwrite `x-playground-session` with a 48-character lowercase hex session ID. Do not expose the demo service directly: the header is routing context, not authentication. `PLAYGROUND_STORE_DIR` holds one persisted event per session. Run one event process per storage directory; revision queues are process-local. Gateway access control, expiration and deployment remain outside this example repository. Concurrent first requests share the same store initialization.
