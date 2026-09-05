import { describe, it, expect } from 'vitest';
import { ExpeditionRun, Simulation, gradeBattle, pickScenario, scaleExpeditionBattle } from '../src/core';

const DEFENSE_SEED = 13;

describe('defense demo route (seed 13)', () => {
  it('starts with a deterministic 8-node route and rewrites branch to elite via real chooseBranch', () => {
    const run = new ExpeditionRun(DEFENSE_SEED);
    expect(run.route).toEqual(['combat', 'branch', 'combat', 'shop', 'rest', 'event', 'rest', 'boss']);
    expect(run.current()).toBe('combat');
    run.clearNode(); // first combat
    expect(run.current()).toBe('branch');
    expect(run.chooseBranch('risk')).toBe(true);
    expect(run.route[2]).toBe('elite');
    expect(run.current()).toBe('elite');
  });

  it('completes the full defense route with real battles, manual elite/shop rewards, and a visible boss', () => {
    const run = new ExpeditionRun(DEFENSE_SEED);
    const sim = new Simulation();
    let manualEliteId: string | undefined;
    let manualShopId: string | undefined;
    let reachedBoss = false;
    while (run.nodeIndex < run.route.length) {
      const node = run.current()!;
      if (node === 'boss') reachedBoss = true;
      if (node === 'combat' || node === 'elite' || node === 'boss') {
        const scenario = pickScenario(node, DEFENSE_SEED, run.nodeIndex);
        const scaled = scaleExpeditionBattle(scenario, run.nodeIndex);
        const applied = node === 'boss' ? scenario : scaled;
        sim.setScenario(applied, run.modifiers(), DEFENSE_SEED);
        const built = sim.build(scenario.solutionCode ?? scenario.starterCode);
        expect(built.ok, `${node} solution should build`).toBe(true);
        sim.reset();
        while (sim.status === 'running') sim.step();
        expect(sim.status, `${node} should be a real Simulation victory`).toBe('success');
        const damage = Math.max(0, run.modifiers().maxHp - sim.robot.hp);
        const energyUsed = Math.max(0, run.modifiers().maxEnergy - sim.robot.energy);
        const actions = sim.frames.filter(frame => !!frame.action).length;
        const sensorReads = sim.frames.reduce((sum, frame) => sum + frame.sensors.length, 0);
        const grade = gradeBattle({ tick: sim.tick, damage, energyUsed, actions, sensorReads });
        const enemyMaxHp = applied.enemy?.hp ?? 0;
        if (node === 'elite') {
          manualEliteId = run.choices().find(r => r.id === 'echo')?.id ?? run.choices()[0].id;
          expect(run.resolveBattle(sim.tick, damage, enemyMaxHp, grade, manualEliteId)).toBe(true);
          expect(run.lastOutcome.rewardId).toBe(manualEliteId);
        } else {
          expect(run.resolveBattle(sim.tick, damage, enemyMaxHp, grade)).toBe(true);
        }
        run.clearNode();
      } else if (node === 'branch') {
        expect(run.chooseBranch('risk')).toBe(true);
      } else {
        const actionId = node === 'shop' ? (run.credits >= run.shopBuyCost() ? 'buy' : 'leave') : node === 'rest' ? 'repair' : 'scan';
        expect(run.resolveAction(actionId)).toBe(true);
        if (node === 'shop') {
          manualShopId = run.choices().find(r => r.id === 'rewind')?.id ?? run.choices()[0].id;
          expect(run.choose(manualShopId)).toBe(true);
        } else {
          expect(run.choose(run.choices()[0].id)).toBe(true);
        }
        run.clearNode();
      }
    }
    expect(manualEliteId).toBe('echo');
    expect(manualShopId).toBe('rewind');
    expect(reachedBoss).toBe(true);
    expect(run.stats.victory).toBe(true);
    expect(run.stats.nodesCleared).toBe(run.route.length);
    expect(run.rewards.map(r => r.id)).toContain('echo');
    expect(run.rewards.map(r => r.id)).toContain('rewind');
  });
});