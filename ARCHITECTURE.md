# Architecture

`src/language.ts` implements the safe RoboC++ pipeline: Lexer -> Parser/AST -> Interpreter. No `eval`, dynamic Function, compiler, or user binary is used.

The interpreter maintains separate declared-type and value environments. Only declared globals are committed between ticks; locals are recreated for each `update()` call. Runtime guards enforce boolean conditions, typed assignment, defined variables, zero-safe arithmetic, builtin arity, void returns, short-circuit boolean operators, and the per-tick operation budget. Controlled `RoboError` values carry source line/column into TickResult and TraceFrame.

`src/core.ts` owns serializable robot state, map, action resolution, tick progression, deterministic trace frames, and termination. The Vue shell in `src/App.vue` renders editor, world, terminal, and replay inspector; game rules remain outside the component.

Interpreter execution has a per-tick operation budget. RuntimeHost is the narrow bridge for sensors and actions, ensuring one action commit per tick.

Statement and call nodes retain source line metadata. TickResult propagates the committed action's line into TraceFrame so the UI can map a replay decision back to firmware text.

The lightweight editor shell layers a synchronized line-number gutter and source-line highlight behind the native textarea. The selected TraceFrame is the single source of truth for the highlighted line, so live execution and post-run replay use the same mapping without coupling editor rendering to interpreter execution.

The simulation now includes a data-only Slime enemy and deterministic contact damage. Combat remains an ActionResolver concern and is represented in every trace frame.

The debugger keeps breakpoints as source-line numbers on `Simulation`. A matching action pauses the run and emits a `BREAKPOINT` event in the trace; each configured line is armed again on the next `reset()`. The Vue shell owns the browser timer, clearing it during pause/stop and recreating it only on resume/run.

Story progress uses a versioned, validated local storage record (`coderogue.story-progress.v1`). `loadStoryProgress` filters unknown level IDs and tolerates malformed or unavailable storage; `saveStoryProgress` stores completed level IDs and the selected level. `Simulation` exposes `getProgress`/`applyProgress`, keeping persistence outside the tick and interpreter rules.

Debugger watchpoints are variable-name sets on `Simulation`. Each run establishes a first-tick baseline, then pauses on value changes and records `WATCHPOINT:<name>` in the trace. Failure Core Dumps are serializable snapshots of the failure cause, source location, world state, variables, and the most recent trace frames.

The language parser/interpreter supports bounded `for` loops, fixed-size typed arrays, and user-defined functions with typed parameters and a 32-level call-depth guard. `Simulation.snapshot()` and `rollback()` clone world/trace/interpreter-global state. `ExpeditionRun` provides a seeded route, deterministic three-choice rewards, node progression, and settlement statistics for combat, elite, event, shop, and boss nodes.

`ExpeditionRun.resolveAction()` resolves node-specific risk/reward choices into deterministic pending outcomes. Chosen rewards are tracked as a build and modify subsequent outcomes; `lastOutcome`, route node color coding, and action logs keep the result visible to the player. Boss escape correctly settles as a non-victory extraction.

Story levels are data-driven records containing an ID, title, objective, map, and optional enemy definition. Chapter 2 maps reuse the same deterministic tick engine and rely on interpreter globals for cross-tick decisions; no level-specific solution logic is embedded in the simulation.

The Vue interface is organized into Story navigation, firmware workbench, simulation chamber, system console, and execution trace surfaces. Local SVG sprites in `src/assets` provide directional robot, Slime, and exit visuals. Responsive CSS changes the two-column workbench to a single-column mobile layout without changing simulation behavior.
