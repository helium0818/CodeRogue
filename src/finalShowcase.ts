import { DungeonLayout, DungeonKind } from './dungeon';
import type { SimulationModifiers } from './core';

export interface FinalEncounter {
  id: string;
  label: string;
  phaseLabel: string;
  slogan: string;
  width: number;
  height: number;
  ascii: string[];
  robot: { x:number; y:number; dir:'N'|'E'|'S'|'W' };
  enemy: { x:number; y:number; hp:number; kind:DungeonKind; moveEvery?:number; attackEvery?:number; range?:number };
  modifiers: Partial<SimulationModifiers>;
  starterCode: string;
  patchHint: string;
}

function mapRows(ascii:string[]):string[]{return ascii.map(row=>row.split('').map(ch=>'#'.includes(ch)?'#':'.').join(''))}
function encounterDungeon(enc:FinalEncounter):DungeonLayout{
  return {width:enc.width,height:enc.height,rooms:[{id:'arena',type:'combat',x:0,y:0,width:enc.width,height:enc.height,interior:mapRows(enc.ascii),enemy:{x:enc.enemy.x,y:enc.enemy.y,hp:enc.enemy.hp,kind:enc.enemy.kind,moveEvery:enc.enemy.moveEvery,attackEvery:enc.enemy.attackEvery,range:enc.enemy.range},items:[]}],corridors:[],doors:[]};
}

const RUNNER_STARTER=`void update() {
  if (enemy_hp() == 0) {
    wait();
    return;
  }

  move_forward();
}`;
const RUNNER_PATCH=`int shots = 0;

void update() {
  if (enemy_hp() == 0) {
    wait();
    return;
  }

  if (shots == 0) {
    ranged_attack();
    shots = 1;
    return;
  }

  if (shots == 1) {
    back();
    shots = 2;
    return;
  }

  ranged_attack();
}`;
const GUARD_PATCH=`bool guarded = false;

void update() {
  if (enemy_hp() == 0) {
    wait();
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

  if (distance_to_enemy() <= 2) {
    dash();
    return;
  }

  move_forward();
}`;
const TURRET_BASELINE=`void update() {
  if (enemy_hp() == 0) {
    wait();
    return;
  }

  if (distance_to_enemy() <= 2) {
    ranged_attack();
    return;
  }

  move_forward();
}`;
const TURRET_OPT=`void update() {
  if (enemy_hp() == 0) {
    wait();
    return;
  }

  if (distance_to_enemy() <= 2) {
    ranged_attack();
    return;
  }

  if (distance_to_enemy() <= 6) {
    dash();
    return;
  }

  move_forward();
}`;

export const FINAL_ENCOUNTERS:FinalEncounter[]=[
  {
    id:'pursuit-bay',label:'PURSUIT BAY',phaseLabel:'PHASE 01 · RUNTIME BUG',slogan:'PURSUIT / RETREAT',width:24,height:9,
    ascii:[
'########################',
'#....##..........##....#',
'#......................#',
'#......................#',
'#..R.r.................#',
'#......................#',
'#....##..........##....#',
'#......................#',
'########################'
    ],
    robot:{x:3,y:4,dir:'E'},
    enemy:{x:5,y:4,hp:2,kind:'runner',moveEvery:1,attackEvery:4},
    modifiers:{maxHp:5,maxEnergy:40},
    starterCode:RUNNER_STARTER,
    patchHint:'Observe distance. When the runner closes in, ranged → back → ranged.'
  },
  {
    id:'security-gate',label:'SECURITY GATE',phaseLabel:'PHASE 02 · STRATEGY INVALIDATED',slogan:'CLOSE IN / SURVIVE',width:24,height:9,
    ascii:[
'########################',
'#......######..........#',
'#......#....#..........#',
'#......#....#..........#',
'#..R.G......#..........#',
'#......#....#..........#',
'#......######..........#',
'#......................#',
'########################'
    ],
    robot:{x:3,y:4,dir:'E'},
    enemy:{x:5,y:4,hp:6,kind:'guard',moveEvery:1000,attackEvery:4},
    modifiers:{maxHp:5,maxEnergy:40,incomingDamage:5},
    starterCode:RUNNER_STARTER,
    patchHint:'Ranged damage = 0. Switch to melee and shield when Guard HP <= 2.'
  },
  {
    id:'fire-control',label:'FIRE CONTROL',phaseLabel:'PHASE 03 · RUNTIME OPTIMIZATION',slogan:'MINIMIZE EXPOSURE',width:28,height:9,
    ascii:[
'############################',
'#.........####.............#',
'#..........................#',
'#..........................#',
'#..R..............T........#',
'#..........................#',
'#.........####.............#',
'#..........................#',
'############################'
    ],
    robot:{x:3,y:4,dir:'E'},
    enemy:{x:18,y:4,hp:1,kind:'turret',moveEvery:1000,attackEvery:2,range:5},
    modifiers:{maxHp:5,maxEnergy:40},
    starterCode:TURRET_BASELINE,
    patchHint:'Reduce exposure time: when distance <= 6 use dash.'
  }
];

export function finalDungeon(enc:FinalEncounter){return encounterDungeon(enc)}
export const FINAL_CODES={runnerPatch:RUNNER_PATCH,guardPatch:GUARD_PATCH,turretBaseline:TURRET_BASELINE,turretOpt:TURRET_OPT};