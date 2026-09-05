import { describe, expect, it } from 'vitest';
import { ExpeditionRun, Simulation, expeditionPool, pickScenario, scaleExpeditionBattle } from '../src/core';
import { EXPEDITION_ROOM_TEMPLATES } from '../src/expeditionRooms';

function walkable(map: string[], x: number, y: number) {
  return y >= 0 && y < map.length && x >= 0 && x < map[y].length && map[y][x] !== '#';
}

function reachable(map: string[], from: [number, number], to: [number, number]) {
  const queue = [from];
  const key = (p: [number, number]) => p[0] + ',' + p[1];
  const seen = new Set<string>([key(from)]);
  while (queue.length) {
    const p = queue.shift()!;
    if (p[0] === to[0] && p[1] === to[1]) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n: [number, number] = [p[0] + dx, p[1] + dy];
      const k = key(n);
      if (!seen.has(k) && walkable(map, n[0], n[1])) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return false;
}

describe('Expedition designed room templates', () => {
  it('ships at least six distinct designed rooms with recommended strategy metadata', () => {
    expect(EXPEDITION_ROOM_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const ids = new Set(EXPEDITION_ROOM_TEMPLATES.map((room) => room.scenario.id));
    expect(ids.size).toBe(EXPEDITION_ROOM_TEMPLATES.length);
    for (const room of EXPEDITION_ROOM_TEMPLATES) {
      expect(room.recommendedStrategy.length).toBeGreaterThan(0);
      expect(room.difficulty.length).toBeGreaterThan(0);
      expect(room.scenario.solutionCode?.length).toBeGreaterThan(0);
    }
  });

  it('keeps every designed room rectangular and marks legal spawn/enemy/exit cells', () => {
    for (const room of EXPEDITION_ROOM_TEMPLATES) {
      const map = room.scenario.map!;
      const width = map[0].length;
      expect(map.length).toBeGreaterThan(2);
      expect(map[0].length).toBe(width);
      for (let y = 0; y < map.length; y++) {
        expect(map[y].length, `${room.id} row ${y}`).toBe(width);
      }
      const spawn = room.scenario.robotSpawn ?? { x: 1, y: 1 };
      expect(map[spawn.y][spawn.x]).toBe('R');
      const enemy = room.scenario.enemy!;
      expect(walkable(map, enemy.x, enemy.y), `${room.id} enemy walkable`).toBe(true);
      const exitY = map.findIndex((row) => row.includes('E'));
      const exitX = exitY >= 0 ? map[exitY].indexOf('E') : -1;
      expect(exitX, `${room.id} has exit`).toBeGreaterThan(0);
      expect(walkable(map, exitX, exitY)).toBe(true);
      expect(reachable(map, [spawn.x, spawn.y], [enemy.x, enemy.y]), `${room.id} enemy reachable`).toBe(true);
      expect(reachable(map, [spawn.x, spawn.y], [exitX, exitY]), `${room.id} exit reachable`).toBe(true);
      for (const item of room.scenario.items ?? []) {
        expect(walkable(map, item.x, item.y), `${room.id} item ${item.x},${item.y}`).toBe(true);
      }
    }
  });

  it('solves every designed room with its shipped firmware, including sonar and late scaling', () => {
    for (const room of EXPEDITION_ROOM_TEMPLATES) {
      for (const modifiers of [undefined, { nearRange: 3 }, { nearRange: 3, rangedRange: 3, maxEnergy: 26 }, { nearRange: 3, rangedRange: 3, maxEnergy: 12, incomingDamage: 0 }]) {
        for (const nodeIndex of [0, 6]) {
          const base = scaleExpeditionBattle(room.scenario, nodeIndex);
          const sim = new Simulation();
          sim.setScenario(base, modifiers, 2026);
          expect(sim.build(room.scenario.solutionCode ?? room.scenario.starterCode).ok, `${room.id} build`).toBe(true);
          sim.reset();
          for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
          expect(sim.status, `${room.id} node ${nodeIndex} mods ${JSON.stringify(modifiers)}`).toBe('success');
        }
      }
    }
  });

  it('makes the six designed room structures appear in real expedition route sampling', () => {
    const required = new Set(EXPEDITION_ROOM_TEMPLATES.map((room) => room.scenario.id));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80 && seen.size < required.size; seed++) {
      const run = new ExpeditionRun(seed);
      while (run.nodeIndex < run.route.length && seen.size < required.size) {
        const node = run.current()!;
        if (['combat', 'elite', 'boss'].includes(node)) {
          const scenario = pickScenario(node as 'combat' | 'elite' | 'boss', run.seed, run.nodeIndex);
          seen.add(scenario.id);
        }
        if (node === 'branch') run.chooseBranch('safe');
        else if (node !== 'combat' && node !== 'elite' && node !== 'boss') {
          run.resolveAction(run.actions()[0].id);
          run.clearNode();
        } else {
          run.clearNode();
        }
      }
    }
    expect(seen.size).toBe(required.size);
  });
  it('shows real pull-kite behavior on EXP-01 with back() and ranged_attack() interleaved', () => {
    const room = EXPEDITION_ROOM_TEMPLATES.find((item) => item.id === 'exp-01-open-arena')!;
    const sim = new Simulation();
    sim.setScenario(scaleExpeditionBattle(room.scenario, 6), { nearRange: 3, rangedRange: 3, maxEnergy: 12 }, 2026);
    sim.build(room.scenario.solutionCode ?? room.scenario.starterCode);
    sim.reset();
    for (let i = 0; i < 260 && sim.status === 'running'; i++) sim.step();
    expect(sim.status).toBe('success');
    const actions = sim.frames.map((frame) => frame.action).filter(Boolean);
    expect(actions.filter((a) => a === 'back').length).toBeGreaterThanOrEqual(2);
    expect(actions.filter((a) => a === 'ranged_attack').length).toBeGreaterThanOrEqual(2);
    const backIndexes = actions.map((a, i) => (a === 'back' ? i : -1)).filter((i) => i >= 0);
    const rangedIndexes = actions.map((a, i) => (a === 'ranged_attack' ? i : -1)).filter((i) => i >= 0);
    expect(backIndexes.some((bi) => rangedIndexes.some((ri) => ri > bi))).toBe(true);
  });
});
