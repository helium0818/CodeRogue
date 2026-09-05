import { DungeonLayout } from './dungeon';
import { Simulation, SimulationModifiers } from './core';
import { roomModifiers } from './tacticalRun';

export const PATROL_CODE = `int corner = 0;

void navigate() {
  if (wall_ahead()) {
    if (corner == 0 || corner == 1 || corner == 2 || corner == 3) {
      turn_left();
    } else {
      turn_right();
    }
    corner = corner + 1;
    return;
  }

  move_forward();
}

void update() {
  if (enemy_ahead()) {
    attack();
    return;
  }

  navigate();
}`;

export const CONTROL_CODE = `int corner = 0;
bool retreat = false;

void navigate() {
  if (wall_ahead()) {
    if (corner == 1 || corner == 3) {
      turn_left();
    } else {
      turn_right();
    }
    corner = corner + 1;
    return;
  }

  move_forward();
}

void update() {
  if (enemy_ahead()) {
    attack();
    return;
  }

  if (retreat) {
    back();
    retreat = false;
    return;
  }

  if (distance_to_enemy() <= 2) {
    ranged_attack();
    retreat = true;
    return;
  }

  navigate();
}`;


export const RANGED_CODE = `int corner = 0;

void navigate() {
  if (wall_ahead()) {
    if (corner == 0) { turn_left(); } else if (corner == 1) { turn_right(); } else if (corner == 2) { turn_right(); } else if (corner == 3) { turn_left(); } else if (corner == 4) { turn_left(); } else { turn_left(); }
    corner = corner + 1; return;
  }
  move_forward();
}
void update() {
  if (enemy_near()) { ranged_attack(); return; }
  navigate();
}`;

export const BREACH_CODE = `int corner = 0;
bool guarded = false;

void navigate() {
  if (wall_ahead()) {
    if (corner == 0) { turn_left(); } else if (corner == 1) { turn_right(); } else if (corner == 2) { turn_right(); } else if (corner == 3) { turn_left(); } else if (corner == 4) { turn_left(); } else { turn_left(); }
    corner = corner + 1; return;
  }
  move_forward();
}
void update() {
  if (enemy_ahead()) {
    if (enemy_hp() <= 2 && !guarded) { shield(); guarded = true; } else { attack(); }
    return;
  }
  if (enemy_near()) { dash(); return; }
  navigate();
}`;export const BREACH_NO_SHIELD_CODE = BREACH_CODE.replace('if (enemy_hp() <= 2 && !guarded) { shield(); guarded = true; } else { attack(); }', 'attack();');
export const NAIVE_CODE='void update(){ move_forward(); }';
export const STANDARD_CODE = `int corner = 0;

void navigate() {
  if (wall_ahead()) {
    if (corner == 0) {
      turn_left();
    } else if (corner == 1) {
      turn_right();
    } else {
      turn_right();
    }
    corner = corner + 1;
    return;
  }
  move_forward();
}

void update() {
  if (distance_to_enemy() <= 2) {
    ranged_attack();
    return;
  }
  if (enemy_ahead()) {
    attack();
    return;
  }
  navigate();
}`;

export const ADAPTIVE_CODE = `int corner = 0;
int reposition = 0;
int side = 0;

void navigate() {
  if (wall_ahead()) {
    if (corner == 0) { turn_left(); }
    else if (corner == 1) { turn_right(); }
    else if (side == 0) { turn_left(); side = 1; }
    else { turn_right(); side = 0; }
    corner = corner + 1;
    return;
  }
  move_forward();
}

void update() {
  if (enemy_hp() == 0) { navigate(); return; }
  if (distance_to_enemy() <= 2) { ranged_attack(); return; }
  if (wall_ahead()) { navigate(); return; }
  if (distance_to_enemy() == 3) {
    if (enemy_hp() <= 2 && reposition == 0) { back(); reposition = 1; return; }
    if (reposition == 1) { turn_left(); reposition = 2; return; }
    if (reposition == 2) { turn_right(); reposition = 0; return; }
    move_forward(); return;
  }
  if (enemy_hp() >= 5 && distance_to_enemy() <= 6) { move_forward(); return; }
  if (distance_to_enemy() <= 6) { dash(); return; }
  navigate();
}`;

