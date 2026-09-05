import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/core';
import { DungeonLayout } from '../src/dungeon';

function floorDungeon(w:number,h=5):DungeonLayout{return{width:w,height:h,rooms:[{id:'arena',type:'combat',x:0,y:0,width:w,height:h,interior:Array.from({length:h},()=>'.'.repeat(w)),items:[]}],corridors:[],doors:[]}}
function make(enemies:any[],code='void update(){ wait(); }',w=24,mods?:any){const sim=new Simulation();sim.setScenario({id:'multi',title:'multi',objective:'multi',dungeon:floorDungeon(w),starterCode:code,solutionCode:code,tactics:[],enemies},mods);expect(sim.build(code).ok).toBe(true);sim.reset();return sim}
function stepN(sim:Simulation,n:number){for(let i=0;i<n&&sim.status==='running';i++)sim.step()}

describe('multi-enemy core',()=>{
  it('legacy alias remains single enemy identity after reset and rollback',()=>{
    const sim=make([{x:5,y:1,hp:2,kind:'slime',active:true}]);
    expect(sim.enemies.length).toBe(1); expect(sim.enemy).toBe(sim.enemies[0]);
    const snap=sim.snapshot();sim.step();sim.rollback(snap);
    expect(sim.enemy).toBe(sim.enemies[0]); expect(sim.enemies[0].hp).toBe(2);
  });
  it('nearest targeting and equal distance tie-break',()=>{
    const sim=make([{x:4,y:1,hp:3,kind:'slime'},{x:2,y:2,hp:7,kind:'slime'}],'void update(){ distance_to_enemy(); enemy_hp(); enemy_x(); enemy_y(); }');
    stepN(sim,1);
    const s=sim.frames[0].sensors;
    expect(s.find(x=>x.name==='distance_to_enemy')?.value).toBe(2);
    expect(s.find(x=>x.name==='enemy_hp')?.value).toBe(7);
    expect(s.find(x=>x.name==='enemy_x')?.value).toBe(2);
    expect(s.find(x=>x.name==='enemy_y')?.value).toBe(2);
  });
  it('enemy_ahead reports any enemy directly ahead and attack hits it',()=>{
    const sim=make([{x:3,y:1,hp:4,kind:'slime'},{x:2,y:1,hp:1,kind:'slime'}],'void update(){ if(enemy_ahead()){ attack(); } }');
    stepN(sim,1);
    expect(sim.enemies[1].hp).toBe(0); expect(sim.enemies[0].hp).toBe(4);
  });
  it('ranged selects nearest in range; guard immunity applies to selected guard',()=>{
    const sim=make([{x:4,y:1,hp:3,kind:'guard'},{x:3,y:1,hp:3,kind:'slime'}],'void update(){ ranged_attack(); }');
    stepN(sim,1);
    expect(sim.enemies[0].hp).toBe(3); expect(sim.enemies[1].hp).toBe(2);
  });
  it('dead and dormant enemies are ignored',()=>{
    const sim=make([{x:-1,y:-1,hp:0,kind:'slime'},{x:4,y:1,hp:1,kind:'slime',active:false},{x:5,y:1,hp:2,kind:'slime'}],'void update(){ distance_to_enemy(); enemy_hp(); }');
    stepN(sim,1);
    expect(sim.frames[0].sensors.find(s=>s.name==='distance_to_enemy')?.value).toBe(4);
    expect(sim.frames[0].sensors.find(s=>s.name==='enemy_hp')?.value).toBe(2);
  });
  it('three active enemies independently move without sharing state',()=>{
    const sim=make([
      {x:10,y:1,hp:4,kind:'slime',moveEvery:1,attackEvery:1,active:true},
      {x:12,y:1,hp:4,kind:'swarm',moveEvery:1,attackEvery:1,active:true},
      {x:14,y:1,hp:4,kind:'turret',attackEvery:1,range:5,active:true}
    ]);
    stepN(sim,2);
    expect(sim.enemies[0].x).toBeLessThan(10);
    expect(sim.enemies[1].x).toBeLessThan(12);
    expect(sim.enemies[2].x).toBe(14);
  });
  it('dormant enemy does not move until activated',()=>{
    const sim=make([{x:3,y:1,hp:5,kind:'slime',active:false},{x:10,y:1,hp:5,kind:'slime',active:true}]);
    stepN(sim,3); expect(sim.enemies[0].x).toBe(3);
    sim.enemies[0].active=true; stepN(sim,3); expect(sim.enemies[0].x).not.toBe(3);
  });
  it('robot blocked by enemy; enemies do not overlap',()=>{
    const sim=make([{x:4,y:1,hp:2,kind:'slime',moveEvery:1},{x:2,y:1,hp:2,kind:'slime',moveEvery:1}],'void update(){ move_forward(); }');
    const before=sim.robot.x; stepN(sim,1); expect(sim.robot.x).toBe(before);
    for(let i=0;i<4&&sim.status==='running';i++)sim.step();
    const pos=sim.enemies.map(e=>e.x+','+e.y);
    expect(new Set(pos).size).toBe(sim.enemies.length);
  });
  it('three-enemy snapshot/rollback restores full array',()=>{
    const sim=make([{x:5,y:1,hp:3,kind:'slime'},{x:6,y:1,hp:4,kind:'runner',moveEvery:1,attackEvery:5},{x:7,y:1,hp:5,kind:'tank'}]);
    stepN(sim,1); const snap=sim.snapshot();
    sim.enemies[0].hp=99; sim.enemies[0].x=-9; sim.enemies[1].active=false;
    sim.rollback(snap);
    expect(sim.enemies.map(e=>e.hp)).toEqual([3,4,5]);
    expect(sim.enemies[0].x).toBe(5); expect(sim.enemies[1].active).not.toBe(false);
    expect(sim.enemy).toBe(sim.enemies[0]);
  });
  it('hot reload preserves all enemies and alias',()=>{
    const sim=make([{x:5,y:1,hp:3,kind:'slime'},{x:6,y:1,hp:4,kind:'runner',moveEvery:1,attackEvery:5},{x:7,y:1,hp:5,kind:'tank'}],'void update(){ wait(); }');
    stepN(sim,1); sim.pause(); sim.hotReload('void update(){ move_forward(); }');
    expect(sim.enemies.length).toBe(3); expect(sim.enemies.map(e=>e.hp)).toEqual([3,4,5]);
    expect(sim.enemy).toBe(sim.enemies[0]);
  });
  it('frames and core dump contain all enemies',()=>{
    const sim=make([{x:5,y:1,hp:3,kind:'slime'},{x:6,y:1,hp:4,kind:'runner',moveEvery:1,attackEvery:5},{x:7,y:1,hp:5,kind:'tank'}],'void update(){ int x = 1 / 0; }');
    stepN(sim,1);
    expect(sim.frames[0].enemies.length).toBe(3); expect(sim.coreDump?.enemies?.length).toBe(3);
  });
});

