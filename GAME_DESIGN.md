# Game Design

## Pillars

- Players type RoboC++ text; the program is the robot's persistent brain.
- `update()` runs continuously in a tick-driven simulation.
- At most one world-changing action commits per tick.
- Build, Run, Observe, Trace, Debug, Improve is the core loop.

## Current Story Slice

Story 0-2, *The Wall*, uses a fixed map and teaches `if/else`, `bool wall_ahead()`, `turn_right()`, and `move_forward()`. Expedition, combat variety, and debugger upgrades build on the same kernel after the slice is stable.

The first combat slice adds a Slime with two hit points. `enemy_ahead()` exposes adjacency and `attack()` consumes one action and one energy; contact can damage the robot on a later tick.

Story currently contains five short levels: First Boot (straight exit), The Wall (turning around obstacles), Decision (Slime combat before extraction), Counter Route (`int` state across ticks), and Toggle Corridor (`bool` state across ticks).

Chapter 2 routes deliberately present repeated `wall_ahead()` situations that require different decisions. Stateless right-turn firmware loops instead of reaching the exit, while persistent integer or boolean state lets the robot remember prior encounters.

Story progress is persistent but never restrictive: completed levels and the most recently selected level are saved locally, while every story level remains freely selectable for replay and debugging.

## Upgrade Taxonomy

Future rewards are API, Sensor, Runtime, and Debugger abilities. Debugger abilities change how a player observes or intervenes in a run, not only numeric power.

The first debugger ability is a source-line Breakpoint. During a run it pauses the simulation before the next tick, records the hit in Trace Replay, and can be resumed without resetting the level. A configured breakpoint triggers once per run so RESUME remains meaningful; starting a new run arms it again.

Expedition nodes now follow a two-step risk loop: choose an action appropriate to the node type, resolve deterministic damage/credits, then choose one of three rewards. API, Sensor, Runtime, and Debugger rewards alter later outcomes (damage, mitigation, event income, or shop cost), so a route is a small build rather than a sequence of passive menus. The route exposes combat, elite, event, shop, and boss decisions and shows the current build and settlement result.

## Interface Direction

The playable interface uses Chinese for objectives, status, controls, and player feedback while preserving English RoboC++ API names and engineering labels. The visual language combines a restrained IDE workbench with pixel-style robot, enemy, and exit assets so code, world state, and execution trace remain equally prominent.

The first-time experience assumes no programming background. A three-step guide explains the `update()` loop, the difference between sensors and actions, and the exact first-run sequence. Each Story level exposes a starter firmware button and a plain-language “how to think” card; players are encouraged to run a known-good example before changing one line.

## Ten-pass Gameplay Iteration

The expedition now treats a successful program as the start of a decision rather than the entire reward. Ten concrete passes established: distinct battlefield firmware, moving enemy pressure, node-specific tactical briefs, explicit retryable failure, combat tactical settlement, meaningful typed modules, persistent route hull, damaging risk events, paid shop repairs with affordability validation, and visible performance grading. Together these make code quality, route risk, and build choices affect one another across the full run.

The expedition UI deliberately separates combat from route decisions: non-combat nodes never run firmware, and an action must be explicitly selected before confirmation. The visual shell uses a warm, textured cockpit treatment with threat emphasis so the player reads danger and intent before technical telemetry.

Combat is not passive playback: ordinary encounters now apply pursuit pressure, expose a proximity warning, and provide one emergency Pulse Interference per deployment. The pulse costs three energy, damages a nearby enemy, records a trace action, and cannot be spammed; its value comes from timing.
