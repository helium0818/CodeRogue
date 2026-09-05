import type { SimulationScenario } from './core';

export type ExpeditionRoomKind = 'combat' | 'elite' | 'boss';
type Cell = [number, number];

export interface ExpeditionRoomTemplate {
  id: string;
  name: string;
  kind: ExpeditionRoomKind;
  difficulty: string;
  tags: string[];
  coreLoop: string;
  recommendedStrategy: string;
  scenario: SimulationScenario;
}

type Segment = [number, number, number];

function corridorCells(start: Cell, segments: Segment[]): Cell[] {
  const cells: Cell[] = [start];
  let x = start[0];
  let y = start[1];
  for (const [dx, dy, steps] of segments) {
    for (let i = 0; i < steps; i++) {
      x += dx;
      y += dy;
      cells.push([x, y]);
    }
  }
  return cells;
}

function fillCells(open: Cell[], x1: number, y1: number, x2: number, y2: number) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) open.push([x, y]);
  }
}

function buildRoom(
  width: number,
  height: number,
  open: Cell[],
  enemy: Cell | undefined,
  exit: Cell,
  kind: string,
  start: Cell = [1, 1],
): string[] {
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '#'));
  for (const [x, y] of open) grid[y][x] = '.';
  grid[start[1]][start[0]] = 'R';
  grid[exit[1]][exit[0]] = 'E';
  if (enemy) grid[enemy[1]][enemy[0]] = kind === 'runner' ? 'S' : 'S';
  return grid.map((row) => row.join(''));
}

const rangedNav = `void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); }
  else { advance(); }
}`;

const meleeNav = `void advance() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
void update() {
  if (enemy_ahead()) { attack(); }
  else { advance(); }
}`;

/* EXP-01 开阔拉扯场：追猎坦克会持续逼近；距离 1 时用 back() 后撤，2 格时 ranged_attack()。 */
const arenaOpen: Cell[] = [];
fillCells(arenaOpen, 1, 1, 15, 5);
const exp01: SimulationScenario = {
  id: 'exp-01-open-arena',
  title: '开阔拉扯场',
  objective: '追猎坦克持续逼近：距离 2 用 ranged_attack() 点射，贴身用 back() 后撤拉扯，再抵达撤离门',
  map: buildRoom(17, 7, arenaOpen, [11, 3], [15, 3], 'tank', [8, 3]),
  robotSpawn: { x: 8, y: 3, dir: 'E' },
  enemy: { x: 11, y: 3, hp: 2, moveEvery: 2, attackEvery: 2, kind: 'tank' },
  items: [{ x: 4, y: 3, kind: 'energy' }, { x: 6, y: 3, kind: 'energy' }, { x: 9, y: 3, kind: 'energy' }, { x: 13, y: 3, kind: 'energy' }, { x: 14, y: 3, kind: 'heal' }],
  constraint: { require: ['enemy_near()', 'ranged_attack()'], forbid: ['attack()'] },
  starterCode: 'void update() {\n  move_forward();\n}',
  solutionCode: `void update() {
  if (enemy_hp() > 0) {
    if (enemy_near() && distance_to_enemy() <= 1) { back(); return; }
    if (distance_to_enemy() <= 2) { ranged_attack(); return; }
    wait();
    return;
  }
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}`,
  recommendedStrategy: '拉扯：2 格点射 → 贴身 back() 后撤 → 拉开后再射，形成拉扯节奏',
  difficulty: '低',
  tags: ['open', 'kite', 'tank', 'back'],
  tactics: ['追猎坦克会一直逼近，不能站在原地对射。', '用 distance_to_enemy() 读距离：2 格点射，贴身用 back() 拉开。', '不要用 attack()：远程风筝才是这个房间的正确打法。'],
};

