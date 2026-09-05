import { describe, it, expect } from 'vitest';
import { Simulation, SimulationModifiers } from '../src/core';
import { DungeonLayout, DungeonKind } from '../src/dungeon';

function floorRows(w:number,h:number){return Array.from({length:h},()=>'.'.repeat(w))}
function openDungeon(width:number,height:number,ey:number,enemyKind:DungeonKind,enemyHp:number,moveEvery?:number,attackEvery?:number,range?:number,spawnX=1,enemyX=4):DungeonLayout{
  const mid=Math.floor(height/2);
  return {width,height,rooms:[
    {id:'r1',type:'combat',x:0,y:0,width,height,interior:floorRows(width,height),enemy:{x:enemyX,y:ey,hp:enemyHp,kind:enemyKind,moveEvery,attackEvery,range},items:[]},
    {id:'r0',type:'start',x:0,y:0,width,height,interior:floorRows(width,height),spawn:{x:spawnX,y:mid},items:[]}
  ],corridors:[],doors:[]};
}
function makeSim(d:DungeonLayout,mods?:SimulationModifiers){const sim=new Simulation();sim.setScenario({id:'t',title:'t',objective:'t',dungeon:d,starterCode:'void update(){wait();}',solutionCode:'void update(){wait();}',tactics:[]},mods);return sim}
function stepAction(sim:Simulation,action:string){sim.build(`void update(){ ${action}(); }`);sim.step()}
function dist(sim:Simulation){return sim.enemy.hp>0?Math.abs(sim.enemy.x-sim.robot.x)+Math.abs(sim.enemy.y-sim.robot.y):-1}

describe('tactical feasibility validation',()=>{
  it('Runner: ranged -> runner closes -> back -> runner closes -> ranged kill is stable before explosion',()=>{
    const sim=makeSim(openDungeon(16,3,1,'runner',2,1,4,undefined,3,5));
    sim.reset();
    expect(dist(sim)).toBe(2);
    stepAction(sim,'ranged_attack');
    expect(sim.enemy.hp).toBe(1);
    expect(dist(sim)).toBe(1);
    stepAction(sim,'back');
    expect(sim.robot.x).toBe(2);
    expect(dist(sim)).toBe(1);
    expect(sim.robot.hp).toBe(5);
    stepAction(sim,'ranged_attack');
    expect(sim.enemy.hp).toBe(0);
    expect(sim.robot.hp).toBe(5);
    expect(sim.robot.energy).toBeGreaterThan(0);
  });
  it('Guard: shield at the damage window is decisive under high incoming damage',()=>{
    const d=openDungeon(16,3,1,'guard',6,1000,4,undefined,3,4);
    const mods:SimulationModifiers={maxHp:5,maxEnergy:30,attackPower:1,moveEnergyCost:1,incomingDamage:5};
    const unsafe=makeSim(d,mods);unsafe.reset();
    for(const a of ['attack','attack','attack','attack','attack']) {stepAction(unsafe,a);if(unsafe.robot.hp<=0)break;}
    expect(unsafe.robot.hp).toBe(0);
    const safe=makeSim(d,mods);safe.reset();
    for(const a of ['attack','attack','shield','attack','attack','attack','attack']) {stepAction(safe,a);if(safe.enemy.hp<=0||safe.robot.hp<=0)break;}
    expect(safe.robot.hp).toBeGreaterThan(0);
    expect(safe.enemy.hp).toBe(0);
  });
  it('Turret: dash crosses exposure zone with fewer ticks and higher HP than walking',()=>{
    const mk=()=>makeSim(openDungeon(22,3,1,'turret',1,1000,2,5,2,16));
    const walk=mk();walk.reset();
    while(walk.enemy.hp>0&&walk.robot.hp>0&&walk.frames.length<40){
      const action=dist(walk)<=2?'ranged_attack':'move_forward';
      stepAction(walk,action);
    }
    const dash=mk();dash.reset();
    while(dash.enemy.hp>0&&dash.robot.hp>0&&dash.frames.length<40){
      const d=dist(dash);
      const action=d<=2?'ranged_attack':d<=6?'dash':'move_forward';
      stepAction(dash,action);
    }
    expect(walk.enemy.hp).toBe(0);
    expect(dash.enemy.hp).toBe(0);
    expect(dash.tick).toBeLessThan(walk.tick);
    expect(dash.robot.hp).toBeGreaterThan(walk.robot.hp);
  });
});