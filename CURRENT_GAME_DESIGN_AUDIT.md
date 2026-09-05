# CodeRogue 当前实现完整审计说明书

> 依据：当前工作区实际源码（src/core.ts、src/language.ts、src/dungeon.ts、src/tactical.ts、src/tacticalRun.ts、src/App.vue、tests/*）。
> 原则：源码 > 测试 > 文档；文档与源码不一致处以源码为准，并单独标记。
> 本文件为只读审计产物，不代表“应该怎样设计”。

---

## 0. 当前可进入的模式树（按真实入口）

```
CodeRogue
├── Story Mode（教学模式）           URL: /?demo=story 或顶栏“教学关卡”
│   ├── 0-1 First Boot
│   ├── 0-2 The Wall
│   ├── 1-1 Decision
│   ├── 2-1 Counter Route
│   ├── 2-2 Toggle Corridor
│   ├── 3-1 Ranged First
│   └── 3-2 Shield Rhythm
├── Expedition Mode（Rogue 远征）     URL: /（默认）或顶栏“远征模式”
│   ├── route nodes: combat / branch / elite / event / shop / rest / boss
│   ├── 内部战斗 pool：combat×5、elite×4、boss×2
│   └── Defense Demo 复用 Expedition：/?demo=defense 或顶栏“答辩演示”
├── Dungeon Demo（固定 Dungeon Slice） URL: /?demo=dungeon 或顶栏“地牢演示”
├── Tactical Standalone（单房战术）    URL: /?demo=tactical 或顶栏“战术房”
│   ├── Runner Arena（RETREAT / KITE）
│   ├── Guard Arena（CLOSE IN / MELEE）
│   └── Turret Arena（MINIMIZE EXPOSURE）
├── Tactical Run（连续战术房）         URL: /?demo=tactical-run 或顶栏“战术连跑”
│   ├── Runner → Reward → Guard → Rest → Turret → Complete
└── Tutorial（新手引导弹窗，可跳过/重开）
```

模式总览速查（详见各章）：

| 入口 | URL 参数 | 真实可玩 | 类别 | 共享系统 |
|---|---|---|---|---|
| Story | `?demo=story` | 是 | 教学 | Simulation / Interpreter / Debugger UI |
| Expedition | 无（默认） | 是 | Rogue | Simulation / ExpeditionRun / modules / meta |
| Dungeon Demo | `?demo=dungeon` | 是 | 固定地牢演示 | dungeon Simulation |
| Tactical Standalone | `?demo=tactical` | 是 | tactical 单房 | dungeon Simulation / Debugger |
| Tactical Run | `?demo=tactical-run` | 是 | run 编排 | tactical scenarios / TacticalRunState |
| Defense Demo | `?demo=defense` | 是 | 答辩远征演示 | ExpeditionRun + auto/semi-auto UI |

> 注意：Story 的 URL 只改变启动模式；页面默认是 Expedition。

---
## 1. 全局执行与状态事实（来自源码）

### 1.1 核心类型与默认值

- `Robot` 初始（任意非 dungeon reset）：`x=1,y=1,dir='E',hp=5,energy=20,roomId=null`。
- `Enemy` 初始：`x=-1,y=-1,hp=0,kind='slime'`。
- `SimulationModifiers` 默认：`maxHp=5, maxEnergy=20, attackPower=1, moveEnergyCost=1, incomingDamage=1`。
- 可选 modifiers：`startingHp`, `energyRegenEvery`, `rangedPower`, `nearRange`(默认2), `rangedRange`(默认2)。

### 1.2 Simulation 生命周期

- `selectLevel(i)`：切 Story，清 scenario/dungeon/modifiers，reset，状态 idle。
- `setScenario(scenario, modifiers, seed)`：保留 scenario 副本，套用 modifiers，reset，状态 idle。
- `reset()`：
  - dungeon 路径：从 start 房生成 robot、combat 房生成 enemy、所有 room.items 转全局 items、exit room 生成 exitPoint；清空 frames/breakpoint hit/watch/coredump；HP=startingHp??maxHp，Energy=maxEnergy。
  - 旧 map 路径：从字符串 map 初始化，robot 固定 (1,1) E。
  - 状态设为 running，message=Running。
- `step()`：执行 interpreter 一拍 → resolveEnemy → 能量回复（如有）→ 拾取 → 出口/HP/错误判定 → watchpoint/breakpoint → push frame。
- frames 上限 200，超过后移除最早的 frame。

### 1.3 文档与源码不一致的明确记录

- `ROADMAP.md`、`TASKS.md`、`GAME_DESIGN.md` 包含许多“规划中”内容；本文件只把源码里真正存在的行为算作“已实现”。
- 文档中旧描述“Dungeon UI pending”已过时；源码中 dungeon UI 已实现。
- Tactical Run 文档与源码中的 `hotReloads/debugInterventions` 计数已存在。

---

## 2. RoboC++ 语言（src/language.ts）

### 2.1 词法与语法

- 类型：`int`, `bool`, `int[]`, `bool[]`。
- 函数返回：`void`, `int`, `bool`；`update()` 必须存在、必须 void、无参数。
- 语句：block、if/else、for（maxIterations=64）、return、表达式语句、变量声明、赋值（含数组下标）。
- 表达式：数字/布尔字面量、变量、数组读、`!`、`-`、`+ - * / % < <= > >= == != && ||`；括号。
- 注释：`//`。
- 全局变量在每 tick 间保留；函数内局部变量每次 update 重建。
- for 限制 64 次；操作预算每 tick 500；函数调用深度 32。
- 整数除法是 `Math.trunc`。
- 数组默认长度由声明指定，`int a[]`/`bool a[]` 无大小时默认 4；长度裁剪到 1..32。
- 当前不支持的语法：while、switch、对象/字典、字符串、闭包、动态数组 resizing、break/continue、枚举、结构体、多返回值、运算符重载。

### 2.2 Sensor（实际函数）

| Sensor | 返回 | 精确语义 | 真实用于哪些内容 |
|---|---|---|---|
| `wall_ahead()` | bool | 正前方一格不是 walkable 则为 true | Story 0-2/1-1/2-x；Expedition 多数；Dungeon/Tactical 导航 |
| `enemy_ahead()` | bool | 正前方一格有活动敌人 | Story 1-1/3-2；Expedition melee；Guard tactical |
| `enemy_near()` | bool | Manhattan 距离 ≤ nearRange(默认2) | Story 3-1；Expedition ranged；Runner/Turret starter |
| `low_hp()` | bool | robot.hp ≤ 2 | 语言存在；当前主要测试用/可手写 |
| `low_energy()` | bool | robot.energy ≤ 5 | Dungeon demo final（W2）；Tactical Run 玩家可手写 |
| `distance_to_enemy()` | int | Manhattan 距离；enemy 死亡返回 99 | Runner/Turret/Guard tactical final；Expedition 可手写 |
| `enemy_x()` | int | 敌人 x | 语言存在，游戏中无固定使用点 |
| `enemy_y()` | int | 敌人 y | 同上 |
| `steps_to_wall()` | int | 当前朝向前方连续可走格数（上限10） | 语言存在，无固定关卡必需 |
| `enemy_hp()` | int | 敌人 HP | Tactical final；Guard/Turret/Runner 行为 |

### 2.3 Action（实际函数）

| Action | 行为 | 能量 | 限制/细节 | 真实必需处 |
|---|---|---|---|---|
| `move_forward()` | 向前 1 格 | 1 | 墙/敌人挡路仍扣 1 | 几乎全部 |
| `turn_left()` / `turn_right()` | 转 90° | 1 | —— | Story/导航 |
| `wait()` | 无效果 | 0 | 仅消耗一拍 | 参考/占位 |
| `attack()` | 正前方相邻敌人 -1（或 modifier 伤害） | 1 | guard 也生效 | Story 1-1/3-2；Expedition；Guard |
| `ranged_attack()` | Manhattan ≤ rangedRange(默认2) 敌人 -1 | 2 | guard 会吸收但耗能 | Story 3-1；Expedition；Runner/Turret |
| `shield()` | 设置 shieldReady=true | 2 | 下一次敌人伤害 -1，随后清空；runner 自爆不免疫 | Story 3-2；Guard/Tactical |
| `dash()` | 沿当前方向最多 2 格 | 2 | 遇墙/敌人停止 | Turret final；可手写 |
| `back()` | 沿反方向 1 格 | 1 | 墙/敌人阻挡仍扣 1 | Runner final |
| `repair()` | hp+1 | 3 | 仅 hp<max | 语言存在，主要 Story 不用 |
| `pulse/repair_manual` | 非语言 API，Expedition UI 特殊按钮 | 3/4 | 远征按钮 | Expedition UI |

---

## 3. Debugger / Trace 能力（按真实实现）

### 3.1 Breakpoint

- UI：Story 与 dungeon/tactical 编辑区下方“断点调试”；输入源码行 → 设置断点/清除。
- 核心：`sim.setBreakpoint(line)` 加入 Set；step 中若命中且本 reset 未命中过 → status=paused、event=BREAKPOINT。
- 保留：世界状态、trace 到当前帧、interpreter globals。
- 丢失：命中后继续自动运行前需 resume；同一行本 reset 只命中一次。
- 实际使用：Story 教学；Dungeon/Tactical 可作为人工调试；Tactical Run 统计不自动触发（UI 手动操作才计入 debug count）。
- 结论：Debugger 是可选工具，并非通关必要条件。

### 3.2 Pause / Resume

- UI：暂停/继续按钮；空格键；状态 running/paused。
- 核心：`pause()`/`resume()` 只改状态；App 定时器 clearInterval / startTimer。
- 保留：全部世界/trace/interpreter；暂停期间 step 不前进。

### 3.3 Single-step

- UI：单步按钮在 Expedition 和 dungeon/tactical 模式。
- 核心：`stepOnce()`：build if needed；若终端状态先 reset；再 step；每点击走 1 tick。
- 保留：世界状态；Trace 增长。
- 使用：手动调试；Tactical Run 中计入 Debugger Intervention。

### 3.4 Hot Reload

- UI：paused 时出现“热重载”。
- 核心：`sim.hotReload(code)` 仅 paused/idle；snapshot 后 build，若成功恢复 robot/enemy/tick/frames/interpreter globals。
- 保留：世界、trace、计时中断。
- 丢失：若编译失败不会应用；玩家代码变更是 App 状态。
- Tactical Run：成功 hot reload 会计入 Firmware Revisions + Debugger Interventions。

### 3.5 Watchpoint

- UI：输入变量名 → 添加/清除。
- 核心：变量名匹配 `/^[A-Za-z_][A-Za-z0-9_]*$/`；每 tick 首次建立基线，之后值变化且 running → paused + `WATCHPOINT:<name>` event。
- 只跟踪 interpreter 返回的变量环境。
- 实际使用：可作为 Story/Tactical 调试；不是通关要求。

### 3.6 Snapshot / Rollback

- UI：保存快照 / 回滚（Story、dungeon/tactical 调试区）。
- 核心：snapshot 深拷贝 map/robot/enemy/items/frames/scenario/interpreter globals；rollback 恢复并重设 dungeon/exit。
- 保留：世界、trace、interpreter globals。
- 丢失：App 的 `code` 文本不在 snapshot 内（rollback 不回滚源码）。
- 跨 scenario rollback 不安全；Tactical Run 不要求跨房 snapshot。

### 3.7 Execution Trace / Core dump

- 每 tick push Frame：tick、sourceLine、robot/enemy、variables、sensors、action、events、error；上限200。
- Timeline UI 可点击选中帧；右侧显示动作、源码行、坐标、HP、sensor、变量、事件。
- Core dump 在 runtime error 或 hp=0 时生成：原因、位置、变量、最近12帧。
- UI：控制台与底部面板展示。

---

## 4. 敌人（源码实际存在：slime / swarm / turret / tank / runner / guard）

通用 resolve 顺序（每 tick robot action 后）：

```
if enemy.hp<=0 return
distance=Manhattan
attackEvery = (attackEvery ?? (swarm?1:3)) + jitter - enraged?1:0
enrage: hp <= ceil(maxHp/2) → attackEvery 减 1（更快）
若距离满足 && tick%attackEvery==0：
   damage=incomingDamage(default1) (+ tank +1；swarm enrage +1；第5次攻击+1)
   shield 会先 -1
若 turret：不再移动
否则 moveEvery 满足则 BFS 向 robot 走一步
runner：若贴脸且命中节奏 → 直接 robot.hp=0、enemy移除（无视 shield）
```

### 4.1 Slime

- HP 常见：Story/exp 2、Dungeon 2、Tactical Guard 不是。
- 参数实例：Story1-1 hp2 无 cadence（默认 kind 未写→按 slime 默认 move3/attack3）；exp variants 可能 moveEvery=2/attackEvery=3。
- 行为：接触（dist≤1）后按 cadence 攻击；会向 robot 移动。
- 使用：Story 1-1、3-2、Expedition combat/elite 变体、Dungeon Demo、Defense elite may not；Tactical 无单独 slime。

### 4.2 Swarm

- 基例：hp2、moveEvery1、attackEvery3（如 exp-combat）。
- 行为：每 tick 逼近；接触后按 cadence 攻击；enrage 时 damage+1。
- 使用：Expedition combat variants。

### 4.3 Turret

- 参数：exp elite hp3 attackEvery4 range3；Tactical turret hp1 attackEvery2 range5。
- 行为：**不移动**；攻击只看 Manhattan 距离≤range，不看墙/视线（无 LOS）。
- 使用：Expedition elite；Tactical Turret。

### 4.4 Tank

- 参数：boss hp5、moveEvery4、attackEvery4；late scaled hp+2、cadence更快。
- 行为：contact damage base+1；移动慢。
- 使用：Expedition boss variants。

### 4.5 Runner

- 参数：exp-combat-d hp1、moveEvery1、attackEvery1；Tactical Runner hp2 moveEvery1 attackEvery4。
- 行为：接触若命中节奏 → **自爆**：robot.hp=0、enemy 消失、shield 无法挡。
- 使用：Expedition combat variant；Tactical Runner。

### 4.6 Guard

- 参数：exp-elite-d hp3 moveEvery4 attackEvery4；Tactical Guard hp6 moveEvery1000 attackEvery4。
- 行为：ranged_attack 命中无效但扣能量；近战 attack 有效；接触伤害与 shield 规则同普通。
- 使用：Expedition elite variant；Tactical Guard。
- 说明：source 中 `ranged_attack` 对 guard 只是 message “护盾吸收了远程火力”并扣2能量；enemy_hp 不变。

---

## 5. Story 教学关卡（7 关）

所有 Story 关卡使用旧 `map:string[]` 路径：robot reset 固定 (1,1)、朝向 E；出口为 map 中 `E`；`R/S` 是显示字符，reset 不读取 R/S 作为 spawn/敌人坐标（敌人坐标来自 level.enemy）。

关卡没有独立 `solutionCode` 字段；`LEVEL_STARTER_CODE[id]` 同时也是仓库测试确认能通关的程序。

### 5.1 0-1 First Boot

Map：
```
########
#R....E#
########
```
Robot：(1,1) E；Enemy 无；Item 无；Exit：map row1 `E`（x6）；地图 8×3。

Starter：
```cpp
void update() {
  move_forward();
}
```
流程：连续 move 直到踩到 E，success。sensor 无。不需要 Debugger。教学：最基础 move。

### 5.2 0-2 The Wall

Map：
```
########
#R.....#
#..##..#
#.....E#
########
```
Robot：(1,1) E；Enemy 无；Exit row3；墙内部隔段。

Starter：
```cpp
void update() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
```
流程：wall_ahead 探测 → 前方墙转右。教学：条件分支。

### 5.3 1-1 Decision

Map：
```
########
#R..S.E#
#......#
#......#
########
```
Robot：(1,1) E；Enemy `{x:4,y:1,hp:2}`（实际也是 slime 默认）；Exit row1 E。

Starter：
```cpp
void update() {
  if (enemy_ahead()) { attack(); }
  else if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
```
流程：先 attack 至敌人死亡，再 move 到 E。教学：sensor 顺序与 combat。

### 5.4 2-1 Counter Route

Map：
```
########
#R....##
#####.##
#####.E#
########
```
Robot：(1,1) E；无敌人。Starter：
```cpp
int walls = 0;
void update() {
  if (wall_ahead()) {
    walls = walls + 1;
    if (walls == 2) { turn_left(); }
    else { turn_right(); }
  } else { move_forward(); }
}
```
教学：全局 int 计数跨 tick。测试也验证无状态 wall-follow 在此关不能通过。

### 5.5 2-2 Toggle Corridor

Map：
```
########
#R....##
#####.##
#####..#
######E#
########
```
Starter：
```cpp
bool turn_left_next = false;
void update() {
  if (wall_ahead()) {
    if (turn_left_next) { turn_left(); }
    else { turn_right(); }
    turn_left_next = !turn_left_next;
    return;
  }
  move_forward();
}
```
教学：bool 状态翻转、return 提前结束 update。

### 5.6 3-1 Ranged First

Map：
```
##########
#R...S..E#
##########
```
Enemy `{x:5,y:1,hp:1}`；Exit row1 E x8。Starter：
```cpp
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { move_forward(); }
}
```
教学：enemy_near/range。

### 5.7 3-2 Shield Rhythm

Map：
```
########
#RS...E#
########
```
Enemy `{x:2,y:1,hp:4,attackEvery:1}`（每 tick 接触攻击）。Starter：
```cpp
bool defend_next = true;
void update() {
  if (enemy_ahead()) {
    if (defend_next) { shield(); }
    else { attack(); }
    defend_next = !defend_next;
  } else { move_forward(); }
}
```
教学：shield/attack 节奏交替。

> 观察：7 关 starter 均由源码提供且测试可通关；它们同时充当“参考答案”。仓库没有单独的 Story solutionCode。

---

## 6. Dungeon Demo（固定 Dungeon Slice）

入口：`/?demo=dungeon`；展示一个固定的 4-room dungeon，不是随机生成。

### 6.1 数据坐标（真实来自 `createDemoDungeon()`）

布局 bounds：`width=30, height=18`。

| room | bbox | interior 关键 | 实体 |
|---|---|---|---|
| r0 START | x13..20, y14..17 | 顶门 x16,y14；通道 x14-16,y15；W1 墙 x17,y15 | spawn (14,15) 朝 E |
| r1 COMBAT | x14..20, y9..12 | 竖列 x16 全通；敌人 local(2,2) | slime HP2, moveEvery9999, attackEvery3 → global(16,11) |
| r2 EVENT | x14..22, y1..7 | 垂直 x16；W2 C=(16,5)；西回环 x15/y5、y6；东补给 y5 | energy(15,6), energy(17,5), heal(19,5), energy(20,5) |
| r3 EXIT | x25..29, y1..7 | 横排 y5 | exit (29,5) |

corridors：c0=(16,13)；c1=(16,8)；c2=(23,5),(24,5)。

doors（roomCell → corridorCell）：
d0 r0(16,14)→(16,13)；d1 r1(16,12)→(16,13)；d2 r1(16,9)→(16,8)；d3 r2(16,7)→(16,8)；d4 r2(22,5)→(23,5)；d5 r3(25,5)→(24,5)。

W1/W2 只是 UI 展示标记，不是 dungeon 数据字段：App 中 marker `W1=(17,15)`、`W2=(16,5)`。

### 6.2 Starter / final

Starter（故意失败）：
```cpp
void update() {
  if (enemy_ahead()) { attack(); }
  else { move_forward(); }
}
```
final（源码 `solutionCode`）：
```cpp
void update() {
  if (enemy_ahead()) { attack(); return; }
  if (wall_ahead()) {
    if (low_energy()) { turn_right(); }
    else { turn_left(); }
  } else { move_forward(); }
}
```

### 6.3 实际验证 tick（源码 tests + 之前 UI 运行记录）

- 最终成功实测 Tick 29；Enemy HP=0；robot 在 Exit (29,5)。
- 教学点：
  - W1：straight starter 撞墙并能量耗尽；
  - W2：需要 `low_energy()` 走 Event 补给侧；
  - debug 可用断点/step/hot reload，但固定 demo 不是必需 Debugger。

---

## 7. Tactical Standalone（单房 tactical，3 房）

所有 Tactical 场景由 `buildTacticalDungeon` 生成：Start room 宽4、Arena combat room、Exit room 宽4；所有格子默认 floor，只有少量 `#` obstacle。机器人 reset：spawn x=2、y=mid=3、朝 E；HP/Energy 由 modifiers 决定。

### 7.1 Runner Arena

- 布局 width24,height7；arena x4..19；Exit x20..23，exit tile x22。
- Enemy：Runner 全局(4,3)，HP2，moveEvery1，attackEvery4。
- Obstacles global：(7,1),(12,5),(17,1),(19,5)。
- Item：energy (20,3)。
- ASCII（示意，`.` floor，# obstacle，E exit，R runner）：
```
yyyy? row y3 path: 0..3 R ... ..........# ... E
```
由于数据是全 floor+sparse #，这里用文字表达：三行 open floor，中行有连续空间。

Starter：
```cpp
void update() {
  if (wall_ahead()) { turn_right(); }
  else { move_forward(); }
}
```
Final：
```cpp
int shots = 0;
void update() {
  if (enemy_hp() == 0) { ... move_forward ... }
  if (shots==0 && distance_to_enemy()<=2){ ranged_attack(); shots=1; }
  if (shots==1 && enemy_hp()>0){ back(); shots=2; }
  if (shots==2 && enemy_hp()>0){ ranged_attack(); }
  ...
}
```
（完整 final 源码见 `src/tactical.ts` RUNNER_FINAL；doc 只展示核心分支，代码内容与源完全一致。）

实测关键 tick（start energy 30/run max80 时行为相同）：
| Tick | Action | Robot | Distance | HP | Energy | EnemyHP |
|---|---|---|---|---|---|---|
| 1 | ranged_attack | (2,3) | 2→1 | 5 | 28 | 1 |
| 2 | back | (1,3) | 1 | 5 | 27 | 1 |
| 3 | ranged_attack | (1,3) | killed | 5 | 25 | 0 |
| 24 | move_forward | exit | - | 5 | 9 | 0 |

### 7.2 Guard Arena

- width27,height7；arena x4..22；Exit x25。
- Guard global(4,3)，HP6，moveEvery1000（固定），attackEvery4。
- modifiers：maxHp10, maxEnergy34, incomingDamage5。
- Obstacles：(8,1),(8,5),(15,2),(19,4)。

Starter：
```cpp
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { move_forward(); }
}
```
Final（enemy HP≤2 后 shield 一次）：
```cpp
bool guarded=false;
...
if (enemy_ahead()) { if (enemy_hp()<=2 && !guarded) { shield(); guarded=true; } else { attack(); } }
...
```
实测关键 tick（maxEnergy34，从满血满能开始）：
| Tick | Action | Robot | Distance | HP | Energy | EnemyHP |
|---|---|---|---|---|---|---|
| 1 | dash | (3,3) | 1 | 10 | 32 | 6 |
| 2-5 | attack | (3,3) | 1 | 10 | 28 | 5→2 |
| 6 | shield | (3,3) | 1 | 10→6 | 26 | 2 |
| 7-8 | attack | (3,3) | 1 | 6 | 24 | 2→0 |
| 30 | move_forward | exit | - | 6 | 2 | 0 |

### 7.3 Turret Arena

- width27,height7；arena x4..22；Turret global(18,3)；range5, attackEvery2, HP1。
- Obstacles：(9,1),(13,5),(21,2),(24,4)；item energy global(7,3)。

Starter：
```cpp
void update() {
  if (enemy_near()) { ranged_attack(); }
  else { move_forward(); }
}
```
Final：
```cpp
if (distance_to_enemy()<=2) { ranged_attack(); }
else if (distance_to_enemy()<=6) { dash(); }
else { wall? move_forward }
```
实测对比（真实实验）：
| 策略 | 进射程后暴露 tick | HP | Energy | Ticks |
|---|---|---|---|---|
| 普通 move | 4 tick（进入 d5） | 通关 HP1 | 6 | 13 |
| dash | 2 tick（d5→d4→d2） | 通关 HP3 | 6 | 11 |

---

## 8. Tactical Run（连续战术房）

入口：`/?demo=tactical-run` / 顶栏“战术连跑”。

- 数据源：`TACTICAL_SCENARIOS[runner,guard,turret]` 与 `TacticalRunState`（src/tacticalRun.ts）。
- Run-only modifiers：`runRoomModifiers()` 保证每房 maxEnergy ≥ `TACTICAL_RUN_ENERGY_BUDGET=80`；standalone scenario modifiers 本身不被改变。
- 跨房保留：firmware code、HP、Energy、modules、stats。
- 不跨房：Trace、breakpoint/watch baseline、snapshot。
- 状态：`hp/energy/modules/firmwareCode/clearedRooms/stats{totalTicks,damageTaken,hotReloads,debugInterventions,wins}`。

### 8.1 Reward 固定三选一（实际来自现有 choices）

通过 `new ExpeditionRun(13)` + `nodeIndex=5` 取真实 `choices()`，结果：
- `regen`（能量回收器）
- `sonar`（声呐扩展）
- `longshot`（长程炮管）

实际 modifier（经现有 `modifiers()` + `roomModifiers()` 组合）：
- regen：每5 tick +1 Energy；maxHp 在纯 moduleModifiers 中 -1，但在 Tactical Run room 合并时因取 max(room,module) 而不会降低 room 的 maxHp（见 Observed Issues）。
- sonar：nearRange=3。
- longshot：rangedRange=3。

### 8.2 Firmware continuity 事实

- Runner 房：初始 starter（唯一允许自动加载）。
- Guard 房：进入后 code 仍是 Runner final；实测 Runner code 打 Guard 失败（ranged 被吸收），随后玩家改成 Guard melee/shield。
- Turret 房：进入后 code 仍是 Guard final；实测 Guard code 打 Turret 失败，再改成 Turret dash 优化 final。

### 8.3 Energy Sweep 实数据（真实 Simulation）

| Budget | Runner结束 | Guard结束 | Rest后 | Turret结束 | 通关 |
|---|---|---|---|---|---|
| 60 | HP5 En39 24t | HP1 En7 30t | HP3 En10 | HP1 En0 14t | 失败 |
| 70 | HP5 En49 24t | HP1 En17 30t | HP3 En20 | HP1 En0 22t | 成功但余量0（脆） |
| 80 | HP5 En59 24t | HP1 En27 30t | HP3 En30 | HP1 En10 22t | 成功且有余量 |

最终选定：80。

### 8.4 统计实现

- Firmware Revisions：Run 模式内 `sim.hotReload()` 成功一次 +1。
- Debugger Interventions：Run 模式 battle 阶段中手动 single-step / setBp / setWatch / snapshot / rollback / hotReload 各 +1。
- Reset 归零；standalone 不计数。
- 浏览器 E2E 最终统计：Rooms 3/3、Ticks76、Damage6、HP1、Energy10、Modules1、FirmwareRevisions1、DebuggerInterventions1（本次自动化通过一次热重载）。

---

## 9. Expedition / Rogue（默认模式；Defense Demo 复用）

### 9.1 Route 生成（真实算法）

`generateRoute(seed)`：
- `target=7+(seed%4)` → route 长度 7~10。
- LCG `state=(state*1664525+1013904223)>>>0`。
- 基础结构：`[combat, branch, first, shop, rest, ...tail(len=target-7), rest, boss]`。
- 若 first 不是 event 且 tail 没有 event，会把 tail[0] 改成 event。
- 固定第一个节点总是 combat，第二个总 branch，最后两个是 rest/boss。

真实示例（Defense seed 13）：
`combat → branch → combat → shop → rest → event → rest → boss`
Defense 在 Branch 选 risk 后 route[2] 改成 elite。

### 9.2 Node 类型与玩家操作

| node | 玩家看到 | 是否写代码 | 真实数据变化 |
|---|---|---|---|
| combat/elite/boss | 战斗场景 | 是 | Simulation + resolveBattle |
| branch | safe/risk 二选一 | 否 | `chooseBranch` 改写下一节点并推进 index |
| event | scan/risk/leave | 否 | deterministic outcome credits/damage |
| shop | buy/hack/leave | 否 | credits 消耗/恢复 |
| rest | repair/leave | 否 | hull 恢复 |
| boss | 战斗场景 | 是 | 胜利结束 run |

### 9.3 Action outcome（实际公式，源码直接抄录）

- event：`luck=(seed+nodeIndex*7)%5-2`；risk：damage=2+(seed+nodeIndex)%2, credits=max(4,8+luck)；scan：damage0, credits=max(2,4+luck)；leave：damage0, credits=max(1,1+luck)。
- shop buy：cost=3+rewards.length；修 2+luck hull；leave：credits+1；hack：credits+4+(seed+nodeIndex)%3。
- rest repair：hull=maxHull()；leave：无变化。
- echo+event scan：额外+2；rewind+shop buy：cost=-1。
- `clearNode(result)`：结算 stats，推进 nodeIndex；nodeIndex≥length → victory。
- 战斗失败 `failDeployment`：hull-1；hull=0 → runLost。

### 9.4 Battle scoring（gradeBattle 与 gradeBattleReport）

score 规则（源码）：
- damage0 +3，damage1 +2，damage2 +1
- tick≤10 +3，≤15 +2，≤20 +1
- energyUsed≤12 +2，≤16 +1
- actions≤tick+2 +1
- sensorReads>0 且≤tick*2 +1
- score≥9 S，≥7 A，≥5 B，否则 C

`resolveBattle(ticks,damageTaken,enemyMaxHp,grade,selectedRewardId?)`：
- 基础 credits：combat4 / elite7 / boss12 + S6/A4/B2/C0。
- 不传 selectedRewardId：S/A/B 从当前 choices 中筛选 rewind/sonar/longshot 按 S→0,A→1,B→2 自动给模块；池空则给“应急资源”。
- 传 selectedRewardId：可选择任意当前 choices 中模块（Defense elite 用）。
- C：应急资源，不给模块。

### 9.5 真实战斗 scenario pool

| 类型 | id | map 尺寸/特点 | Enemy | Constraint |
|---|---|---|---|---|
| combat base | exp-combat | 断线走廊 11x5 | swarm hp2 move1 attack3 | require for/enemy_near/ranged；forbid attack |
| combat B | exp-combat-b | 回廊 | slime hp2 move2 attack3 | 同上 ranged |
| combat C | exp-combat-c | 长途 | swarm hp2 move1 attack3 | 同上 ranged |
| combat D | exp-combat-d | 冲刺者 | runner hp1 move1 attack1 | require ranged；forbid attack |
| combat E | exp-combat-e | 贴身 | slime hp2 move2 attack3 | require advance/enemy_ahead/attack；forbid ranged |
| elite base | exp-elite | 炮台 | turret hp3 range3 attack4 | require advance/enemy_near/ranged；forbid attack |
| elite B | exp-elite-b | 侧翼 | turret hp3 | 同 elite base |
| elite C | exp-elite-c | 贴脸拆塔 | turret hp3 | forbid ranged；require attack |
| elite D | exp-elite-d | 护盾守卫 | guard hp3 move4 attack4 | require advance/enemy_ahead；starter uses ranged 故意无效 |
| boss base | exp-boss | 核心熔炉 | tank hp5 move4 attack4 | require `[`；forbid ranged |
| boss B | exp-boss-b | 重装回廊 | tank hp5 move4 attack4 | 同上 |

选择方式：combat pool 5 按 `(seed+index)%5`；elite 4 按 `(seed+index)%4`；boss 2 按 `(seed+index)%2`。Late scaling：`scaleExpeditionBattle` 在 nodeIndex≥5 时 HP+2、moveEvery/attackEvery-1。

### 9.6 Module（全部真实 7 个）

| module | modifiers() 真实影响 | downside |
|---|---|---|
| dash | moveEnergyCost=0 | maxEnergy-4 |
| echo | attackPower=2 | maxEnergy-4 |
| shield | maxHp+2 等效、incomingDamage=0 | maxEnergy-4 |
| rewind | maxEnergy+10 | 占模块位 |
| regen | energyRegenEvery=5 | maxHp-1 |
| sonar | nearRange=3 | 占模块位 |
| longshot | rangedRange=3 | 占模块位 |

> Observed issue：`attack()`/`ranged_attack()` damage 使用 `rangedPower ?? attackPower`；modifiers() 默认 `rangedPower=1` 时 echo 的 melee 增伤可能被掩盖（源码事实；普通 core 测试用没有 rangedPower 的 modifiers 时 echo 才生效）。

### 9.7 Defense Demo（真实）

- seed=13；自动/半自动流程固定。
- 玩家入口与点击：详见仓库历史/本文件模式树；所有 grade/hull/credits/reward 走真实 ExpeditionRun/Simulation。

---

## 10. 全模式对照矩阵

| Mode | Level | Map Type | Enemy | Primary API | Debugger | Player Decision | Rogue Impact | Status |
|---|---|---|---|---|---|---|---|---|
| Story 0-1 | 0-1 | straight corridor | none | move_forward | 可选 | 几乎无 | 无 | 可玩 |
| Story 0-2 | 0-2 | wall corner | none | wall_ahead/turn | 可选 | 低 | 无 | 可玩 |
| Story 1-1 | 1-1 | corridor slime | slime | enemy_ahead/attack | 可选 | 低 | 无 | 可玩 |
| Story 2-1 | 2-1 | counter corridor | none | int/global | 可选 | 中 | 无 | 可玩 |
| Story 2-2 | 2-2 | toggle corridor | none | bool/global | 可选 | 中 | 无 | 可玩 |
| Story 3-1 | 3-1 | ranged corridor | slime | enemy_near/ranged_attack | 可选 | 低 | 无 | 可玩 |
| Story 3-2 | 3-2 | shield corridor | slime cadence1 | shield/attack toggle | 可选 | 中 | 无 | 可玩 |
| Dungeon Demo | fixed | dungeon rooms | slime | wall/low_energy | 可选/教学 | 中 | 无 | 可玩 |
| Tactical Runner | 1 | arena | runner | ranged/back/distance | 强 | 中高 | Run 模块 | 可玩 |
| Tactical Guard | 1 | arena | guard | dash/attack/shield | 强 | 高 | Run 模块 | 可玩 |
| Tactical Turret | 1 | arena | turret | dash/ranged | 强 | 高 | Run 模块 | 可玩 |
| Tactical Run | 3 rooms | arena×3 | runner/guard/turret | 连续固件 | 设计必需 | 高 | HP/energy/module | 可玩 |
| Defense | expedition route | 地图池 | varied | 参考/自动 | UI 不用 Debugger | 中 | 完整 Expedition | 可玩 |
| Expedition | 7-10 route | map pool | varied | varied | Story/Tactical UI 不一定 | 中高 | 全 Rogue | 可玩 |

## 11. 对“好不好玩”的客观审计

### 11.1 实际反复动作

绝大多数关卡的体验循环可归纳为：

```
读地图/目标
→ 写/改 if-else firmware
→ Build
→ Run
→ 看 Trace / sensor
→ 若失败：改代码再 Run
```

Debugger 只有在 Tactical Run 和 Dungeon Demo 的断点/step/hot reload 流程里是“必要体验”；Story 和普通 Expedition 可以不使用 Debugger 直接 Run 完成。

### 11.2 Active vs Watching

- Story 0-1/0-2/1-1/3-1：starter 一跑就成功或只改一行；Active 低、Watching 高。
- Story 2-x/3-2：需要状态设计，Active 中。
- Expedition combat：玩家编写/载入草稿后大量时间在看 Robot 自动跑；真正 Roguelite 决定在 branch/event/shop/reward。
- Tactical Runner/Guard/Turret：active 最高，Debugger 真正影响结果。
- Tactical Run：active 高（跨房改 firmware），但也需要等待 Robot 跑到 Exit。
- Defense Demo：大量节点自动/半自动，主要用于答辩展示，不适合当成“常态游玩”。

### 11.3 常见“看起来重复”的关卡

- 三套 wall turn：Story 0-2/2-1/2-2、Dungeon W1、Expedition advance()。
- 三套 enemy_ahead→attack：Story 1-1/3-2、Guard、melee expedition。
- 两套 ranged first：Story 3-1、Runner/Turret。
- 教程 starter 本身就是参考答案：多数 Story 无需 debugger。

### 11.4 源码事实 vs 文档宣传

- README/GAME_DESIGN 中的“rogue programming”愿景更强；代码里真正“代码决定构筑”的只有 modules 对 SimulationModifiers 的影响，未形成“改代码换奖励类型”的深度循环。
- 多数传感器（enemy_x/enemy_y/steps_to_wall/repair/wait/low_energy 等）存在但当前固定关卡不强制使用。
- Debugger 能力强于关卡需求；目前唯一明显“Debugger 是核心玩法”的是 Tactical Run/Runner 等，以及历史演示链路。

## 12. Observed Issues（只记录，不修改）

```
[Observed Issue] Simulation.setScenario 每次重置都会把 Energy 设满；跨 scenario/run 的 continuity 依赖 App 在 reset 后注入，不是 Simulation 自身语义。
[Observed Issue] snapshot/rollback 不保存 App code ref；rollback 后源码不会恢复。
[Observed Issue] Tactical Run 的 runRoomModifiers 用 Math.max(maxHp/maxEnergy)，导致 regen/dash/shield 等负面 modifiers 在 run 房内可能被覆盖。
[Observed Issue] expedition 战斗重击会因 modifiers.rangedPower 默认存在而让 melee attackPower 不生效（见 9.6）。
[Observed Issue] Defense/Expedition 战斗在普通 Expedition UI 中使用 scaleExpeditionBattle，而部分现有测试使用未缩放 scenario；两者不等价。
[Observed Issue] Story “R/S” 地图字符是展示字符，reset 不读取；地图文字与引擎实际 enemy 起点可造成阅读误导。
[Observed Issue] Dungeon roomId 只在 robot 移动时同步；敌人死亡后 x/y=-1 但 roomId 保留（Tactical 用 hp 判断，实际影响小）。
```

## 13. 文档 vs 源码不一致清单（摘要）

- ROADMAP “Phase” 很多未实现，不要当作现状。
- 早期文档“地图是单一矩形”已过时：现有 dungeon/tactical 使用 room/dungeon 数据。
- 早期 review 说 meta upgrade UI 坏，已实现。
- Tactical/Tactical Run 是新加入的源码事实，旧文档未必覆盖。
- 答辩/演示类文案要区分“实际半自动 demo”与“可以常态游玩”。

---