/* EXP-02 狭长走廊：一条 1 格宽通道，Guard 正面对抗，绕行空间为零。 */
const narrowOpen: Cell[] = [];
fillCells(narrowOpen, 1, 1, 15, 1);
const exp02: SimulationScenario = {
  id: 'exp-02-narrow-corridor',
  title: '狭长走廊',
  objective: '单线走廊无法侧移；贴身击破护盾守卫后抵达远端撤离门',
  map: buildRoom(17, 3, narrowOpen, [9, 1], [15, 1], 'guard'),
  enemy: { x: 9, y: 1, hp: 3, moveEvery: 4, attackEvery: 5, kind: 'guard' },
  items: [{ x: 3, y: 1, kind: 'energy' }, { x: 6, y: 1, kind: 'energy' }, { x: 11, y: 1, kind: 'energy' }, { x: 13, y: 1, kind: 'heal' }],
  constraint: { require: ['enemy_ahead()', 'attack()'], forbid: ['ranged_attack()'] },
  starterCode: 'void update() {\n  move_forward();\n}',
  solutionCode: meleeNav,
  recommendedStrategy: '强攻：正面 enemy_ahead() → attack()，远程火力会被护盾吸收',
  difficulty: '低',
  tactics: ['走廊只有一条通道，没有后退拉扯的余地。', 'Guard 免疫远程，贴近后正面 attack() 拆掉护盾。'],
};

/* EXP-03 中央障碍：大地块迫使机器人绕行整个房间，Turret 在中段施压。 */
const centralOpen: Cell[] = [];
fillCells(centralOpen, 1, 1, 13, 1);
fillCells(centralOpen, 1, 2, 3, 2);
centralOpen.push([13, 2]);
fillCells(centralOpen, 1, 3, 3, 3);
centralOpen.push([13, 3]);
fillCells(centralOpen, 1, 4, 13, 4);
const exp03: SimulationScenario = {
  id: 'exp-03-central-block',
  title: '中央障碍仓',
  objective: '中央墙块挡路：先远程拆掉炮台，再绕外墙抵达左下撤离门',
  map: buildRoom(15, 6, centralOpen, [8, 1], [2, 4], 'turret'),
  enemy: { x: 8, y: 1, hp: 2, attackEvery: 5, range: 3, kind: 'turret' },
  items: [{ x: 4, y: 1, kind: 'energy' }, { x: 6, y: 1, kind: 'energy' }, { x: 7, y: 1, kind: 'energy' }, { x: 9, y: 1, kind: 'energy' }, { x: 10, y: 1, kind: 'energy' }, { x: 12, y: 1, kind: 'energy' }, { x: 12, y: 4, kind: 'energy' }, { x: 5, y: 4, kind: 'energy' }, { x: 7, y: 4, kind: 'heal' }],
  constraint: { require: ['enemy_near()', 'ranged_attack()'], forbid: ['attack()'] },
  starterCode: 'void update() {\n  move_forward();\n}',
  solutionCode: rangedNav,
  recommendedStrategy: '绕行：墙前转向 + 远距拆塔，避免直线进入炮台火力区',
  difficulty: '中',
  tactics: ['中央大型墙块让直线推进失效，必须先读墙再转弯。', 'Turret 有远程射程，尽量在其射程边缘用 ranged_attack() 拆掉。'],
};

