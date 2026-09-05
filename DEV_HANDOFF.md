# CodeRogue Development Handoff

## 当前稳定基线

- Multi-enemy core 已完成并稳定
- Simulation 支持 enemies[]
- legacy enemy alias 保留
- per-enemy runtime 独立
- multi-enemy sensors/actions/AI/collision 已完成
- snapshot / rollback / hotReload / Frame / CoreDump 支持多敌
- Enemy 支持 optional damage override：
  enemy.damage ?? modifiers.incomingDamage
- dash 已修复为阻挡任意 active/alive enemy
- npm test：140 passed / 16 files
- npm run build：通过

## Combat 01 — 追猎迷宫

状态：已完成、已验收、冻结，不要修改。

Robot:
(2,8), East

Enemies:
Slime (7,2)
Runner (26,4)
Swarm (25,8), initially dormant

Robot maxEnergy = 90

CONTROL:
success=true
ticks=67
HP=6
Energy=21
damageTaken=0
turnCount=6
killOrder=runner → swarm → slime
activationTick=23

PATROL:
fail
HP=0
damageTaken=6

naive-forward:
fail

Combat 01 的 gameplay 已通过，不要重新调参。

## Combat 02 — 安保中心

状态：Gameplay + Spatial Pass 均已验收，冻结。

地图尺寸：
36×16

Robot:
(2,10), East

Guard:
(17,6)
hp=6
damage=5
attackEvery=6
moveEvery=1000

Turret:
(13,3)
hp=2
damage=1
range=4
attackEvery=16

Slime:
(24,10)
hp=2
damage=1
initial active=false
Guard 死亡后激活

canonical turn schedule:
L → R → R → L → L → L

BREACH:
success=true
ticks=72
HP=1
Energy=14
damageTaken=5
turnCount=6
killOrder=guard → slime → turret
activationTick=28
actedCount=[1,1,1]

关键战术窗口：
t16 Turret chip：HP6→5
t20 dash
t21-24 Guard HP6→2
t25 shield：Guard damage5→4，Robot HP5→1
t27 Guard 死亡
随后 Slime 激活
最终 Turret 死亡

NO_SHIELD:
fail at tick25
HP5→0

RANGED:
fail
连续攻击 Guard，Guard HP 始终不下降

SONAR：
nearRange 2 → first dash tick20
nearRange 3 → first dash tick18
两者均成功，nearRange 3 更快

Security startingEnergy:
80 可成功但剩4
90 成功剩14
当前 maxEnergy=90

Spatial Pass：
已从一格宽 polyline 扩张成入口大厅 / 中央闸门 / 仓储服务舱 / 炮台控制室四区域。
浏览器截图已人工验收。
Guard 门框未来可轻度 polish，但不是 blocker。

不要重新设计 Combat 02。

## UI 文案规范

已记录在 ROGUE_REDESIGN.md。

玩家可见 UI 使用简体中文。

关卡：
Pursuit Labyrinth → 追猎迷宫
Security Complex → 安保中心
Fire Control Core → 火控核心

Enemies：
Runner → 追猎者
Guard → 守卫
Turret → 炮台
Slime → 史莱姆
Swarm → 虫群
Tank → 重装单位

策略：
PATROL → 巡航策略
CONTROL → 控制策略
RANGED → 远程策略
BREACH → 突破策略
STANDARD → 标准策略
ADAPTIVE → 自适应策略

保留英文：
RoboC++
Debugger
Snapshot
Rollback
Hot Reload
Trace
Breakpoint

RoboC++ API / TypeScript identifier / tests 不翻译。

## Combat 03 — 火控核心

状态：Gameplay feasibility 已验收（2026-09-05）。Combat 01/02 未改，稳定 core 未改。

固定地图：36×16 单房 dungeon，西侧下层通道 → 中部竖井 → 北侧火控双层通道。

Robot:
(3,12), East

Enemies:
Turret (28,5)
hp=2 / damage=1 / range=5 / attackEvery=2
active

Tank (34,5)
hp=6 / damage=1 / moveEvery=12 / attackEvery=5
active

Runner (34,6)
hp=2 / moveEvery=1 / attackEvery=2
initial active=false
机器人进入 x=21 后激活

ADAPTIVE 真实 Simulation 数据：
success=true
ticks=44
HP=4
Energy=53
damageTaken=4
turnCount=2
killOrder=runner → turret → tank
activationTick=19
maxSimultaneousActive=3
firstDashTick=26
rangedShots=10

STANDARD（走步贴近，不 dash）：
success=false（tick30 Runner 自爆）
HP=0
rangedShots=1
firstDashTick 无

行为差异来源：Runner HP2 需要在 d2 先手两发点掉；STANDARD 会贴到 d1 后被自爆，ADAPTIVE 用 dash/单步定位在 d2/d1 完成双发，之后对 Turret 冲刺、对 Tank 保持 d2 距离远程拆解。

验证：npm test 145 passed / 17 files（含 Combat 03 五项新测试）；npm run build 通过。
不要做 Reward / Branch / Rest / Final Rogue UI（完整 UI 仍未开始；其纯状态编排已由下一段验收）。

