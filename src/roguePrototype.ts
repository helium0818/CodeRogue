import { DungeonLayout, DungeonKind } from './dungeon';
import type { SimulationModifiers } from './core';
import { buildTacticalDungeon } from './tactical';

export const INITIAL_CAPABILITIES = [
  'wall_ahead','enemy_ahead','enemy_hp','distance_to_enemy',
  'move_forward','turn_left','turn_right','attack','ranged_attack','wait'
];
export const LOCKED_CAPABILITIES = [
  'back','dash','shield','enemy_near','low_hp','low_energy'
];
export type ProtoRewardId = 'back'|'threat'|'patching';

export interface RoguePrototypeState {
  roomIndex: number;
  phase: 'battle'|'reward'|'complete';
  hp: number;
  energy: number;
  debugPoints: number;
  debugPointBonus: number;
  firmwareCode: string;
  capabilities: string[];
  selectedReward?: ProtoRewardId;
  stats: { hotReloadCount:number; rollbackCount:number; roomRetries:number; debugPointsSpent:number };
}

export const ROGUE_PROTOTYPE_ROOM_COUNT = 2;
export const BASE_DEBUG_POINTS = 3;

export function createRoguePrototypeState(): RoguePrototypeState {
  return {
    roomIndex: 0,
    phase: 'battle',
    hp: 5,
    energy: 60,
    debugPoints: BASE_DEBUG_POINTS,
    debugPointBonus: 0,
    firmwareCode: '',
    capabilities: [...INITIAL_CAPABILITIES],
    stats: { hotReloadCount:0, rollbackCount:0, roomRetries:0, debugPointsSpent:0 }
  };
}

export function prototypeDebugBudget(state:RoguePrototypeState){return BASE_DEBUG_POINTS + state.debugPointBonus}
export function resetPrototypeDebugPoints(state:RoguePrototypeState){state.debugPoints = prototypeDebugBudget(state)}

export function findLockedCapability(code:string, capabilities:string[]): string|undefined {
  for(const name of LOCKED_CAPABILITIES){
    if(capabilities.includes(name)) continue;
    const re = new RegExp('\\b'+name+'\\s*\\(', 'i');
    if(re.test(code)) return name;
  }
  return undefined;
}

export function applyProtoReward(state:RoguePrototypeState, reward:ProtoRewardId): boolean {
  state.selectedReward = reward;
  if(reward==='back' && !state.capabilities.includes('back')) state.capabilities.push('back');
  if(reward==='threat' && !state.capabilities.includes('enemy_near')) state.capabilities.push('enemy_near');
  if(reward==='patching'){state.debugPointBonus = 1; resetPrototypeDebugPoints(state)}
  return true;
}

export function spendDebugPoints(state:RoguePrototypeState, cost:number): boolean {
  if(state.debugPoints < cost) return false;
  state.debugPoints -= cost;
  state.stats.debugPointsSpent += cost;
  return true;
}

export function protoRoomModifiers(roomMods?:Partial<SimulationModifiers>):Partial<SimulationModifiers>{
  return {maxHp:roomMods?.maxHp ?? 8, maxEnergy:roomMods?.maxEnergy ?? 60, attackPower:1, moveEnergyCost:1, incomingDamage:roomMods?.incomingDamage ?? 1};
}

export interface ProtoScenario { id:string; title:string; objective:string; dungeon:DungeonLayout; starterCode:string; modifiers?:Partial<SimulationModifiers>; enemyKind:DungeonKind }

const RUNNER_STARTER = `void update() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}`;

export const ROGUE_PROTO_ROOMS: ProtoScenario[] = [
  {
    id:'proto-runner',
    title:'Room 1 · Runner Pressure',
    objective:'Runner 会连续逼近。观察距离，不要只靠直线开火。',
    dungeon:buildTacticalDungeon(24,7,{kind:'runner',hp:2,ex:0,ey:3,moveEvery:1,attackEvery:2,obstacles:[{x:3,y:1},{x:8,y:5},{x:13,y:1},{x:15,y:5}],items:[{x:16,y:3,kind:'energy'}]}),
    starterCode:RUNNER_STARTER,
    modifiers:{maxEnergy:60},
    enemyKind:'runner'
  },
  {
    id:'proto-guard',
    title:'Room 2 · Adaptive Arena',
    objective:'Guard 免疫远程：继承 Room 1 的 firmware 会失效，需要调整策略与能力。',
    dungeon:buildTacticalDungeon(27,7,{kind:'guard',hp:4,ex:0,ey:3,moveEvery:1000,attackEvery:4,obstacles:[{x:4,y:1},{x:4,y:5},{x:11,y:2},{x:15,y:4}]}),
    starterCode:RUNNER_STARTER,
    modifiers:{maxHp:8,maxEnergy:60,incomingDamage:3},
    enemyKind:'guard'
  }
];