/* EXP-04 环形回廊：中央封闭岛，外周环路；Turret 挡在短边。 */
const ringOpen: Cell[] = [];
fillCells(ringOpen, 1, 1, 11, 1);
fillCells(ringOpen, 1, 2, 3, 2);
fillCells(ringOpen, 10, 2, 11, 2);
fillCells(ringOpen, 1, 3, 3, 3);
fillCells(ringOpen, 10, 3, 11, 3);
fillCells(ringOpen, 1, 4, 3, 4);
fillCells(ringOpen, 10, 4, 11, 4);
fillCells(ringOpen, 1, 5, 11, 5);
const exp04: SimulationScenario = {
  id: 'exp-04-ring-corridor',
  title: '环形回廊',
  objective: '中央区域不可通行；绕外侧环路拆掉炮台后抵达下方出口',
  map: buildRoom(13, 7, ringOpen, [8, 1], [6, 5], 'turret'),
  enemy: { x: 8, y: 1, hp: 2, attackEvery: 5, range: 3, kind: 'turret' },
  items: [{ x: 3, y: 1, kind: 'energy' }, { x: 6, y: 1, kind: 'energy' }, { x: 7, y: 1, kind: 'energy' }, { x: 9, y: 1, kind: 'energy' }, { x: 10, y: 1, kind: 'energy' }, { x: 10, y: 5, kind: 'energy' }, { x: 7, y: 5, kind: 'energy' }, { x: 8, y: 5, kind: 'heal' }],
  constraint: { require: ['enemy_near()', 'ranged_attack()'], forbid: ['attack()'] },
  starterCode: 'void update() {\n  move_forward();\n}',
  solutionCode: rangedNav,
  recommendedStrategy: '绕环：贴外墙走完三边，不要试图穿越中央封闭区',
  difficulty: '中',
  tactics: ['环形回廊只有外周可走，墙前转向决定能否绕回出口。', '先解决挡在环路上的炮台，再贴着外墙完成绕行。'],
};

/* EXP-05 双路仓储：上下两条平行通道，均汇入撤离门；上层直行、下层绕行。 */
const splitOpen: Cell[] = [];
fillCells(splitOpen, 1, 1, 15, 1);
fillCells(splitOpen, 1, 2, 4, 2);
fillCells(splitOpen, 14, 2, 15, 2);
fillCells(splitOpen, 1, 3, 15, 3);
fillCells(splitOpen, 1, 4, 15, 4);
const exp05: SimulationScenario = {
  id: 'exp-05-split-route',
  title: '双路仓储区',
  objective: '上层与下层是两条真实通道：先清掉入口炮台，再选择路线抵达撤离门',
  map: buildRoom(17, 6, splitOpen, [4, 1], [14, 4], 'turret'),
  enemy: { x: 4, y: 1, hp: 2, attackEvery: 5, range: 3, kind: 'turret' },
  items: [{ x: 3, y: 1, kind: 'energy' }, { x: 6, y: 1, kind: 'energy' }, { x: 9, y: 1, kind: 'energy' }, { x: 12, y: 1, kind: 'energy' }, { x: 8, y: 4, kind: 'heal' }],
  constraint: { require: ['enemy_near()', 'ranged_attack()'], forbid: ['attack()'] },
  starterCode: 'void update() {\n  move_forward();\n}',
  solutionCode: rangedNav,
  recommendedStrategy: '导航选择：上层直行最快；下层补给较多但要多转弯',
  difficulty: '中',
  tags: ['branch', 'turning'],
  tactics: ['通道在上层与下层之间真实分叉，撤离门在汇合点之后。', '入口 Turret 挡路，先用 ranged_attack() 清掉再决定走哪一层。'],
};

