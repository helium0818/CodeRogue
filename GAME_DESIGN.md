# Game Design

## Pillars

- Players type RoboC++ text; the program is the robot's persistent brain.
- `update()` runs continuously in a tick-driven simulation.
- At most one world-changing action commits per tick.
- Build, Run, Observe, Trace, Debug, Improve is the core loop.

## Current Story Slice

Story 0-2, *The Wall*, uses a fixed map and teaches `if/else`, `bool wall_ahead()`, `turn_right()`, and `move_forward()`. Expedition, combat variety, and debugger upgrades build on the same kernel after the slice is stable.

The first combat slice adds a Slime with two hit points. `enemy_ahead()` exposes adjacency and `attack()` consumes one action and one energy; contact can damage the robot on a later tick.

Story currently contains seven short levels: First Boot (straight exit), The Wall (turning around obstacles), Decision (Slime combat before extraction), Counter Route (`int` state across ticks), Toggle Corridor (`bool` state across ticks), Ranged First (`enemy_near()` + `ranged_attack()`), and Shield Rhythm (`shield()` + `attack()` alternation).

Chapter 2 routes deliberately present repeated `wall_ahead()` situations that require different decisions. Stateless right-turn firmware loops instead of reaching the exit, while persistent integer or boolean state lets the robot remember prior encounters.

Story progress is persistent but never restrictive: completed levels and the most recently selected level are saved locally, while every story level remains freely selectable for replay and debugging.

## Upgrade Taxonomy

Future rewards are API, Sensor, Runtime, and Debugger abilities. Debugger abilities change how a player observes or intervenes in a run, not only numeric power.

The first debugger ability is a source-line Breakpoint. During a run it pauses the simulation before the next tick, records the hit in Trace Replay, and can be resumed without resetting the level. A configured breakpoint triggers once per run so RESUME remains meaningful; starting a new run arms it again.

Expedition combat resolves immediately from firmware grade: S/A/B directly grant a module and C grants emergency resources, so there is no separate tactical settlement menu. Event, shop, rest, and branch nodes keep an explicit action choice before loot. API, Sensor, Runtime, and Debugger rewards alter later simulations, and the route exposes combat, elite, event, shop, rest, branch, and boss decisions with visible build and settlement state.

## Interface Direction

The playable interface uses Chinese for objectives, status, controls, and player feedback while preserving English RoboC++ API names and engineering labels. The visual language combines a restrained IDE workbench with pixel-style robot, enemy, and exit assets so code, world state, and execution trace remain equally prominent.

The first-time experience assumes no programming background. A three-step guide explains the `update()` loop, the difference between sensors and actions, and the exact first-run sequence. Each Story level exposes a starter firmware button and a plain-language “how to think” card; players are encouraged to run a known-good example before changing one line.

## Ten-pass Gameplay Iteration

The firmware grade is the settlement: battles reward S/A/B/C directly, while ordinary/elite fields forbid melee and the boss forbids ranged_attack so a single generic program cannot farm every node. Failed robot deployments cost hull, zero hull ends the run, and later nodes scale enemy HP and cadence. Modules now include behavior changes such as extended enemy_near range, and meta credits purchase persistent ship upgrades.

The expedition UI deliberately separates combat from route decisions: non-combat nodes never run firmware, and an action must be explicitly selected before confirmation. The visual shell uses a warm, textured cockpit treatment with threat emphasis so the player reads danger and intent before technical telemetry.

Combat is not passive playback: ordinary encounters now apply pursuit pressure, expose a proximity warning, and provide one emergency Pulse Interference per deployment. The pulse costs three energy, damages a nearby enemy, records a trace action, and cannot be spammed; its value comes from timing.
