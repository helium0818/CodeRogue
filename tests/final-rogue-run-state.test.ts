import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_CODE,
  BREACH_CODE,
  CONTROL_CODE,
  FinalRogueRun,
  runFinalRogue,
  runFinalRogueCanonical,
} from '../src/finalRogueRun';

function node(result: ReturnType<typeof runFinalRogueCanonical>, label: string) {
  const found = result.state.nodes.find((n) => n.label === label);
  if (!found) throw new Error('missing timeline node ' + label);
  return found;
}

describe('Final Rogue Run state orchestration / economy', () => {
  it('canonical path clears all three combats with kills=9 and records every resource step', () => {
    const result = runFinalRogueCanonical();
    expect(result.success).toBe(true);
    expect(result.combats).toHaveLength(3);
    expect(result.combats.every((c) => c.success)).toBe(true);
    expect(result.state.modules).toEqual(['sonar', 'dash']);
    expect(result.state.branch).toBe('risk');
    expect(result.state.restChoice).toBe('repair');
    expect(result.state.stats).toEqual({ totalTicks: 180, damageTaken: 9, kills: 9 });

    const c1 = node(result, 'combat1-clear').combat!;
    expect(c1).toMatchObject({ phase: 'pursuit', startHp: 6, startEnergy: 90, endHp: 6, endEnergy: 21, ticks: 67, damageTaken: 0, kills: 3 });

    const reward1 = node(result, 'reward1-chosen');
    expect(reward1).toMatchObject({ phase: 'branch', hp: 6, energy: 90, modules: ['sonar'] });

    const branch = node(result, 'branch-chosen');
    expect(branch).toMatchObject({ phase: 'security', hp: 6, energy: 90, branch: 'risk', modules: ['sonar'] });

    const c2 = node(result, 'combat2-clear').combat!;
    expect(c2).toMatchObject({ phase: 'security', startHp: 6, startEnergy: 90, endHp: 1, endEnergy: 16, ticks: 69, damageTaken: 5, kills: 3 });
    expect(node(result, 'combat2-start')).toMatchObject({ hp: 6, energy: 90 });

    const reward2 = node(result, 'reward2-chosen');
    expect(reward2).toMatchObject({ phase: 'rest', hp: 1, energy: 86, modules: ['sonar', 'dash'] });

    const rest = node(result, 'rest-chosen');
    expect(rest).toMatchObject({ phase: 'fire-control', hp: 5, energy: 86, restChoice: 'repair', modules: ['sonar', 'dash'] });

    const c3 = node(result, 'combat3-start');
    expect(c3).toMatchObject({ hp: 5, energy: 86 });
    const c3End = node(result, 'complete').combat!;
    expect(c3End).toMatchObject({ phase: 'fire-control', startHp: 5, startEnergy: 86, endHp: 1, endEnergy: 58, ticks: 44, damageTaken: 4, kills: 3 });
    expect(result.state).toMatchObject({ phase: 'complete', hp: 1, energy: 58 });
  });

  it('SONAR is carried into Security through real room modifiers: near/dash engage at tick 18', () => {
    const sonar = runFinalRogueCanonical();
    expect(sonar.combats[1].firstEnemyNearTick).toBe(18);
    expect(sonar.combats[1].firstDashTick).toBe(18);
    const withoutSonar = runFinalRogue({ reward1: 'longshot', branch: 'risk', reward2: 'dash', rest: 'repair' });
    expect(withoutSonar.combats[1].firstEnemyNearTick).toBe(20);
    expect(withoutSonar.combats[1].firstDashTick).toBe(20);
    expect(sonar.combats[1].ticks).toBeLessThan(withoutSonar.combats[1].ticks);
  });

  it('Combat results write real HP/Energy back and module modifiers reach later combats', () => {
    const run = new FinalRogueRun();
    expect(run.phase).toBe('pursuit');
    expect(run.hp).toBe(6);
    expect(run.energy).toBe(90);

    const c1 = run.runNextCombat(CONTROL_CODE)!;
    expect(c1.success).toBe(true);
    expect(run.hp).toBe(6);
    expect(run.energy).toBe(21);
    expect(run.phase).toBe('reward1');

    expect(run.chooseReward('sonar')).toBe(true);
    expect(run.phase).toBe('branch');
    expect(run.modules).toEqual(['sonar']);
    expect(run.energy).toBe(90);

    expect(run.chooseBranch('risk')).toBe(true);
    expect(run.phase).toBe('security');
    const c2 = run.runNextCombat(BREACH_CODE)!;
    expect(c2.success).toBe(true);
    expect(run.hp).toBe(1);
    expect(run.energy).toBe(16);
    expect(run.phase).toBe('reward2');

    expect(run.rewardChoices()).toEqual(['shield', 'rewind', 'dash']);
    expect(run.chooseReward('dash')).toBe(true);
    expect(run.energy).toBe(86);
    expect(run.chooseRest('repair')).toBe(true);
    expect(run.hp).toBe(5);
    expect(run.phase).toBe('fire-control');
    const c3 = run.runNextCombat(ADAPTIVE_CODE)!;
    expect(c3.success).toBe(true);
    expect(run.phase).toBe('complete');
  });

  it('REGEN + SAFE and LONGSHOT + RISK are real non-canonical orchestrations without crashing', () => {
    const regenSafe = runFinalRogue({ reward1: 'regen', branch: 'safe', reward2: 'shield', rest: 'repair' });
    expect(regenSafe.state.modules).toEqual(['regen', 'shield']);
    expect(regenSafe.state.branch).toBe('safe');
    expect(regenSafe.state.restChoice).toBe('repair');
    expect(regenSafe.state.stats.kills).toBeGreaterThanOrEqual(3);
    expect(['complete', 'failed']).toContain(regenSafe.state.phase);
    expect(Number.isFinite(regenSafe.state.hp)).toBe(true);
    expect(Number.isFinite(regenSafe.state.energy)).toBe(true);
    expect(regenSafe.combats.length).toBeGreaterThanOrEqual(1);

    const longshotRisk = runFinalRogue({ reward1: 'longshot', branch: 'risk', reward2: 'dash', rest: 'repair' });
    expect(longshotRisk.state.modules).toEqual(['longshot', 'dash']);
    expect(longshotRisk.state.branch).toBe('risk');
    expect(longshotRisk.state.stats.kills).toBeGreaterThanOrEqual(3);
    expect(['complete', 'failed']).toContain(longshotRisk.state.phase);
  });

  it('decision phases cannot advance before their real choice is committed', () => {
    const run = new FinalRogueRun();
    run.runNextCombat(CONTROL_CODE);
    expect(run.phase).toBe('reward1');
    expect(run.advance()).toBe(false);
    expect(run.runNextCombat(BREACH_CODE)).toBeNull();
    expect(run.chooseReward('sonar')).toBe(true);
    expect(run.phase).toBe('branch');
    expect(run.advance()).toBe(false);
    expect(run.chooseBranch('risk')).toBe(true);
    expect(run.phase).toBe('security');
    run.runNextCombat(BREACH_CODE);
    expect(run.phase).toBe('reward2');
    expect(run.advance()).toBe(false);
    expect(run.runNextCombat(ADAPTIVE_CODE)).toBeNull();
    expect(run.chooseReward('dash')).toBe(true);
    expect(run.phase).toBe('rest');
    expect(run.advance()).toBe(false);
    expect(run.runNextCombat(ADAPTIVE_CODE)).toBeNull();
    expect(run.chooseRest('repair')).toBe(true);
    expect(run.phase).toBe('fire-control');
    expect(run.advance()).toBe(true);
  });
  it('invalid rewards are rejected and the run can stop cleanly on a failed combat', () => {
    const run = new FinalRogueRun();
    run.runNextCombat(CONTROL_CODE);
    expect(run.phase).toBe('reward1');
    expect(run.chooseReward('dash')).toBe(false);
    expect(run.chooseReward('shield')).toBe(false);
    expect(run.modules).toEqual([]);

    const failing = new FinalRogueRun();
    const bad = failing.runNextCombat('void update(){ move_forward(); }');
    expect(bad?.success).toBe(false);
    expect(failing.phase).toBe('failed');
    expect(failing.stats.kills).toBeGreaterThanOrEqual(0);
    expect(failing.state().nodes.some((n) => n.label === 'failed')).toBe(true);
  });
});