import { it } from 'vitest';
import { PURSUIT_LABYRINTH, simulateRogueCombat } from '../src/finalRogueRun';
function variant(base:string,leftMask:number,max=6){let terms:string[]=[];for(let c=0;c<max;c++){if((leftMask>>c)&1)terms.push(`corner==${c}`)}const cond=terms.length?terms.join('||'):'false';const needle=`if (corner == 0 || corner == 3) { turn_left(); } else { turn_right(); }`;const rep=`if (${cond}) { turn_left(); } else { turn_right(); }`;if(!base.includes(needle))throw new Error('needle');return base.replace(needle,rep)}
it('schedule search',()=>{
 const base=`int corner = 0;
void navigate() { if (wall_ahead()) { if (corner == 0 || corner == 3) { turn_left(); } else { turn_right(); } corner = corner + 1; return; } move_forward(); }
void update(){ if(enemy_ahead()){attack();return;} navigate(); }`;
 const cbase=`int corner = 0; bool retreat = false;
void navigate() { if (wall_ahead()) { if (corner == 0 || corner == 3) { turn_left(); } else { turn_right(); } corner = corner + 1; return; } move_forward(); }
void update(){ if(enemy_ahead()){attack();return;} if(retreat){back();retreat=false;return;} if(distance_to_enemy()<=2){ranged_attack();retreat=true;return;} navigate(); }`;
 for(let m=0;m<64;m++){
   const pat=variant(base,m); const con=variant(cbase,m);
   const a=simulateRogueCombat(PURSUIT_LABYRINTH,pat);const b=simulateRogueCombat(PURSUIT_LABYRINTH,con);
   console.log('mask',m,'pat',a.success,a.hp,'con',b.success,b.hp,b.ticks);
 }
});