import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/core';
import { TACTICAL_SCENARIOS, TacticalScenario } from '../src/tactical';

function runCode(sc:TacticalScenario,code:string){
  const sim=new Simulation();
  sim.setScenario({id:sc.id,title:sc.title,objective:sc.objective,dungeon:sc.dungeon,starterCode:code,solutionCode:code,tactics:[]},sc.modifiers);
  sim.build(code);
  sim.reset();
  for(let i=0;i<220&&sim.status==='running';i++)sim.step();
  return sim;
}
describe('tactical showcase scenarios',()=>{
  it('Runner: starter dies on contact; final kites and reaches exit',()=>{
    const sc=TACTICAL_SCENARIOS[0];
    const starter=runCode(sc,sc.starterCode);
    const final=runCode(sc,sc.finalCode);
    expect(starter.status).toBe('failed');
    expect(final.status).toBe('success');
    expect(final.robot.hp).toBeGreaterThan(0);
    expect(sc.finalCode.includes('turn ==')).toBe(false);
    expect(final.enemy.hp).toBe(0);
    expect(final.robot.energy).toBeGreaterThanOrEqual(4);
  });
  it('Guard: ranged starter is lethal; shielded melee reaches exit',()=>{
    const sc=TACTICAL_SCENARIOS[1];
    const starter=runCode(sc,sc.starterCode);
    const final=runCode(sc,sc.finalCode);
    expect(starter.status).toBe('failed');
    expect(final.status).toBe('success');
    expect(final.robot.hp).toBeGreaterThan(0);
    expect(sc.finalCode.includes('turn ==')).toBe(false);
  });
  it('Turret: starter succeeds with heavy cost; dash final is faster and healthier',()=>{
    const sc=TACTICAL_SCENARIOS[2];
    const starter=runCode(sc,sc.starterCode);
    const final=runCode(sc,sc.finalCode);
    expect(starter.status).toBe('success');
    expect(final.status).toBe('success');
    expect(starter.robot.hp).toBeLessThan(final.robot.hp);
    expect(starter.tick).toBeGreaterThan(final.tick);
  });
});