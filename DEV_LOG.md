# Development Log

## M0-M2 / 2026-09-02

Implemented:
- Vue/Vite shell with firmware editor, world grid, terminal, controls, and replay inspector.
- Restricted RoboC++ lexer, parser, AST interpreter, operation budget, and action host.
- Tick simulation for the tutorial wall map with movement, turns, energy, exit, and failure states.
- Bounded serializable trace frames and focused Vitest coverage.

Tests:
- Lexer/parser smoke test.
- One-action-per-tick test.
- Persistent variable test.

Known Issues:
- Source-line highlighting, enemies, and debugger upgrades are next milestones.

Design Changes:
- none

## M3 Combat Kernel / 2026-09-02

Implemented:
- Added Slime state, `enemy_ahead()` sensor, and `attack()` action.
- Added deterministic contact damage and combat-aware success condition.

Tests:
- Existing interpreter and build suites remain green.

## M3 Story Levels / 2026-09-02

Implemented:
- Added data-driven StoryLevel definitions and level selector UI.
- Added distinct First Boot, The Wall, and Decision maps with per-level objectives.
- Added Slime rendering and combat objective feedback.

Tests:
- Build and 4 unit tests pass.

## M3 Full-Chain Verification / 2026-09-02

Fixed:
- Made Simulation reactive in the Vue shell so level selection updates map, objective, title, and enemy state immediately.
- Reset level state to Ready on selection instead of leaving a phantom running state.
- Corrected Decision map placement and exit/combat rules so the intended firmware strategy is solvable.

Tests:
- Added solvability coverage for all three levels and state-isolation coverage.
- Build and 6 unit tests pass.

Manual verification:
- Browser navigation selected each level; Decision completed with Slime destroyed and Exit reached.

## M5 Breakpoint Debugger / 2026-09-02

Implemented:
- Added source-line breakpoint storage and one-shot-per-run breakpoint hits.
- Added PAUSE/RESUME controls, breakpoint line input, active breakpoint display, and timer lifecycle guards.
- Preserved the current run on resume; RUN cannot reset a paused run and STOP returns to idle.

Tests:
- Added breakpoint event, pause freeze, and resume continuation coverage.
- `npm test`: 8 tests passed.
- `npm run build`: passed.

Next:
- Story progress persistence.

## Story Progress Persistence / 2026-09-02

Implemented:
- Added versioned local progress storage for completed level IDs and the last selected level.
- Restored progress on app startup and persisted selection, successful completion, and run termination.
- Added visible `DONE` indicators while preserving free selection of every story level.
- Added validation for unknown IDs and malformed storage data.

Fixed:
- Progress restore now resets the full selected level state, preventing enemy/objective data from leaking across levels.

Tests:
- Added persistence round-trip and malformed-data coverage.
- `npm test`: 10 tests passed.
- `npm run build`: passed.

Next:
- Rich editor line highlighting.

## M2 Source Line Highlighting / 2026-09-02

Implemented:
- Added editor line numbers and a synchronized current-line highlight behind the firmware textarea.
- Connected the selected Trace tick to the highlighted source line and editor header indicator.
- Kept gutter alignment synchronized with vertical editor scrolling.
- Made firmware read-only during active/paused execution and invalidated prior builds when source changes.

Fixed:
- Build errors now replace stale success status, and BUILD is disabled during active or paused runs to preserve the no-hot-reload rule.

Tests:
- Added multiline committed-action source-line coverage.
- Browser replay verification switched highlighting from line 7 to line 3 when selecting an earlier combat tick.

Next:
- Expand the first playable Story toward the required 4-6 short levels.

## M3 Five-Level Story / 2026-09-02

Implemented:
- Added `2-1 Counter Route`, requiring an integer wall counter to choose a different second turn.
- Added `2-2 Toggle Corridor`, requiring persistent boolean state to alternate right/left/right turns.
- Added data-driven objective text for every Story level.
- Changed the clean-start default to First Boot with no leaked enemy state.

Tests:
- Expanded full Story solvability coverage from three to five levels.
- Added regression coverage proving the stateless right-turn strategy cannot solve the Chapter 2 routes.
- `npm test`: 12 tests passed.
- `npm run build`: passed.

