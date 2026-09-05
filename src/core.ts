import {Interpreter,Parser,lex,RoboError,RuntimeHost,RuntimeValue} from './language';import {createDemoDungeon,DungeonLayout,roomAt,walkableAt} from './dungeon';import {EXPEDITION_COMBAT_EXTRA,EXPEDITION_ELITE_EXTRA} from './expeditionRooms';
export type Direction='N'|'E'|'S'|'W'; export interface Robot{x:number;y:number;dir:Direction;hp:number;energy:number;roomId?:string|null} export interface Enemy{x:number;y:number;hp:number;active?:boolean;damage?:number;kind?:'slime'|'turret'|'swarm'|'tank'|'runner'|'guard';moveEvery?:number;attackEvery?:number;range?:number;roomId?:string|null}
export interface Item{x:number;y:number;kind:'energy'|'heal';roomId?:string|null}
export interface StoryLevel{id:string;title:string;objective:string;map:string[];enemy?:Enemy}
export interface SimulationScenario{id:string;title:string;objective:string;map?:string[];enemy?:Enemy;enemies?:Enemy[];starterCode:string;solutionCode?:string;tactics:string[];constraint?:{require?:string[];forbid?:string[]};items?:Item[];dungeon?:DungeonLayout;recommendedStrategy?:string;difficulty?:string;tags?:string[];robotSpawn?:{x:number;y:number;dir:Direction}}
export interface SimulationModifiers{maxHp:number;maxEnergy:number;attackPower:number;moveEnergyCost:number;incomingDamage:number;startingHp?:number;energyRegenEvery?:number;rangedPower?:number;nearRange?:number;rangedRange?:number}
export const STORY_LEVELS:StoryLevel[]=[
 {id:'0-1',title:'First Boot',objective:'让机器人持续前进并抵达出口',map:['########','#R....E#','########']},
 {id:'0-2',title:'The Wall',objective:'读取 wall_ahead()，绕过障碍抵达出口',map:['########','#R.....#','#..##..#','#.....E#','########']},
 {id:'1-1',title:'Decision',objective:'判断敌人与墙体，消灭史莱姆后撤离',map:['########','#R..S.E#','#......#','#......#','########'],enemy:{x:4,y:1,hp:2}},
 {id:'2-1',title:'Counter Route',objective:'记住遇墙次数，在第二个转角改变方向',map:['########','#R....##','#####.##','#####.E#','########']},
 {id:'2-2',title:'Toggle Corridor',objective:'使用 bool 状态交替选择左转与右转',map:['########','#R....##','#####.##','#####..#','######E#','########']},
 {id:'3-1',title:'Ranged First',objective:'用 enemy_near() 发现两格内的敌人，再用 ranged_attack() 点掉后撤离',map:['##########','#R...S..E#','##########'],enemy:{x:5,y:1,hp:1}},
 {id:'3-2',title:'Shield Rhythm',objective:'敌人每拍反击：交替使用 shield() 与 attack() 削减它，再抵达出口',map:['########','#RS...E#','########'],enemy:{x:2,y:1,hp:4,attackEvery:1}}
];
export interface Frame{tick:number;sourceLine?:number;robot:Robot;enemy:Enemy;enemies:Enemy[];variables:Record<string,RuntimeValue>;sensors:{name:string,value:number|boolean}[];action?:string;events:string[];error?:string}
export interface CoreDump{cause:'runtime_error'|'robot_destroyed';tick:number;sourceLine?:number;message:string;robot:Robot;enemy:Enemy;enemies:Enemy[];variables:Record<string,RuntimeValue>;recentFrames:Frame[]}
export interface SimulationSnapshot{levelIndex:number;map:string[];robot:Robot;enemy:Enemy;enemies?:Enemy[];items:Item[];tick:number;frames:Frame[];status:Simulation['status'];message:string;interpreterGlobals:Record<string,RuntimeValue>;scenario?:SimulationScenario}
export interface ProfileStats{ticks:number;actions:number;errors:number;durationMs:number;actionCounts:Record<string,number>}
export type ExpeditionNode='combat'|'elite'|'event'|'shop'|'rest'|'branch'|'boss';
export const EXPEDITION_SCENARIOS:Record<'combat'|'elite'|'boss',SimulationScenario>={
 combat:{id:'exp-combat',title:'断线走廊',objective:'击破蜂群并抵达撤离门；蜂群每 1 Tick 逼近、每 2 Tick 攻击',map:['###########','#R..S.....#','#...#####.#','#........E#','###########'],enemy:{x:4,y:1,hp:2,moveEvery:1,attackEvery:3,kind:'swarm'},items:[{x:2,y:1,kind:'energy'},{x:7,y:1,kind:'heal'}],constraint:{require:['for (','enemy_near()','ranged_attack()'],forbid:['attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['走廊有隔墙，用 advance() 沿墙导航。','敌人靠近时用 ranged_attack() 在安全距离解决。']},
 elite:{id:'exp-elite',title:'压迫侧廊',objective:'炮台静止但远程射击；靠近击破后绕过隔墙撤离',map:['#########','#R..S...#','#.###...#','#.....E.#','#########'],enemy:{x:4,y:1,hp:3,attackEvery:4,kind:'turret',range:3},items:[{x:2,y:1,kind:'energy'},{x:5,y:3,kind:'heal'},{x:4,y:3,kind:'energy'}],constraint:{require:['void advance()','enemy_near()','ranged_attack()'],forbid:['attack()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  advance();
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { advance(); }
}`,tactics:['炮台不会移动，但会在远处持续射击，尽快靠近并击破。','敌人倒下后，墙会迫使你转弯；让感知优先于移动。']},
 boss:{id:'exp-boss',title:'核心熔炉',objective:'重装核心每 4 Tick 逼近、每 3 Tick 攻击；击破后撤离',map:['###########','#R..S.....#','#.#####...#','#.......E.#','###########'],enemy:{x:4,y:1,hp:5,moveEvery:4,attackEvery:4,kind:'tank'},items:[{x:2,y:1,kind:'energy'},{x:2,y:3,kind:'heal'}],constraint:{require:['['],forbid:['ranged_attack()']},starterCode:`int path[2];
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
const COMBAT_VARIANT_B:SimulationScenario={id:'exp-combat-b',title:'回廊突破',objective:'击破巡逻体并抵达撤离门；巡逻体每 2 Tick 逼近、每 2 Tick 攻击',map:['###########','#R...S....#','#...#####.#','#........E#','###########'],enemy:{x:5,y:1,hp:2,moveEvery:2,attackEvery:3,kind:'slime'},constraint:{require:['for (','enemy_near()','ranged_attack()'],forbid:['attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['敌人挡在撤离门前方，先识别再攻击。','for 循环让机器人在非战斗拍稳定前进。']};
const ELITE_VARIANT_B:SimulationScenario={id:'exp-elite-b',title:'侧翼炮阵',objective:'炮台静止但远程射击；靠近击破后绕过隔墙撤离',map:['#########','#R...S..#','#.###...#','#.....E.#','#########'],enemy:{x:5,y:1,hp:3,attackEvery:4,kind:'turret',range:3},items:[{x:2,y:1,kind:'energy'},{x:5,y:3,kind:'heal'}],constraint:{require:['void advance()','enemy_near()','ranged_attack()'],forbid:['attack()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  advance();
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { advance(); }
}`,tactics:['炮台不会移动，用 ranged_attack() 在安全距离点掉它。','敌人倒下后，用 advance() 沿墙绕过隔墙。']};
const ELITE_VARIANT_C:SimulationScenario={id:'exp-elite-c',title:'贴脸拆塔',objective:'炮台会远程射击；禁用 ranged_attack，只能贴近后用 attack() 拆掉',map:['#########','#R..S...#','#.###...#','#.....E.#','#########'],enemy:{x:4,y:1,hp:3,attackEvery:4,kind:'turret',range:3},items:[{x:2,y:1,kind:'energy'},{x:5,y:3,kind:'heal'},{x:4,y:3,kind:'energy'}],constraint:{require:['void advance()','enemy_ahead()','attack()'],forbid:['ranged_attack()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,tactics:['远程被禁用：贴墙导航靠近炮台，用 attack() 贴身拆掉。','隔墙会逼你转弯，先处理墙再前进。']};
const ELITE_VARIANT_D:SimulationScenario={id:'exp-elite-d',title:'护盾守卫',objective:'守卫会吸收远程火力；贴近后用 attack() 拆掉护盾并抵达出口',map:['###########','#R...S...E#','#...####..#','#.........#','###########'],enemy:{x:5,y:1,hp:3,moveEvery:4,attackEvery:4,kind:'guard'},items:[{x:2,y:1,kind:'energy'},{x:6,y:3,kind:'heal'},{x:8,y:1,kind:'energy'}],constraint:{require:['void advance()','enemy_ahead()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  if (enemy_ahead()) { ranged_attack(); }
  else { advance(); }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,tactics:['远程攻击会被护盾吸收：不要站在原地和它对射。','贴近后用 attack() 拆掉守卫，再用 advance() 绕墙抵达出口。']};
const BOSS_VARIANT_B:SimulationScenario={id:'exp-boss-b',title:'重装回廊',objective:'重装核心逼近；击破后撤离',map:['###########','#R..S.....#','#..#####..#','#.......E.#','###########'],enemy:{x:4,y:1,hp:5,moveEvery:4,attackEvery:4,kind:'tank'},items:[{x:2,y:1,kind:'energy'},{x:2,y:3,kind:'heal'}],constraint:{require:['['],forbid:['ranged_attack()']},starterCode:`int path[2];
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
const COMBAT_VARIANT_C:SimulationScenario={id:'exp-combat-c',title:'长途奔袭',objective:'击破巡逻体并抵达远端撤离门',map:['###############','#R..S.........#','#....#####....#','#............E#','###############'],enemy:{x:4,y:1,hp:2,moveEvery:1,attackEvery:3,kind:'swarm'},items:[{x:2,y:1,kind:'energy'},{x:10,y:1,kind:'heal'},{x:12,y:1,kind:'energy'}],constraint:{require:['for (','enemy_near()','ranged_attack()'],forbid:['attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['这条走廊更长，注意能量管理。','用 ranged_attack() 在安全距离点掉巡逻体。']};const COMBAT_VARIANT_D:SimulationScenario={id:'exp-combat-d',title:'冲刺者走廊',objective:'在冲刺者近身前用 ranged_attack() 点掉它',map:['###########','#R.......E#','#.........#','#.........#','###########'],enemy:{x:6,y:1,hp:1,moveEvery:1,attackEvery:1,kind:'runner'},items:[{x:2,y:1,kind:'energy'}],constraint:{require:['for (','enemy_near()','ranged_attack()'],forbid:['attack()']},starterCode:`void update() {
  for (int i = 0; i < 1; i = i + 1) {
    move_forward();
  }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { for (int i = 0; i < 1; i = i + 1) { advance(); } }
}`,tactics:['冲刺者近身会自爆，必须远程点掉。','enemy_near() 能在两格内发现它。']};
const COMBAT_VARIANT_E:SimulationScenario={id:'exp-combat-e',title:'贴身突破',objective:'禁用 ranged_attack，贴近后用 attack() 清理巡逻体并抵达出口',map:['###########','#R...S....#','#...#####.#','#........E#','###########'],enemy:{x:5,y:1,hp:2,moveEvery:2,attackEvery:3,kind:'slime'},items:[{x:2,y:1,kind:'energy'},{x:7,y:1,kind:'heal'},{x:9,y:1,kind:'energy'}],constraint:{require:['void advance()','enemy_ahead()','attack()'],forbid:['ranged_attack()']},starterCode:`void advance() {
  move_forward();
}
void update() {
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,solutionCode:`void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`,tactics:['远程被禁用：先贴近巡逻体，再正面攻击。','隔墙会逼你转弯；advance() 需要补上墙前转向。']};
export function expeditionPool(kind:'combat'|'elite'|'boss'):SimulationScenario[]{if(kind==='combat')return[EXPEDITION_SCENARIOS.combat,COMBAT_VARIANT_B,COMBAT_VARIANT_C,COMBAT_VARIANT_D,COMBAT_VARIANT_E,...EXPEDITION_COMBAT_EXTRA];if(kind==='elite')return[EXPEDITION_SCENARIOS.elite,ELITE_VARIANT_B,ELITE_VARIANT_C,ELITE_VARIANT_D,...EXPEDITION_ELITE_EXTRA];return[EXPEDITION_SCENARIOS.boss,BOSS_VARIANT_B]}export function pickScenario(kind:'combat'|'elite'|'boss',seed:number,index:number):SimulationScenario{const pool=expeditionPool(kind);return pool[(seed+index)%pool.length]}export const EXPEDITION_HUB_SCENARIO:SimulationScenario={id:'exp-hub',title:'远征中转站',objective:'选择路线行动，准备下一场代码战斗',map:['#########','#R.....E#','#########'],starterCode:'void update() {\n  wait();\n}',tactics:['事件与商店不需要运行固件。','你的选择会改变资源与下一场战斗的准备状态。']};
export const DEMO_DUNGEON_SCENARIO:SimulationScenario={id:'demo-dungeon',title:'Dungeon Navigation Slice',objective:'从 Start 出发：在 W1 学会用墙判断转弯，击杀 Slime 后在 W2 用 low_energy 选择补给侧并抵达 Exit',dungeon:createDemoDungeon(),starterCode:'void update() {\n  if (enemy_ahead()) { attack(); }\n  else { move_forward(); }\n}',solutionCode:'void update() {\n  if (enemy_ahead()) { attack(); return; }\n  if (wall_ahead()) {\n    if (low_energy()) { turn_right(); }\n    else { turn_left(); }\n  } else {\n    move_forward();\n  }\n}',tactics:['Start 东侧第一面墙（W1）：机器人不会自动转弯，move_forward() 撞墙仍耗能。','进入 Combat 前保持左转即可；Slime 挡住正前方时优先攻击。','到达 W2 时能量应低于阈值：此时应右转进入 Event 补给侧，左转会进入西侧回环。']};
export function scaleExpeditionBattle(scenario:SimulationScenario,nodeIndex:number):SimulationScenario{const depth=Math.floor(nodeIndex/4);const late=nodeIndex>=5;const enemy=scenario.enemy?{...scenario.enemy,hp:scenario.enemy.hp+depth+(late?2:0),moveEvery:late&&scenario.enemy.moveEvery?Math.max(1,scenario.enemy.moveEvery-1):scenario.enemy.moveEvery,attackEvery:late&&scenario.enemy.attackEvery?Math.max(1,scenario.enemy.attackEvery-1):scenario.enemy.attackEvery}:undefined;return{...scenario,enemy}}
export interface ExpeditionReward{id:string;kind:'api'|'sensor'|'runtime'|'debugger';title:string;description:string}
export interface ExpeditionStats{seed:number;nodesCleared:number;damageDealt:number;damageTaken:number;credits:number;rewards:string[];victory:boolean}
export interface ExpeditionAction{id:string;title:string;description:string}
export interface ExpeditionOutcome{damageDealt:number;damageTaken:number;credits:number;victory?:boolean;hullAfter?:number;grade?:string;rewardTitle?:string;rewardId?:string}
export class ExpeditionRun{
  seed:number; route:ExpeditionNode[]; nodeIndex=0; credits=0; hull=5; rewards:ExpeditionReward[]=[]; stats:ExpeditionStats; nodeCleared=false; pendingOutcome:ExpeditionOutcome={damageDealt:0,damageTaken:0,credits:0}; lastOutcome:ExpeditionOutcome={damageDealt:0,damageTaken:0,credits:0}; log:string[]=[];
  constructor(seed=Date.now()){this.seed=seed>>>0;const nodes:ExpeditionNode[]=['combat','event','combat','shop','elite','event','boss'];let state=this.seed||1;this.route=this.generateRoute(this.seed);this.stats={seed:this.seed,nodesCleared:0,damageDealt:0,damageTaken:0,credits:0,rewards:[],victory:false}}
  reset(seed=Date.now()){this.seed=(seed>>>0)||1;this.route=this.generateRoute(this.seed);this.nodeIndex=0;this.credits=0;this.hull=5;this.rewards=[];this.stats={seed:this.seed,nodesCleared:0,damageDealt:0,damageTaken:0,credits:0,rewards:[],victory:false};this.nodeCleared=false;this.pendingOutcome={damageDealt:0,damageTaken:0,credits:0};this.lastOutcome={damageDealt:0,damageTaken:0,credits:0};this.log=[]}
  private generateRoute(seed:number):ExpeditionNode[]{let state=seed||1;const target=7+(state%4);state=(state*1664525+1013904223)>>>0;const pick=():ExpeditionNode=>{state=(state*1664525+1013904223)>>>0;const roll=state%100;return roll<34?'combat':roll<56?'event':roll<70?'shop':roll<82?'elite':'combat'};let first=pick();const tail:ExpeditionNode[]=[];for(let i=0;i<target-7;i++)tail.push(pick());if(first!=='event'&&!tail.includes('event')){if(tail.length)tail[0]='event';else first='event'}return['combat','branch',first,'shop','rest',...tail,'rest','boss']}
  current(){return this.route[this.nodeIndex]}
  hasReward(id:string){return this.rewards.some(reward=>reward.id===id)}
  shopBuyCost(){return 3+this.rewards.length}
  maxHull(){return this.hasReward('shield')?7:5}
  modifiers(metaUpgrades:string[]=[]):SimulationModifiers{const baseMaxHp=this.maxHull()+(metaUpgrades.includes('hull1')?1:0);const maxHp=Math.max(1,baseMaxHp-(this.hasReward('regen')?1:0));const maxEnergy=Math.max(8,20+(this.hasReward('rewind')?10:0)+(metaUpgrades.includes('energy10')?10:0)-(this.hasReward('echo')?4:0)-(this.hasReward('dash')?4:0)-(this.hasReward('shield')?4:0));const incomingDamage=this.hasReward('shield')?0:1;return{maxHp,maxEnergy,attackPower:this.hasReward('echo')?2:1,moveEnergyCost:this.hasReward('dash')?0:1,incomingDamage,startingHp:this.stats.nodesCleared?Math.min(this.maxHull(),maxHp):undefined,energyRegenEvery:this.hasReward('regen')?5:undefined,rangedPower:metaUpgrades.includes('ranged1')?2:1,nearRange:this.hasReward('sonar')?3:2,rangedRange:this.hasReward('longshot')?3:2}}
  resolveBattle(ticks:number,damageTaken:number,enemyMaxHp:number,grade:string,selectedRewardId?:string){const node=this.current();if(this.nodeCleared||!['combat','elite','boss'].includes(node))return false;const gradeBonus:Record<string,number>={S:6,A:4,B:2,C:0};const rewardIndex:Record<string,number|undefined>={S:0,A:1,B:2,C:undefined};const baseCredits=node==='boss'?12:node==='elite'?7:4;const outcome:ExpeditionOutcome={damageDealt:enemyMaxHp,damageTaken,credits:baseCredits+(gradeBonus[grade]??0),victory:node==='boss',grade};const index=rewardIndex[grade];if(index!==undefined){let reward:ExpeditionReward|undefined;if(selectedRewardId){reward=this.choices().find(item=>item.id===selectedRewardId);if(!reward)return false}else{const autoPool=this.choices().filter(item=>item.id==='rewind'||item.id==='sonar'||item.id==='longshot');reward=autoPool[Math.min(index,autoPool.length-1)]}if(reward){this.choose(reward.id);outcome.rewardTitle=reward.title;outcome.rewardId=reward.id}else outcome.rewardTitle='应急资源'}else outcome.rewardTitle='应急资源';this.pendingOutcome=outcome;this.lastOutcome=outcome;this.nodeCleared=true;this.log.push(`${node}:firmware-${grade}:${ticks}t:${outcome.rewardTitle}`);return true}
  actions():ExpeditionAction[]{const node=this.current();if(node==='branch')return[{id:'safe',title:'保守路线',description:'下一站改为事件节点，低风险'},{id:'risk',title:'精英捷径',description:'下一站改为精英战斗，风险与收益更高'}];if(node==='rest')return[{id:'repair',title:'就地整备',description:'不消耗 credits，恢复全部耐久'},{id:'leave',title:'继续出发',description:'保持现状继续'}];if(node==='shop'){const buyCost=this.shopBuyCost();return[{id:'buy',title:'购买补给',description:'消耗 '+buyCost+' credits，恢复状态'},{id:'hack',title:'破解终端',description:'风险换取额外 credits'},{id:'leave',title:'离开商店',description:'不花钱，安全离开'}]};if(node==='event')return[{id:'scan',title:'扫描遗迹',description:'稳定获得情报与少量 credits'},{id:'risk',title:'深入探索',description:'可能受伤，但收益更高'},{id:'leave',title:'绕开异常',description:'零风险通过'}];return[]}
  resolveAction(actionId:string){if(this.nodeCleared)return false;const node=this.current();if(['combat','elite','boss','branch'].includes(node))return false;if(node==='shop'&&actionId==='buy'&&this.credits<this.shopBuyCost())return false;const action=this.actions().find(item=>item.id===actionId);if(!action)return false;let outcome:ExpeditionOutcome={damageDealt:0,damageTaken:0,credits:0,victory:false};if(node==='rest'){outcome=actionId==='repair'?{damageDealt:0,damageTaken:0,credits:0,hullAfter:this.maxHull()}:{damageDealt:0,damageTaken:0,credits:0}}else if(node==='event'){const luck=(this.seed+this.nodeIndex*7)%5-2;if(actionId==='risk')outcome={damageDealt:0,damageTaken:2+(this.seed+this.nodeIndex)%2,credits:Math.max(4,8+luck)};else if(actionId==='scan')outcome={damageDealt:0,damageTaken:0,credits:Math.max(2,4+luck)};else outcome={damageDealt:0,damageTaken:0,credits:Math.max(1,1+luck)}}else if(node==='shop'){const luck=(this.seed+this.nodeIndex*11)%3;if(actionId==='buy')outcome={damageDealt:0,damageTaken:0,credits:-this.shopBuyCost(),hullAfter:Math.min(this.maxHull(),this.hull+2+luck)};else outcome={damageDealt:0,damageTaken:0,credits:actionId==='hack'?4+(this.seed+this.nodeIndex)%3:1}}if(this.hasReward('echo')&&node==='event'&&actionId==='scan')outcome.credits+=2;if(this.hasReward('rewind')&&node==='shop'&&actionId==='buy')outcome.credits=-1;this.pendingOutcome=outcome;this.lastOutcome=outcome;this.nodeCleared=true;this.log.push(`${node}:${actionId}`);return true}
  chooseBranch(choice:string){if(this.current()!=='branch')return false;const idx=this.nodeIndex+1;if(choice==='safe')this.route[idx]='event';else if(choice==='risk')this.route[idx]='elite';else return false;this.log.push(`branch:${choice}`);this.nodeIndex=Math.min(this.route.length,this.nodeIndex+1);this.stats.nodesCleared=this.nodeIndex;return true}
  failDeployment(){const node=this.current();if(this.nodeCleared||!['combat','elite','boss'].includes(node))return false;this.hull=Math.max(0,this.hull-1);this.log.push(`${node}:deployment-failed`);return true}
  choices():ExpeditionReward[]{const pool:ExpeditionReward[]=[{id:'dash',kind:'api',title:'零耗推进器',description:'移动不耗能，但最大能量 -4'},{id:'echo',kind:'sensor',title:'弱点扫描仪',description:'攻击伤害 +1，但最大能量 -4'},{id:'shield',kind:'runtime',title:'偏转护盾',description:'最大生命 +2、每次减伤 1，但最大能量 -4'},{id:'rewind',kind:'debugger',title:'扩容电池',description:'最大能量 +10，占一个模块位'},{id:'regen',kind:'runtime',title:'能量回收器',description:'每 5 Tick 回复 1 能量，但最大生命 -1'},{id:'sonar',kind:'sensor',title:'声呐扩展',description:'enemy_near() 探测范围 +1，占一个模块位'},{id:'longshot',kind:'api',title:'长程炮管',description:'ranged_attack 射程 +1，占一个模块位'}];const offset=(this.seed+this.nodeIndex)%pool.length;return[0,1,2].map(i=>pool[(offset+i)%pool.length])}
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
  '2-2':`bool turn_left_next = false;\nvoid update() {\n  if (wall_ahead()) {\n    if (turn_left_next) { turn_left(); }\n    else { turn_right(); }\n    turn_left_next = !turn_left_next;\n    return;\n  }\n  move_forward();\n}`,
  '3-1':`void update() {\n  if (enemy_near()) {\n    ranged_attack();\n  } else {\n    move_forward();\n  }\n}`,
  '3-2':`bool defend_next = true;\nvoid update() {\n  if (enemy_ahead()) {\n    if (defend_next) { shield(); }\n    else { attack(); }\n    defend_next = !defend_next;\n  } else {\n    move_forward();\n  }\n}`
};
export class Simulation {pulseUsed=false;shieldReady=false;levelIndex=0;map:string[]=STORY_LEVELS[0].map;dungeon?:DungeonLayout;exitPoint?:{x:number;y:number;roomId?:string|null};robot:Robot={x:1,y:1,dir:'E',hp:5,energy:20};enemy:Enemy={x:-1,y:-1,hp:0,kind:'slime'};enemies:Enemy[]=[];items:Item[]=[];tick=0;frames:Frame[]=[];breakpoints=new Set<number>();watchpoints=new Set<string>();coreDump?:CoreDump;completedLevels=new Set<string>();profile:ProfileStats={ticks:0,actions:0,errors:0,durationMs:0,actionCounts:{}};private runStartedAt=0;private hitBreakpoints=new Set<number>();private watchedValues=new Map<string,RuntimeValue|undefined>();private scenario?:SimulationScenario;private modifiers:SimulationModifiers={maxHp:5,maxEnergy:20,attackPower:1,moveEnergyCost:1,incomingDamage:1};private seed=0;private rngState=1;private enemyJitter={attack:0,move:0};private enemyMaxHp=1;private enemyAttackCount=0;private enemyRuntimes:{maxHp:number;attackCount:number;jitter:{attack:number;move:number}}[]=[];interpreter?:Interpreter;status:'idle'|'running'|'paused'|'success'|'failed'|'error'='idle';message='Ready';
 selectLevel(i:number){this.levelIndex=Math.max(0,Math.min(STORY_LEVELS.length-1,i));this.scenario=undefined;this.dungeon=undefined;this.exitPoint=undefined;this.modifiers={maxHp:5,maxEnergy:20,attackPower:1,moveEnergyCost:1,incomingDamage:1};this.reset();this.status='idle';this.message='Ready'}
 setScenario(scenario:SimulationScenario,modifiers?:Partial<SimulationModifiers>,seed=0){this.seed=seed>>>0;this.rngState=this.seed||1;this.scenario=scenario.dungeon?{...scenario}:{...scenario,map:scenario.map?[...scenario.map]:[],enemy:scenario.enemy?{...scenario.enemy}:undefined};this.modifiers={maxHp:5,maxEnergy:20,attackPower:1,moveEnergyCost:1,incomingDamage:1,...modifiers};this.reset();this.status='idle';this.message='Scenario loaded'}
 getProgress():StoryProgress{return{completedLevelIds:[...this.completedLevels],selectedLevelId:STORY_LEVELS[this.levelIndex].id}}
 applyProgress(progress:StoryProgress){const validIds=new Set(STORY_LEVELS.map(l=>l.id));this.completedLevels=new Set(progress.completedLevelIds.filter(id=>validIds.has(id)));const selected=progress.selectedLevelId?STORY_LEVELS.findIndex(l=>l.id===progress.selectedLevelId):-1;if(selected>=0)this.levelIndex=selected;this.reset();this.status='idle';this.message='Ready'}
 setBreakpoint(line:number){if(Number.isInteger(line)&&line>0){this.breakpoints.add(line);this.hitBreakpoints.delete(line)}} clearBreakpoints(){this.breakpoints.clear();this.hitBreakpoints.clear()} setWatchpoint(name:string){const normalized=name.trim();if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)){this.watchpoints.add(normalized);this.watchedValues.delete(normalized);return true}return false} clearWatchpoints(){this.watchpoints.clear();this.watchedValues.clear()} pause(){if(this.status==='running'){this.status='paused';this.message='Paused'}} resume(){if(this.status==='paused'){this.status='running';this.message='Running'}}
 build(code:string){try{const constraint=this.scenario?.constraint;if(constraint){const match=(tok:string)=>{if(tok.endsWith('()')){const esc=tok.slice(0,-2).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^A-Za-z0-9_])'+esc+'\\(\\)').test(code)}return code.includes(tok)};const missing=(constraint.require??[]).filter(tok=>!match(tok));if(missing.length)throw new RoboError(`代码约束：需要包含 ${missing.join('、')}`);const banned=(constraint.forbid??[]).filter(tok=>match(tok));if(banned.length)throw new RoboError(`代码约束：不能包含 ${banned.join('、')}`)}this.interpreter=new Interpreter(new Parser(lex(code)).parse(),this.host());this.message='Build succeeded';return{ok:true}}catch(e){const er=e as RoboError;this.message=`Build error ${er.line}:${er.column} - ${er.message}`;return{ok:false,error:er}}}
 hotReload(code:string){if(this.status!=='paused'&&this.status!=='idle')return{ok:false,error:new RoboError('Hot reload is only available while paused or idle')};const previous=this.snapshot();const result=this.build(code);if(result.ok){this.robot={...previous.robot};this.enemies=(previous.enemies??[previous.enemy]).map(e=>({...e}));this.enemy=this.enemies[0];this.rebuildEnemyRuntimes();this.tick=previous.tick;this.frames=previous.frames;this.status='paused';this.message='Hot reload applied';if(this.interpreter)Object.assign(this.interpreter.globals,previous.interpreterGlobals)}return result}
 reset(){
  const l=this.scenario??STORY_LEVELS[this.levelIndex];
  const scenario=l as SimulationScenario;
  const sourceEnemies=scenario.enemies??[];
  const dungeon=scenario.dungeon;
  let rawEnemies:Enemy[]=[];
  if(dungeon){
   const d=dungeon;this.dungeon=d;this.map=[];
   const start=d.rooms.find(r=>r.type==='start');const combat=d.rooms.find(r=>r.type==='combat');const exitRoom=d.rooms.find(r=>r.type==='exit');
   if(start?.spawn){this.robot={x:start.x+start.spawn.x,y:start.y+start.spawn.y,dir:'E',hp:this.modifiers.startingHp??this.modifiers.maxHp,energy:this.modifiers.maxEnergy,roomId:start.id}}else{this.robot={x:start?.x??1,y:start?.y??1,dir:'E',hp:this.modifiers.startingHp??this.modifiers.maxHp,energy:this.modifiers.maxEnergy,roomId:start?.id??null}}
   if(sourceEnemies.length){rawEnemies=sourceEnemies.map(en=>({...en,roomId:en.roomId??(combat?.id??null)}))}else if(combat?.enemy){rawEnemies=[{...combat.enemy,x:combat.x+combat.enemy.x,y:combat.y+combat.enemy.y,roomId:combat.id}]}else{rawEnemies=[{x:-1,y:-1,hp:0,kind:'slime',roomId:null}]}
   this.items=[];for(const room of d.rooms){for(const item of room.items){this.items.push({...item,x:room.x+item.x,y:room.y+item.y,roomId:room.id})}}
   this.exitPoint=exitRoom&&exitRoom.exit?{x:exitRoom.x+exitRoom.exit.x,y:exitRoom.y+exitRoom.exit.y,roomId:exitRoom.id}:undefined;
  }else{
   this.dungeon=undefined;this.exitPoint=undefined;this.map=[...(l.map??STORY_LEVELS[0].map)];this.robot={x:scenario.robotSpawn?.x??1,y:scenario.robotSpawn?.y??1,dir:scenario.robotSpawn?.dir??'E',hp:this.modifiers.startingHp??this.modifiers.maxHp,energy:this.modifiers.maxEnergy,roomId:null};
   if(sourceEnemies.length){rawEnemies=sourceEnemies.map(en=>({...en}))}else if(l.enemy){rawEnemies=[{...l.enemy}]}else{rawEnemies=[{x:-1,y:-1,hp:0,kind:'slime'}]}
   this.items=this.scenario?.items?[...this.scenario.items]:[];
  }
  this.enemies=rawEnemies;this.enemy=this.enemies[0];
  this.enemyMaxHp=this.enemy.hp;this.enemyAttackCount=0;
  this.enemyRuntimes=rawEnemies.map(e=>({maxHp:e.hp,attackCount:0,jitter:this.seed?{attack:this.nextInt(0,2),move:this.nextInt(0,2)}:{attack:0,move:0}}));
  this.enemyJitter=this.enemyRuntimes[0]?.jitter??{attack:0,move:0};
  this.tick=0;this.frames=[];this.pulseUsed=false;this.shieldReady=false;this.hitBreakpoints.clear();this.watchedValues.clear();this.coreDump=undefined;this.profile={ticks:0,actions:0,errors:0,durationMs:0,actionCounts:{}};this.runStartedAt=Date.now();this.status='running';this.message='Running'}
 usePulse(){if(this.pulseUsed||this.enemy.hp<=0||this.robot.energy<3||this.status==='idle'||this.status==='success'||this.status==='failed'||this.status==='error')return false;const distance=Math.abs(this.enemy.x-this.robot.x)+Math.abs(this.enemy.y-this.robot.y);if(distance>3)return false;this.pulseUsed=true;this.robot.energy-=3;this.enemy.hp=Math.max(0,this.enemy.hp-1);if(this.enemy.hp===0){this.enemy.x=-1;this.enemy.y=-1}this.message=this.enemy.hp?'脉冲命中：敌方系统短路':'脉冲击破：敌方系统离线';this.frames.push({tick:this.tick,robot:{...this.robot},enemy:{...this.enemy},enemies:this.enemies.map(e=>({...e})),variables:{},sensors:[],action:'pulse',events:['PULSE']});return true} useRepair(){if(this.robot.energy<4||this.robot.hp>=this.modifiers.maxHp||this.status==='idle'||this.status==='success'||this.status==='failed'||this.status==='error')return false;this.robot.energy-=4;this.robot.hp=Math.min(this.modifiers.maxHp,this.robot.hp+1);this.frames.push({tick:this.tick,robot:{...this.robot},enemy:{...this.enemy},enemies:this.enemies.map(e=>({...e})),variables:{},sensors:[],action:'repair_manual',events:['MANUAL_REPAIR']});this.message='紧急修理完成';return true}
 snapshot():SimulationSnapshot{return{levelIndex:this.levelIndex,map:[...this.map],robot:{...this.robot},enemy:{...this.enemy},enemies:this.enemies.map(e=>({...e})),items:this.items.map(item=>({...item})),tick:this.tick,frames:this.frames.map(frame=>({...frame,robot:{...frame.robot},enemy:{...frame.enemy},enemies:(frame.enemies??[frame.enemy]).map(e=>({...e})),variables:{...frame.variables},sensors:frame.sensors.map(sensor=>({...sensor}))})),status:this.status,message:this.message,interpreterGlobals:this.interpreter?{...this.interpreter.globals}:{},scenario:this.scenario?{...this.scenario,map:this.scenario.map?[...this.scenario.map]:[],enemy:this.scenario.enemy?{...this.scenario.enemy}:undefined,enemies:this.scenario.enemies?this.scenario.enemies.map(e=>({...e})):undefined}:undefined}}
 rollback(snapshot:SimulationSnapshot){this.levelIndex=snapshot.levelIndex;this.scenario=snapshot.scenario?{...snapshot.scenario,map:snapshot.scenario.map?[...snapshot.scenario.map]:[],enemy:snapshot.scenario.enemy?{...snapshot.scenario.enemy}:undefined,enemies:snapshot.scenario?.enemies?snapshot.scenario.enemies.map(e=>({...e})):undefined}:undefined;this.dungeon=this.scenario?.dungeon;this.map=this.dungeon?[]:[...snapshot.map];if(this.dungeon){const exitRoom=this.dungeon.rooms.find(r=>r.type==='exit');this.exitPoint=exitRoom?.exit?{x:exitRoom.x+exitRoom.exit.x,y:exitRoom.y+exitRoom.exit.y,roomId:exitRoom.id}:undefined}else this.exitPoint=undefined;this.robot={...snapshot.robot};this.enemies=(snapshot.enemies??[snapshot.enemy]).map(e=>({...e}));this.enemy=this.enemies[0];this.rebuildEnemyRuntimes();this.items=snapshot.items.map(item=>({...item}));this.tick=snapshot.tick;this.frames=snapshot.frames.map(frame=>({...frame,robot:{...frame.robot},enemy:{...frame.enemy},enemies:(frame.enemies??[frame.enemy]).map(e=>({...e})),variables:{...frame.variables},sensors:frame.sensors.map(sensor=>({...sensor}))}));this.status=snapshot.status;this.message='Rolled back to snapshot';if(this.interpreter)Object.assign(this.interpreter.globals,snapshot.interpreterGlobals)}
  step(){if(!this.interpreter||this.status!=='running')return;this.normalizeEnemyAlias();const result=this.interpreter.runTick();this.tick++;this.resolveEnemies();if(this.modifiers.energyRegenEvery&&this.tick%this.modifiers.energyRegenEvery===0){this.robot.energy=Math.min(this.modifiers.maxEnergy,this.robot.energy+1)}const ey=this.exitPoint?this.exitPoint.y:this.map.findIndex(r=>r.includes('E'));const ex=this.exitPoint?this.exitPoint.x:(this.map[ey]?.indexOf('E')??6);const events:string[]=[];const itemIndex=this.items.findIndex(item=>item.x===this.robot.x&&item.y===this.robot.y);if(itemIndex>=0){const item=this.items[itemIndex];if(item.kind==='energy'){this.robot.energy=Math.min(this.modifiers.maxEnergy,this.robot.energy+5);events.push('PICKUP_ENERGY')}else{this.robot.hp=Math.min(this.modifiers.maxHp,this.robot.hp+1);events.push('PICKUP_HEAL')}this.items.splice(itemIndex,1)}const anyAlive=this.activeEnemies().length>0;
if(this.seed&&anyAlive&&this.nextInt(0,100)<12){this.robot.energy=Math.min(this.modifiers.maxEnergy,this.robot.energy+1);events.push('POWER_SURGE')}else if(this.seed&&anyAlive&&this.nextInt(0,100)<8){this.robot.energy=Math.max(0,this.robot.energy-1);events.push('SYSTEM_OVERLOAD')}if(this.robot.x===ex&&this.robot.y===ey&&this.enemies.every(e=>e.hp<=0)){this.status='success';this.message='Exit reached';if(!this.scenario)this.completedLevels.add(STORY_LEVELS[this.levelIndex].id);events.push('EXIT_REACHED')}if(this.robot.hp<=0){this.status='failed';this.message='Robot destroyed';events.push('ROBOT_DESTROYED')}if(result.error){this.status='error';this.message=result.error;events.push('RUNTIME_ERROR')}for(const name of this.watchpoints){const value=result.variables[name];const previous=this.watchedValues.get(name);if(this.watchedValues.has(name)&&previous!==value){events.push(`WATCHPOINT:${name}`);if(this.status==='running'){this.status='paused';this.message=`Watchpoint changed: ${name}`}}this.watchedValues.set(name,value)}if(this.status==='running'&&result.sourceLine&&this.breakpoints.has(result.sourceLine)&&!this.hitBreakpoints.has(result.sourceLine)){this.status='paused';this.message=`Breakpoint hit at line ${result.sourceLine}`;this.hitBreakpoints.add(result.sourceLine);events.push('BREAKPOINT')}this.frames.push({tick:this.tick,sourceLine:result.sourceLine??result.errorLine,robot:{...this.robot},enemy:{...this.enemy},enemies:this.enemies.map(e=>({...e})),variables:result.variables,sensors:result.sensors,action:result.action,events,error:result.error});if(this.frames.length>200)this.frames.shift();if(result.error||this.robot.hp<=0){this.coreDump={cause:result.error?'runtime_error':'robot_destroyed',tick:this.tick,sourceLine:result.sourceLine??result.errorLine,message:result.error??'Robot destroyed',robot:{...this.robot},enemy:{...this.enemy},enemies:this.enemies.map(e=>({...e})),variables:{...result.variables},recentFrames:this.frames.slice(-12).map(frame=>({...frame,robot:{...frame.robot},enemy:{...frame.enemy},enemies:(frame.enemies??[frame.enemy]).map(e=>({...e})),variables:{...frame.variables},sensors:frame.sensors.map(sensor=>({...sensor}),)}))}}return result}
 private normalizeEnemyAlias(){if(this.enemies.length===1&&this.enemy!==this.enemies[0]){this.enemies=[this.enemy];this.enemyRuntimes=[{maxHp:this.enemy.hp,attackCount:0,jitter:{attack:0,move:0}}]}} private activeEnemies():Enemy[]{return this.enemies.filter(e=>e.active!==false&&e.hp>0&&e.x>=0&&e.y>=0)}
 private enemyDistance(e:Enemy){return Math.abs(e.x-this.robot.x)+Math.abs(e.y-this.robot.y)}
 private enemyAheadTarget():Enemy|undefined{const p=this.front();return this.activeEnemies().find(e=>e.x===p.x&&e.y===p.y)}
 private nearestEnemy():Enemy|undefined{let best:Enemy|undefined;let bestD=Infinity;for(const e of this.activeEnemies()){const d=this.enemyDistance(e);if(d<bestD){bestD=d;best=e}}return best}
 private nearestEnemyInRange(range:number):Enemy|undefined{let best:Enemy|undefined;let bestD=Infinity;for(const e of this.activeEnemies()){const d=this.enemyDistance(e);if(d<=range&&d<bestD){bestD=d;best=e}}return best}
 private enemyAtCell(x:number,y:number):Enemy|undefined{return this.activeEnemies().find(e=>e.x===x&&e.y===y)}
 private enemyBlocked(x:number,y:number){return !!this.enemyAtCell(x,y)} private host():RuntimeHost{return{sense:(n)=>n==='wall_ahead'?this.isWall(this.front().x,this.front().y):n==='enemy_ahead'?!!this.enemyAheadTarget():n==='enemy_near'?this.activeEnemies().some(e=>this.enemyDistance(e)<=(this.modifiers.nearRange??2)):n==='low_hp'?this.robot.hp<=2:n==='low_energy'?this.robot.energy<=5:false,value:(n)=>{const nearest=this.nearestEnemy();return n==='distance_to_enemy'?(nearest?this.enemyDistance(nearest):99):n==='enemy_x'?(nearest?.x??-1):n==='enemy_y'?(nearest?.y??-1):n==='steps_to_wall'?this.stepsToWall():n==='enemy_hp'?(nearest?.hp??0):0},action:(n)=>{if(this.robot.energy<=0){this.status='failed';this.message='Energy depleted';return}if(n==='move_forward'){const p=this.front();if(!this.isWall(p.x,p.y)&&!this.enemyBlocked(p.x,p.y)){this.robot.x=p.x;this.robot.y=p.y;this.syncRoom(p.x,p.y)}this.robot.energy=Math.max(0,this.robot.energy-this.modifiers.moveEnergyCost)}else if(n==='turn_right'){this.robot.dir={N:'E',E:'S',S:'W',W:'N'}[this.robot.dir]as Direction;this.robot.energy=Math.max(0,this.robot.energy-1)}else if(n==='turn_left'){this.robot.dir={N:'W',W:'S',S:'E',E:'N'}[this.robot.dir]as Direction;this.robot.energy=Math.max(0,this.robot.energy-1)}else if(n==='dash'){let p=this.front();let moved=0;while(moved<2){if(this.isWall(p.x,p.y)||this.enemyAtCell(p.x,p.y))break;this.robot.x=p.x;this.robot.y=p.y;moved++;p=this.front();}this.syncRoom(this.robot.x,this.robot.y);this.robot.energy=Math.max(0,this.robot.energy-2)}else if(n==='back'){const back={N:[0,1],E:[-1,0],S:[0,-1],W:[1,0]}[this.robot.dir]as [number,number];const bx=this.robot.x+back[0];const by=this.robot.y+back[1];if(!this.isWall(bx,by)&&!this.enemyBlocked(bx,by)){this.robot.x=bx;this.robot.y=by;this.syncRoom(bx,by)}this.robot.energy=Math.max(0,this.robot.energy-1)}else if(n==='repair'&&this.robot.hp<this.modifiers.maxHp){this.robot.hp=Math.min(this.modifiers.maxHp,this.robot.hp+1);this.robot.energy=Math.max(0,this.robot.energy-3)}else if(n==='shield'){this.shieldReady=true;this.robot.energy=Math.max(0,this.robot.energy-2)}else if(n==='ranged_attack'){const target=this.nearestEnemyInRange(this.modifiers.rangedRange??2);if(target){if(target.kind==='guard'){this.message='护盾吸收了远程火力';this.robot.energy=Math.max(0,this.robot.energy-2)}else{target.hp=Math.max(0,target.hp-(this.modifiers.rangedPower??this.modifiers.attackPower));if(target.hp===0){target.x=-1;target.y=-1}this.message=target.hp?'Ranged hit':'Target destroyed';this.robot.energy=Math.max(0,this.robot.energy-2)}}}else if(n==='attack'){const target=this.enemyAheadTarget();if(target){target.hp=Math.max(0,target.hp-(this.modifiers.rangedPower??this.modifiers.attackPower));if(target.hp===0){target.x=-1;target.y=-1}this.message=target.hp?'Slime hit':'Slime destroyed';this.robot.energy=Math.max(0,this.robot.energy-1)}}}}}
 private nextEnemyStep(excludeIndex:number):{x:number;y:number}|undefined{
    const e=this.enemies[excludeIndex]; if(!e)return undefined;
    const sx=e.x; const sy=e.y;
    const tx=this.robot.x; const ty=this.robot.y;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    const targets=dirs.map(([dx,dy])=>({x:tx+dx,y:ty+dy})).filter(p=>!this.isWall(p.x,p.y)&&!this.otherEnemyAt(excludeIndex,p.x,p.y));
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
        if(this.otherEnemyAt(excludeIndex,nx,ny))continue;
        visited.add(k);
        queue.push({x:nx,y:ny,path:[...cur.path,{x:nx,y:ny}]});
      }
    }
    return undefined;
  }
 private otherEnemyAt(excludeIndex:number,x:number,y:number):boolean{
   for(let i=0;i<this.enemies.length;i++){if(i===excludeIndex)continue;const o=this.enemies[i];if(o.active!==false&&o.hp>0&&o.x===x&&o.y===y)return true}
   return false;
 }
 private nextRand():number{this.rngState=(this.rngState*1664525+1013904223)>>>0;return this.rngState/4294967296}
 private nextInt(min:number,max:number):number{return min+Math.floor(this.nextRand()*(max-min))}
 private stepsToWall(){const d={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[this.robot.dir];let x=this.robot.x,y=this.robot.y,s=0;while(s<10&&!this.isWall(x+d[0],y+d[1])){x+=d[0];y+=d[1];s++;}return s}
 private syncRoom(x:number,y:number){if(this.dungeon)this.robot.roomId=roomAt(this.dungeon,x,y)?.id??null} private front(){const d={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[this.robot.dir];return{x:this.robot.x+d[0],y:this.robot.y+d[1]}} private isWall(x:number,y:number){if(this.dungeon)return !walkableAt(this.dungeon,x,y);return this.map[y]?.[x]==='#'} private rebuildEnemyRuntimes(){this.enemyRuntimes=this.enemies.map(e=>({maxHp:e.hp,attackCount:0,jitter:{attack:0,move:0}}))}
 private resolveEnemies(){
   for(let idx=0;idx<this.enemies.length;idx++){
     const enemy=this.enemies[idx];
     if(enemy.active===false||enemy.hp<=0)continue;
     const rt=this.enemyRuntimes[idx]??{maxHp:enemy.hp,attackCount:0,jitter:{attack:0,move:0}};
     if(!this.enemyRuntimes[idx])this.enemyRuntimes[idx]=rt;
     const dist=Math.abs(enemy.x-this.robot.x)+Math.abs(enemy.y-this.robot.y);
     const kind=enemy.kind??'slime';
     const enraged=rt.maxHp>0&&enemy.hp<=Math.ceil(rt.maxHp/2);
     const attackEvery=Math.max(1,(enemy.attackEvery??(kind==='swarm'?1:3))+rt.jitter.attack-(enraged?1:0));
     const inRange=kind==='turret'?dist<=(enemy.range??3):dist<=1;
     if(inRange&&this.tick%attackEvery===0){
       rt.attackCount++;
       let damage=enemy.damage ?? this.modifiers.incomingDamage;
       if(kind==='tank')damage+=1;
       if(enraged&&kind==='swarm')damage+=1;
       if(rt.attackCount%5===0)damage+=1;
       if(kind==='runner'){this.shieldReady=false;this.robot.hp=0;enemy.hp=0;enemy.x=-1;enemy.y=-1;this.message='Runner exploded';break;}
       if(this.shieldReady){damage=Math.max(0,damage-1);this.shieldReady=false;}
       this.robot.hp=Math.max(0,this.robot.hp-damage);
       this.message=rt.attackCount%5===0?'Enemy heavy strike':kind==='turret'?'敌方炮台射击':'Enemy strike';
     }
     if(this.robot.hp<=0)break;
     if(kind==='turret')continue;
     const moveEvery=(enemy.moveEvery??(kind==='swarm'||kind==='runner'?1:kind==='tank'?4:3))+rt.jitter.move;
     if(this.tick%moveEvery===0){
       const step=this.nextEnemyStep(idx);
       if(step){enemy.x=step.x;enemy.y=step.y;if(this.dungeon)enemy.roomId=roomAt(this.dungeon,step.x,step.y)?.id??null;}
     }
   }
 }}
export const META_KEY='coderogue.meta.v1';
export interface RunRecord{seed:number;result:'victory'|'lost';nodesCleared:number;routeLength:number;credits:number;rewards:string[];bestGrade?:string}
export interface MetaProgress{credits:number;runs:number;bestGrade?:string;upgrades:string[];lastRuns?:RunRecord[]}
export function loadMeta(storage?:ProgressStorage):MetaProgress{if(!storage)return{credits:0,runs:0,upgrades:[],lastRuns:[]};try{const raw=storage.getItem(META_KEY);if(!raw)return{credits:0,runs:0,upgrades:[],lastRuns:[]};const parsed=JSON.parse(raw) as Partial<MetaProgress>;const upgrades=Array.isArray(parsed.upgrades)?parsed.upgrades.filter((u):u is string=>typeof u==='string'):[];const rawRuns=Array.isArray(parsed.lastRuns)?parsed.lastRuns.filter((r):r is RunRecord=>!!r&&typeof r==='object'&&typeof r.seed==='number'&&(r.result==='victory'||r.result==='lost')):[];return{credits:typeof parsed.credits==='number'&&parsed.credits>=0?Math.floor(parsed.credits):0,runs:typeof parsed.runs==='number'&&parsed.runs>=0?Math.floor(parsed.runs):0,bestGrade:typeof parsed.bestGrade==='string'?parsed.bestGrade:undefined,upgrades,lastRuns:rawRuns}}catch{return{credits:0,runs:0,upgrades:[],lastRuns:[]}}}
export function saveMeta(meta:MetaProgress,storage?:ProgressStorage):void{if(!storage)return;try{storage.setItem(META_KEY,JSON.stringify(meta))}catch{}}
export function gradeBattle(m:{tick:number;damage:number;energyUsed:number;actions:number;sensorReads:number}):string{let score=0;if(m.damage===0)score+=3;else if(m.damage===1)score+=2;else if(m.damage===2)score+=1;if(m.tick<=10)score+=3;else if(m.tick<=15)score+=2;else if(m.tick<=20)score+=1;if(m.energyUsed<=12)score+=2;else if(m.energyUsed<=16)score+=1;if(m.actions<=m.tick+2)score+=1;if(m.sensorReads>0&&m.sensorReads<=m.tick*2)score+=1;return score>=9?'S':score>=7?'A':score>=5?'B':'C'}
export interface BattleGradeReport{grade:string;score:number;reasons:string[]}
export function gradeBattleReport(m:{tick:number;damage:number;energyUsed:number;actions:number;sensorReads:number}):BattleGradeReport{let score=0;const reasons:string[]=[];if(m.damage===0){score+=3;reasons.push('无伤 +3')}else if(m.damage===1){score+=2;reasons.push('受伤 1 +2')}else if(m.damage===2){score+=1;reasons.push('受伤 2 +1')}else{reasons.push(`受伤 ${m.damage} +0`)}if(m.tick<=10){score+=3;reasons.push(`速度 ${m.tick} Tick +3`)}else if(m.tick<=15){score+=2;reasons.push(`速度 ${m.tick} Tick +2`)}else if(m.tick<=20){score+=1;reasons.push(`速度 ${m.tick} Tick +1`)}else{reasons.push(`速度 ${m.tick} Tick +0`)}if(m.energyUsed<=12){score+=2;reasons.push(`能耗 ${m.energyUsed} +2`)}else if(m.energyUsed<=16){score+=1;reasons.push(`能耗 ${m.energyUsed} +1`)}else{reasons.push(`能耗 ${m.energyUsed} +0`)}if(m.actions<=m.tick+2){score+=1;reasons.push(`动作纪律 +1`)}else{reasons.push('动作纪律 +0')}if(m.sensorReads>0&&m.sensorReads<=m.tick*2){score+=1;reasons.push('感知节奏 +1')}else{reasons.push('感知节奏 +0')}const grade=score>=9?'S':score>=7?'A':score>=5?'B':'C';return{grade,score,reasons}}
export const STORY_BEST_KEY='coderogue.story-best.v1';
export interface StoryBestProgress{bestGrades:Record<string,string>;bestTicks:Record<string,number>}
export function loadStoryBest(storage?:ProgressStorage):StoryBestProgress{if(!storage)return{bestGrades:{},bestTicks:{}};try{const raw=storage.getItem(STORY_BEST_KEY);if(!raw)return{bestGrades:{},bestTicks:{}};const parsed=JSON.parse(raw) as Partial<StoryBestProgress>;const validIds=new Set(STORY_LEVELS.map(l=>l.id));const bestGrades:Record<string,string>={};const bestTicks:Record<string,number>={};if(parsed.bestGrades&&typeof parsed.bestGrades==='object'){for(const [id,grade] of Object.entries(parsed.bestGrades)){if(validIds.has(id)&&['S','A','B','C'].includes(grade))bestGrades[id]=grade}}if(parsed.bestTicks&&typeof parsed.bestTicks==='object'){for(const [id,ticks] of Object.entries(parsed.bestTicks)){if(validIds.has(id)&&typeof ticks==='number'&&ticks>=0)bestTicks[id]=Math.floor(ticks)}}return{bestGrades,bestTicks}}catch{return{bestGrades:{},bestTicks:{}}}}
export function saveStoryBest(best:StoryBestProgress,storage?:ProgressStorage):void{if(!storage)return;try{storage.setItem(STORY_BEST_KEY,JSON.stringify(best))}catch{}}
export function recordStoryBest(levelId:string,grade:string,ticks:number,storage?:ProgressStorage):boolean{const valid=new Set(STORY_LEVELS.map(l=>l.id));if(!valid.has(levelId)||!['S','A','B','C'].includes(grade))return false;const best=loadStoryBest(storage);const order=['S','A','B','C'];const current=best.bestGrades[levelId];if(current){const currentIdx=order.indexOf(current);const newIdx=order.indexOf(grade);if(currentIdx<newIdx)return false;if(currentIdx===newIdx&&(best.bestTicks[levelId]??Infinity)<=ticks)return false}best.bestGrades[levelId]=grade;best.bestTicks[levelId]=ticks;saveStoryBest(best,storage);return true}
