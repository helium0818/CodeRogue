import { describe, expect, it } from 'vitest';
import {
  BREACH_CODE,
  BREACH_NO_SHIELD_CODE,
  NAIVE_CODE,
  RANGED_CODE,
  SECURITY_COMPLEX,
  simulateRogueCombat,
} from '../src/finalRogueRun';

describe('Combat 02 Security Complex', () => {
  it('map has 3 enemies: lethal guard, chip turret, dormant slime', () => {
    expect(SECURITY_COMPLEX.enemies).toHaveLength(3);
    const [guard, turret, slime] = SECURITY_COMPLEX.enemies;
    expect(guard.kind).toBe('guard');
    expect(guard.hp).toBe(6);
    expect(guard.damage).toBe(5);
    expect(guard.attackEvery).toBe(6);
    expect(turret.kind).toBe('turret');
    expect(turret.damage).toBe(1);
    expect(turret.hp).toBe(2);
    expect(turret.range).toBe(4);
    expect(slime.kind).toBe('slime');
    expect(slime.damage).toBe(1);
    expect(slime.hp).toBe(2);
    expect(slime.active).toBe(false);
    expect(SECURITY_COMPLEX.modifiers?.maxEnergy).toBe(90);
  });

  it('navigation-only reaches the route checkpoint with at least 6 real turns', () => {
    const navEnc = {
      ...SECURITY_COMPLEX,
      enemies: SECURITY_COMPLEX.enemies.map((e) => ({ ...e, active: false })),
    };
    const nav = simulateRogueCombat(navEnc, BREACH_CODE, {
      activation: false,
      goal: { x: 13, y: 3 },
      maxTicks: 150,
    });
    expect(nav.reachedRouteGoal).toBe(true);
    expect(nav.turnCount).toBeGreaterThanOrEqual(6);
    expect(nav.ticks).toBeLessThan(100);
  });

  it('naive forward is blocked by the canonical polyline and fails', () => {
    const naive = simulateRogueCombat(SECURITY_COMPLEX, NAIVE_CODE, { maxTicks: 180 });
    expect(naive.success).toBe(false);
    expect(naive.turnCount).toBe(0);
    expect(naive.ticks).toBeLessThan(180);
  });

  it('RANGED reaches Guard, repeatedly fires absorbed shots, and runs out of energy', () => {
    const ranged = simulateRogueCombat(SECURITY_COMPLEX, RANGED_CODE, { maxTicks: 120 });
    expect(ranged.firstEnemyNearTick).toBe(20);
    expect(ranged.rangedShots ?? 0).toBeGreaterThanOrEqual(2);
    expect(ranged.actedCount[0]).toBe(0); // Guard HP was never reduced
    expect(ranged.success).toBe(false);
    expect(ranged.energy).toBe(0);
    expect(ranged.hp).toBeGreaterThan(0);
  });

  it('BREACH clears all three enemies with the shield window; no-shield variant dies', () => {
    const breach = simulateRogueCombat(SECURITY_COMPLEX, BREACH_CODE);
    expect(breach.success).toBe(true);
    expect(breach.ticks).toBe(72);
    expect(breach.hp).toBe(1);
    expect(breach.energy).toBeGreaterThanOrEqual(5);
    expect(breach.damageTaken).toBe(5);
    expect(breach.turnCount).toBeGreaterThanOrEqual(6);
    expect(breach.firstDashTick).toBe(20);
    expect(breach.actedCount).toEqual([1, 1, 1]);
    expect(breach.killOrder).toEqual(['guard', 'slime', 'turret']);
    expect(breach.activationTick).toBeGreaterThanOrEqual(0);

    const noShield = simulateRogueCombat(SECURITY_COMPLEX, BREACH_NO_SHIELD_CODE);
    expect(noShield.success).toBe(false);
    expect(noShield.hp).toBe(0);
    expect(noShield.ticks).toBeLessThan(40);
  });

  it('SONAR nearRange fact test: 2 engages at tick 20, 3 engages at tick 18', () => {
    const near2 = simulateRogueCombat(SECURITY_COMPLEX, BREACH_CODE, { nearRange: 2 });
    const near3 = simulateRogueCombat(SECURITY_COMPLEX, BREACH_CODE, { nearRange: 3 });
    expect(near2.success).toBe(true);
    expect(near2.firstEnemyNearTick).toBe(20);
    expect(near2.firstDashTick).toBe(20);
    expect(near3.success).toBe(true);
    expect(near3.firstEnemyNearTick).toBe(18);
    expect(near3.firstDashTick).toBe(18);
    expect(near2.ticks).toBeGreaterThan(near3.ticks);
  });

  it('energy budget 90 is the stable minimum with >=5 reserve; 80 is too tight', () => {
    const at70 = simulateRogueCombat(SECURITY_COMPLEX, BREACH_CODE, { startingEnergy: 70 });
    const at80 = simulateRogueCombat(SECURITY_COMPLEX, BREACH_CODE, { startingEnergy: 80 });
    const at90 = simulateRogueCombat(SECURITY_COMPLEX, BREACH_CODE, { startingEnergy: 90 });
    expect(at70.success).toBe(false);
    expect(at80.success).toBe(true);
    expect(at80.energy).toBeLessThan(5);
    expect(at90.success).toBe(true);
    expect(at90.energy).toBeGreaterThanOrEqual(5);
    expect(at90.ticks).toBe(72);
  });
});