Manual verification:
- Completed Counter Route with `walls = 2` visible in Trace variables.
- Completed Toggle Corridor with `turn_left_next` persisting across ticks.
- Switched freely from a completed Chapter 2 level back to The Wall with an idle, empty replay state.

Next:
- Strengthen RoboC++ runtime validation and player-facing language errors.

## Expedition Combat Readability Pass / 2026-09-03

Implemented after comparing the reference project's explicit per-turn punishment and failure feedback:
- Separated pursuit from contact damage. Expedition enemies move on their movement cadence, then attack only on a visible attack cadence instead of dealing damage every adjacent tick.
- Added attack cadence to expedition mission briefs so players can plan around the next danger window.
- Kept the existing single-use Pulse Interference as a timing tool; a player can now pause/step after pursuit and spend energy before the attack beat.

Verification:
- `npm test`: 41 tests passed.
- `npm run build`: passed.
- Browser playthrough from a fresh state completed: combat → event → elite → shop repair → elite → event → BOSS → victory.

## Roguelite Flow & Map Variety Pass / 2026-09-03

Implemented:
- Replaced the always-visible reward row with a post-node reward modal. Clearing a node now creates a deliberate “open loot” moment; the modal summarizes the outcome and presents three build cards before route progression.
- Added a clear close/reopen path so closing the modal never loses a pending reward.
- Expanded the ordinary expedition battlefield from a one-lane strip to a five-row arena with side chambers and a central obstacle, while retaining a guaranteed straight extraction lane for the starter firmware.
- Added responsive modal styling, card selection states, and mobile stacking so the reward moment reads like a roguelite choice instead of a permanent form.
- Duplicate module picks now convert into +2 credits, making every reward choice useful across a run.

Verification:
- `npm test`: 42 tests passed.
- `npm run build`: passed.
- Browser verified the new reward modal appears only after tactical settlement and that selecting a module advances to the next route node.

## Beginner Experience Pass / 2026-09-03

Implemented:
- Replaced the generic overlay with a three-step guide explaining `update()`, sensors versus actions, one-action-per-tick, and the build/run sequence.
- Changed the default firmware to the smallest successful First Boot program.
- Added per-level starter firmware and a plain-language “本关怎么想” card with API explanations.
- Added “载入本关示例” so a new player can recover to a known-good solution without understanding all syntax.
- Fixed paused editor state so code can be edited and hot-reloaded without losing debugger state.

Verification:
- Browser stepped through all three guide pages, loaded the example, built and completed First Boot, and observed Trace output.
- Mobile 390px viewport remained free of horizontal overflow.

## M5 Debugger Extensions / 2026-09-03

Implemented:
- Added variable watchpoints with first-tick baselines, change-triggered pause, and `WATCHPOINT:<name>` Trace events.
- Added a visible watch list and current values to the debugger controls.
- Added serializable Failure Core Dumps for runtime errors and robot destruction, including source line, world state, variables, and recent frames.

Tests:
- `npm test`: 20 tests passed.
- `npm run build`: passed.

## M6-M8 Vertical Slice / 2026-09-03

Implemented and verified:
- Bounded `for` loops, typed fixed-size arrays with bounds checks, user-defined functions, and call-depth protection.
- Deterministic snapshots/rollback plus profiler counters in the trace surface.
- Seeded Expedition route with combat, elite, event, shop, and boss nodes; three typed rewards; settlement statistics and Chinese UI controls.

Verification:
- `npm test`: 25 tests passed.
- `npm run build`: passed.
- Browser smoke test: Expedition route/reward confirmation advanced from node 0 to node 1; First Boot completed in the UI; desktop viewport had no horizontal overflow.

## M9 Polish / 2026-09-03

Implemented:
- Added dismissible Chinese first-launch tutorial with settings reopen action.
- Added optional Web Audio feedback for run, success, and failure states plus movement/status visual polish.
- Added local firmware persistence, audio preference, tutorial state, and recent build history.
- Added limited paused-state hot reload and final demo README/screenshot.

Verification:
- `npm test`: 26 tests passed.
- `npm run build`: passed.
- Browser confirmed tutorial dismissal, settings panel, expedition route, and zero desktop horizontal overflow.

## Expedition Fun Pass / 2026-09-03