describe('multi-enemy micro facts',()=>{
  it('A: slime+runner+dormant swarm nearest changes after activation',()=>{
    const sim=make([{x:3,y:1,hp:5,kind:'slime',moveEvery:1,attackEvery:2},{x:8,y:1,hp:2,kind:'runner',moveEvery:1,attackEvery:1},{x:12,y:1,hp:2,kind:'swarm',moveEvery:1,attackEvery:1,active:false}],'void update(){ enemy_hp(); }');
    stepN(sim,1);
    expect(sim.frames[0].sensors.find(s=>s.name==='enemy_hp')?.value).toBe(5);
    sim.enemies[2].active=true;
    sim.robot.x=10; sim.robot.y=1;
    stepN(sim,1);
    expect(sim.frames[1].sensors.find(s=>s.name==='enemy_hp')?.value).toBe(2);
  });
  it('B: guard selected by ranged takes 0 damage while turret can attack independently',()=>{
    const sim=make([{x:3,y:1,hp:4,kind:'guard',moveEvery:1,attackEvery:5},{x:6,y:1,hp:4,kind:'turret',moveEvery:1,attackEvery:1,range:5}],'void update(){ ranged_attack(); }');
    const hp=sim.robot.hp; stepN(sim,1);
    expect(sim.enemies[0].hp).toBe(4); expect(sim.enemies[1].hp).toBe(4);
    expect(sim.robot.hp).toBeLessThan(hp);
  });
  it('C: tank+runner+turret active for 5 ticks without corruption',()=>{
    const sim=make([{x:3,y:1,hp:5,kind:'tank',moveEvery:1,attackEvery:4},{x:6,y:1,hp:1,kind:'runner',moveEvery:1,attackEvery:3},{x:10,y:1,hp:4,kind:'turret',moveEvery:1,attackEvery:3,range:6}]);
    stepN(sim,5);
    expect(sim.enemies.length).toBe(3);
    expect(sim.frames.length).toBeGreaterThanOrEqual(5);
    expect(sim.frames.every(f=>f.enemies.length===3)).toBe(true);
    expect(sim.enemies.every(e=>Number.isFinite(e.hp))).toBe(true);
  });
});