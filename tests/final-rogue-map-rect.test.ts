import { describe, expect, it } from 'vitest';
import { FIRE_CONTROL_CORE, PURSUIT_LABYRINTH, rogueDungeon, SECURITY_COMPLEX } from '../src/finalRogueRun';

describe('Final Rogue map rectangular invariant', () => {
  const encounters = [PURSUIT_LABYRINTH, SECURITY_COMPLEX, FIRE_CONTROL_CORE];

  it.each(encounters.map((enc) => [enc.id, enc] as const))('%s rows all equal declared width/height', (_id, enc) => {
    expect(enc.ascii).toHaveLength(enc.height);
    for (let y = 0; y < enc.ascii.length; y++) {
      expect(enc.ascii[y].length, `row ${y}`).toBe(enc.width);
    }
    expect(new Set(enc.ascii.map((row) => row.length)).size).toBe(1);
  });

  it('rogueDungeon interiors are strictly rectangular', () => {
    for (const enc of encounters) {
      const layout = rogueDungeon(enc);
      const room = layout.rooms[0];
      expect(room.interior).toHaveLength(enc.height);
      for (let y = 0; y < room.interior.length; y++) {
        expect(room.interior[y].length, `${enc.id} row ${y}`).toBe(enc.width);
      }
    }
  });
});