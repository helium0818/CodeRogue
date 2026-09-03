import { describe, it, expect } from 'vitest';
import { EXPEDITION_HUB_SCENARIO, EXPEDITION_SCENARIOS, ExpeditionRun, LEVEL_STARTER_CODE, Simulation, STORY_LEVELS, STORY_PROGRESS_KEY, gradeBattle, loadMeta, loadStoryProgress, saveMeta, saveStoryProgress } from '../src/core';

class MemoryStorage {
  private values = new Map<string,string>();
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
}

describe('simulation combat', () => {
  it('builds the starter firmware for every selectable story level', () => {
    STORY_LEVELS.forEach((level, index) => {
      const sim = new Simulation();
      sim.selectLevel(index);
      const result = sim.build(LEVEL_STARTER_CODE[level.id]);
      expect(result.ok, `${level.id} starter should build`).toBe(true);
    });
  });
  it('keeps every combat expedition battlefield solvable with its starter firmware', () => {
    for (const kind of ['combat','elite','boss'] as const) {
      const scenario = EXPEDITION_SCENARIOS[kind];
      const sim = new Simulation();
      sim.setScenario(scenario);
      if (scenario.constraint) {
        expect(sim.build(LEVEL_STARTER_CODE['1-1']).ok, `${kind} should reject unconstrained firmware`).toBe(false);
      }
      expect(sim.build(scenario.starterCode).ok, `${kind} starter should build`).toBe(true);
      sim.reset();
      for (let i=0;i<160 && sim.status==='running';i++) sim.step();
      expect(sim.status, `${kind} battlefield should be completable`).toBe('success');
    }
  });
  it('ships a solvable starter firmware for every expedition battlefield', () => {
    for (const kind of ['combat','elite','boss'] as const) {
      const scenario=EXPEDITION_SCENARIOS[kind];
      const sim=new Simulation();
      sim.setScenario(scenario);
      expect(sim.build(scenario.starterCode).ok, `${kind} starter should build`).toBe(true);
      sim.reset();
      for(let i=0;i<160&&sim.status==='running';i++)sim.step();
      expect(sim.status, `${kind} starter should reach the exit`).toBe('success');
    }
  });
  it('exposes enemy sensor and resolves attack', () => {
    const sim = new Simulation();
    sim.build('void update(){ if(enemy_ahead()){ attack(); } else { for (int i = 0; i < 1; i = i + 1){ move_forward(); } } }');
    sim.reset();
    for (let i=0;i<12 && sim.status==='running';i++) sim.step();
    expect(sim.frames.some(f=>f.sensors.some(s=>s.name==='enemy_ahead'))).toBe(true);
  });
  it('allows one costly pulse intervention when an enemy is near', () => {
    const sim=new Simulation(); sim.setScenario(EXPEDITION_SCENARIOS.combat); expect(sim.build(EXPEDITION_SCENARIOS.combat.starterCode).ok).toBe(true); sim.reset(); sim.step(); sim.step();
    const before=sim.enemy.hp; expect(sim.usePulse()).toBe(true); expect(sim.enemy.hp).toBe(before-1); expect(sim.robot.energy).toBe(15); expect(sim.usePulse()).toBe(false); expect(sim.frames[sim.frames.length-1]?.action).toBe('pulse');
  });
  it('separates enemy pursuit from its contact attack cadence', () => {
    const sim=new Simulation(); sim.setScenario(EXPEDITION_SCENARIOS.combat);
    expect(sim.build(EXPEDITION_SCENARIOS.combat.starterCode).ok).toBe(true); sim.reset();
    for(let i=0;i<12&&sim.status==='running';i++) sim.step();
    expect(sim.status).toBe('success');
    expect(sim.robot.hp).toBe(4);
  });
  it('keeps every story level reachable with a firmware strategy', () => {
    const programs = [
      'void update(){ move_forward(); }',
      'void update(){ if(wall_ahead()){ turn_right(); } else { move_forward(); } }',
      'void update(){ if(enemy_ahead()){ attack(); } else if(wall_ahead()){ turn_right(); } else { move_forward(); } }',
      'int walls=0; void update(){ if(wall_ahead()){ walls=walls+1; if(walls==2){ turn_left(); } else { turn_right(); } } else { move_forward(); } }',
      'bool turn_left_next=false; void update(){ if(wall_ahead()){ if(turn_left_next){ turn_left(); } else { turn_right(); } turn_left_next=!turn_left_next; return; } move_forward(); }'
    ];
    programs.forEach((program, index) => {
      const sim = new Simulation(); sim.selectLevel(index); expect(sim.build(program).ok).toBe(true); sim.reset();
      for (let i=0;i<120 && sim.status==='running';i++) sim.step();
      expect(sim.status, `level ${index} should be solvable: robot=${sim.robot.x},${sim.robot.y} dir=${sim.robot.dir} enemy=${sim.enemy.hp}`).toBe('success');
      expect(sim.completedLevels.has(STORY_LEVELS[index]?.id ?? '')).toBe(true);
    });
  });
  it('requires persistent state for the chapter 2 routes', () => {
    for (const index of [3,4]) {
      const sim = new Simulation();
      sim.selectLevel(index);
      expect(sim.build('void update(){ if(wall_ahead()){ turn_right(); } else { move_forward(); } }').ok).toBe(true);
      sim.reset();
      for(let i=0;i<80&&sim.status==='running';i++)sim.step();
      expect(sim.status, `level ${STORY_LEVELS[index].id} should reject the stateless wall strategy`).not.toBe('success');
    }
  });
  it('switches level data without leaking prior run state', () => {
    const sim = new Simulation(); sim.build('void update(){ move_forward(); }'); sim.reset(); sim.step();
    sim.selectLevel(0);
    expect(sim.levelIndex).toBe(0); expect(sim.map[1]).toContain('E'); expect(sim.tick).toBe(0); expect(sim.status).toBe('idle'); expect(sim.enemy.hp).toBe(0);
  });
  it('pauses on a breakpoint and records the breakpoint event', () => {
    const sim = new Simulation();
    expect(sim.build('void update(){ move_forward(); }').ok).toBe(true);
    sim.setBreakpoint(1);
    sim.reset();
    sim.step();
    expect(sim.status).toBe('paused');
    expect(sim.tick).toBe(1);
    expect(sim.frames[0].events).toContain('BREAKPOINT');
    expect(sim.message).toBe('Breakpoint hit at line 1');
  });
  it('pause freezes ticks and resume continues without retriggering the same breakpoint', () => {
    const sim = new Simulation();
    expect(sim.build('void update(){ move_forward(); }').ok).toBe(true);
    sim.reset();
    sim.pause();
    sim.step();
    expect(sim.status).toBe('paused');
    expect(sim.tick).toBe(0);
    sim.resume();
    expect(sim.status).toBe('running');
    sim.setBreakpoint(1);
    sim.step();
    expect(sim.status).toBe('paused');
    sim.resume();
    sim.step();
    expect(sim.status).toBe('running');
    expect(sim.tick).toBe(2);
  });
  it('persists completed levels and the last selected level', () => {
    const storage = new MemoryStorage();
    const sim = new Simulation();
    sim.selectLevel(0);
    sim.completedLevels.add('0-1');
    saveStoryProgress(sim.getProgress(), storage);
    const restored = loadStoryProgress(storage);
    const next = new Simulation();
    next.applyProgress(restored);
    expect(storage.getItem(STORY_PROGRESS_KEY)).toContain('0-1');
    expect(next.levelIndex).toBe(0);
    expect(next.completedLevels.has('0-1')).toBe(true);
    expect(next.enemy.hp).toBe(0);
    expect(next.tick).toBe(0);
    expect(next.status).toBe('idle');
  });
  it('ignores malformed or unknown persisted progress', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORY_PROGRESS_KEY, '{"completedLevelIds":["0-1","unknown",4],"selectedLevelId":"unknown"}');
    expect(loadStoryProgress(storage)).toEqual({completedLevelIds:['0-1'],selectedLevelId:undefined});
    storage.setItem(STORY_PROGRESS_KEY, 'not-json');
    expect(loadStoryProgress(storage)).toEqual({completedLevelIds:[]});
  });
  it('records runtime errors at the failing source line', () => {
    const sim = new Simulation();
    expect(sim.build('int n=1;\nvoid update(){\n  n=n/0;\n}').ok).toBe(true);
    sim.reset();
    sim.step();
    expect(sim.status).toBe('error');
    expect(sim.frames[0].sourceLine).toBe(3);
    expect(sim.frames[0].events).toContain('RUNTIME_ERROR');
    expect(sim.frames[0].error).toContain('Division by zero');
  });
  it('pauses on a watched variable change and records a watchpoint event', () => {
    const sim = new Simulation();
    expect(sim.build('int n=0; void update(){ n=n+1; wait(); }').ok).toBe(true);
    expect(sim.setWatchpoint('n')).toBe(true);
    sim.reset();
    sim.step();
    expect(sim.status).toBe('running');
    sim.step();
    expect(sim.status).toBe('paused');
    expect(sim.frames[1].events).toContain('WATCHPOINT:n');
    expect(sim.message).toContain('n');
  });
  it('does not trigger a watchpoint when the value stays unchanged', () => {
    const sim = new Simulation();
    expect(sim.build('int n=0; void update(){ wait(); }').ok).toBe(true);
    sim.setWatchpoint('n');
    sim.reset();
    sim.step(); sim.step();
    expect(sim.status).toBe('running');
    expect(sim.frames.every(frame => !frame.events.some(event => event.startsWith('WATCHPOINT:')))).toBe(true);
  });
  it('creates a core dump for runtime failures with recent trace frames', () => {
    const sim = new Simulation();
    expect(sim.build('int n=1; void update(){ n=n/0; }').ok).toBe(true);
    sim.reset(); sim.step();
    expect(sim.coreDump?.cause).toBe('runtime_error');
    expect(sim.coreDump?.tick).toBe(1);
    expect(sim.coreDump?.recentFrames).toHaveLength(1);
    expect(sim.coreDump?.message).toContain('Division by zero');
  });
  it('snapshots and rolls back deterministic simulation state', () => {
    const sim = new Simulation();
    expect(sim.build('void update(){ move_forward(); }').ok).toBe(true);
    sim.reset(); sim.step();
    const snapshot=sim.snapshot();
    sim.step();
    expect(sim.tick).toBe(2);
    sim.rollback(snapshot);
    expect(sim.tick).toBe(1);
    expect(sim.robot.x).toBe(snapshot.robot.x);
    expect(sim.frames).toHaveLength(1);
    expect(sim.message).toBe('Rolled back to snapshot');
  });
  it('applies limited hot reload while paused without resetting world state', () => {
    const sim = new Simulation();
    expect(sim.build('void update(){ move_forward(); }').ok).toBe(true);
    sim.reset(); sim.step(); sim.pause();
    const before={...sim.robot};
    expect(sim.hotReload('void update(){ turn_right(); }').ok).toBe(true);
    expect(sim.robot).toEqual(before);
    sim.resume(); sim.step();
    expect(sim.robot.dir).toBe('S');
  });
  it('generates deterministic expedition routes and applies three-choice rewards', () => {
    const first=new ExpeditionRun(42); const second=new ExpeditionRun(42);
    expect(first.route).toEqual(second.route);
    expect(first.route[first.route.length-1]).toBe('boss');
    const choices=first.choices();
    expect(choices).toHaveLength(3);
    expect(first.choose(choices[1].id)).toBe(true);
    first.clearNode({damageDealt:3,damageTaken:1,credits:8});
    expect(first.stats.nodesCleared).toBe(1);
    expect(first.stats.damageDealt).toBe(3);
    expect(first.stats.credits).toBe(8);
    expect(first.stats.rewards).toEqual([choices[1].id]);
  });
  it('converts duplicate module picks into credits', () => {
    const run=new ExpeditionRun(42); const reward=run.choices()[0];
    expect(run.choose(reward.id)).toBe(true); expect(run.choose(reward.id)).toBe(true);
    expect(run.credits).toBe(2); expect(run.log[run.log.length-1]).toContain('duplicate');
  });
  it('requires an encounter decision before expedition rewards and settles the boss', () => {
    const run=new ExpeditionRun(42);
    expect(run.nodeCleared).toBe(false);
    expect(run.resolveAction('guard')).toBe(true);
    expect(run.nodeCleared).toBe(true);
    expect(run.log).toEqual(['combat:guard']);
    const reward=run.choices()[0];
    expect(run.choose(reward.id)).toBe(true);
    run.clearNode();
    expect(run.nodeIndex).toBe(1);
    while(run.nodeIndex<run.route.length-1){run.resolveAction(run.actions()[0].id);run.clearNode()}
    expect(run.current()).toBe('boss');
    run.resolveAction('outplay');
    expect(run.nodeCleared).toBe(true);
    run.clearNode();
    expect(run.stats.victory).toBe(true);
  });
  it('rejects an expedition action until the player explicitly chooses one', () => {
    const run=new ExpeditionRun(42);
    expect(run.resolveAction('',true)).toBe(false);
    expect(run.nodeCleared).toBe(false);
  });
  it('requires a verified firmware run for combat expedition nodes', () => {
    const run = new ExpeditionRun(42);
    expect(run.resolveAction('strike', false)).toBe(false);
    expect(run.nodeCleared).toBe(false);
    expect(run.resolveAction('strike', true)).toBe(true);
  });
  it('turns expedition rewards into real simulation modifiers', () => {
    const run = new ExpeditionRun(42);
    run.rewards.push({id:'echo',kind:'sensor',title:'弱点扫描仪',description:''});
    run.rewards.push({id:'shield',kind:'runtime',title:'偏转护盾',description:''});
    const sim = new Simulation();
    sim.setScenario(EXPEDITION_SCENARIOS.combat, run.modifiers());
    expect(sim.robot.hp).toBe(7);
    expect(sim.build('void update(){ if(enemy_ahead()){ attack(); } else { for (int i = 0; i < 1; i = i + 1){ move_forward(); } } }').ok).toBe(true);
    sim.reset(); sim.step(); sim.step(); sim.step(); sim.step();
    expect(sim.enemy.hp).toBe(0);
    expect(sim.robot.hp).toBe(7);
  });
  it('makes the weak-point scanner materially shorten a boss battle', () => {
    const scenario=EXPEDITION_SCENARIOS.boss;
    const baseline=new Simulation();
    baseline.setScenario(scenario);
    baseline.build(scenario.starterCode); baseline.reset();
    for(let i=0;i<160&&baseline.status==='running';i++)baseline.step();
    const upgraded=new Simulation();
    upgraded.setScenario(scenario,{attackPower:2});
    upgraded.build(scenario.starterCode); upgraded.reset();
    for(let i=0;i<160&&upgraded.status==='running';i++)upgraded.step();
    expect(upgraded.status).toBe('success');
    expect(upgraded.tick).toBeLessThan(baseline.tick);
  });
  it('lets expedition rewards modify later encounter outcomes', () => {
    const run=new ExpeditionRun(42);
    expect(run.resolveAction('strike')).toBe(true);
    const baseline=run.lastOutcome;
    run.clearNode();
    expect(run.choose(run.choices()[0].id)).toBe(true);
    expect(run.choose('shield')).toBe(false);
    while(run.nodeIndex<run.route.length-1){run.resolveAction(run.actions()[0].id);run.clearNode();if(run.current()==='boss')break}
    run.rewards.push({id:'shield',kind:'runtime',title:'护盾内核',description:''});
    run.resolveAction(run.actions()[0].id);
    expect(run.lastOutcome.damageTaken).toBeLessThanOrEqual(baseline.damageTaken);
  });
  it('carries expedition hull between nodes and lets a shop repair it', () => {
    const run=new ExpeditionRun(42);
    expect(run.resolveAction('strike',true)).toBe(true);
    run.clearNode({damageDealt:3,damageTaken:2,credits:4});
    expect(run.hull).toBe(3);
    while(run.current()!=='shop'){run.resolveAction(run.actions()[0].id,true);run.clearNode({damageTaken:0,credits:1})}
    expect(run.resolveAction('buy',true)).toBe(true);
    run.clearNode();
    expect(run.hull).toBe(5);
  });
  it('does not allow buying supplies without enough credits', () => {
    const run=new ExpeditionRun(42);
    while(run.current()!=='shop'){run.resolveAction(run.actions()[0].id,true);run.clearNode({damageTaken:0,credits:0})}
    expect(run.resolveAction('buy',true)).toBe(false);
    expect(run.nodeCleared).toBe(false);
  });
  it('carries firmware damage into tactical settlement and hull', () => {
    const run=new ExpeditionRun(42);
    run.recordBattlePerformance(3);
    expect(run.resolveAction('guard',true)).toBe(true);
    run.clearNode();
    expect(run.stats.damageTaken).toBe(2);
    expect(run.hull).toBe(3);
  });
  it('settles a boss escape as a non-victory extraction', () => {
    const run=new ExpeditionRun(42);
    while(run.nodeIndex<run.route.length-1){run.resolveAction(run.actions()[0].id);run.clearNode()}
    expect(run.current()).toBe('boss');
    expect(run.resolveAction('escape')).toBe(true);
    run.clearNode();
    expect(run.stats.victory).toBe(false);
    expect(run.stats.nodesCleared).toBe(run.route.length);
  });
  it('resets an expedition to a new deterministic seed', () => {
    const run=new ExpeditionRun(42);
    run.reset(2026);
    expect(run.seed).toBe(2026);
    expect(run.route[0]).toBe('combat');
    expect(run.route[run.route.length-1]).toBe('boss');
    expect(run.route).toContain('shop');
    expect(run.route).toContain('event');
    const twin=new ExpeditionRun(2026);
    expect(run.route).toEqual(twin.route);
    expect(run.nodeIndex).toBe(0);
    expect(run.credits).toBe(0);
    expect(run.hull).toBe(5);
  });
  it('recognizes new sensors and lets shield block the next hit', () => {
    const sim=new Simulation();
    sim.setScenario(EXPEDITION_SCENARIOS.combat);
    expect(sim.build('void update(){ if(enemy_near()){ shield(); } if(low_energy()){ for (int i = 0; i < 1; i = i + 1){ wait(); } } }').ok).toBe(true);
    sim.build('void update(){ if(enemy_near()){ shield(); } for (int i = 0; i < 1; i = i + 1){ wait(); } }');
    sim.reset();
    sim.enemy.x=2; sim.enemy.y=1;
    sim.step();
    expect(sim.robot.hp).toBe(5);
    expect(sim.robot.energy).toBe(18);
    expect(sim.frames[0].sensors.some(s=>s.name==='enemy_near')).toBe(true);
  });
  it('grades battles by speed, damage, energy, actions and sensors', () => {
    expect(gradeBattle({tick:8,damage:0,energyUsed:10,actions:9,sensorReads:8})).toBe('S');
    expect(gradeBattle({tick:14,damage:1,energyUsed:14,actions:16,sensorReads:20})).toBe('A');
    expect(gradeBattle({tick:18,damage:2,energyUsed:16,actions:20,sensorReads:30})).toBe('B');
    expect(gradeBattle({tick:30,damage:4,energyUsed:20,actions:40,sensorReads:0})).toBe('C');
  });
  it('keeps generated expedition routes within bounds and structurally valid', () => {
    for(const seed of [1,2,42,2026,999999]){
      const run=new ExpeditionRun(seed);
      expect(run.route.length).toBeGreaterThanOrEqual(7);
      expect(run.route.length).toBeLessThanOrEqual(10);
      expect(run.route[0]).toBe('combat');
      expect(run.route[run.route.length-1]).toBe('boss');
      expect(run.route).toContain('shop');
      expect(run.route).toContain('event');
    }
  });
  it('persists meta credits and upgrades', () => {
    const storage=new MemoryStorage();
    saveMeta({credits:12,runs:3,bestGrade:'A',upgrades:['energy10']},storage);
    const meta=loadMeta(storage);
    expect(meta.credits).toBe(12);
    expect(meta.runs).toBe(3);
    expect(meta.bestGrade).toBe('A');
    expect(meta.upgrades).toEqual(['energy10']);
  });
  it('recovers energy during a battle with the regen module', () => {
    const sim=new Simulation();
    sim.setScenario(EXPEDITION_HUB_SCENARIO, {energyRegenEvery:1, maxEnergy:20});
    expect(sim.build('void update(){ wait(); }').ok).toBe(true);
    sim.reset();
    sim.robot.energy=10;
    sim.step();
    expect(sim.robot.energy).toBe(11);
  });
  it('lets ranged_attack damage an enemy up to two tiles away', () => {
    const sim=new Simulation();
    sim.selectLevel(0);
    expect(sim.build('void update(){ ranged_attack(); }').ok).toBe(true);
    sim.reset();
    sim.enemy={x:3,y:1,hp:3,kind:'slime'};
    sim.step();
    expect(sim.enemy.hp).toBe(2);
    expect(sim.robot.energy).toBe(18);
  });
  it('scales tactical settlement by battle grade', () => {
    const base=new ExpeditionRun(42);
    base.resolveAction('strike',true);
    const graded=new ExpeditionRun(42);
    graded.resolveAction('strike',true,'S');
    expect(graded.lastOutcome.credits).toBe(base.lastOutcome.credits+2);
    expect(graded.lastOutcome.damageDealt).toBe(base.lastOutcome.damageDealt+2);
  });
  it('applies ranged calibration to ranged_attack', () => {
    const sim=new Simulation();
    sim.setScenario(EXPEDITION_HUB_SCENARIO, {rangedPower:2, maxEnergy:20});
    expect(sim.build('void update(){ ranged_attack(); }').ok).toBe(true);
    sim.reset();
    sim.enemy={x:3,y:1,hp:3,kind:'slime'};
    sim.step();
    expect(sim.enemy.hp).toBe(1);
  });
});
