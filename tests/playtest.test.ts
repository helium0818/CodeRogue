import { describe, it, expect } from 'vitest';
import { EXPEDITION_HUB_SCENARIO, ExpeditionRun, Simulation, gradeBattle, pickScenario, scaleExpeditionBattle } from '../src/core';

const rangedGeneric = `void advance() {}
void update(){
  if(false){ for (int i = 0; i < 1; i = i + 1) { wait(); } }
  if(enemy_near()){ ranged_attack(); }
  else if(wall_ahead()){ turn_right(); }
  else { move_forward(); }
}`;

const meleeGeneric = `int memo[1];
void update(){
  if(enemy_ahead()){ attack(); }
  else if(wall_ahead()){ turn_right(); }
  else { move_forward(); }
}`;

describe('expedition archetype pressure', () => {
  it('forbids one generic firmware from fitting every battlefield', () => {
    for (let index = 0; index < 5; index++) {
      const combat = pickScenario('combat', 1, index);
      const sim = new Simulation();
      sim.setScenario(combat);
      if (combat.constraint?.forbid?.includes('ranged_attack()')) {
        expect(sim.build(rangedGeneric).ok, `${combat.id} should reject ranged-only firmware`).toBe(false);
      } else {
        expect(sim.build(rangedGeneric).ok, `${combat.id} should accept ranged-only firmware`).toBe(true);
        expect(sim.build(meleeGeneric).ok, `${combat.id} should reject generic melee firmware`).toBe(false);
      }
    }
    for (let index = 0; index < 4; index++) {
      const elite = pickScenario('elite', 1, index);
      const sim = new Simulation();
      sim.setScenario(elite);
      if (elite.constraint?.forbid?.includes('ranged_attack()') || elite.constraint?.require?.includes('enemy_ahead()')) {
        expect(sim.build(rangedGeneric).ok, `${elite.id} should reject firmware still using ranged_attack`).toBe(false);
      } else {
        expect(sim.build(rangedGeneric).ok, `${elite.id} should accept ranged-only firmware`).toBe(true);
        expect(sim.build(meleeGeneric).ok, `${elite.id} should reject generic melee firmware`).toBe(false);
      }
      const boss = pickScenario('boss', 1, index);
      const bossSim = new Simulation();
      bossSim.setScenario(boss);
      expect(bossSim.build(meleeGeneric).ok, `${boss.id} should accept melee firmware`).toBe(true);
      expect(bossSim.build(rangedGeneric).ok, `${boss.id} should reject firmware that still calls ranged_attack`).toBe(false);
    }
  });

  it('makes the sonar module extend enemy_near sensor range in the trace', () => {
    const code = 'void update(){ if(enemy_near()){ wait(); } }';
    const base = new Simulation();
    base.setScenario(EXPEDITION_HUB_SCENARIO);
    expect(base.build(code).ok).toBe(true);
    base.reset();
    base.enemy = { x: 4, y: 1, hp: 1, kind: 'slime' };
    base.step();
    expect(base.frames[0].sensors.find(s => s.name === 'enemy_near')?.value).toBe(false);
    const sonar = new Simulation();
    sonar.setScenario(EXPEDITION_HUB_SCENARIO, { nearRange: 3 });
    expect(sonar.build(code).ok).toBe(true);
    sonar.reset();
    sonar.enemy = { x: 4, y: 1, hp: 1, kind: 'slime' };
    sonar.step();
    expect(sonar.frames[0].sensors.find(s => s.name === 'enemy_near')?.value).toBe(true);
  });
  it('keeps the melee elite draft incomplete while its shipped solution wins', () => {
    const scenario = pickScenario('elite', 1, 1);
    expect(scenario.constraint?.forbid).toContain('ranged_attack()');
    const sim = new Simulation();
    sim.setScenario(scenario);
    expect(sim.build(scenario.starterCode).ok, 'draft should satisfy build constraints').toBe(true);
    sim.reset();
    for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
    expect(sim.status, 'draft alone should not complete the elite').not.toBe('success');
  });
  it('keeps every expedition battlefield draft incomplete', () => {
    for (const kind of ['combat','elite','boss'] as const) {
      const count = kind === 'combat' ? 5 : 4;
      for (let index = 0; index < count; index++) {
        const scenario = pickScenario(kind, 1, index);
        const sim = new Simulation();
        sim.setScenario(scenario);
        const built = sim.build(scenario.starterCode);
        if (built.ok) {
          sim.reset();
          for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
          expect(sim.status, `${scenario.id} starter should not win by itself`).not.toBe('success');
        }
        expect(scenario.starterCode).not.toBe(scenario.solutionCode ?? scenario.starterCode);
      }
    }
  });
  it('lets the longshot module extend ranged_attack range', () => {
    const code = 'void update(){ if(distance_to_enemy() <= 3){ ranged_attack(); } else { move_forward(); } }';
    const base = new Simulation();
    base.setScenario(EXPEDITION_HUB_SCENARIO);
    expect(base.build(code).ok).toBe(true);
    base.reset();
    base.enemy = { x: 4, y: 1, hp: 3, kind: 'slime' };
    base.step();
    expect(base.enemy.hp).toBe(3);
    const long = new Simulation();
    long.setScenario(EXPEDITION_HUB_SCENARIO, { rangedRange: 3 });
    expect(long.build(code).ok).toBe(true);
    long.reset();
    long.enemy = { x: 4, y: 1, hp: 3, kind: 'slime' };
    long.step();
    expect(long.enemy.hp).toBe(2);
  });
  it('makes runner contact a fatal explosion instead of chip damage', () => {
    const sim = new Simulation();
    sim.setScenario(EXPEDITION_HUB_SCENARIO);
    expect(sim.build('void update(){ move_forward(); }').ok).toBe(true);
    sim.reset();
    sim.enemy = { x: 3, y: 1, hp: 1, kind: 'runner', moveEvery: 1, attackEvery: 1 };
    sim.step();
    expect(sim.robot.hp).toBe(0);
    expect(sim.status).toBe('failed');
  });
  it('makes guard enemies immune to ranged attacks but vulnerable to melee', () => {
    const rangedSim = new Simulation();
    rangedSim.setScenario(EXPEDITION_HUB_SCENARIO);
    expect(rangedSim.build('void update(){ ranged_attack(); }').ok).toBe(true);
    rangedSim.reset();
    rangedSim.enemy = { x: 3, y: 1, hp: 4, kind: 'guard' };
    rangedSim.step();
    expect(rangedSim.enemy.hp).toBe(4);
    expect(rangedSim.message).toBe('护盾吸收了远程火力');
    const meleeSim = new Simulation();
    meleeSim.setScenario(EXPEDITION_HUB_SCENARIO);
    expect(meleeSim.build('void update(){ attack(); }').ok).toBe(true);
    meleeSim.reset();
    meleeSim.enemy = { x: 2, y: 1, hp: 4, kind: 'guard' };
    meleeSim.step();
    expect(meleeSim.enemy.hp).toBe(3);
  });
  it('preserves every enemy archetype across simulation reset', () => {
    for (const kind of ['swarm','turret','tank','runner','guard'] as const) {
      const scenario = { ...EXPEDITION_HUB_SCENARIO, enemy: { x: 4, y: 1, hp: 3, kind, moveEvery: 2, attackEvery: 2 } };
      const sim = new Simulation();
      sim.setScenario(scenario);
      sim.reset();
      expect(sim.enemy.kind, kind).toBe(kind);
      expect(sim.enemy.moveEvery, kind).toBe(2);
      expect(sim.enemy.attackEvery, kind).toBe(2);
    }
  });
  it('ramps enemy pressure deeper into the route', () => {
    const boss = pickScenario('boss', 1, 0);
    const early = scaleExpeditionBattle(boss, 0);
    const late = scaleExpeditionBattle(boss, 8);
    expect(late.enemy!.hp).toBeGreaterThan(early.enemy!.hp);
    if (early.enemy!.moveEvery && late.enemy!.moveEvery) {
      expect(late.enemy!.moveEvery).toBeLessThanOrEqual(early.enemy!.moveEvery);
    }
  });
  it('keeps every generated scenario solvable by its own shipped solution', () => {
    for (let index = 0; index < 5; index++) {
      const scenario = pickScenario('combat', 1, index);
      const sim = new Simulation();
      sim.setScenario(scenario);
      expect(sim.build(scenario.solutionCode ?? scenario.starterCode).ok, `${scenario.id} build`).toBe(true);
      sim.reset();
      for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
      expect(sim.status, `${scenario.id} should be solvable`).toBe('success');
    }
    for (let index = 0; index < 4; index++) {
      const scenario = pickScenario('elite', 1, index);
      const sim = new Simulation();
      sim.setScenario(scenario);
      expect(sim.build(scenario.solutionCode ?? scenario.starterCode).ok, `${scenario.id} build`).toBe(true);
      sim.reset();
      for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
      expect(sim.status, `${scenario.id} should be solvable`).toBe('success');
    }
    for (let index = 0; index < 2; index++) {
      const scenario = pickScenario('boss', 1, index);
      const sim = new Simulation();
      sim.setScenario(scenario);
      expect(sim.build(scenario.solutionCode ?? scenario.starterCode).ok, `${scenario.id} build`).toBe(true);
      sim.reset();
      for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
      expect(sim.status, `${scenario.id} should be solvable`).toBe('success');
    }
  });
});
describe('fresh-run fairness', () => {
  it('clears representative fresh runs without meta upgrades or hand-written firmware', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const run = new ExpeditionRun(seed);
      while (run.nodeIndex < run.route.length) {
        const node = run.current()!;
        if (['combat', 'elite', 'boss'].includes(node)) {
          const scenario = pickScenario(node as 'combat'|'elite'|'boss', run.seed, run.nodeIndex);
          const sim = new Simulation();
          sim.setScenario(scenario, run.modifiers());
          expect(sim.build(scenario.solutionCode ?? scenario.starterCode).ok).toBe(true);
          sim.reset();
          for (let i = 0; i < 240 && sim.status === 'running'; i++) sim.step();
          expect(sim.status, `seed ${seed} ${node} ${scenario.id} should be completable`).toBe('success');
          const damage = Math.max(0, run.modifiers().maxHp - sim.robot.hp);
          const energyUsed = Math.max(0, run.modifiers().maxEnergy - sim.robot.energy);
          const actions = sim.frames.filter(frame => !!frame.action).length;
          const sensorReads = sim.frames.reduce((sum, frame) => sum + frame.sensors.length, 0);
          const grade = gradeBattle({ tick: sim.tick, damage, energyUsed, actions, sensorReads });
          run.resolveBattle(sim.tick, damage, scenario.enemy!.hp + Math.floor(run.nodeIndex / 4), grade);
          run.clearNode();
        } else if (node === 'branch') {
          expect(run.chooseBranch('safe')).toBe(true);
        } else {
          const action = node === 'rest' ? 'repair' : (node === 'shop' ? (run.credits >= 3 ? 'buy' : 'leave') : 'scan');
          run.resolveAction(action);
          run.clearNode();
        }
      }
      expect(run.stats.nodesCleared, `seed ${seed} should complete`).toBe(run.route.length);
    }
  });
});
