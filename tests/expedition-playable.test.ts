import { describe, expect, it } from 'vitest';
import { EXPEDITION_HUB_SCENARIO, pickScenario, Simulation } from '../src/core';

describe('Expedition mode playable invariants', () => {
  it('ships at least 10 distinct rectangular map templates across nodes/seeds', () => {
    const maps = new Set<string>();
    for (const kind of ['combat', 'elite', 'boss'] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        for (let index = 0; index < 5; index++) {
          const scenario = pickScenario(kind, seed, index);
          const mapRows = scenario.map!; expect(mapRows).toHaveLength(mapRows.length);
          expect(new Set(mapRows.map((r) => r.length)).size).toBe(1);
          maps.add(JSON.stringify(mapRows));
        }
      }
    }
    maps.add(JSON.stringify(EXPEDITION_HUB_SCENARIO.map));
    expect(maps.size).toBeGreaterThanOrEqual(10);
  });

  it('ship solution firmware for representative expedition nodes builds and reaches success', () => {
    const cases = [
      pickScenario('combat', 1, 0),
      pickScenario('elite', 1, 0),
      pickScenario('boss', 1, 0),
      pickScenario('combat', 42, 4),
    ];
    for (const scenario of cases) {
      const code = scenario.solutionCode ?? scenario.starterCode;
      const sim = new Simulation();
      sim.setScenario(scenario);
      expect(sim.build(code).ok, scenario.id).toBe(true);
      sim.reset();
      let reached = false;
      for (let i = 0; i < 260 && sim.status === 'running'; i++) {
        sim.step();
        if ((sim as unknown as {status:string}).status === 'success') { reached = true; break; }
      }
      expect(reached, scenario.id + ' should reach exit').toBe(true);
      expect(sim.robot.x).toBeGreaterThan(0);
    }
  });
});