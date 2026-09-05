import { ExpeditionRun, ExpeditionReward, SimulationModifiers } from './core';

export interface TacticalRunState {
  roomIndex: number;
  phase: 'battle' | 'reward' | 'rest' | 'complete';
  hp: number;
  energy: number;
  modules: string[];
  firmwareCode: string;
  clearedRooms: string[];
  stats: { totalTicks: number; damageTaken: number; hotReloads: number; debugInterventions: number; wins: number };
}

export const TACTICAL_RUN_ROOM_COUNT = 3;
export const TACTICAL_RUN_ENERGY_BUDGET = 80;

export function createInitialTacticalRun(): TacticalRunState {
  return {
    roomIndex: 0,
    phase: 'battle',
    hp: 5,
    energy: TACTICAL_RUN_ENERGY_BUDGET,
    modules: [],
    firmwareCode: '',
    clearedRooms: [],
    stats: { totalTicks: 0, damageTaken: 0, hotReloads: 0, debugInterventions: 0, wins: 0 }
  };
}

const CALC_SEED = 13;
const CALC_NODE_INDEX = 5; // choices() window = [regen, sonar, longshot]

export function tacticalRewardChoices(): ExpeditionReward[] {
  const run = new ExpeditionRun(CALC_SEED);
  run.nodeIndex = CALC_NODE_INDEX;
  return run.choices();
}

export function moduleModifiers(moduleIds: string[]): Partial<SimulationModifiers> {
  const run = new ExpeditionRun(CALC_SEED);
  run.nodeIndex = CALC_NODE_INDEX;
  const knownIds = new Set<string>();
  for (let offset = 0; offset < 7; offset++) {
    const window = new ExpeditionRun(CALC_SEED);
    window.nodeIndex = offset;
    for (const reward of window.choices()) knownIds.add(reward.id);
  }
  run.rewards = moduleIds
    .filter((id) => knownIds.has(id))
    .map((id) => ({ id, kind: 'api' as const, title: id, description: '' }));
  return run.modifiers([]);
}

export function markRunFirmwareRevision(state: TacticalRunState){state.stats.hotReloads += 1}
export function markRunDebugIntervention(state: TacticalRunState){state.stats.debugInterventions += 1}
export function runRoomModifiers(roomMods: Partial<SimulationModifiers> | undefined, moduleIds: string[]): Partial<SimulationModifiers> {
  const mods = roomModifiers(roomMods, moduleIds);
  mods.maxEnergy = Math.max(mods.maxEnergy ?? 0, TACTICAL_RUN_ENERGY_BUDGET);
  return mods;
}

export function roomModifiers(roomMods: Partial<SimulationModifiers> | undefined, moduleIds: string[]): Partial<SimulationModifiers> {
  const mods = moduleModifiers(moduleIds);
  return {
    ...mods,
    ...roomMods,
    energyRegenEvery: mods.energyRegenEvery ?? roomMods?.energyRegenEvery,
    nearRange: mods.nearRange ?? roomMods?.nearRange ?? 2,
    rangedRange: mods.rangedRange ?? roomMods?.rangedRange ?? 2,
    maxHp: Math.max(roomMods?.maxHp ?? 5, mods.maxHp ?? 5),
    maxEnergy: Math.max(roomMods?.maxEnergy ?? 20, mods.maxEnergy ?? 20)
  };
}