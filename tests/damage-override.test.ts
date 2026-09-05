import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/core';
import { DungeonLayout } from '../src/dungeon';

function floorDungeon(w: number, h = 5): DungeonLayout {
  return {
    width: w,
    height: h,
    rooms: [{
      id: 'arena',
      type: 'combat',
      x: 0,
      y: 0,
      width: w,
      height: h,
      interior: Array.from({ length: h }, () => '.'.repeat(w)),
      items: [],
    }],
    corridors: [],
    doors: [],
  };
}

function make(enemies: any[], code = 'void update(){ turn_left(); }', w = 24, mods?: any) {
  const sim = new Simulation();
  sim.setScenario({
    id: 'multi',
    title: 'multi',
    objective: 'multi',
    dungeon: floorDungeon(w),
    starterCode: code,
    solutionCode: code,
    tactics: [],
    enemies,
  }, mods);
  expect(sim.build(code).ok).toBe(true);
  sim.reset();
  return sim;
}

function stepN(sim: Simulation, n: number) {
  for (let i = 0; i < n && sim.status === 'running'; i++) sim.step();
}

describe('Level 2 per-enemy damage override', () => {
  it('legacy enemy without damage uses global incomingDamage exactly as before', () => {
    const sim = make(
      [{ x: 2, y: 1, hp: 5, kind: 'slime', attackEvery: 1 }],
      'void update(){ turn_left(); }',
      10,
      { maxHp: 10, maxEnergy: 50, attackPower: 1, moveEnergyCost: 1, incomingDamage: 2 },
    );
    expect(sim.robot.hp).toBe(10);
    stepN(sim, 1);
    expect(sim.robot.hp).toBe(8);
  });

  it('guard damage=5 and turret damage=1 use per-enemy base damage, not the global value', () => {
    const sim = make(
      [
        { x: 2, y: 1, hp: 6, damage: 5, kind: 'guard', attackEvery: 1 },
        { x: 3, y: 1, hp: 2, damage: 1, kind: 'turret', range: 5, attackEvery: 1 },
      ],
      'void update(){ turn_left(); }',
      10,
      { maxHp: 10, maxEnergy: 50, attackPower: 1, moveEnergyCost: 1, incomingDamage: 99 },
    );
    stepN(sim, 1);
    expect(sim.robot.hp).toBe(4);
  });

  it('dash blocks on any active enemy in a multi-enemy field', () => {
    const sim = make(
      [
        { x: 3, y: 1, hp: 3, kind: 'slime', active: true },
        { x: 4, y: 1, hp: 3, kind: 'slime', active: true },
      ],
      'void update(){ dash(); }',
      10,
      { maxHp: 10, maxEnergy: 50, attackPower: 1, moveEnergyCost: 1, incomingDamage: 1 },
    );
    stepN(sim, 1);
    expect(sim.robot.x).toBe(2);
    expect(sim.enemies[0].hp).toBe(3);
    expect(sim.enemies[1].hp).toBe(3);
  });
});