export const KITE_CODE = `int corner = 0;
int reposition = 0;
int retreating = 0;
int side = 0;

void navigate() {
  if (wall_ahead()) {
    if (corner == 0) { turn_left(); }
    else if (corner == 1) { turn_right(); }
    else if (side == 0) { turn_left(); side = 1; }
    else { turn_right(); side = 0; }
    corner = corner + 1;
    return;
  }
  move_forward();
}

void update() {
  if (enemy_hp() == 0) { navigate(); return; }
  if (retreating == 1) { retreating = 0; back(); return; }
  if (distance_to_enemy() <= 2) { ranged_attack(); retreating = 1; return; }
  if (wall_ahead()) { navigate(); return; }
  if (distance_to_enemy() == 3) {
    if (enemy_hp() <= 2 && reposition == 0) { back(); reposition = 1; return; }
    if (reposition == 1) { turn_left(); reposition = 2; return; }
    if (reposition == 2) { turn_right(); reposition = 0; return; }
    move_forward(); return;
  }
  if (enemy_hp() >= 5 && distance_to_enemy() <= 6) { move_forward(); return; }
  if (distance_to_enemy() <= 6) { dash(); return; }
  navigate();
}`;

export interface RogueEnemyMeta {
  x:number;y:number;hp:number;damage?:number;kind:'slime'|'runner'|'swarm'|'guard'|'turret'|'tank';
  moveEvery?:number;attackEvery?:number;range?:number;active?:boolean;
}
export interface RogueEncounter {
  id:string;label:string;width:number;height:number;ascii:string[];
  robot:{x:number;y:number;dir:'N'|'E'|'S'|'W'};
  enemies:RogueEnemyMeta[];
  swarmActivateX:number;
  modifiers?:{maxHp:number;maxEnergy:number;incomingDamage?:number;nearRange?:number;rangedRange?:number;energyRegenEvery?:number};
}
export interface RogueCombatStats {
  success:boolean;ticks:number;hp:number;energy:number;damageTaken:number;
  turnCount:number;actedCount:number[];killOrder:string[];activationTick:number;
  maxSimultaneousActive:number;exposureTicks:number;reachedRouteGoal?:boolean;firstEnemyNearTick?:number;firstDashTick?:number;rangedShots?:number;
}
export function rogueDungeon(enc:RogueEncounter):DungeonLayout{
  const rectRows=enc.ascii.map(row=>row.length<enc.width?row.padEnd(enc.width,'#'):row);
  const interior=rectRows.map(row=>row.split('').map(ch=>ch==='#'?'#':'.').join(''));
  return {width:enc.width,height:enc.height,rooms:[{id:'arena',type:'combat',x:0,y:0,width:enc.width,height:enc.height,interior,items:[]}],corridors:[],doors:[]};
}

export const PURSUIT_LABYRINTH:RogueEncounter={
  id:'pursuit-labyrinth',label:'PURSUIT LABYRINTH',width:38,height:12,
  ascii:[
'######################################',
'#...............#..................#'+'##',
'#.....S.........#..................#'+'##',
'#.....#####.....#..................#'+'##',
'#.........#..........r.............#' + '##',
'#.........#.........................#' + '#',
'#.........######....................#' + '#',
'#...............#...................#' + '#',
'#R..............#.........w.........#' + '#',
'#...............########............#' + '#',
'#...................................#' + '#',
'######################################'
  ],
  robot:{x:2,y:8,dir:'E'},
  enemies:[
    {x:7,y:2,hp:2,kind:'slime',moveEvery:3,attackEvery:4,active:true},
    {x:26,y:4,hp:3,kind:'runner',moveEvery:2,attackEvery:6,active:true},
    {x:25,y:8,hp:2,kind:'swarm',moveEvery:1,attackEvery:3,active:false}
  ],
  swarmActivateX:20,
  modifiers:{maxHp:6,maxEnergy:90}
};