Implemented:
- Reworked Expedition from passive reward clicks into action -> outcome -> reward decisions.
- Added distinct combat, elite, event, shop, and boss action sets with deterministic risk/reward outcomes.
- Added reward synergies (damage, mitigation, event income, shop cost), acquired-build chips, action log, outcome readout, and correct boss escape settlement.

Verification:
- `npm test`: 29 tests passed.
- `npm run build`: passed.
- Browser personally completed all five Story levels and a full seven-node Expedition route after the rework.

## M4 Strict Runtime Validation / 2026-09-03

Implemented:
- Reworked the RoboC++ parser/interpreter into a typed, source-located runtime.
- Added undefined-variable, duplicate declaration, assignment type, initializer type, condition type, builtin arity, division/modulo-by-zero, update signature, and void-return validation.
- Added boolean short-circuit semantics and restricted cross-tick persistence to declared globals.
- Propagated runtime error line/column into the console, source highlight, and Trace event.

Tests:
- Added strict runtime, local/global lifetime, short-circuit, and Simulation error-frame coverage.
- Browser verified a division-by-zero failure at line 3 with Chinese error UI and Trace highlighting.
- Browser regression completed all five Story levels after the interpreter rewrite.

Next:
- Implement Watch display and a basic watchpoint debugger ability.

## Bilingual Interface Refresh / 2026-09-02

Implemented:
- Rebuilt the interface around Story navigation, firmware workbench, simulation chamber, console, and execution trace surfaces.
- Added Chinese controls, objectives, status, console messages, Trace labels, and level names while preserving RoboC++ API terminology.
- Added local pixel-style SVG assets for the directional robot, Slime, and exit.
- Added HP/energy meters, completion summary, stronger selected/completed level states, and clearer Trace inspection.
- Added responsive desktop, tablet, and mobile layouts.

Tests:
- `npm test`: 12 tests passed.
- `npm run build`: passed.
- Browser playthrough completed all five levels through the redesigned UI at ticks 5, 8, 7, 9, and 11.
- Breakpoint Trace displayed `命中断点`, resumed correctly, and completed First Boot with five frames.
- Mobile viewport had no horizontal overflow and no clipped button labels.

Next:
- Strengthen RoboC++ runtime validation and player-facing language errors.

## Firmware Grade Direct Rewards / 2026-09-04

Implemented:
- Removed the post-combat tactical settlement menu. A successful expedition battle now resolves immediately from the firmware grade (S/A/B/C) and auto-grants the matching module or emergency resources.
- Moved combat reward resolution into `ExpeditionRun.resolveBattle(ticks, damageTaken, enemyMaxHp, grade)` and removed the now-unused `recordBattlePerformance` and combat tactical action list.
- Updated auto-demo and unit tests to the direct-resolution flow, including grade-to-reward mapping and hull/credits carryover.

Verification:
- `npm test`: 58 tests passed.
- `npm run build`: passed.
## Dungeon Vertical Slice — Data + UI / 2026-09-05

Implemented:
- New `src/dungeon.ts` fixed 4-room slice data: Start → Combat → Event → Exit; each room has local `interior` shapes, rooms separated by corridors and bidirectional doors.
- `Simulation` now supports a unified dungeon coordinate model: robot `{x,y,roomId}` (corridor `roomId=null`), enemy/item/exit converted once to global coordinates at reset; `move_forward/back/dash` sync room after every step; success uses `exitPoint`.
- `DEMO_DUNGEON_SCENARIO` is loaded from the top-bar 地牢演示 button or `?demo=dungeon`; the right World panel renders a single dungeon canvas directly from `sim.dungeon` + `sim.robot/enemy/items/exitPoint` (no UI-side map copies): 4 separated rooms, corridors, door cells, START/COMBAT/EVENT/EXIT labels, and an active-room glow.
- Dungeon mode reuses run/pause/single-step/breakpoint/watch/snapshot controls; Debugger internals and Story/Expedition renderers are untouched.

Verification:
- `npm test`: 78 passed (including cross-room Start→Combat→Event→Exit movement plus pause/step/breakpoint regression).
- `npm run build`: passed.
- Live screenshot: `docs-dungeon-slice.png` at `http://127.0.0.1:5173/?demo=dungeon`.

Next (after review): Phase 2 randomized Dungeon (6–10 rooms, seeds, BFS reachability), then Rogue events/rewards.