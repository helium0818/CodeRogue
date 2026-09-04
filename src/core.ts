import {Interpreter,Parser,lex,RoboError,RuntimeHost,RuntimeValue} from './language';
export type Direction='N'|'E'|'S'|'W'; export interface Robot{x:number;y:number;dir:Direction;hp:number;energy:number} export interface Enemy{x:number;y:number;hp:number;kind?:'slime'|'turret'|'swarm'|'tank'|'runner';moveEvery?:number;attackEvery?:number;range?:number}
export interface Item{x:number;y:number;kind:'energy'|'heal'}
export interface StoryLevel{id:string;title:string;objective:string;map:string[];enemy?:{x:number;y:number;hp:number}}
export interface SimulationScenario{id:string;title:string;objective:string;map:string[];enemy?:Enemy;starterCode:string;solutionCode?:string;tactics:string[];constraint?:{require?:string[];forbid?:string[]};items?:Item[]}
export interface SimulationModifiers{maxHp:number;maxEnergy:number;attackPower:number;moveEnergyCost:number;incomingDamage:number;startingHp?:number;energyRegenEvery?:number;rangedPower?:number}
export const STORY_LEVELS:StoryLevel[]=[
 {id:'0-1',title:'First Boot',objective:'让机器人持续前进并抵达出口',map:['########','#R....E#','########']},
 {id:'0-2',title:'The Wall',objective:'读取 wall_ahead()，绕过障碍抵达出口',map:['########','#R.....#','#..##..#','#.....E#','########']},
 {id:'1-1',title:'Decision',objective:'判断敌人与墙体，消灭史莱姆后撤离',map:['########','#R..S.E#','#......#','#......#','########'],enemy:{x:4,y:1,hp:2}},
 {id:'2-1',title:'Counter Route',objective:'记住遇墙次数，在第二个转角改变方向',map:['########','#R....##','#####.##','#####.E#','########']},
 {id:'2-2',title:'Toggle Corridor',objective:'使用 bool 状态交替选择左转与右转',map:['########','#R....##','#####.##','#####..#','######E#','########']}
];
export interface Frame{tick:number;sourceLine?:number;robot:Robot;enemy:Enemy;variables:Record<string,RuntimeValue>;sensors:{name:string,value:number|boolean}[];action?:string;events:string[];error?:string}
export interface CoreDump{cause:'runtime_error'|'robot_destroyed';tick:number;sourceLine?:number;message:string;robot:Robot;enemy:Enemy;variables:Record<string,RuntimeValue>;recentFrames:Frame[]}
export interface SimulationSnapshot{levelIndex:number;map:string[];robot:Robot;enemy:Enemy;items:Item[];tick:number;frames:Frame[];status:Simulation['status'];message:string;interpreterGlobals:Record<string,RuntimeValue>;scenario?:SimulationScenario}
export interface ProfileStats{ticks:number;actions:number;errors:number;durationMs:number;actionCounts:Record<string,number>}
export type ExpeditionNode='combat'|'elite'|'event'|'shop'|'boss';
export const EXPEDITION_SCENARIOS:Record<'combat'|'elite'|'boss',SimulationScenario>={
 combat:{id:'exp-combat',title:'断线走廊',objective:'击破蜂群并抵达撤离门；蜂群每 1 Tick 逼近并攻击',map:['###########','#R..S.....#','#...#####.#','#........E#','###########'],enemy:{x:4,y:1,hp:2,moveEvery:1,attackEvery:1,kind:'swarm'},items:[{x:2,y:1,kind:'energy'},{x:7,y:1,kind:'heal'}],constraint:{require:['for (','enemy_near()','ranged_attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['走廊有隔墙，用 advance() 沿墙导航。','敌人靠近时用 ranged_attack() 在安全距离解决。']},
 elite:{id:'exp-elite',title:'压迫侧廊',objective:'炮台静止但远程射击；靠近击破后绕过隔墙撤离',map:['#########','#R..S...#','#.###...#','#.....E.#','#########'],enemy:{x:4,y:1,hp:4,attackEvery:2,kind:'turret',range:3},items:[{x:2,y:1,kind:'energy'},{x:5,y:3,kind:'heal'}],constraint:{require:['void advance()','enemy_near()','ranged_attack()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  advance();
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { advance(); }
}`,tactics:['炮台不会移动，但会在远处持续射击，尽快靠近并击破。','敌人倒下后，墙会迫使你转弯；让感知优先于移动。']},
 boss:{id:'exp-boss',title:'核心熔炉',objective:'重装核心每 4 Tick 逼近、每 3 Tick 攻击；击破后撤离',map:['###########','#R..S.....#','#.#####...#','#.......E.#','###########'],enemy:{x:4,y:1,hp:5,moveEvery:4,attackEvery:3,kind:'tank'},items:[{x:2,y:1,kind:'energy'},{x:2,y:3,kind:'heal'}],constraint:{require:['[']},starterCode:`int path[2];
void update() {
  path[0] = path[0] + 1;
  move_forward();
}`,solutionCode:`int path[2];
void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  path[0] = path[0] + 1;
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,tactics:['重装核心移动慢但每次攻击更重，尽快击破以缩短受击窗口。','“弱点扫描仪”可将 attack() 提高到 2 点伤害，是应对重装核心的关键。']}
};
const COMBAT_VARIANT_B:SimulationScenario={id:'exp-combat-b',title:'回廊突破',objective:'击破巡逻体并抵达撤离门；巡逻体每 2 Tick 逼近、每 2 Tick 攻击',map:['###########','#R...S....#','#...#####.#','#........E#','###########'],enemy:{x:5,y:1,hp:3,moveEvery:2,attackEvery:2,kind:'slime'},constraint:{require:['for (','enemy_near()','ranged_attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['敌人挡在撤离门前方，先识别再攻击。','for 循环让机器人在非战斗拍稳定前进。']};
const ELITE_VARIANT_B:SimulationScenario={id:'exp-elite-b',title:'侧翼炮阵',objective:'炮台静止但远程射击；靠近击破后绕过隔墙撤离',map:['#########','#R...S..#','#.###...#','#.....E.#','#########'],enemy:{x:5,y:1,hp:4,attackEvery:2,kind:'turret',range:3},items:[{x:2,y:1,kind:'energy'},{x:5,y:3,kind:'heal'}],constraint:{require:['void advance()','enemy_near()','ranged_attack()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  advance();
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { advance(); }
}`,tactics:['炮台不会移动，用 ranged_attack() 在安全距离点掉它。','敌人倒下后，用 advance() 沿墙绕过隔墙。']};
const BOSS_VARIANT_B:SimulationScenario={id:'exp-boss-b',title:'重装回廊',objective:'重装核心逼近；击破后撤离',map:['###########','#R..S.....#','#..#####..#','#.......E.#','###########'],enemy:{x:4,y:1,hp:5,moveEvery:4,attackEvery:3,kind:'tank'},items:[{x:2,y:1,kind:'energy'},{x:2,y:3,kind:'heal'}],constraint:{require:['[']},starterCode:`int path[2];
void update() {
  path[0] = path[0] + 1;
  move_forward();
}`,solutionCode:`int path[2];
void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  path[0] = path[0] + 1;
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,tactics:['重装核心伤害高，尽快贴身击破。','数组 path 用于记录进度，击破后沿墙撤离。']};
const COMBAT_VARIANT_C:SimulationScenario={id:'exp-combat-c',title:'长途奔袭',objective:'击破巡逻体并抵达远端撤离门',map:['###############','#R..S.........#','#....#####....#','#............E#','###############'],enemy:{x:4,y:1,hp:2,moveEvery:1,attackEvery:1,kind:'swarm'},items:[{x:2,y:1,kind:'energy'},{x:10,y:1,kind:'heal'},{x:12,y:1,kind:'energy'}],constraint:{require:['for (','enemy_near()','ranged_attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['这条走廊更长，注意能量管理。','用 ranged_attack() 在安全距离点掉巡逻体。']};export function pickScenario(kind:'combat'|'elite'|'boss',seed:number,index:number):SimulationScenario{const COMBAT_VARIANT_D:SimulationScenario={id:'exp-combat-d',title:'冲刺者走廊',objective:'在冲刺者近身前用 ranged_attack() 点掉它',map:['##########','#R.......E#','#.........#','#.........#','##########'],enemy:{x:6,y:1,hp:1,moveEvery:1,attackEvery:1,kind:'runner'},items:[{x:2,y:1,kind:'energy'}],constraint:{require:['for (','enemy_near()','ranged_attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['冲刺者近身会自爆，必须远程点掉。','enemy_near() 能在两格内发现它。']};
if(kind==='combat'){const pool=[EXPEDITION_SCENARIOS.combat,COMBAT_VARIANT_B,COMBAT_VARIANT_C,COMBAT_VARIANT_D];return pool[(seed+index)%4]}if(kind==='elite')return (seed+index)%2===0?EXPEDITION_SCENARIOS.elite:ELITE_VARIANT_B;return (seed+index)%2===0?EXPEDITION_SCENARIOS.boss:BOSS_VARIANT_B}export const EXPEDITION_HUB_SCENARIO:SimulationScenario={id:'exp-hub',title:'远征中转站',objective:'选择路线行动，准备下一场代码战斗',map:['#########','#R.....E#','#########'],starterCode:'void update() {\n  wait();\n}',tactics:['事件与商店不需要运行固件。','你的选择会改变资源与下一场战斗的准备状态。']};
export interface ExpeditionReward{id:string;kind:'api'|'sensor'|'runtime'|'debugger';title:string;description:string}
export interface ExpeditionStats{seed:number;nodesCleared:number;damageDealt:number;damageTaken:number;credits:number;rewards:string[];victory:boolean}
export interface ExpeditionAction{id:string;title:string;description:string}
export class ExpeditionRun{
  seed:number; route:ExpeditionNode[]; nodeIndex=0; credits=0; hull=5; rewards:ExpeditionReward[]=[]; stats:ExpeditionStats; nodeCleared=false; pendingBattleDamage=0; pendingOutcome:{damageDealt:number;damageTaken:number;credits:number;victory?:boolean;hullAfter?:number}={damageDealt:0,damageTaken:0,credits:0}; lastOutcome:{damageDealt:number;damageTaken:number;credits:number;victory?:boolean;hullAfter?:number}={damageDealt:0,damageTaken:0,credits:0}; log:string[]=[];
  constructor(seed=Date.now()){this.seed=seed>>>0;const nodes:ExpeditionNode[]=['combat','event','combat','shop','elite','event','boss'];let state=this.seed||1;this.route=this.generateRoute(this.seed);this.stats={seed:this.seed,nodesCleared:0,damageDealt:0,damageTaken:0,credits:0,rewards:[],victory:false}}
  reset(seed=Date.now()){this.seed=(seed>>>0)||1;this.route=this.generateRoute(this.seed);this.nodeIndex=0;this.credits=0;this.hull=5;this.rewards=[];this.stats={seed:this.seed,nodesCleared:0,damageDealt:0,damageTaken:0,credits:0,rewards:[],victory:false};this.nodeCleared=false;this.pendingBattleDamage=0;this.pendingOutcome={damageDealt:0,damageTaken:0,credits:0};this.lastOutcome={damageDealt:0,damageTaken:0,credits:0};this.log=[]}
  private generateRoute(seed:number):ExpeditionNode[]{let state=seed||1;const length=7+(state%4);state=(state*1664525+1013904223)>>>0;const pick=():ExpeditionNode=>{state=(state*1664525+1013904223)>>>0;const roll=state%100;return roll<34?'combat':roll<56?'event':roll<70?'shop':roll<82?'elite':'combat'};const pre:ExpeditionNode[]=[pick(),pick()];if(!pre.includes('event'))pre[0]='event';const post:ExpeditionNode[]=[];for(let i=0;i<length-5;i++)post.push(pick());return['combat',pre[0],pre[1],'shop',...post,'boss']}
  current(){return this.route[this.nodeIndex]}
  hasReward(id:string){return this.rewards.some(reward=>reward.id===id)}
  shopBuyCost(){return 3+this.rewards.length}
  maxHull(){return this.hasReward('shield')?7:5}
  modifiers(metaUpgrades:string[]=[]):SimulationModifiers{const baseMaxHp=this.maxHull()+(metaUpgrades.includes('hull1')?1:0);const maxHp=Math.max(1,baseMaxHp-(this.hasReward('regen')?1:0));const maxEnergy=Math.max(8,20+(this.hasReward('rewind')?10:0)+(metaUpgrades.includes('energy10')?10:0)-(this.hasReward('echo')?4:0)-(this.hasReward('dash')?4:0)-(this.hasReward('shield')?4:0));const incomingDamage=(this.hasReward('shield')?0:1)+(this.hasReward('rewind')?1:0);return{maxHp,maxEnergy,attackPower:this.hasReward('echo')?2:1,moveEnergyCost:this.hasReward('dash')?0:1,incomingDamage,startingHp:this.stats.nodesCleared?Math.min(this.hull,maxHp):undefined,energyRegenEvery:this.hasReward('regen')?5:undefined,rangedPower:metaUpgrades.includes('ranged1')?2:1}}
  resolveBattle(ticks:number,hp:number,enemyMaxHp:number){const node=this.current();if(this.nodeCleared||!['combat','elite','boss'].includes(node))return false;const maxHp=this.modifiers().maxHp;const speedTarget=node==='boss'?20:node==='elite'?16:12;const speedBonus=Math.max(0,Math.ceil((speedTarget-ticks)/3));const baseCredits=node==='boss'?12:node==='elite'?7:4;const outcome={damageDealt:enemyMaxHp,damageTaken:Math.max(0,maxHp-hp),credits:baseCredits+speedBonus,victory:node==='boss'};this.pendingOutcome=outcome;this.lastOutcome=outcome;this.nodeCleared=true;this.log.push(`${node}:firmware-victory:${ticks}t`);return true}
  recordBattlePerformance(hp:number){const maxHp=this.modifiers().maxHp;this.pendingBattleDamage=Math.max(0,maxHp-hp);this.log.push(`${this.current()}:firmware-victory`);return this.pendingBattleDamage}
  actions():ExpeditionAction[]{const node=this.current();if(node==='boss')return[{id:'strike',title:'核心打击',description:'全力攻击 BOSS，承受反击'},{id:'outplay',title:'程序博弈',description:'用一次高风险算法换取更高伤害'},{id:'escape',title:'紧急撤离',description:'放弃本次远征奖励，保留战利品'}];if(node==='shop'){const buyCost=this.shopBuyCost();return[{id:'buy',title:'购买补给',description:'消耗 '+buyCost+' credits，恢复状态'},{id:'hack',title:'破解终端',description:'风险换取额外 credits'},{id:'leave',title:'离开商店',description:'不花钱，安全离开'}]};if(node==='event')return[{id:'scan',title:'扫描遗迹',description:'稳定获得情报与少量 credits'},{id:'risk',title:'深入探索',description:'可能受伤，但收益更高'},{id:'leave',title:'绕开异常',description:'零风险通过'}];return[{id:'strike',title:node==='elite'?'强攻精英':'快速击破',description:'造成更多伤害，同时承受反击'},{id:'guard',title:'防御反制',description:'伤害较低，但几乎不受伤'},{id:'hack',title:'漏洞利用',description:'以程序技巧换取稳定收益'}]}
  resolveAction(actionId:string,firmwareVerified=true,grade?:string,risk=false){if(this.nodeCleared)return false;const node=this.current();if((node==='combat'||node==='elite'||node==='boss')&&!firmwareVerified)return false;if(node==='shop'&&actionId==='buy'&&this.credits<this.shopBuyCost())return false;const action=this.actions().find(item=>item.id===actionId);if(!action)return false;let outcome:{damageDealt:number;damageTaken:number;credits:number;victory?:boolean;hullAfter?:number}={damageDealt:0,damageTaken:0,credits:0,victory:false};if(node==='boss'){outcome=actionId==='escape'?{damageDealt:0,damageTaken:0,credits:0,victory:false}:actionId==='outplay'?{damageDealt:14,damageTaken:3,credits:12,victory:true}:{damageDealt:10,damageTaken:2,credits:8,victory:true}}else if(node==='event'){const luck=(this.seed+this.nodeIndex*7)%5-2;if(actionId==='risk')outcome={damageDealt:0,damageTaken:2+(this.seed+this.nodeIndex)%2,credits:Math.max(4,8+luck)};else if(actionId==='scan')outcome={damageDealt:0,damageTaken:0,credits:Math.max(2,4+luck)};else outcome={damageDealt:0,damageTaken:0,credits:Math.max(1,1+luck)}}else if(node==='shop'){const luck=(this.seed+this.nodeIndex*11)%3;if(actionId==='buy')outcome={damageDealt:0,damageTaken:0,credits:-this.shopBuyCost(),hullAfter:Math.min(this.maxHull(),this.hull+2+luck)};else outcome={damageDealt:0,damageTaken:0,credits:actionId==='hack'?4+(this.seed+this.nodeIndex)%3:1}}else{outcome=actionId==='strike'?{damageDealt:node==='elite'?5:3,damageTaken:node==='elite'?2:1,credits:node==='elite'?7:4}:actionId==='guard'?{damageDealt:1,damageTaken:0,credits:2}:{damageDealt:2,damageTaken:0,credits:3};outcome.damageTaken+=this.pendingBattleDamage;this.pendingBattleDamage=0}if(this.hasReward('dash')&&outcome.damageDealt>0)outcome.damageDealt++;if(this.hasReward('shield'))outcome.damageTaken=Math.max(0,outcome.damageTaken-1);if(this.hasReward('echo')&&node==='event'&&actionId==='scan')outcome.credits+=2;if(this.hasReward('rewind')&&node==='shop'&&actionId==='buy')outcome.credits=-1;if(grade==='S'){outcome.credits+=2;outcome.damageDealt+=2;outcome.damageTaken=Math.max(0,outcome.damageTaken-1)}else if(grade==='A'){outcome.credits+=1;outcome.damageDealt+=1}if(risk){outcome.credits+=2;outcome.damageDealt+=1;outcome.damageTaken+=1}this.pendingOutcome=outcome;this.lastOutcome=outcome;this.nodeCleared=true;this.log.push(`${node}:${actionId}`);return true}
  choices():ExpeditionReward[]{const pool:ExpeditionReward[]=[{id:'dash',kind:'api',title:'零耗推进器',description:'移动不耗能，但最大能量 -4'},{id:'echo',kind:'sensor',title:'弱点扫描仪',description:'攻击伤害 +1，但最大能量 -4'},{id:'shield',kind:'runtime',title:'偏转护盾',description:'最大生命 +2、每次减伤 1，但最大能量 -4'},{id:'rewind',kind:'debugger',title:'扩容电池',description:'最大能量 +10，但每次补给受到的伤害 +1'},{id:'regen',kind:'runtime',title:'能量回收器',description:'每 5 Tick 回复 1 能量，但最大生命 -1'}];const offset=(this.seed+this.nodeIndex)%pool.length;return[0,1,2].map(i=>pool[(offset+i)%pool.length])}
  choose(rewardId:string){const reward=this.choices().find(item=>item.id===rewardId);if(!reward)return false;if(this.hasReward(reward.id)){this.credits+=2;this.stats.credits=this.credits;this.log.push(`duplicate:${reward.id}:+2`);return true}if(this.rewards.length>=3){this.credits+=2;this.stats.credits=this.credits;this.log.push('duplicate-full:'+reward.id+':+2');return true}this.rewards.push(reward);this.stats.rewards=[...this.rewards.map(item=>item.id)];return true}
  clearNode(result:{damageDealt?:number;damageTaken?:number;credits?:number;victory?:boolean;hullAfter?:number}={}){const outcome=Object.keys(result).length?result:this.pendingOutcome;this.stats.damageDealt+=outcome.damageDealt??0;this.stats.damageTaken+=outcome.damageTaken??0;this.credits+=outcome.credits??0;this.stats.credits=this.credits;this.hull=outcome.hullAfter===undefined?Math.max(0,Math.min(this.maxHull(),this.hull-(outcome.damageTaken??0))):Math.max(0,Math.min(this.maxHull(),outcome.hullAfter));this.nodeIndex=Math.min(this.route.length,this.nodeIndex+1);this.stats.nodesCleared=this.nodeIndex;this.nodeCleared=false;this.pendingOutcome={damageDealt:0,damageTaken:0,credits:0};if(this.nodeIndex>=this.route.length)this.stats.victory=outcome.victory!==false;return this.stats}
}
export const STORY_PROGRESS_KEY='coderogue.story-progress.v1';
export interface ProgressStorage{getItem(key:string):string|null;setItem(key:string,value:string):void}
export interface StoryProgress{completedLevelIds:string[];selectedLevelId?:string}
export function loadStoryProgress(storage?:ProgressStorage):StoryProgress{if(!storage)return{completedLevelIds:[]};try{const raw=storage.getItem(STORY_PROGRESS_KEY);if(!raw)return{completedLevelIds:[]};const parsed=JSON.parse(raw) as Partial<StoryProgress>;const validIds=new Set(STORY_LEVELS.map(l=>l.id));const completed=Array.isArray(parsed.completedLevelIds)?parsed.completedLevelIds.filter((id):id is string=>typeof id==='string'&&validIds.has(id)):[];const selectedLevelId=typeof parsed.selectedLevelId==='string'&&validIds.has(parsed.selectedLevelId)?parsed.selectedLevelId:undefined;return{completedLevelIds:[...new Set(completed)],selectedLevelId}}catch{return{completedLevelIds:[]}}}
export function saveStoryProgress(progress:StoryProgress,storage?:ProgressStorage):void{if(!storage)return;try{storage.setItem(STORY_PROGRESS_KEY,JSON.stringify({completedLevelIds:[...new Set(progress.completedLevelIds)],selectedLevelId:progress.selectedLevelId}))}catch{/* Persistence is best effort; gameplay must continue if storage is unavailable. */}}
export const DEFAULT_CODE=`void update() {\n  move_forward();\n}`;
export const LEVEL_STARTER_CODE:Record<string,string>={
  '0-1':`void update() {\n  move_forward();\n}`,
  '0-2':`void update() {\n  if (wall_ahead()) {\n    turn_right();\n  } else {\n    move_forward();\n  }\n}`,
  '1-1':`void update() {\n  if (enemy_ahead()) {\n    attack();\n  } else if (wall_ahead()) {\n    turn_right();\n  } else {\n    move_forward();\n  }\n}`,
  '2-1':`int walls = 0;\nvoid update() {\n  if (wall_ahead()) {\n    walls = walls + 1;\n    if (walls == 2) { turn_left(); }\n    else { turn_right(); }\n  } else {\n    move_forward();\n  }\n}`,
  '2-2':`bool turn_left_next = false;\nvoid update() {\n  if (wall_ahead()) {\n    if (turn_left_next) { turn_left(); }\n    else { turn_right(); }\n    turn_left_next = !turn_left_next;\n    return;\n  }\n  move_forward();\n}`
};
export class Simulation {pulseUsed=false;shieldReady=false;levelIndex=0;map=STORY_LEVELS[0].map;robot:Robot={x:1,y:1,dir:'E',hp:5,energy:20};enemy:Enemy={x:-1,y:-1,hp:0,kind:'slime'};items:Item[]=[];tick=0;frames:Frame[]=[];breakpoints=new Set<number>();watchpoints=new Set<string>();coreDump?:CoreDump;completedLevels=new Set<string>();profile:ProfileStats={ticks:0,actions:0,errors:0,durationMs:0,actionCounts:{}};private runStartedAt=0;private hitBreakpoints=new Set<number>();private watchedValues=new Map<string,RuntimeValue|undefined>();private scenario?:SimulationScenario;private modifiers:SimulationModifiers={maxHp:5,maxEnergy:20,attackPower:1,moveEnergyCost:1,incomingDamage:1};private seed=0;private rngState=1;private enemyJitter={attack:0,move:0};private enemyMaxHp=1;private enemyAttackCount=0;interpreter?:Interpreter;status:'idle'|'running'|'paused'|'success'|'failed'|'error'='idle';message='Ready';
 selectLevel(i:number){this.levelIndex=Math.max(0,Math.min(STORY_LEVELS.length-1,i));this.scenario=undefined;this.modifiers={maxHp:5,maxEnergy:20,attackPower:1,moveEnergyCost:1,incomingDamage:1};this.reset();this.status='idle';this.message='Ready'}
 setScenario(scenario:SimulationScenario,modifiers?:Partial<SimulationModifiers>,seed=0){this.seed=seed>>>0;this.rngState=this.seed||1;this.scenario={...scenario,map:[...scenario.map],enemy:scenario.enemy?{...scenario.enemy}:undefined};this.modifiers={maxHp:5,maxEnergy:20,attackPower:1,moveEnergyCost:1,incomingDamage:1,...modifiers};this.reset();this.status='idle';this.message='Scenario loaded'}
 getProgress():StoryProgress{return{completedLevelIds:[...this.completedLevels],selectedLevelId:STORY_LEVELS[this.levelIndex].id}}
 applyProgress(progress:StoryProgress){const validIds=new Set(STORY_LEVELS.map(l=>l.id));this.completedLevels=new Set(progress.completedLevelIds.filter(id=>validIds.has(id)));const selected=progress.selectedLevelId?STORY_LEVELS.findIndex(l=>l.id===progress.selectedLevelId):-1;if(selected>=0)this.levelIndex=selected;this.reset();this.status='idle';this.message='Ready'}
 setBreakpoint(line:number){if(Number.isInteger(line)&&line>0){this.breakpoints.add(line);this.hitBreakpoints.delete(line)}} clearBreakpoints(){this.breakpoints.clear();this.hitBreakpoints.clear()} setWatchpoint(name:string){const normalized=name.trim();if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)){this.watchpoints.add(normalized);this.watchedValues.delete(normalized);return true}return false} clearWatchpoints(){this.watchpoints.clear();this.watchedValues.clear()} pause(){if(this.status==='running'){this.status='paused';this.message='Paused'}} resume(){if(this.status==='paused'){this.status='running';this.message='Running'}}
 build(code:string){try{const constraint=this.scenario?.constraint;if(constraint){const missing=(constraint.require??[]).filter(tok=>!code.includes(tok));if(missing.length)throw new RoboError(`代码约束：需要包含 ${missing.join('、')}`);const banned=(constraint.forbid??[]).filter(tok=>code.includes(tok));if(banned.length)throw new RoboError(`代码约束：不能包含 ${banned.join('、')}`)}this.interpreter=new Interpreter(new Parser(lex(code)).parse(),this.host());this.message='Build succeeded';return{ok:true}}catch(e){const er=e as RoboError;this.message=`Build error ${er.line}:${er.column} - ${er.message}`;return{ok:false,error:er}}}
 hotReload(code:string){if(this.status!=='paused'&&this.status!=='idle')return{ok:false,error:new RoboError('Hot reload is only available while paused or idle')};const previous=this.snapshot();const result=this.build(code);if(result.ok){this.robot={...previous.robot};this.enemy={...previous.enemy};this.tick=previous.tick;this.frames=previous.frames;this.status='paused';this.message='Hot reload applied';if(this.interpreter)Object.assign(this.interpreter.globals,previous.interpreterGlobals)}return result}
 reset(){const l=this.scenario??STORY_LEVELS[this.levelIndex];this.map=[...l.map];this.robot={x:1,y:1,dir:'E',hp:this.modifiers.startingHp??this.modifiers.maxHp,energy:this.modifiers.maxEnergy};this.enemy={x:l.enemy?.x??-1,y:l.enemy?.y??-1,hp:l.enemy?.hp??0,kind:'slime'};this.enemyMaxHp=this.enemy.hp;this.enemyAttackCount=0;this.items=this.scenario?.items?[...this.scenario.items]:[];this.enemyJitter=this.seed?{attack:this.nextInt(0,2),move:this.nextInt(0,2)}:{attack:0,move:0};this.tick=0;this.frames=[];this.pulseUsed=false;this.shieldReady=false;this.hitBreakpoints.clear();this.watchedValues.clear();this.coreDump=undefined;this.profile={ticks:0,actions:0,errors:0,durationMs:0,actionCounts:{}};this.runStartedAt=Date.now();this.status='running';this.message='Running'}
 usePulse(){if(this.pulseUsed||this.enemy.hp<=0||this.robot.energy<3||this.status==='idle'||this.status==='success'||this.status==='failed'||this.status==='error')return false;const distance=Math.abs(this.enemy.x-this.robot.x)+Math.abs(this.enemy.y-this.robot.y);if(distance>3)return false;this.pulseUsed=true;this.robot.energy-=3;this.enemy.hp=Math.max(0,this.enemy.hp-1);if(this.enemy.hp===0){this.enemy.x=-1;this.enemy.y=-1}this.message=this.enemy.hp?'脉冲命中：敌方系统短路':'脉冲击破：敌方系统离线';this.frames.push({tick:this.tick,robot:{...this.robot},enemy:{...this.enemy},variables:{},sensors:[],action:'pulse',events:['PULSE']});return true} useRepair(){if(this.robot.energy<4||this.robot.hp>=this.modifiers.maxHp||this.status==='idle'||this.status==='success'||this.status==='failed'||this.status==='error')return false;this.robot.energy-=4;this.robot.hp=Math.min(this.modifiers.maxHp,this.robot.hp+1);this.frames.push({tick:this.tick,robot:{...this.robot},enemy:{...this.enemy},variables:{},sensors:[],action:'repair_manual',events:['MANUAL_REPAIR']});this.message='紧急修理完成';return true}
 snapshot():SimulationSnapshot{return{levelIndex:this.levelIndex,map:[...this.map],robot:{...this.robot},enemy:{...this.enemy},items:this.items.map(item=>({...item})),tick:this.tick,frames:this.frames.map(frame=>({...frame,robot:{...frame.robot},enemy:{...frame.enemy},variables:{...frame.variables},sensors:frame.sensors.map(sensor=>({...sensor}))})),status:this.status,message:this.message,interpreterGlobals:this.interpreter?{...this.interpreter.globals}:{},scenario:this.scenario?{...this.scenario,map:[...this.scenario.map],enemy:this.scenario.enemy?{...this.scenario.enemy}:undefined}:undefined}}
 rollback(snapshot:SimulationSnapshot){this.levelIndex=snapshot.levelIndex;this.scenario=snapshot.scenario?{...snapshot.scenario,map:[...snapshot.scenario.map],enemy:snapshot.scenario.enemy?{...snapshot.scenario.enemy}:undefined}:undefined;this.map=[...snapshot.map];this.robot={...snapshot.robot};this.enemy={...snapshot.enemy};this.items=snapshot.items.map(item=>({...item}));this.tick=snapshot.tick;this.frames=snapshot.frames.map(frame=>({...frame,robot:{...frame.robot},enemy:{...frame.enemy},variables:{...frame.variables},sensors:frame.sensors.map(sensor=>({...sensor}))}));this.status=snapshot.status;this.message='Rolled back to snapshot';if(this.interpreter)Object.assign(this.interpreter.globals,snapshot.interpreterGlobals)}
  step(){if(!this.interpreter||this.status!=='running')return;const result=this.interpreter.runTick();this.tick++;this.resolveEnemy();if(this.modifiers.energyRegenEvery&&this.tick%this.modifiers.energyRegenEvery===0){this.robot.energy=Math.min(this.modifiers.maxEnergy,this.robot.energy+1)}const ey=this.map.findIndex(r=>r.includes('E'));const ex=this.map[ey]?.indexOf('E')??6;const events:string[]=[];const itemIndex=this.items.findIndex(item=>item.x===this.robot.x&&item.y===this.robot.y);if(itemIndex>=0){const item=this.items[itemIndex];if(item.kind==='energy'){this.robot.energy=Math.min(this.modifiers.maxEnergy,this.robot.energy+5);events.push('PICKUP_ENERGY')}else{this.robot.hp=Math.min(this.modifiers.maxHp,this.robot.hp+1);events.push('PICKUP_HEAL')}this.items.splice(itemIndex,1)}if(this.seed&&this.enemy.hp>0&&this.nextInt(0,100)<12){this.robot.energy=Math.min(this.modifiers.maxEnergy,this.robot.energy+1);events.push('POWER_SURGE')}else if(this.seed&&this.enemy.hp>0&&this.nextInt(0,100)<8){this.robot.energy=Math.max(0,this.robot.energy-1);events.push('SYSTEM_OVERLOAD')}if(this.robot.x===ex&&this.robot.y===ey&&this.enemy.hp<=0){this.status='success';this.message='Exit reached';if(!this.scenario)this.completedLevels.add(STORY_LEVELS[this.levelIndex].id);events.push('EXIT_REACHED')}if(this.robot.hp<=0){this.status='failed';this.message='Robot destroyed';events.push('ROBOT_DESTROYED')}if(result.error){this.status='error';this.message=result.error;events.push('RUNTIME_ERROR')}for(const name of this.watchpoints){const value=result.variables[name];const previous=this.watchedValues.get(name);if(this.watchedValues.has(name)&&previous!==value){events.push(`WATCHPOINT:${name}`);if(this.status==='running'){this.status='paused';this.message=`Watchpoint changed: ${name}`}}this.watchedValues.set(name,value)}if(this.status==='running'&&result.sourceLine&&this.breakpoints.has(result.sourceLine)&&!this.hitBreakpoints.has(result.sourceLine)){this.status='paused';this.message=`Breakpoint hit at line ${result.sourceLine}`;this.hitBreakpoints.add(result.sourceLine);events.push('BREAKPOINT')}this.frames.push({tick:this.tick,sourceLine:result.sourceLine??result.errorLine,robot:{...this.robot},enemy:{...this.enemy},variables:result.variables,sensors:result.sensors,action:result.action,events,error:result.error});if(this.frames.length>200)this.frames.shift();if(result.error||this.robot.hp<=0){this.coreDump={cause:result.error?'runtime_error':'robot_destroyed',tick:this.tick,sourceLine:result.sourceLine??result.errorLine,message:result.error??'Robot destroyed',robot:{...this.robot},enemy:{...this.enemy},variables:{...result.variables},recentFrames:this.frames.slice(-12).map(frame=>({...frame,robot:{...frame.robot},enemy:{...frame.enemy},variables:{...frame.variables},sensors:frame.sensors.map(sensor=>({...sensor}),)}))}}return result}
 private host():RuntimeHost{return{sense:(n)=>n==='wall_ahead'?this.isWall(this.front().x,this.front().y):n==='enemy_ahead'?this.enemy.hp>0&&this.front().x===this.enemy.x&&this.front().y===this.enemy.y:n==='enemy_near'?this.enemy.hp>0&&Math.abs(this.enemy.x-this.robot.x)+Math.abs(this.enemy.y-this.robot.y)<=2:n==='low_hp'?this.robot.hp<=2:n==='low_energy'?this.robot.energy<=5:false,value:(n)=>n==='distance_to_enemy'?(this.enemy.hp>0?Math.abs(this.enemy.x-this.robot.x)+Math.abs(this.enemy.y-this.robot.y):99):n==='enemy_x'?this.enemy.x:n==='enemy_y'?this.enemy.y:n==='steps_to_wall'?this.stepsToWall():n==='enemy_hp'?this.enemy.hp:0,action:(n)=>{if(this.robot.energy<=0){this.status='failed';this.message='Energy depleted';return}if(n==='move_forward'){const p=this.front();if(!this.isWall(p.x,p.y)&&!(this.enemy.hp>0&&p.x===this.enemy.x&&p.y===this.enemy.y)){this.robot.x=p.x;this.robot.y=p.y}this.robot.energy=Math.max(0,this.robot.energy-this.modifiers.moveEnergyCost)}else if(n==='turn_right'){this.robot.dir={N:'E',E:'S',S:'W',W:'N'}[this.robot.dir]as Direction;this.robot.energy=Math.max(0,this.robot.energy-1)}else if(n==='turn_left'){this.robot.dir={N:'W',W:'S',S:'E',E:'N'}[this.robot.dir]as Direction;this.robot.energy=Math.max(0,this.robot.energy-1)}else if(n==='dash'){let p=this.front();let moved=0;while(moved<2){if(this.isWall(p.x,p.y)||(this.enemy.hp>0&&p.x===this.enemy.x&&p.y===this.enemy.y))break;this.robot.x=p.x;this.robot.y=p.y;moved++;p=this.front();}this.robot.energy=Math.max(0,this.robot.energy-2)}else if(n==='back'){const back={N:[0,1],E:[-1,0],S:[0,-1],W:[1,0]}[this.robot.dir]as [number,number];const bx=this.robot.x+back[0];const by=this.robot.y+back[1];if(!this.isWall(bx,by)&&!(this.enemy.hp>0&&bx===this.enemy.x&&by===this.enemy.y)){this.robot.x=bx;this.robot.y=by}this.robot.energy=Math.max(0,this.robot.energy-1)}else if(n==='repair'&&this.robot.hp<this.modifiers.maxHp){this.robot.hp=Math.min(this.modifiers.maxHp,this.robot.hp+1);this.robot.energy=Math.max(0,this.robot.energy-3)}else if(n==='shield'){this.shieldReady=true;this.robot.energy=Math.max(0,this.robot.energy-2)}else if(n==='ranged_attack'&&this.enemy.hp>0){const dist=Math.abs(this.enemy.x-this.robot.x)+Math.abs(this.enemy.y-this.robot.y);if(dist<=2){this.enemy.hp=Math.max(0,this.enemy.hp-(this.modifiers.rangedPower??this.modifiers.attackPower));if(this.enemy.hp===0){this.enemy.x=-1;this.enemy.y=-1}this.message=this.enemy.hp?'Ranged hit':'Target destroyed';this.robot.energy=Math.max(0,this.robot.energy-2)}}else if(n==='attack'&&this.enemy.hp>0&&this.front().x===this.enemy.x&&this.front().y===this.enemy.y){this.enemy.hp=Math.max(0,this.enemy.hp-(this.modifiers.rangedPower??this.modifiers.attackPower));if(this.enemy.hp===0){this.enemy.x=-1;this.enemy.y=-1}this.message=this.enemy.hp?'Slime hit':'Slime destroyed';this.robot.energy=Math.max(0,this.robot.energy-1)}}}}
 private nextEnemyStep():{x:number;y:number}|undefined{
    const sx=this.enemy.x; const sy=this.enemy.y;
    const tx=this.robot.x; const ty=this.robot.y;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    const targets=dirs.map(([dx,dy])=>({x:tx+dx,y:ty+dy})).filter(p=>!this.isWall(p.x,p.y));
    if(targets.length===0)return undefined;
    const visited=new Set([sx+','+sy]);
    const queue=[{x:sx,y:sy,path:[] as {x:number;y:number}[]}];
    while(queue.length){
      const cur=queue.shift()!;
      for(const t of targets){if(cur.x===t.x&&cur.y===t.y)return cur.path[0]??{x:sx,y:sy};}
      for(const [dx,dy] of dirs){
        const nx=cur.x+dx; const ny=cur.y+dy;
        const k=nx+','+ny;
        if(visited.has(k))continue;
        if(this.isWall(nx,ny))continue;
        if(nx===tx&&ny===ty)continue;
        visited.add(k);
        queue.push({x:nx,y:ny,path:[...cur.path,{x:nx,y:ny}]});
      }
    }
    return undefined;
  }
 private nextRand():number{this.rngState=(this.rngState*1664525+1013904223)>>>0;return this.rngState/4294967296}
 private nextInt(min:number,max:number):number{return min+Math.floor(this.nextRand()*(max-min))}
 private stepsToWall(){const d={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[this.robot.dir];let x=this.robot.x,y=this.robot.y,s=0;while(s<10&&!this.isWall(x+d[0],y+d[1])){x+=d[0];y+=d[1];s++;}return s}
 private front(){const d={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[this.robot.dir];return{x:this.robot.x+d[0],y:this.robot.y+d[1]}} private isWall(x:number,y:number){return this.map[y]?.[x]==='#'} private resolveEnemy(){
    if(this.enemy.hp<=0)return;
    const dist=()=>Math.abs(this.enemy.x-this.robot.x)+Math.abs(this.enemy.y-this.robot.y);
    const kind=this.enemy.kind??'slime';
    const enraged=this.enemyMaxHp>0&&this.enemy.hp<=Math.ceil(this.enemyMaxHp/2);const attackEvery=Math.max(1,(this.enemy.attackEvery??(kind==='swarm'?1:3))+this.enemyJitter.attack-(enraged?1:0));
    const inRange=kind==='turret'?dist()<=(this.enemy.range??3):dist()<=1;
    if(inRange&&this.tick%attackEvery===0){
      this.enemyAttackCount++;
      let damage=this.modifiers.incomingDamage;
      if(kind==='tank')damage+=1;
      if(enraged&&kind==='swarm')damage+=1;
      if(this.enemyAttackCount%5===0)damage+=1;
      if(kind==='runner'){damage+=1;this.shieldReady=false;this.robot.hp=Math.max(0,this.robot.hp-damage);this.enemy.hp=0;this.enemy.x=-1;this.enemy.y=-1;this.message='Runner exploded';return;}
      if(this.shieldReady){damage=Math.max(0,damage-1);this.shieldReady=false;}
      this.robot.hp=Math.max(0,this.robot.hp-damage);
      this.message=this.enemyAttackCount%5===0?'Enemy heavy strike':kind==='turret'?'敌方炮台射击':'Enemy strike';
    }
    if(kind==='turret')return;
    const moveEvery=(this.enemy.moveEvery??(kind==='swarm'||kind==='runner'?1:kind==='tank'?4:3))+this.enemyJitter.move;
    if(this.tick%moveEvery===0){
      const step=this.nextEnemyStep();
      if(step){this.enemy.x=step.x;this.enemy.y=step.y;}
    }
  }

}
export const META_KEY='coderogue.meta.v1';
export interface MetaProgress{credits:number;runs:number;bestGrade?:string;upgrades:string[]}
export function loadMeta(storage?:ProgressStorage):MetaProgress{if(!storage)return{credits:0,runs:0,upgrades:[]};try{const raw=storage.getItem(META_KEY);if(!raw)return{credits:0,runs:0,upgrades:[]};const parsed=JSON.parse(raw) as Partial<MetaProgress>;const upgrades=Array.isArray(parsed.upgrades)?parsed.upgrades.filter((u):u is string=>typeof u==='string'):[];return{credits:typeof parsed.credits==='number'&&parsed.credits>=0?Math.floor(parsed.credits):0,runs:typeof parsed.runs==='number'&&parsed.runs>=0?Math.floor(parsed.runs):0,bestGrade:typeof parsed.bestGrade==='string'?parsed.bestGrade:undefined,upgrades}}catch{return{credits:0,runs:0,upgrades:[]}}}
export function saveMeta(meta:MetaProgress,storage?:ProgressStorage):void{if(!storage)return;try{storage.setItem(META_KEY,JSON.stringify(meta))}catch{}}
export function gradeBattle(m:{tick:number;damage:number;energyUsed:number;actions:number;sensorReads:number}):string{let score=0;if(m.damage===0)score+=3;else if(m.damage===1)score+=2;else if(m.damage===2)score+=1;if(m.tick<=10)score+=3;else if(m.tick<=15)score+=2;else if(m.tick<=20)score+=1;if(m.energyUsed<=12)score+=2;else if(m.energyUsed<=16)score+=1;if(m.actions<=m.tick+2)score+=1;if(m.sensorReads>0&&m.sensorReads<=m.tick*2)score+=1;return score>=9?'S':score>=7?'A':score>=5?'B':'C'}