function buildSecurityRows():string[]{
 return [
'####################################',
'#############...#....#...#..########',
'#############...#.....#.....########',
'#############.................######',
'#########...#..#....#....#....######',
'#########.#.......#.#######...######',
'########............#######...######',
'#######.....#..#.....######...######',
'#..#.#....########.....#...#.......#',
'#.........########.................#',
'#........#########...........#######',
'#...#....###########...............#',
'#....#...###########..#...#...#....#',
'#........###########...............#',
'####################################',
'####################################'
 ];
}export const SECURITY_COMPLEX:RogueEncounter={
 id:'security-complex',label:'SECURITY COMPLEX',width:36,height:16,
 ascii:buildSecurityRows(),
 robot:{x:2,y:10,dir:'E'},
 enemies:[
  {x:17,y:6,hp:6,damage:5,kind:'guard',moveEvery:1000,attackEvery:6,active:true},
  {x:13,y:3,hp:2,damage:1,kind:'turret',range:4,attackEvery:16,active:true},
  {x:24,y:10,hp:2,damage:1,kind:'slime',moveEvery:1000,attackEvery:1000,active:false}
 ],
 swarmActivateX:19,
 modifiers:{maxHp:6,maxEnergy:90}
};
function buildFireControlRows():string[]{
 const w=36,h=16;
 const grid:string[][]=Array.from({length:h},()=>Array.from({length:w},()=>'#'));
 const open=(x0:number,y0:number,x1:number,y1:number)=>{for(let y=y0;y<=y1;y++){for(let x=x0;x<=x1;x++){grid[y][x]='.'}}};
 open(2,11,21,13);
 open(21,5,21,13);
 open(21,5,34,6);
 return grid.map(row=>row.join(''));
}
export const FIRE_CONTROL_CORE:RogueEncounter={
 id:'fire-control-core',label:'FIRE CONTROL CORE',width:36,height:16,
 ascii:buildFireControlRows(),
 robot:{x:3,y:12,dir:'E'},
 enemies:[
  {x:28,y:5,hp:2,damage:1,kind:'turret',range:5,attackEvery:2,active:true},
  {x:34,y:5,hp:6,damage:1,kind:'tank',moveEvery:12,attackEvery:5,active:true},
  {x:34,y:6,hp:2,kind:'runner',moveEvery:1,attackEvery:2,active:false}
 ],
 swarmActivateX:21,
 modifiers:{maxHp:8,maxEnergy:110}
};
export function simulateRogueCombat(enc:RogueEncounter,code:string,opts?:{startingEnergy?:number;nearRange?:number;activation?:boolean;goal?:{x:number;y:number};maxTicks?:number;modifiers?:Partial<SimulationModifiers>;hp?:number;energy?:number}):RogueCombatStats{
  const sim=new Simulation();
  const mods={...enc.modifiers,...(opts?.modifiers??{}),...(opts?.nearRange!==undefined?{nearRange:opts.nearRange}:{}),...(opts?.startingEnergy!==undefined?{maxEnergy:opts.startingEnergy}:{})};sim.setScenario({id:enc.id,title:enc.label,objective:enc.label,dungeon:rogueDungeon(enc),starterCode:code,solutionCode:code,tactics:[],enemies:enc.enemies.map(e=>({...e}))},mods);
  if(!sim.build(code).ok){return{success:false,ticks:0,hp:0,energy:0,damageTaken:0,turnCount:0,actedCount:[0,0,0],killOrder:[],activationTick:-1,maxSimultaneousActive:0,exposureTicks:0}}
  sim.reset();
  sim.robot.x=enc.robot.x;sim.robot.y=enc.robot.y;sim.robot.dir=enc.robot.dir;
  if(opts?.hp!==undefined)sim.robot.hp=Math.max(0,Math.min(opts.hp,mods.maxHp??sim.robot.hp));
  if(opts?.energy!==undefined)sim.robot.energy=Math.max(0,Math.min(opts.energy,mods.maxEnergy??sim.robot.energy));
  const startHp=sim.robot.hp;
  const starts=enc.enemies.map(e=>({x:e.x,y:e.y,hp:e.hp}));
  const acted=[false,false,false];
  const killOrder:string[]=[];let lastAlive=[...sim.enemies.map(e=>e.hp>0)];
  let swarmOn=false;let swarmTick=-1;let reachedRouteGoal=false;
  const maxTicks=opts?.maxTicks??500;
  for(let i=0;i<maxTicks&&sim.status==='running';i++){
    const runner=sim.enemies.find(e=>e.kind==='runner');
    const guard=sim.enemies.find(e=>e.kind==='guard');
    if((opts?.activation??true)&&!swarmOn && sim.enemies[2] && (guard&&guard.hp<=0 || runner&&runner.hp<=0 || sim.robot.x>=enc.swarmActivateX)){
      sim.enemies[2].active=true;swarmOn=true;swarmTick=sim.tick+1;
    }
    for(let idx=0;idx<sim.enemies.length;idx++){const e=sim.enemies[idx];if(!e.active||e.hp<=0)continue;if(e.x!==starts[idx].x||e.y!==starts[idx].y||e.hp<starts[idx].hp)acted[idx]=true}
    sim.step();
    if(opts?.goal&&!reachedRouteGoal&&sim.robot.x===opts.goal.x&&sim.robot.y===opts.goal.y){reachedRouteGoal=true;break;}
    for(let idx=0;idx<sim.enemies.length;idx++){const e=sim.enemies[idx];if(e.active!==false&&e.hp>0&&(e.x!==starts[idx].x||e.y!==starts[idx].y||e.hp<starts[idx].hp))acted[idx]=true}
    for(let idx=0;idx<sim.enemies.length;idx++){if(lastAlive[idx]&&sim.enemies[idx].hp<=0){killOrder.push(sim.enemies[idx].kind??'');lastAlive[idx]=false}}
    if(sim.enemies.every(e=>e.hp<=0))break;
  }
  const turnCount=sim.frames.filter(f=>f.action==='turn_left'||f.action==='turn_right').length;
  let maxSimultaneousActive=0;let exposureTicks=0;let firstEnemyNearTick:number|undefined;let firstDashTick:number|undefined;let rangedShots=0;
  for(const frame of sim.frames){
    if(firstEnemyNearTick===undefined&&frame.sensors.some(s=>s.name==='enemy_near'&&s.value===true))firstEnemyNearTick=frame.tick;
    if(firstDashTick===undefined&&frame.action==='dash')firstDashTick=frame.tick;
    if(frame.action==='ranged_attack')rangedShots++;
    const alive=frame.enemies.filter(e=>e.active!==false&&e.hp>0&&e.x>=0);
    if(alive.length>maxSimultaneousActive)maxSimultaneousActive=alive.length;
    if(alive.some(e=>{const d=Math.abs(e.x-frame.robot.x)+Math.abs(e.y-frame.robot.y);return e.kind==='turret'?d<=(e.range??3):d<=1}))exposureTicks++;

  }
  return {success:sim.enemies.every(e=>e.hp<=0),ticks:sim.tick,hp:sim.robot.hp,energy:sim.robot.energy,damageTaken:Math.max(0,startHp-sim.robot.hp),turnCount,actedCount:acted.map(v=>v?1:0),killOrder,activationTick:swarmTick,maxSimultaneousActive,exposureTicks,reachedRouteGoal,firstEnemyNearTick,firstDashTick,rangedShots};
}
export type FinalRoguePhase='pursuit'|'reward1'|'branch'|'security'|'reward2'|'rest'|'fire-control'|'complete'|'failed';
export type FinalRogueRestChoice='repair'|'charge';
export interface FinalRogueCombatRecord{phase:FinalRoguePhase;firmware:string;startHp:number;startEnergy:number;endHp:number;endEnergy:number;ticks:number;damageTaken:number;kills:number;success:boolean}
export interface FinalRogueTimelineNode{label:string;phase:FinalRoguePhase;hp:number;energy:number;maxHp:number;maxEnergy:number;modules:string[];branch?:'safe'|'risk';restChoice?:FinalRogueRestChoice;combat?:FinalRogueCombatRecord}
export interface FinalRogueRunState{phase:FinalRoguePhase;hp:number;energy:number;maxHp:number;maxEnergy:number;modules:string[];branch?:'safe'|'risk';restChoice?:FinalRogueRestChoice;firmwareCode:string;profile:Record<string,string>;stats:{totalTicks:number;damageTaken:number;kills:number};nodes:FinalRogueTimelineNode[]}
export interface FinalRogueRunResult{state:FinalRogueRunState;success:boolean;combats:RogueCombatStats[]}
export const FINAL_ROGUE_REWARD1:string[]=['regen','sonar','longshot'];
export const FINAL_ROGUE_REWARD2_SAFE:string[]=['shield','rewind'];
export const FINAL_ROGUE_REWARD2_RISK:string[]=['shield','rewind','dash'];