/* EXP-06 折返小迷宫：1 格宽回廊，路线需要两次左转与多次转向。 */
const mazeOpen = corridorCells(
  [1, 1],
  [
    [1, 0, 6],
    [0, 1, 2],
    [-1, 0, 4],
    [0, 1, 2],
    [1, 0, 4],
    [0, 1, 1],
  ],
);
const mazeSolution = `int phase = 0;
int n = 0;
void update() {
  if (enemy_near() && distance_to_enemy() <= 2) { ranged_attack(); return; }
  if (phase == 0) {
    if (n < 6) { n = n + 1; move_forward(); return; }
    phase = 1; n = 0; turn_right(); return;
  }
  if (phase == 1) {
    if (n < 2) { n = n + 1; move_forward(); return; }
    phase = 2; n = 0; turn_right(); return;
  }
  if (phase == 2) {
    if (n < 4) { n = n + 1; move_forward(); return; }
    phase = 3; n = 0; turn_left(); return;
  }
  if (phase == 3) {
    if (n < 2) { n = n + 1; move_forward(); return; }
    phase = 4; n = 0; turn_left(); return;
  }
  if (phase == 4) {
    if (n < 4) { n = n + 1; move_forward(); return; }
    phase = 5; n = 0; turn_right(); return;
  }
  if (n < 1) { n = n + 1; move_forward(); }
  else { wait(); }
}`;
const exp06: SimulationScenario = {
  id: 'exp-06-mini-maze',
  title: '折返小迷宫',
  objective: '窄回廊要求多次转弯：远程拆掉巡逻炮台后，按墙线走到深处出口',
  map: buildRoom(11, 8, mazeOpen, [5, 1], [7, 6], 'turret'),
  enemy: { x: 5, y: 1, hp: 1, attackEvery: 5, range: 3, kind: 'turret' },
  items: [{ x: 3, y: 1, kind: 'energy' }, { x: 7, y: 1, kind: 'energy' }, { x: 5, y: 3, kind: 'energy' }, { x: 3, y: 5, kind: 'energy' }, { x: 5, y: 5, kind: 'energy' }],
  constraint: { require: ['enemy_near()', 'ranged_attack()'], forbid: ['attack()'] },
  starterCode: 'void update() {\n  move_forward();\n}',
  solutionCode: mazeSolution,
  recommendedStrategy: '记忆路线：固定折返转向 + 途中远程拆塔，不能一直 move_forward()',
  difficulty: '中',
  tags: ['maze', 'turning'],
  tactics: ['1 格宽回廊没有掉头空间，转弯顺序就是路线本身。', '地图深处仍有炮台，接近前先用 ranged_attack() 拆掉。'],
};

export const EXPEDITION_ROOM_TEMPLATES: ExpeditionRoomTemplate[] = [
  { id: exp01.id, name: exp01.title, kind: 'combat', difficulty: exp01.difficulty ?? '低', tags: ['open', 'kite', 'tank', 'back'], coreLoop: 'distance gate + back() retreat + ranged_attack', recommendedStrategy: exp01.recommendedStrategy ?? '', scenario: exp01 },
  { id: exp02.id, name: exp02.title, kind: 'combat', difficulty: exp02.difficulty ?? '低', tags: ['corridor', 'melee', 'guard'], coreLoop: 'enemy_ahead + attack + single-line advance', recommendedStrategy: exp02.recommendedStrategy ?? '', scenario: exp02 },
  { id: exp03.id, name: exp03.title, kind: 'combat', difficulty: exp03.difficulty ?? '中', tags: ['central-block', 'turning', 'turret'], coreLoop: 'wall-turn navigation + ranged_attack', recommendedStrategy: exp03.recommendedStrategy ?? '', scenario: exp03 },
  { id: exp04.id, name: exp04.title, kind: 'elite', difficulty: exp04.difficulty ?? '中', tags: ['ring', 'kite', 'turret'], coreLoop: 'wall-turn navigation around enclosed core', recommendedStrategy: exp04.recommendedStrategy ?? '', scenario: exp04 },
  { id: exp05.id, name: exp05.title, kind: 'combat', difficulty: exp05.difficulty ?? '中', tags: ['branch', 'dual-route', 'turning'], coreLoop: 'early ranged kill + route selection', recommendedStrategy: exp05.recommendedStrategy ?? '', scenario: exp05 },
  { id: exp06.id, name: exp06.title, kind: 'elite', difficulty: exp06.difficulty ?? '中', tags: ['maze', 'turning', 'turret'], coreLoop: 'fixed-turn corridor route + ranged_attack', recommendedStrategy: exp06.recommendedStrategy ?? '', scenario: exp06 },
];

export const EXPEDITION_COMBAT_EXTRA: SimulationScenario[] = [exp01, exp02, exp03, exp05];
export const EXPEDITION_ELITE_EXTRA: SimulationScenario[] = [exp04, exp06];