## Final Rogue Run — 纯状态编排 / Economy

状态：已验收（2026-09-05）。Combat 01/02/03 地图与 enemy 参数未改；Prepared Firmware UI 已实现（只载入代码，不自动运行）；三张 Combat 仍按各自已验收参数独立 Simulation。

新增 API：
- `FinalRogueRun` state class：phase / hp / energy / maxHp / maxEnergy / modules / branch / restChoice / firmwareCode / profile / stats / timeline nodes
- `runFinalRogueCanonical()` / `runFinalRogue(...)`
- Combat 通过 `simulateRogueCombat(...,{hp,energy,modifiers})` 注入真实 RunState 资源
- module modifier 复用 `tacticalRun.roomModifiers()`，没有复制 module 逻辑

Canonical 路径：CONTROL → SONAR → RISK → BREACH → DASH → 战地维修 → ADAPTIVE

整局真实 Simulation 时间线：
| 节点 | HP | Energy | modules |
|---|---|---|---|
| Combat 01 start | 6 | 90 | [] |
| Combat 01 end（CONTROL, ticks67） | 6 | 21 | [] |
| Reward 1 后（SONAR, +70 cap90） | 6 | 90 | [sonar] |
| Branch 后（RISK） | 6 | 90 | [sonar] |
| Combat 02 start | 6 | 90 | [sonar] |
| Combat 02 end（BREACH, ticks69） | 1 | 16 | [sonar] |
| Reward 2 后（DASH, +70 cap110） | 1 | 86 | [sonar,dash] |
| Rest 后（战地维修 +4 cap8） | 5 | 86 | [sonar,dash] |
| Combat 03 start | 5 | 86 | [sonar,dash] |
| Combat 03 end（ADAPTIVE, ticks44） | 1 | 58 | [sonar,dash] |

整局：modules=[sonar,dash]，kills=9，totalTicks=180，damageTaken=9。

SONAR 真实性：Security 内 first enemy_near / first dash 由 base tick20 提前到 tick18。

已验证非 canonical 路径（无 crash、状态真实）：
- REGEN + SAFE（Reward2=SHIELD、Rest=战地维修）
- LONGSHOT + RISK（Reward2=DASH、Rest=战地维修）

验证：npm test 150 passed / 18 files（含 Final Rogue 五项新测试）；npm run build 通过。

## Final Rogue B2 UI

状态：已验收（2026-09-05）。入口 `/?demo=final-rogue`，顶栏 Final Rogue 也可进入。仍直接消费 `FinalRogueRun` state，不复制状态。

界面内容：
- 中文路线串联：追猎迷宫 → 模块奖励 1 → 路线选择 → 安保中心 → 模块奖励 2 → 维护舱 → 火控核心 → 行动完成
- 战斗显示 RunState HP / Energy / 已获得模块 / 当前路线节点 / 三敌实时威胁列表（已激活 / 未激活 / HP）
- Prepared Firmware 只加载对应 CONTROL / BREACH / ADAPTIVE 代码，不自动运行
- Reward / Branch / Rest 调用真实 `chooseReward / chooseBranch / chooseRest`
- Final Combat 保留 Snapshot / Rollback / Hot Reload；B2 仿真 step 前复用与 simulateRogueCombat 一致的 dormant activation
- Complete 页面读取真实 stats：kills / totalTicks / damageTaken / modules / final HP / Energy

真实 Chrome headless canonical 全流程已跑通（Prepared → 构建 → 运行逐场推进），截图：
docs-final-rogue-b2-01-pursuit-start.png
docs-final-rogue-b2-02-reward1.png
docs-final-rogue-b2-03-branch.png
docs-final-rogue-b2-04-security-start.png
docs-final-rogue-b2-05-reward2.png
docs-final-rogue-b2-06-rest.png
docs-final-rogue-b2-07-firecontrol-start.png
docs-final-rogue-b2-08-complete.png

未做：完整动画 polish。

## 尚未开始

- 最终 Debugger 演示串联

## 已知经济事实

不要假设 HP/Energy 可以完全原样跨房：

Combat 01 CONTROL 结束：
HP6 / Energy21

Combat 02 单独稳定通关至少需要约80 startingEnergy，
90 时结束 HP1 / Energy14。

Combat 03 ADAPTIVE（本轮 110 startingEnergy）结束：
HP4 / Energy53。

Final Rogue canonical 跨房后：
Combat 03 start HP5 / Energy86，end HP1 / Energy58（DASH 让 move 不耗能真实生效）。
Reward 1/2 各固定 +70；Rest 战地维修 +4。

战斗间 Recharge 已按上面的固定数值解决；
不要通过修改已冻结 Combat 01/02/03 的 gameplay 参数来解决。

## 下一步候选任务

Final Rogue B2 UI 已完成验收（canonical 全流程真实 Chrome 跑通）。
下一阶段仍不要动 Combat 01/02/03 与资源数值；可做最终 Debugger 演示串联或视觉动画 polish，
全部直接消费现有 `FinalRogueRun` state / timeline。
