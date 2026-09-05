import { describe, it, expect } from 'vitest';
import { DEMO_DUNGEON_SCENARIO, Simulation } from '../src/core';
import { DungeonLayout, roomAt, walkableAt } from '../src/dungeon';

const STARTER = 'void update() {\n  if (enemy_ahead()) { attack(); }\n  else { move_forward(); }\n}';
const LEFT_FIX = 'void update() {\n  if (enemy_ahead()) { attack(); return; }\n  if (wall_ahead()) { turn_left(); }\n  else { move_forward(); }\n}';
const FINAL = 'void update() {\n  if (enemy_ahead()) { attack(); return; }\n  if (wall_ahead()) {\n    if (low_energy()) { turn_right(); }\n    else { turn_left(); }\n  } else {\n    move_forward();\n  }\n}';

function runTo(sim: Simulation, stop: (s: Simulation) => boolean, maxTicks = 160): Simulation {
  for (let i = 0; i < maxTicks && sim.status === 'running' && !stop(sim); i++) sim.step();
  return sim;
}
function startSim(): Simulation {
  const sim = new Simulation();
  sim.setScenario(DEMO_DUNGEON_SCENARIO);
  sim.build(DEMO_DUNGEON_SCENARIO.starterCode);
  return sim;
}

describe('redesigned dungeon navigation slice', () => {
  it('keeps four separated rooms, a real 2D branch, and a walkable corridor graph', () => {
    const layout = DEMO_DUNGEON_SCENARIO.dungeon!;
    expect(layout.rooms.map(r => r.type)).toEqual(['start', 'combat', 'event', 'exit']);
    expect(roomAt(layout, 16, 15)?.type).toBe('start');
    expect(roomAt(layout, 16, 11)?.type).toBe('combat');
    expect(roomAt(layout, 16, 5)?.type).toBe('event');
    expect(roomAt(layout, 29, 5)?.type).toBe('exit');
    expect(walkableAt(layout, 15, 5)).toBe(true);   // wrong-loop west arm
    expect(walkableAt(layout, 15, 6)).toBe(true);   // wrong-loop bottom arm
    expect(walkableAt(layout, 17, 5)).toBe(true);   // supply branch east arm
  });

  it('lets the starter firmware fail at W1 without ever reaching Combat', () => {
    const sim = startSim();
    sim.build(STARTER);
    sim.reset();
    runTo(sim, s => s.status !== 'running', 40);
    expect(sim.status).toBe('failed');
    expect(sim.robot.x).toBe(16);
    expect(sim.robot.y).toBe(15);
    expect(sim.robot.roomId).toBe('r0');
    expect(sim.frames.slice(-3).every(f => f.robot.x === 16 && f.robot.y === 15)).toBe(true);
  });

  it('lets the first fix survive the W1 turn and pass through Combat', () => {
    const sim = startSim();
    sim.build(LEFT_FIX);
    sim.reset();
    runTo(sim, s => s.enemy.hp === 0, 60);
    expect(sim.enemy.hp).toBe(0);
    expect(sim.frames.some(f => f.robot.roomId === 'r1')).toBe(true);
    expect(sim.status).toBe('running');
  });

  it('lets the first fix enter the west wrong loop after W2 and visibly repeat a position', () => {
    const sim = startSim();
    sim.build(LEFT_FIX);
    sim.reset();
    const visits: Record<string, number> = {};
    let repeats = 0;
    let sawLoopArm = false;
    for (let i = 0; i < 120 && sim.status === 'running'; i++) {
      sim.step();
      const frame = sim.frames[sim.frames.length - 1];
      if (frame.robot.x === 15 && (frame.robot.y === 5 || frame.robot.y === 6)) sawLoopArm = true;
      if (frame.robot.roomId === 'r2' && frame.robot.x === 16 && frame.robot.y === 5 && frame.action === 'turn_left') {
        const key = `${frame.robot.x},${frame.robot.y}:turn`;
        visits[key] = (visits[key] ?? 0) + 1;
        if (visits[key] > 1) { repeats++; break; }
      }
    }

    expect(sawLoopArm).toBe(true);
    expect(repeats).toBeGreaterThan(0);
    expect(sim.status).toBe('running');
  });

  it('makes the final solution turn right at W2 only because low_energy() is true', () => {
    const sim = startSim();
    sim.build(FINAL);
    sim.reset();
    let rightTurn: { tick: number; energy: number; sensor: boolean } | undefined;
    let movedEast = false;
    for (let i = 0; i < 120 && sim.status === 'running'; i++) {
      sim.step();
      const frame = sim.frames[sim.frames.length - 1];
      if (!rightTurn && frame.action === 'turn_right') {
        rightTurn = {
          tick: frame.tick,
          energy: frame.robot.energy,
          sensor: frame.sensors.some(s => s.name === 'low_energy' && s.value === true)
        };
      }
      if (rightTurn && frame.robot.x > 16 && frame.robot.roomId === 'r2') movedEast = true;
      if (rightTurn && movedEast && frame.robot.x === 17) break;
    }
    expect(rightTurn).toBeDefined();
    expect(rightTurn!.sensor).toBe(true);
    expect(rightTurn!.energy).toBeLessThanOrEqual(5);
    expect(movedEast).toBe(true);
    expect(sim.frames.some(f => f.robot.x === 16 && f.robot.y === 5 && f.sensors.some(s => s.name === 'low_energy' && s.value === true))).toBe(true);
  });

  it('never triggers low_energy at the W1 turn and keeps a stable low-energy checkpoint at W2', () => {
    const sim = startSim();
    sim.build(FINAL);
    sim.reset();
    let w1Low: boolean | undefined;
    let w2Energy: number | undefined;
    for (let i = 0; i < 120 && sim.status === 'running'; i++) {
      sim.step();
      const frame = sim.frames[sim.frames.length - 1];
      if (w1Low === undefined && frame.robot.x === 16 && frame.robot.y === 15 && frame.action === 'turn_left') {
        w1Low = frame.sensors.some(s => s.name === 'low_energy' && s.value === true);
      }
      if (frame.robot.x === 16 && frame.robot.y === 5 && frame.robot.roomId === 'r2' && frame.action === 'turn_right') {
        w2Energy = frame.robot.energy;
      }
      if (frame.robot.x === 29 && frame.robot.y === 5) break;
    }
    expect(sim.status).toBe('success');
    expect(w1Low).toBe(false);
    expect(w2Energy).toBeDefined();
    expect(w2Energy!).toBeLessThanOrEqual(5);
    expect(sim.robot.roomId).toBe('r3');
    expect(sim.enemy.hp).toBe(0);
  });

  it('keeps snapshot/rollback consistent for dungeon world and interpreter globals', () => {
    const sim = startSim();
    const codeWithState = 'int n = 0;\nvoid update() {\n  n = n + 1;\n  if (enemy_ahead()) { attack(); return; }\n  if (wall_ahead()) { turn_left(); }\n  else { move_forward(); }\n}';
    sim.build(codeWithState);
    sim.reset();
    for (let i = 0; i < 18 && sim.status === 'running'; i++) sim.step();
    const snap = sim.snapshot();
    const snapTick = sim.tick;
    const snapGlobal = (sim.interpreter?.globals ?? {}).n;
    const snapRobot = { ...sim.robot };
    const snapEnemy = { ...sim.enemy };
    const snapItems = sim.items.map(i => ({ ...i }));
    const snapExit = sim.exitPoint ? { ...sim.exitPoint } : undefined;
    for (let i = 0; i < 6 && sim.status === 'running'; i++) sim.step();
    expect(sim.tick).not.toBe(snapTick);
    sim.rollback(snap);
    expect(sim.tick).toBe(snapTick);
    expect(sim.robot).toEqual(snapRobot);
    expect(sim.enemy).toEqual(snapEnemy);
    expect(sim.items).toEqual(snapItems);
    expect(sim.exitPoint).toEqual(snapExit);
    expect((sim.interpreter?.globals ?? {}).n).toBe(snapGlobal);
    expect(sim.frames.length).toBe(snap.frames.length);
    sim.resume();
    sim.step();
    expect(sim.tick).toBe(snapTick + 1);
  });

  it('syncs enemy roomId when an enemy walks out of its room into a corridor', () => {
    const layout: DungeonLayout = {
      width: 12, height: 4,
      rooms: [
        { id: 'r0', type: 'start', x: 8, y: 0, width: 4, height: 4, interior: ['....', '....', '....', '....'], spawn: { x: 0, y: 0 }, items: [] },
        { id: 'r1', type: 'combat', x: 0, y: 0, width: 4, height: 4, interior: ['....', '....', '....', '....'], enemy: { x: 0, y: 0, hp: 30, kind: 'slime', moveEvery: 1, attackEvery: 1000 }, items: [] }
      ],
      corridors: [{ id: 'c0', cells: [{ x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }] }],
      doors: [
        { id: 'd0', roomId: 'r0', corridorId: 'c0', roomCell: { x: 8, y: 0 }, corridorCell: { x: 7, y: 0 } },
        { id: 'd1', roomId: 'r1', corridorId: 'c0', roomCell: { x: 3, y: 0 }, corridorCell: { x: 4, y: 0 } }
      ]
    };
    const sim = new Simulation();
    sim.setScenario({ id: 'sync-test', title: 'sync', objective: 'sync', dungeon: layout, starterCode: 'void update(){ wait(); }', solutionCode: 'void update(){ wait(); }', tactics: [] });
    sim.build('void update(){ wait(); }');
    sim.reset();
    expect(sim.enemy.roomId).toBe('r1');
    for (let i = 0; i < 12 && sim.status === 'running' && sim.enemy.roomId === 'r1'; i++) sim.step();
    expect(sim.enemy.roomId).toBeNull();
    expect(sim.enemy.x).toBeGreaterThanOrEqual(4);
  });
});