function combineCombatModifiers(enc:RogueEncounter,moduleIds:string[]):Partial<SimulationModifiers>{
  return roomModifiers(enc.modifiers,moduleIds);
}

export class FinalRogueRun{
  phase:FinalRoguePhase='pursuit';
  hp=0;energy=0;maxHp=0;maxEnergy=0;modules:string[]=[];
  branch?:'safe'|'risk';restChoice?:FinalRogueRestChoice;firmwareCode='';
  profile:Record<string,string>={};
  stats={totalTicks:0,damageTaken:0,kills:0};
  nodes:FinalRogueTimelineNode[]=[];
  constructor(){this.reset()}
  reset(){
    this.phase='pursuit';this.modules=[];this.branch=undefined;this.restChoice=undefined;this.firmwareCode='';this.profile={};
    const enc=PURSUIT_LABYRINTH;const mods=combineCombatModifiers(enc,[]);
    this.maxHp=mods.maxHp??enc.modifiers?.maxHp??6;this.maxEnergy=mods.maxEnergy??enc.modifiers?.maxEnergy??90;
    this.hp=this.maxHp;this.energy=this.maxEnergy;
    this.stats={totalTicks:0,damageTaken:0,kills:0};this.nodes=[];
    this.pushNode('initial');
  }
  state():FinalRogueRunState{return{phase:this.phase,hp:this.hp,energy:this.energy,maxHp:this.maxHp,maxEnergy:this.maxEnergy,modules:[...this.modules],branch:this.branch,restChoice:this.restChoice,firmwareCode:this.firmwareCode,profile:{...this.profile},stats:{...this.stats},nodes:this.nodes.map(n=>({...n,combat:n.combat?{...n.combat}:undefined}))}}
  rewardChoices():string[]{if(this.phase==='reward1')return[...FINAL_ROGUE_REWARD1];if(this.phase==='reward2')return this.branch==='risk'?[...FINAL_ROGUE_REWARD2_RISK]:[...FINAL_ROGUE_REWARD2_SAFE];return[]}
  currentEncounter():RogueEncounter|null{const byPhase:Record<string,RogueEncounter>={pursuit:PURSUIT_LABYRINTH,security:SECURITY_COMPLEX,'fire-control':FIRE_CONTROL_CORE};return byPhase[this.phase]??null}
  isCombatPhase():boolean{return this.phase==='pursuit'||this.phase==='security'||this.phase==='fire-control'}
  combatModifiers():Partial<SimulationModifiers>{const enc=this.currentEncounter();if(!enc)return{};return combineCombatModifiers(enc,this.modules)}
  private encounter():RogueEncounter{const enc=this.currentEncounter();if(!enc)throw new Error('No combat for phase '+this.phase);return enc}
  private refreshCaps(enc:RogueEncounter){const mods=combineCombatModifiers(enc,this.modules);this.maxHp=Math.max(1,Math.min(mods.maxHp??enc.modifiers?.maxHp??6,99));this.maxEnergy=Math.max(1,Math.min(mods.maxEnergy??enc.modifiers?.maxEnergy??90,999));this.hp=Math.max(0,Math.min(this.hp,this.maxHp));this.energy=Math.max(0,Math.min(this.energy,this.maxEnergy))}
  private pushNode(label:string,combat?:FinalRogueCombatRecord){this.nodes.push({label,phase:this.phase,hp:this.hp,energy:this.energy,maxHp:this.maxHp,maxEnergy:this.maxEnergy,modules:[...this.modules],branch:this.branch,restChoice:this.restChoice,combat:combat?{...combat}:undefined})}
  runNextCombat(code:string):RogueCombatStats|null{
    if(this.phase!=='pursuit'&&this.phase!=='security'&&this.phase!=='fire-control')return null;
    const enc=this.encounter();this.refreshCaps(enc);const startHp=this.hp;const startEnergy=this.energy;const phase=this.phase;
    this.firmwareCode=code;this.profile[phase]=code;const startLabel=phase==='pursuit'?'combat1-start':phase==='security'?'combat2-start':'combat3-start';this.pushNode(startLabel);
    const mods=combineCombatModifiers(enc,this.modules);
    const result=simulateRogueCombat(enc,code,{hp:this.hp,energy:this.energy,modifiers:mods});
    this.hp=Math.max(0,Math.min(result.hp,this.maxHp));this.energy=Math.max(0,Math.min(result.energy,this.maxEnergy));
    this.stats.totalTicks+=result.ticks;this.stats.damageTaken+=result.damageTaken;this.stats.kills+=result.killOrder.length;
    const nextPhase:FinalRoguePhase=this.phase==='pursuit'?'reward1':this.phase==='security'?'reward2':'complete';
    this.phase=result.success?nextPhase:'failed';
    const record:FinalRogueCombatRecord={phase,startHp,startEnergy,endHp:result.hp,endEnergy:result.energy,ticks:result.ticks,damageTaken:result.damageTaken,kills:result.killOrder.length,success:result.success,firmware:code};
    const doneLabel=this.phase==='failed'?'failed':phase==='pursuit'?'combat1-clear':phase==='security'?'combat2-clear':'complete';this.pushNode(doneLabel,record);
    return result;
  }
  advance():boolean{
    if(this.phase==='reward1'||this.phase==='reward2'||this.phase==='branch'||this.phase==='rest')return false;
    return this.isCombatPhase()||this.phase==='complete';
  }
  chooseReward(id:string):boolean{
    const candidates=this.rewardChoices();if(candidates.length===0||!candidates.includes(id)||this.modules.includes(id))return false;
    this.modules.push(id);
    const nextEnc=this.phase==='reward1'?SECURITY_COMPLEX:FIRE_CONTROL_CORE;
    this.refreshCaps(nextEnc);
    const label=this.phase==='reward1'?'reward1-chosen':'reward2-chosen';
    this.energy=Math.min(this.maxEnergy,this.energy+70);
    this.phase=this.phase==='reward1'?'branch':'rest';
    this.pushNode(label);
    return true;
  }
  chooseBranch(choice:'safe'|'risk'):boolean{
    if(this.phase!=='branch'||(choice!=='safe'&&choice!=='risk'))return false;
    this.branch=choice;
    if(choice==='safe')this.energy=Math.min(this.maxEnergy,this.energy+10);
    this.phase='security';this.refreshCaps(SECURITY_COMPLEX);this.pushNode('branch-chosen');
    return true;
  }
  chooseRest(choice:FinalRogueRestChoice):boolean{
    if(this.phase!=='rest'||(choice!=='repair'&&choice!=='charge'))return false;
    this.restChoice=choice;
    if(choice==='repair')this.hp=Math.min(this.maxHp,this.hp+4);
    else this.energy=Math.min(this.maxEnergy,this.energy+25);
    this.phase='fire-control';this.refreshCaps(FIRE_CONTROL_CORE);this.pushNode('rest-chosen');
    return true;
  }
}

