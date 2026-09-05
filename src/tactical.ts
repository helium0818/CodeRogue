import { DungeonLayout, DungeonRoomType, DungeonKind } from './dungeon';
import type { SimulationModifiers } from './core';

export interface TacticalScenario {
  id: string;
  title: string;
  objective: string;
  lesson: string;
  dungeon: DungeonLayout;
  starterCode: string;
  finalCode: string;
  modifiers?: Partial<SimulationModifiers>;
}

function fill(w:number,h:number,ch:string){return Array.from({length:h},()=>Array.from({length:w},()=>ch))}
function carve(grid:string[][],x:number,y:number){if(y>=0&&y<grid.length&&x>=0&&x<grid[y].length)grid[y][x]='.'}
function toRows(grid:string[][]){return grid.map(row=>row.join(''))}

export interface TacticalSpec{kind:DungeonKind;hp:number;ex:number;ey:number;moveEvery?:number;attackEvery?:number;range?:number;obstacles:{x:number;y:number}[];items?:{x:number;y:number;kind:'energy'|'heal'}[]}

export function buildTacticalDungeon(width:number,height:number,enemy:TacticalSpec):DungeonLayout{
  const mid=Math.floor(height/2);
  const startW=4;
  const exitW=4;
  const arenaW=width-startW-exitW;
  const startGrid=fill(startW,height,'.');
  const arenaGrid=fill(arenaW,height,'.');
  const exitGrid=fill(exitW,height,'.');
  for(const o of enemy.obstacles){if(o.x>=0&&o.x<arenaW)arenaGrid[o.y][o.x]='#'}
  const rooms=[];
  rooms.push({id:'r0',type:'start' as DungeonRoomType,x:0,y:0,width:startW,height,interior:toRows(startGrid),spawn:{x:2,y:mid},items:[],exit:undefined});
  rooms.push({id:'r1',type:'combat' as DungeonRoomType,x:startW,y:0,width:arenaW,height,interior:toRows(arenaGrid),enemy:{x:enemy.ex,y:enemy.ey,hp:enemy.hp,kind:enemy.kind,moveEvery:enemy.moveEvery,attackEvery:enemy.attackEvery,range:enemy.range},items:enemy.items??[],exit:undefined});
  rooms.push({id:'r2',type:'exit' as DungeonRoomType,x:startW+arenaW,y:0,width:exitW,height,interior:toRows(exitGrid),items:[],exit:{x:2,y:mid}});
  return {width,height,rooms:rooms as DungeonLayout['rooms'],corridors:[],doors:[]};
}

const RUNNER_FINAL = `int shots = 0;
void update() {
  if (enemy_hp() == 0) {
    if (wall_ahead()) { turn_right(); }
    else { move_forward(); }
    return;
  }
  if (shots == 0 && distance_to_enemy() <= 2) {
    ranged_attack();
    shots = shots + 1;
    return;
  }
  if (shots == 1 && enemy_hp() > 0) {
    back();
    shots = shots + 1;
    return;
  }
  if (shots == 2 && enemy_hp() > 0) {
    ranged_attack();
    return;
  }
  if (wall_ahead()) { turn_left(); }
  else { move_forward(); }
}`;

const GUARD_FINAL = `bool guarded = false;
void update() {
  if (enemy_hp() == 0) {
    if (wall_ahead()) { turn_right(); }
    else { move_forward(); }
    return;
  }
  if (enemy_ahead()) {
    if (enemy_hp() <= 2 && !guarded) {
      shield();
      guarded = true;
    } else {
      attack();
    }
    return;
  }
  if (distance_to_enemy() <= 2) { dash(); return; }
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}`;

const TURRET_FINAL = `void update() {
  if (enemy_hp() == 0) {
    if (wall_ahead()) { turn_right(); }
    else { move_forward(); }
    return;
  }
  if (distance_to_enemy() <= 2) { ranged_attack(); return; }
  if (distance_to_enemy() <= 6) { dash(); return; }
  if (wall_ahead()) { turn_left(); }
  else { move_forward(); }
}`;

export const TACTICAL_SCENARIOS: TacticalScenario[] = [
  {
    id:'runner-arena',
    title:'Runner Arena · Kiting',
    objective:'Runner 接触会自爆：靠近后开火，后撤一步，在自爆节奏前补第二枪，然后抵达出口。',
    lesson:'Bug Fixing：Trace 会告诉你 move_forward 把距离变成 1 才是死因。',
    dungeon:buildTacticalDungeon(24,7,{kind:'runner',hp:2,ex:0,ey:3,moveEvery:1,attackEvery:4,obstacles:[{x:3,y:1},{x:8,y:5},{x:13,y:1},{x:15,y:5}],items:[{x:16,y:3,kind:'energy'}]}),
    starterCode:`void update() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}`,
    finalCode:RUNNER_FINAL,
    modifiers:{maxEnergy:30}
  },
  {
    id:'guard-arena',
    title:'Guard Arena · Forced Melee',
    objective:'Guard 免疫远程且重击很高：必须先近身，用护盾挡关键一击，再用 attack() 连续近战。',
    lesson:'Strategy Adaptation：看到 ranged_attack 命中但 enemy_hp 不变时，就是 Guard 的远程免疫信号。',
    dungeon:buildTacticalDungeon(27,7,{kind:'guard',hp:6,ex:0,ey:3,moveEvery:1000,attackEvery:4,obstacles:[{x:4,y:1},{x:4,y:5},{x:11,y:2},{x:15,y:4}]}),
    starterCode:`void update() {
  if (enemy_near()) { ranged_attack(); }
  else { move_forward(); }
}`,
    finalCode:GUARD_FINAL,
    modifiers:{maxHp:10,maxEnergy:34,incomingDamage:5}
  },
  {
    id:'turret-arena',
    title:'Turret Arena · Exposure Management',
    objective:'Turret 在射程内持续开火：进入危险区后减少停留 tick，用 dash 穿过并用 ranged_attack 收尾。',
    lesson:'Optimization：同样的通关，dash 少暴露 2 tick、少受 2 点伤害。',
    dungeon:buildTacticalDungeon(27,7,{kind:'turret',hp:1,ex:14,ey:3,moveEvery:1000,attackEvery:2,range:5,obstacles:[{x:5,y:1},{x:9,y:5},{x:17,y:2},{x:20,y:4}],items:[{x:3,y:3,kind:'energy'}]}),
    starterCode:`void update() {
  if (enemy_near()) { ranged_attack(); }
  else { move_forward(); }
}`,
    finalCode:TURRET_FINAL,
    modifiers:{maxEnergy:30}
  }
];