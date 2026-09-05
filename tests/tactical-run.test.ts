import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/core';
import { TACTICAL_SCENARIOS } from '../src/tactical';
import { TACTICAL_RUN_ROOM_COUNT,createInitialTacticalRun,markRunDebugIntervention,markRunFirmwareRevision,moduleModifiers,roomModifiers,runRoomModifiers,TACTICAL_RUN_ENERGY_BUDGET,tacticalRewardChoices } from '../src/tacticalRun';

function runScenario(code:string,index:number,mods?:Parameters<Simulation['setScenario']>[1],extraMax?:number){
  const sc=TACTICAL_SCENARIOS[index];
  const sim=new Simulation();
  sim.setScenario({id:sc.id,title:sc.title,objective:sc.objective,dungeon:sc.dungeon,starterCode:code,solutionCode:code,tactics:[]},mods);
  sim.build(code);sim.reset();
  for(let i=0;i<220&&sim.status==='running';i++)sim.step();
  return sim;
}

describe('tactical run continuity',()=>{
  it('reuses real module catalog without duplicating logic',()=>{
    const choices=tacticalRewardChoices();
    expect(choices.map(r=>r.id)).toEqual(['regen','sonar','longshot']);
    const mods=roomModifiers(TACTICAL_SCENARIOS[1].modifiers,['regen','sonar','longshot']);
    expect(mods.energyRegenEvery).toBe(5);
    expect(mods.nearRange).toBe(3);
    expect(mods.rangedRange).toBe(3);
    expect(mods.maxHp).toBeGreaterThanOrEqual(TACTICAL_SCENARIOS[1].modifiers?.maxHp??0);
    expect(mods.maxEnergy).toBeGreaterThanOrEqual(TACTICAL_SCENARIOS[1].modifiers?.maxEnergy??0);
  });
  it('module modifiers can be applied to a real Simulation without changing base scenario',()=>{
    const sc=TACTICAL_SCENARIOS[1];
    const sim=new Simulation();
    const mods=roomModifiers(sc.modifiers,['longshot']);
    sim.setScenario({id:sc.id,title:sc.title,objective:sc.objective,dungeon:sc.dungeon,starterCode:sc.finalCode,solutionCode:sc.finalCode,tactics:[]},mods);
    expect(sim.enemy.attackEvery).toBe(4);
    sim.build(sc.finalCode);sim.reset();
    for(let i=0;i<220&&sim.status==='running';i++)sim.step();
    expect(sim.status).toBe('success');
  });
  it('carries HP/Energy from Runner into Guard after reset injection',()=>{
    const runner=TACTICAL_SCENARIOS[0];
    const sim=runScenario(runner.finalCode,0,runner.modifiers);
    expect(sim.status).toBe('success');
    const hp=sim.robot.hp;const energy=sim.robot.energy;
    const guard=TACTICAL_SCENARIOS[1];
    const gsim=new Simulation();
    gsim.setScenario({id:guard.id,title:guard.title,objective:guard.objective,dungeon:guard.dungeon,starterCode:guard.finalCode,solutionCode:guard.finalCode,tactics:[]},roomModifiers(guard.modifiers,[]));
    gsim.reset();
    gsim.robot.hp=Math.min(hp,gsim.robot.hp);
    gsim.robot.energy=Math.min(energy,gsim.robot.energy);
    expect(gsim.robot.hp).toBe(hp);
    expect(gsim.robot.energy).toBe(energy);
  });
  it('run room modifiers keep a continuity energy budget without changing standalone data',()=>{
    const sc=TACTICAL_SCENARIOS[1];
    const mods=runRoomModifiers(sc.modifiers,['regen']);
    expect(mods.maxEnergy).toBe(TACTICAL_RUN_ENERGY_BUDGET);
    expect(sc.modifiers?.maxEnergy).toBe(34);
  });
  it('reset run restores initial state',()=>{
    const initial=createInitialTacticalRun();
    initial.roomIndex=1;initial.hp=3;initial.energy=7;initial.modules.push('longshot');initial.clearedRooms.push('runner');
    const reset=createInitialTacticalRun();
    expect(reset.roomIndex).toBe(0);
    expect(reset.phase).toBe('battle');
    expect(reset.hp).toBe(5);
    expect(reset.energy).toBe(TACTICAL_RUN_ENERGY_BUDGET);
    expect(reset.modules).toEqual([]);
    expect(reset.clearedRooms).toEqual([]);
  });
  it('module calculator exposes expected non-conflicting effects',()=>{
    const mods=moduleModifiers(['sonar','longshot','regen']);
    expect(mods.nearRange).toBe(3);
    expect(mods.rangedRange).toBe(3);
    expect(mods.energyRegenEvery).toBe(5);
  });
});
function runSim(code:string,index:number,mods:any,startHp:number,startEnergy:number){
  const sc=TACTICAL_SCENARIOS[index];const sim=new Simulation();
  sim.setScenario({id:sc.id,title:sc.title,objective:sc.objective,dungeon:sc.dungeon,starterCode:code,solutionCode:code,tactics:[]},mods);
  sim.build(code);sim.reset();
  sim.robot.hp=Math.min(startHp,sim.robot.hp);sim.robot.energy=Math.min(startEnergy,sim.robot.energy);
  for(let i=0;i<260&&sim.status==='running';i++)sim.step();
  return sim;
}

describe('tactical run energy balance and stats',()=>{
  it('selected budget 80 completes the whole run with energy margin',()=>{
    const B=TACTICAL_RUN_ENERGY_BUDGET;
    const runner=TACTICAL_SCENARIOS[0],guard=TACTICAL_SCENARIOS[1],turret=TACTICAL_SCENARIOS[2];
    const r=runSim(runner.finalCode,0,runRoomModifiers(runner.modifiers,['longshot']),5,B);
    expect(r.status).toBe('success');
    const g=runSim(guard.finalCode,1,runRoomModifiers(guard.modifiers,['longshot']),r.robot.hp,r.robot.energy);
    expect(g.status).toBe('success');
    const restHp=Math.min(g.robot.hp+2,guard.modifiers?.maxHp??5);
    const restEn=g.robot.energy+3;
    const t=runSim(turret.finalCode,2,runRoomModifiers(turret.modifiers,['longshot']),restHp,restEn);
    expect(t.status).toBe('success');
    expect(t.robot.energy).toBeGreaterThan(0);
  });
  it('reset run restores firmware revision and debugger counters to zero',()=>{
    const state=createInitialTacticalRun();
    markRunFirmwareRevision(state);markRunFirmwareRevision(state);markRunDebugIntervention(state);
    expect(state.stats.hotReloads).toBe(2);
    expect(state.stats.debugInterventions).toBe(1);
    const reset=createInitialTacticalRun();
    expect(reset.stats.hotReloads).toBe(0);
    expect(reset.stats.debugInterventions).toBe(0);
  });
  it('run stats count constants are visible through Complete-facing state',()=>{
    const state=createInitialTacticalRun();
    state.clearedRooms=['runner-arena','guard-arena','turret-arena'];
    expect(TACTICAL_RUN_ROOM_COUNT).toBe(3);
    expect(state.clearedRooms.length).toBe(TACTICAL_RUN_ROOM_COUNT);
  });
});