export function runFinalRogue(opts:{reward1?:string;branch?:'safe'|'risk';reward2?:string;rest?:FinalRogueRestChoice}={}):FinalRogueRunResult{
  const run=new FinalRogueRun();const combats:RogueCombatStats[]=[];
  const reward1=opts.reward1??'sonar';const branch=opts.branch??'risk';const reward2=opts.reward2??(branch==='risk'?'dash':'shield');const rest=opts.rest??'repair';
  const c1=run.runNextCombat(CONTROL_CODE);if(c1)combats.push(c1);if(!c1?.success)return{state:run.state(),success:false,combats};
  if(!run.chooseReward(reward1))return{state:run.state(),success:false,combats};
  if(!run.chooseBranch(branch))return{state:run.state(),success:false,combats};
  const c2=run.runNextCombat(BREACH_CODE);if(c2)combats.push(c2);if(!c2?.success)return{state:run.state(),success:false,combats};
  if(!run.chooseReward(reward2))return{state:run.state(),success:false,combats};
  if(!run.chooseRest(rest))return{state:run.state(),success:false,combats};
  const c3=run.runNextCombat(ADAPTIVE_CODE);if(c3)combats.push(c3);
  return{state:run.state(),success:c3?.success===true,combats};
}
export function runFinalRogueCanonical():FinalRogueRunResult{return runFinalRogue({reward1:'sonar',branch:'risk',reward2:'dash',rest:'repair'})}
