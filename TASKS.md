# Tasks

## M0 Foundation

- [x] Vite + Vue + TypeScript project
- [x] Documentation baseline
- [x] Build and test scripts

## M1 Code Controls Robot

- [x] Lexer and parser for first language subset
- [x] Safe interpreter and operation limit
- [x] Tick engine, map, movement, turning, wall sensor
- [x] One action per tick
- [x] Build / Run / Stop UI

## M2 Trace & Replay

- [x] Trace frames with sensors, variables, action, robot state
- [x] Timeline and selected tick inspector
- [x] Source line tracking in AST and TraceFrame
- [x] Rich editor line highlighting

## Next

- [x] Enemy and combat chapter (Slime + enemy_ahead + attack kernel)
- [x] Story level selection (3 data-driven levels)
- [x] End-to-end solvability checks for all Story levels
- [x] Breakpoint / pause debugger ability
- [x] Story progress persistence
- [x] Expand Story to at least 5 short, solvable teaching levels

## M4 Language State

- [x] Persistent `int` and `bool` globals across ticks
- [x] Assignment, arithmetic, comparison, unary state toggle, and `return`
- [x] Strengthen runtime validation and clear language errors

## M5 Debugger

- [x] Breakpoint and pause/resume
- [x] Watch display and basic watchpoint
- [x] Failure core dump

## M6 Language Expansion

- [x] Bounded loops
- [x] Fixed-size arrays or small collection
- [x] User-defined functions and call-depth limits

## M7 Advanced Debugger

- [x] Deterministic snapshot and rollback
- [x] Limited hot reload
- [x] Runtime profiler

## M8 Expedition

- [x] Seeded route and encounters
- [x] Three-choice API/Sensor/Runtime/Debugger rewards
- [x] Additional enemies, elite, event, shop, and boss
- [x] Run settlement and statistics

## M9 Polish

- [x] Bilingual visual interface refresh
- [x] Pixel-style game assets and responsive layout
- [x] Tutorial prompts, animation/audio feedback, and final demo flow
- [x] Save/settings history and final README/screenshots

## M10 Ten-pass Gameplay Depth

- [x] Distinct combat, elite, and boss firmware challenges
- [x] Moving enemy pressure and battlefield-specific tactical briefs
- [x] Retryable deployment failure with preserved code and trace
- [x] Firmware grade directly resolves post-combat rewards (no tactical settlement menu)
- [x] Real simulation effects for all four module families
- [x] Persistent expedition hull across route nodes
- [x] Event damage carries into later combat
- [x] Shop repair changes hull and validates credits
- [x] Battle performance grade based on speed and damage
- [x] Fresh-run browser validation of success and failure paths
- [x] Expedition live intervention: pause, single-tick stepping, keyboard shortcuts, and threat warning
- [x] Explicit route-node selection and non-combat firmware lockout
- [x] Cockpit visual pass with textured background, panel hierarchy, and threat framing
- [x] Active combat intervention with one-shot Pulse Interference and proximity warning
- [x] Increased ordinary/elite enemy pressure and scenario objectives

## M11 Difficulty & Meaningful Choice

- [x] Anti-generic constraints: ranged-only combat/elite and melee-only boss with function-name boundary matching
- [x] Reference solution gated behind a failed attempt
- [x] Failed deployment deducts hull; zero hull ends the run as lost
- [x] Meta upgrade catalog and purchase persistence implemented and applied to expedition modifiers
- [x] Behavioral module: sonar extends enemy_near sensor range and is visible in Trace
- [x] Route-depth difficulty tuning: shared scaling raises enemy HP and cadence in late nodes
## M12 Feedback & Pacing

- [x] Settlement console explains grade score across damage/speed/energy/discipline/sensors
- [x] Loot cards confirm on click; modal confirm remains for deliberate choice
- [x] Story 3-1 Ranged First teaches enemy_near() and ranged_attack() before expedition
- [x] Route grid already uses auto-fit minmax columns; verified for 7-10 node routes
## M13 Fairness & Clarity

- [x] Battle gates show required/forbidden function hints before first run
- [x] Story API guide includes attack() and ranged_attack()
- [x] Combat auto-rewards prefer zero-downside modules and fall back to emergency credits
- [x] Story 3-2 Shield Rhythm teaches shield() + bool alternation under per-tick enemy attacks
- [x] Add rest/整备点 node after shop with free hull repair choice
## M14 Fresh-Run Fairness

- [x] Guaranteed rest before boss in addition to post-shop rest, keeping route length 7-10
- [x] Fresh-run fairness regression sweeps seeds 1-30 without meta upgrades
- [x] Route branch offers meaningful alternate next nodes (elite shortcut vs safe event) [superseded by M16/M21]
- [x] Shield/rest balance validated by 100-seed fresh runs on both branch choices
## M15 Meta Feedback

