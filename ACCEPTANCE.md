# Acceptance

## M0-M2

1. `npm install`, `npm run build`, and `npm test` complete successfully.
2. A player can edit RoboC++ and press BUILD to receive success or line/column errors.
3. RUN invokes `update()` repeatedly at a visible interval.
4. `wall_ahead()` changes robot decisions on the fixed map.
5. Only the first world action in a tick is committed.
6. STOP halts the simulation.
7. Each tick appears in Trace Replay with action, sensor, variables, position, facing, and HP.
8. The editor shows stable line numbers and highlights the source line for the selected Trace tick.
9. Selecting another Trace tick updates the highlighted line, including after a completed run.

## M3 Combat Slice

1. The tutorial firmware can read `enemy_ahead()`.
2. `attack()` damages an adjacent Slime while respecting one action per tick.
3. Combat state and events are captured in replay frames.
4. Story navigation exposes five distinct levels: First Boot, The Wall, Decision, Counter Route, and Toggle Corridor.
5. Each level resets its map, objective, and enemy state while reusing the same firmware runtime.
6. Every Story level has an automated solvability strategy, and Chapter 2 state levels reject the original stateless wall strategy.

## M5 Debugger Slice

1. A player can enter a positive source line and set a visible breakpoint.
2. RUN pauses automatically when an action executes on that line and records a `BREAKPOINT` trace event.
3. PAUSE freezes tick progression; RESUME continues the same run without creating duplicate timers.
4. STOP clears active execution and returns the simulation to an idle state.

## M4 Language State

1. Global `int` and `bool` values persist across ticks while local variables reset for each `update()` call.
2. Undefined reads/assignments, type mismatches, non-boolean conditions, invalid builtin arguments, and division/modulo by zero terminate safely.
3. Runtime errors include source line and column, stop the simulation, appear in the console, and create a `RUNTIME_ERROR` Trace frame on the failing line.
4. Boolean `&&` and `||` use short-circuit evaluation.

## Story Progress Persistence

1. Completing a story level records it as completed after the run stops.
2. Refreshing or reopening the game restores completed level indicators and the most recently selected level.
3. All story levels remain selectable regardless of completion state.
4. Malformed or outdated local progress is ignored without preventing the game from loading.

## M5 Debugger Extensions

1. A player can add a valid variable name to the watch list and see its value in the debugger bar and selected trace frame.
2. A watched value changing between ticks pauses the run and records a `WATCHPOINT:<name>` trace event; unchanged values do not pause.
3. Runtime errors and robot destruction create a Failure Core Dump containing cause, tick, source line when available, robot/enemy state, variables, and recent trace frames.

## Interface Polish

1. Core controls, objectives, status, console feedback, and Trace labels are available in Chinese while RoboC++ API names remain unchanged.
2. Robot, Slime, exit, walls, HP, energy, selected level, and completed levels are visually distinct.
3. Desktop presents editor and world side by side; narrow screens use a single-column layout without horizontal overflow or clipped button labels.
4. All five levels remain buildable, runnable, traceable, and completable through the redesigned interface.

## M6-M8 Vertical Slice

1. `for` loops are bounded, fixed-size arrays reject invalid access, and user functions enforce argument types and call depth.
2. A simulation snapshot can be restored deterministically; the trace inspector shows lightweight tick/action/error profile counts.
3. Expedition uses a deterministic seed, exposes combat/elite/event/shop/boss route nodes, presents three typed rewards, and records settlement statistics.
4. Each Expedition node requires an action before rewards appear; combat, elite, and boss nodes additionally require a successful firmware simulation (build + run to exit). Node-specific outcomes and acquired rewards modify later results and are visible in the route/build/settlement UI.

## M9 Polish

1. First launch provides a dismissible Chinese tutorial overlay covering edit/build/run/observe/debug; it can be reopened from settings.
2. Run, success, and failure states provide visual status feedback and optional local audio feedback controlled by settings.
3. Firmware, audio preference, tutorial dismissal, and recent build times persist locally; the final README documents the playable demo flow.
4. A first-time player can understand the update loop, sensor/action distinction, and first-run sequence from the guide, load a level example, build it, run it, and reach a successful trace without prior C++ knowledge.
