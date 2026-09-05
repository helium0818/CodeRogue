import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/core';
import { FINAL_ENCOUNTERS,FINAL_CODES,finalDungeon } from '../src/finalShowcase';

function runEncounter(index:number,code:string,stopOnDead=true){
  const enc=FINAL_ENCOUNTERS[index];const sim=new Simulation();
  sim.setScenario({id:enc.id,title:enc.label,objective:enc.label,dungeon:finalDungeon(enc),starterCode:code,solutionCode:code,tactics:[]},enc.modifiers);
  sim.build(code);sim.reset();
  sim.robot.x=enc.robot.x;sim.robot.y=enc.robot.y;sim.robot.dir=enc.robot.dir;
  for(let i=0;i<260&&sim.status==='running';i++){if(stopOnDead&&sim.enemy.hp<=0)break;sim.step()}
  return sim;
}
function exposure(sim:Simulation){const enc=FINAL_ENCOUNTERS[2];let n=0;for(const f of sim.frames){if(f.enemy.hp>0){const d=Math.abs(f.enemy.x-f.robot.x)+Math.abs(f.enemy.y-f.robot.y);if(d<=(enc.enemy.range??5))n++}}return n}

describe('final showcase scenarios',()=>{
  it('Pursuit Bay naive starter fails; ranged/back/ranged patch clears enemy',()=>{
    const naive=runEncounter(0,FINAL_ENCOUNTERS[0].starterCode);
    expect(naive.status==='failed'||naive.robot.hp<=0).toBe(true);
    const patched=runEncounter(0,FINAL_CODES.runnerPatch);
    expect(patched.enemy.hp).toBe(0);
    expect(patched.robot.hp).toBeGreaterThan(0);
  });
  it('Runner patch cannot damage Guard, but Guard melee+shield survives',()=>{
    const runnerCode=runEncounter(1,FINAL_CODES.runnerPatch);
    expect(runnerCode.enemy.hp).toBe(6);
    const noShield=runEncounter(1,'void update(){ if(enemy_hp()==0){wait();return;} if(enemy_ahead()){attack();return;} move_forward(); }');
    expect(noShield.status==='failed'||noShield.robot.hp<=0).toBe(true);
    const guarded=runEncounter(1,FINAL_CODES.guardPatch);
    expect(guarded.enemy.hp).toBe(0);
    expect(guarded.robot.hp).toBeGreaterThan(0);
  });
  it('Fire Control optimized dash has fewer exposure ticks and higher HP than walk baseline',()=>{
    const base=runEncounter(2,FINAL_CODES.turretBaseline);
    const opt=runEncounter(2,FINAL_CODES.turretOpt);
    expect(base.enemy.hp).toBe(0);
    expect(opt.enemy.hp).toBe(0);
    expect(exposure(opt)).toBeLessThan(exposure(base));
    expect(opt.robot.hp).toBeGreaterThanOrEqual(base.robot.hp+2);
  });
});