- [x] Persist last five expedition records (seed/result/progress/credits/rewards/grade)
- [x] Settings panel shows recent expedition history
- [x] Route branch alternatives implemented in M16 and stress-tested in M21
## M16 Route Planning

- [x] Route intelligence meta upgrade reveals future two nodes
- [x] Route branch node lets players choose event (safe) or elite (risk) for the next node, with length preserved
## M17 Trace & Teaching Clarity

- [x] Trace action names cover ranged_attack/shield/repair/dash/back/pulse
- [x] Story chapter labels distinguish 3-1 (远程) from 3-2 (防御战术)
## M18 Seed Stress Coverage

- [x] Sweep seeds 1-100 with fresh no-meta runs: 0 failures
- [x] Keep 100-seed regression in the test suite
## M19 Story Replay Targets

- [x] Persist best grade and best ticks per Story level
- [x] Show best grade in level list and new-record notice in console
## M20 Story-Meta Economy

- [x] Improved Story records grant one-time credits by grade (S/A/B)
- [x] No repeat farming because credits only trigger on record improvement
## M21 Risk-Branch Fairness

- [x] 100-seed regression proves elite-shortcut branch stays completable for fresh no-meta runs
## M22 Seed Sharing

- [x] Copy current/input seed to clipboard for sharing and reproduction
## M23 Reference Exploit Closure

- [x] Reference solution limited to once per expedition run
- [x] Runtime errors no longer unlock the reference
## M24 Report Polish

- [x] Expedition report shows recent action trail
- [x] REVIEW risk list refreshed to current gameplay state
## M25 Visible Grade Card

- [x] Persistent grade card shows score reasons after each expedition battle until next node
## M26 Elite Constraint Mutation

- [x] Elite pool includes melee-only "贴脸拆塔" variant with reversed API restriction
- [x] Generic ranged firmware cannot fit every elite roll
## M27 Abandon Farming Closure

- [x] Only completed or lost runs bank credits and run counts
- [x] Mid-run exit records a lost history entry without granting economy rewards
## M28 Auto-Demo Economy Lock

- [x] Auto-demo runs no longer bank meta credits/runs/bestGrade
## M29 Replay Visibility

- [x] Settings shows best grade for every Story level
## M30 Draft Integrity

- [x] Melee elite draft no longer equals its solution
- [x] Every scenario has an explicit solutionCode separate from starterCode
## M31 Draft Integrity Regression

- [x] Generic regression covers every expedition battlefield starter draft
## M32 Ordinary Combat Mutation

- [x] Ordinary combat pool includes melee-only "贴身突破" variant
- [x] Fresh-run fairness re-verified after pool expansion
## M33 Visual Evidence

- [x] Capture current UI screenshot with local headless Chrome
- [x] README preview points to the current screenshot
## M34 Screenshot Chain

- [x] Story and Expedition demo entry points via URL params
- [x] README gallery shows default/Story/Expedition screenshots
## M35 Behavior Modules II

- [x] Longshot module extends ranged_attack range to 3
- [x] Sonar vs Longshot creates two behavior-driven build directions
## M36 Detection Consistency

- [x] UI visibility and fog use sensor detection range
- [x] Sonar module now visibly reveals enemies at range 3
## M37 Runner Threat

- [x] Runner contact now destroys the robot
- [x] Regression proves ranged-first is mandatory for runner fights
## M38 Enemy Behavior Propagation

- [x] Simulation.reset preserves enemy kind/cadence/range from scenario
- [x] Tank/swarm/slime/runner/turret/guard behaviors now actually affect gameplay
- [x] Guard elite prototype immune to ranged, requires melee
## M39 Enemy Reset Guard

- [x] Regression verifies archetype and cadence survive reset for all enemy kinds
## M40 Enemy Intel UI

- [x] Mission brief shows enemy kind name and live cadence from simulation
## M41 Text Polish

- [x] Player-visible English statuses localized to Chinese
## M42 Node Map Variety

- [x] Event/shop/rest/branch each render distinct themed maps
- [x] Desktop map tiles enlarged for readability
## M43 Route Experiment Rollback

- [x] Node-specific maps kept; stable route restored
- [x] Risk autopilot over-promise removed from tests/docs
- [ ] Combat-heavy expedition to be designed as a separate difficulty mode with its own balance
## M44 Enemy Visual Identity

- [x] Per-kind enemy sprites rendered by enemy kind
## M45 Dungeon Core Model

- [x] Fixed 4-room dungeon data with rooms/corridors/doors
- [x] Simulation uses global coords + roomId (null in corridor)
- [x] Entities converted once to global coordinates at reset
- [x] move_forward/dash/back sync roomId
- [ ] Dungeon UI rendering and expedition demo entry (next)