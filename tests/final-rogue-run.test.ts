import { describe, it, expect } from 'vitest';
import { CONTROL_CODE, NAIVE_CODE, PATROL_CODE, PURSUIT_LABYRINTH, rogueDungeon, simulateRogueCombat } from '../src/finalRogueRun';
describe('Combat 01 Pursuit Labyrinth',()=>{
  it('map has exactly 3 enemies with one initially dormant',()=>{
    expect(PURSUIT_LABYRINTH.enemies).toHaveLength(3);
    expect(PURSUIT_LABYRINTH.enemies[2].kind).toBe('swarm');
    expect(PURSUIT_LABYRINTH.enemies[2].active).toBe(false);
  });
  it('naive forward is blocked by walls',()=>{
    const r=simulateRogueCombat(PURSUIT_LABYRINTH,NAIVE_CODE);
    expect(r.success).toBe(false);
    expect(r.turnCount).toBe(0);
  });
  it('PATROL clearly fails while CONTROL clears all 3 enemies with real turns and activation',()=>{
    const patrol=simulateRogueCombat(PURSUIT_LABYRINTH,PATROL_CODE);
    const control=simulateRogueCombat(PURSUIT_LABYRINTH,CONTROL_CODE);
    expect(patrol.success).toBe(false);
    expect(control.success).toBe(true);
    expect(control.ticks).toBeLessThan(200);
    expect(control.hp).toBeGreaterThan(0);
    expect(control.turnCount).toBeGreaterThanOrEqual(3);
    expect(control.actedCount[0]).toBeGreaterThan(0);
    expect(control.actedCount[1]).toBeGreaterThan(0);
    expect(control.actedCount[2]).toBeGreaterThan(0);
    expect(control.activationTick).toBeGreaterThanOrEqual(0);
    expect(control.killOrder).toHaveLength(3);
    expect(control.energy).toBeGreaterThanOrEqual(20);
  });
});