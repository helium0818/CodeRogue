import { describe, it, expect } from 'vitest';
import { ExpeditionRun, Simulation, gradeBattle, pickScenario } from '../src/core';

describe('auto demo', () => {
  it('plays a full expedition like a cautious player', () => {
    const run = new ExpeditionRun(20260903);
    const sim = new Simulation();
    console.log(`\n=== CodeRogue auto-demo · seed ${run.seed} ===`);
    while (run.nodeIndex < run.route.length) {
      const node = run.current()!;
      console.log(`\n-- Node ${run.nodeIndex + 1}/${run.route.length}: ${node} --`);
      if (node === 'combat' || node === 'elite' || node === 'boss') {
        const scenario = pickScenario(node, run.seed, run.nodeIndex);
        sim.setScenario(scenario, run.modifiers(), run.seed);
        const code = scenario.solutionCode ?? scenario.starterCode;
        const built = sim.build(code);
        expect(built.ok, `${node} should build`).toBe(true);
        sim.reset();
        while (sim.status === 'running') sim.step();
        console.log(`  battle: ${sim.status} · ${sim.tick} ticks · hp ${sim.robot.hp}`);
        const damage = Math.max(0, run.modifiers().maxHp - sim.robot.hp);
        const energyUsed = Math.max(0, run.modifiers().maxEnergy - sim.robot.energy);
        const actions = sim.frames.filter(frame => !!frame.action).length;
        const sensorReads = sim.frames.reduce((sum, frame) => sum + frame.sensors.length, 0);
        const grade = gradeBattle({ tick: sim.tick, damage, energyUsed, actions, sensorReads });
        const enemyMaxHp = (scenario.enemy?.hp ?? 0) + Math.floor(run.nodeIndex / 4);
        expect(run.resolveBattle(sim.tick, damage, enemyMaxHp, grade)).toBe(true);
        console.log(`  firmware: ${grade} · reward ${run.lastOutcome.rewardTitle}`);
        run.clearNode();
            } else if (node === 'branch') {
        expect(run.chooseBranch('safe')).toBe(true);
        console.log(`  branch: safe`);
      } else {
        const action = node === 'shop' ? (run.credits >= 3 ? 'buy' : 'leave') : node === 'rest' ? 'repair' : 'scan';
        expect(run.resolveAction(action)).toBe(true);
        console.log(`  action: ${action} · credits ${run.lastOutcome.credits} · damage ${run.lastOutcome.damageTaken}`);
        const reward = run.choices()[0];
        expect(run.choose(reward.id)).toBe(true);
        console.log(`  reward: ${reward.id} ${reward.title}`);
        run.clearNode();
      }
      run.clearNode();
    }
    console.log(`\n=== Run complete: victory=${run.stats.victory} · nodes=${run.stats.nodesCleared} · credits=${run.stats.credits} ===`);
    expect(run.stats.nodesCleared).toBe(run.route.length);
  });
});