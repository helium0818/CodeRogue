import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/core';
import { ROGUE_PROTO_ROOMS,INITIAL_CAPABILITIES,LOCKED_CAPABILITIES,applyProtoReward,createRoguePrototypeState,findLockedCapability,resetPrototypeDebugPoints,spendDebugPoints } from '../src/roguePrototype';

describe('rogue prototype capabilities and debug points',()=>{
  it('initial capability set is exact',()=>{
    expect(INITIAL_CAPABILITIES).toEqual(['wall_ahead','enemy_ahead','enemy_hp','distance_to_enemy','move_forward','turn_left','turn_right','attack','ranged_attack','wait']);
    expect(LOCKED_CAPABILITIES).toContain('back');
  });
  it('blocks locked back() call at prototype layer',()=>{
    const state=createRoguePrototypeState();
    expect(findLockedCapability('void update(){ back(); }',state.capabilities)).toBe('back');
    expect(findLockedCapability('void update(){ move_forward(); }',state.capabilities)).toBeUndefined();
  });
  it('Backstep reward unlocks back()',()=>{
    const s=createRoguePrototypeState();applyProtoReward(s,'back');
    expect(s.capabilities).toContain('back');
    expect(findLockedCapability('back()',s.capabilities)).toBeUndefined();
  });
  it('Threat Scanner reward unlocks enemy_near()',()=>{
    const s=createRoguePrototypeState();applyProtoReward(s,'threat');
    expect(s.capabilities).toContain('enemy_near');
    expect(findLockedCapability('enemy_near()',s.capabilities)).toBeUndefined();
  });
  it('Hot Patch Cache gives 4 debug points per room',()=>{
    const s=createRoguePrototypeState();applyProtoReward(s,'patching');
    resetPrototypeDebugPoints(s);
    expect(s.debugPoints).toBe(4);
  });
  it('debug point spending is exact and insufficient blocks',()=>{
    const s=createRoguePrototypeState();
    expect(spendDebugPoints(s,1)).toBe(true);expect(s.debugPoints).toBe(2);
    expect(spendDebugPoints(s,2)).toBe(true);expect(s.debugPoints).toBe(0);
    expect(spendDebugPoints(s,1)).toBe(false);
  });
  it('reset room keeps firmware concept pure: reset state has no mutation of initial capability set',()=>{
    const a=createRoguePrototypeState();const b=createRoguePrototypeState();
    applyProtoReward(a,'back');
    expect(b.capabilities).not.toContain('back');
  });
});

describe('rogue prototype scenarios build with real Simulation',()=>{
  it('Room 1 scenario loads and initial starter builds',()=>{
    const sc=ROGUE_PROTO_ROOMS[0];const sim=new Simulation();
    sim.setScenario({id:sc.id,title:sc.title,objective:sc.objective,dungeon:sc.dungeon,starterCode:sc.starterCode,solutionCode:sc.starterCode,tactics:[]},sc.modifiers);
    expect(sim.build(sc.starterCode).ok).toBe(true);
    sim.reset();
    for(let i=0;i<3&&sim.status==='running';i++)sim.step();
    expect(sim.status==='failed'||sim.robot.hp<=0).toBe(true);
  });
  it('Room 2 scenario exposes Guard ranged absorption',()=>{
    const sc=ROGUE_PROTO_ROOMS[1];const sim=new Simulation();
    sim.setScenario({id:sc.id,title:sc.title,objective:sc.objective,dungeon:sc.dungeon,starterCode:sc.starterCode,solutionCode:sc.starterCode,tactics:[]},sc.modifiers);
    expect(sim.build('void update(){ if(enemy_near()){ ranged_attack(); } else { move_forward(); } }').ok).toBe(true);
    sim.reset();
    for(let i=0;i<8&&sim.status==='running';i++)sim.step();
    expect(sim.enemy.hp).toBeGreaterThan(0);
  });
});