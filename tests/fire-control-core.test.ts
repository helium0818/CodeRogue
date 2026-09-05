import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_CODE,
  FIRE_CONTROL_CORE,
  HOTPATCH_START_CODE,
  KITE_CODE,
  NAIVE_CODE,
  STANDARD_CODE,
  simulateRogueCombat,
} from '../src/finalRogueRun';

describe('Combat 03 Fire Control Core', () => {
  it('fixed map has active turret + tank and a dormant runner that is the activation threat', () => {
    expect(FIRE_CONTROL_CORE.ascii).toHaveLength(16);
    expect(FIRE_CONTROL_CORE.ascii.every((row) => row.length === 36)).toBe(true);
    expect(FIRE_CONTROL_CORE.enemies).toHaveLength(3);
    const [turret, tank, runner] = FIRE_CONTROL_CORE.enemies;
    expect(turret.kind).toBe('turret');
    expect(turret.hp).toBe(2);
    expect(turret.range).toBe(5);
    expect(turret.attackEvery).toBe(2);
    expect(turret.active).not.toBe(false);
    expect(tank.kind).toBe('tank');
    expect(tank.hp).toBe(6);
    expect(tank.moveEvery).toBe(12);
    expect(tank.active).not.toBe(false);
    expect(runner.kind).toBe('runner');
    expect(runner.hp).toBe(2);
    expect(runner.active).toBe(false);
    expect(FIRE_CONTROL_CORE.swarmActivateX).toBe(21);
    expect(FIRE_CONTROL_CORE.modifiers?.maxHp).toBe(8);
    expect(FIRE_CONTROL_CORE.modifiers?.maxEnergy).toBe(110);
  });

  it('navigation-only firmware reaches the fire-control route checkpoint with real turns', () => {
    const navEnc = {
      ...FIRE_CONTROL_CORE,
      enemies: FIRE_CONTROL_CORE.enemies.map((e) => ({ ...e, active: false })),
    };
    const nav = simulateRogueCombat(navEnc, ADAPTIVE_CODE, {
      activation: false,
      goal: { x: 28, y: 5 },
      maxTicks: 90,
    });
    expect(nav.reachedRouteGoal).toBe(true);
    expect(nav.turnCount).toBeGreaterThanOrEqual(2);
    expect(nav.ticks).toBeLessThan(60);
  });

  it('naive forward firmware is blocked by the lower access hall wall', () => {
    const naive = simulateRogueCombat(FIRE_CONTROL_CORE, NAIVE_CODE, { maxTicks: 130 });
    expect(naive.success).toBe(false);
    expect(naive.turnCount).toBe(0);
    expect(naive.activationTick).toBeGreaterThanOrEqual(0);
  });

  it('STANDARD walks into Runner contact and explodes; ADAPTIVE dashes to intercept at range 2 first', () => {
    const standard = simulateRogueCombat(FIRE_CONTROL_CORE, STANDARD_CODE);
    const adaptive = simulateRogueCombat(FIRE_CONTROL_CORE, ADAPTIVE_CODE);

    expect(standard.success).toBe(false);
    expect(standard.hp).toBe(0);
    expect(standard.ticks).toBe(30);
    expect(standard.killOrder).toEqual(['runner']);
    expect(standard.firstDashTick).toBeUndefined();

    expect(adaptive.success).toBe(true);
    expect(adaptive.ticks).toBe(49);
    expect(adaptive.hp).toBeGreaterThan(0);
    expect(adaptive.energy).toBeGreaterThanOrEqual(20);
    expect(adaptive.damageTaken).toBeGreaterThan(0);
    expect(adaptive.turnCount).toBeGreaterThanOrEqual(2);
    expect(adaptive.firstDashTick).toBe(26);
    expect(adaptive.killOrder).toEqual(['runner', 'turret', 'tank']);
    expect(adaptive.actedCount).toEqual([1, 1, 1]);
  });

  it('all three enemies are really active in the same Simulation window and activation fires', () => {
    const adaptive = simulateRogueCombat(FIRE_CONTROL_CORE, ADAPTIVE_CODE);
    expect(adaptive.activationTick).toBeGreaterThanOrEqual(0);
    expect(adaptive.maxSimultaneousActive).toBe(3);
    expect(adaptive.killOrder).toHaveLength(3);
    expect(adaptive.rangedShots ?? 0).toBeGreaterThanOrEqual(5);
  });
  it('KITE strategy clears Fire Control with a real shoot-and-back pull loop', () => {
    const kite = simulateRogueCombat(FIRE_CONTROL_CORE, KITE_CODE);
    expect(kite.success).toBe(true);
    expect(kite.hp).toBeGreaterThan(0);
    expect(kite.killOrder).toEqual(['runner', 'turret', 'tank']);
    expect(kite.turnCount).toBeGreaterThanOrEqual(2);
    expect(kite.energy).toBeGreaterThan(0);
  });
  it('hot-patch starter fails until its range threshold is hot-fixed back to <=2', () => {
    const broken = simulateRogueCombat(FIRE_CONTROL_CORE, HOTPATCH_START_CODE);
    const fixed = simulateRogueCombat(FIRE_CONTROL_CORE, HOTPATCH_START_CODE.replace('distance_to_enemy() <= 1', 'distance_to_enemy() <= 2'));
    expect(broken.success).toBe(false);
    expect(fixed.success).toBe(true);
    expect(fixed.killOrder).toEqual(['runner', 'turret', 'tank']);
  });
});
