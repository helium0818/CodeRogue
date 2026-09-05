export type DungeonRoomType='start'|'combat'|'event'|'exit';
export type DungeonKind='slime'|'swarm'|'turret'|'tank'|'runner'|'guard';
export interface DungeonEnemy{x:number;y:number;hp:number;kind:DungeonKind;moveEvery?:number;attackEvery?:number;range?:number}
export interface DungeonItem{x:number;y:number;kind:'energy'|'heal'}
export interface DungeonRoom{id:string;type:DungeonRoomType;x:number;y:number;width:number;height:number;interior:string[];spawn?:{x:number;y:number};enemy?:DungeonEnemy;items:DungeonItem[];exit?:{x:number;y:number}}
export interface DungeonCorridor{id:string;cells:{x:number;y:number}[]}
export interface DungeonDoor{id:string;roomId:string;corridorId:string;roomCell:{x:number;y:number};corridorCell:{x:number;y:number}}
export interface DungeonLayout{width:number;height:number;rooms:DungeonRoom[];corridors:DungeonCorridor[];doors:DungeonDoor[]}
export function roomAt(layout:DungeonLayout,gx:number,gy:number):DungeonRoom|null{for(const room of layout.rooms){if(gx>=room.x&&gx<room.x+room.width&&gy>=room.y&&gy<room.y+room.height){return room}}return null}
export function isInteriorFloor(room:DungeonRoom,gx:number,gy:number):boolean{const lx=gx-room.x;const ly=gy-room.y;if(lx<0||ly<0||ly>=room.interior.length)return false;const row=room.interior[ly];if(!row||lx>=row.length)return false;return row[lx]==='.'}
export function walkableAt(layout:DungeonLayout,gx:number,gy:number):boolean{const room=roomAt(layout,gx,gy);if(room)return isInteriorFloor(room,gx,gy);return layout.corridors.some(c=>c.cells.some(p=>p.x===gx&&p.y===gy))}

type Grid=string[][];
function makeGrid(width:number,height:number):Grid{return Array.from({length:height},()=>Array.from({length:width},()=> '#'))}
function carve(grid:Grid,x:number,y:number){if(y>=0&&y<grid.length&&x>=0&&x<grid[y].length)grid[y][x]='.'}
function toInterior(grid:Grid):string[]{return grid.map(row=>row.join(''))}
function room(w:number,h:number,grid:Grid){return{w,h,grid}}

function buildRoom(id:string,type:DungeonRoomType,ox:number,oy:number,width:number,height:number,draw:(grid:Grid)=>void):DungeonRoom{
  const grid=makeGrid(width,height);
  draw(grid);
  return{id,type,x:ox,y:oy,width,height,interior:toInterior(grid),items:[]};
}

export function createDemoDungeon():DungeonLayout{
  const start=buildRoom('r0','start',13,14,8,4,grid=>{
    carve(grid,3,0);       // top door at x16,y14
    carve(grid,1,1);       // spawn local (1,1) => x14,y15
    carve(grid,2,1);
    carve(grid,3,1);       // walk to W1 wall; local4 (x17) stays wall
    carve(grid,3,2);       // small pre-open (decor only, robot does not need it)
  });
  start.spawn={x:1,y:1};

  const combat=buildRoom('r1','combat',14,9,7,4,grid=>{
    carve(grid,2,0);       // top door x16,y9
    carve(grid,2,1);
    carve(grid,2,2);       // enemy lane
    carve(grid,2,3);       // bottom door x16,y12
  });
  combat.enemy={x:2,y:2,hp:2,kind:'slime',moveEvery:9999,attackEvery:3};

  const event=buildRoom('r2','event',14,1,9,7,grid=>{
    // vertical approach column x16 (local2) from bottom door up to C
    carve(grid,2,4);       // C junction at x16,y5
    carve(grid,2,5);
    carve(grid,2,6);       // bottom door x16,y7
    // west wrong-loop square: x15..x16 x y5..y6
    carve(grid,1,4);
    carve(grid,1,5);
    // east supply corridor row y5: x17..x22 (local3..8)
    carve(grid,3,4); carve(grid,4,4); carve(grid,5,4); carve(grid,6,4); carve(grid,7,4); carve(grid,8,4);
    // supply-side doors at event row y5 east side are interior boundary rows (see doors)
  });
  event.items=[
    {x:1,y:5,kind:'energy'}, // ring trap supply, keeps wrong loop visible one lap
    {x:3,y:4,kind:'energy'},
    {x:5,y:4,kind:'heal'},
    {x:6,y:4,kind:'energy'}
  ];

  const exitRoom=buildRoom('r3','exit',25,1,5,7,grid=>{
    carve(grid,0,4);       // west door x25,y5
    carve(grid,1,4);
    carve(grid,2,4);
    carve(grid,3,4);
    carve(grid,4,4);
  });
  exitRoom.exit={x:4,y:4};

  const corridors: DungeonCorridor[]=[
    {id:'c0',cells:[{x:16,y:13}]},
    {id:'c1',cells:[{x:16,y:8}]},
    {id:'c2',cells:[{x:23,y:5},{x:24,y:5}]}
  ];
  const doors: DungeonDoor[]=[
    {id:'d0',roomId:'r0',corridorId:'c0',roomCell:{x:16,y:14},corridorCell:{x:16,y:13}},
    {id:'d1',roomId:'r1',corridorId:'c0',roomCell:{x:16,y:12},corridorCell:{x:16,y:13}},
    {id:'d2',roomId:'r1',corridorId:'c1',roomCell:{x:16,y:9},corridorCell:{x:16,y:8}},
    {id:'d3',roomId:'r2',corridorId:'c1',roomCell:{x:16,y:7},corridorCell:{x:16,y:8}},
    {id:'d4',roomId:'r2',corridorId:'c2',roomCell:{x:22,y:5},corridorCell:{x:23,y:5}},
    {id:'d5',roomId:'r3',corridorId:'c2',roomCell:{x:25,y:5},corridorCell:{x:24,y:5}}
  ];
  return{width:30,height:18,rooms:[start,combat,event,exitRoom],corridors,doors};
}