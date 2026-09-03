<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,reactive,ref} from 'vue';
import {DEFAULT_CODE,EXPEDITION_HUB_SCENARIO,EXPEDITION_SCENARIOS,ExpeditionRun,LEVEL_STARTER_CODE,ProgressStorage,Simulation,STORY_LEVELS,loadMeta,loadStoryProgress,saveMeta,saveStoryProgress} from './core';
import robotSprite from './assets/robot.svg';
import slimeSprite from './assets/slime.svg';
import exitSprite from './assets/exit.svg';

const code=ref(DEFAULT_CODE);
const sim=reactive(new Simulation());
const expedition=reactive(new ExpeditionRun());
const seedInput=ref('');
const selectedReward=ref<string>();
const rewardModalVisible=ref(false);
const selectedExpeditionAction=ref<string>();
const built=ref(false);
const selected=ref(0);
const speed=ref(800);
const running=ref(false);
const stepMode=ref(false);
const breakpoint=ref<number>();
const watchVariable=ref('');
const hasSnapshot=ref(false);
let snapshotState: ReturnType<Simulation['snapshot']>|undefined;
const buildError=ref('');
const tutorialVisible=ref(true);
const tutorialStep=ref(0);
const audioEnabled=ref(true);
const settingsOpen=ref(false);
const buildHistory=ref<string[]>([]);
const editorRef=ref<HTMLTextAreaElement>();
const editorScroll=ref(0);
const levelNotice=ref('');
let timer:number|undefined;
let storage:ProgressStorage|undefined;
let savedFirmware:string|undefined;
let savedFirmwareLevel:string|undefined;

try{storage=typeof window!=='undefined'?window.localStorage:undefined}catch{storage=undefined}
try{if(typeof window!=='undefined'){tutorialVisible.value=window.localStorage.getItem('coderogue.tutorial.dismissed')!=='1';audioEnabled.value=window.localStorage.getItem('coderogue.audio')!=='0';savedFirmware=window.localStorage.getItem('coderogue.firmware')??undefined;savedFirmwareLevel=window.localStorage.getItem('coderogue.firmware-level')??undefined;const history=window.localStorage.getItem('coderogue.build-history');if(history)buildHistory.value=JSON.parse(history)}}catch{}
sim.applyProgress(loadStoryProgress(storage));
const meta=reactive(loadMeta(storage));
if(savedFirmware&&savedFirmwareLevel===STORY_LEVELS[sim.levelIndex].id)code.value=savedFirmware;else code.value=LEVEL_STARTER_CODE[STORY_LEVELS[sim.levelIndex].id]??DEFAULT_CODE;

const EDITOR_LINE_HEIGHT=23.8;
const EDITOR_PADDING=18;
const frame=computed(()=>sim.frames[selected.value]);
const grid=computed(()=>sim.map.map((row,y)=>row.split('').map((cell,x)=>({cell,x,y}))));
const codeLines=computed(()=>code.value.split('\n'));
const currentSourceLine=computed(()=>frame.value?.sourceLine);
const currentLevel=computed(()=>STORY_LEVELS[sim.levelIndex]);
const completedCount=computed(()=>sim.completedLevels.size);
const expeditionModifiers=computed(()=>expedition.modifiers());
const maxHp=computed(()=>gameMode.value==='expedition'?expeditionModifiers.value.maxHp:5);
const maxEnergy=computed(()=>gameMode.value==='expedition'?expeditionModifiers.value.maxEnergy:20);
const hpPercent=computed(()=>`${Math.max(0,sim.robot.hp/maxHp.value*100)}%`);
const energyPercent=computed(()=>`${Math.max(0,sim.robot.energy/maxEnergy.value*100)}%`);
const enemyThreat=computed(()=>sim.enemy.hp>0&&Math.abs(sim.enemy.x-sim.robot.x)+Math.abs(sim.enemy.y-sim.robot.y)<=2);
const enemyAttackCountdown=computed(()=>{const attackEvery=sim.enemy.attackEvery;if(!expeditionScenarioActive.value||sim.enemy.hp<=0||!attackEvery)return undefined;const distance=Math.abs(sim.enemy.x-sim.robot.x)+Math.abs(sim.enemy.y-sim.robot.y);if(distance>1)return undefined;const remainder=sim.tick%attackEvery;return remainder===0?attackEvery:attackEvery-remainder});
const pulseAvailable=computed(()=>gameMode.value==='expedition'&&expeditionNeedsFirmware.value&&sim.enemy.hp>0&&sim.robot.energy>=3&&!sim.pulseUsed&&(sim.status==='running'||sim.status==='paused'));
const statusLabel=computed(()=>({idle:'待机',running:'运行中',paused:'已暂停',success:'任务完成',failed:'机体损毁',error:'程序错误'}[sim.status]));
const terminalMessage=computed(()=>localizeMessage(buildError.value||sim.message));
const expeditionNode=computed(()=>expedition.current());
const expeditionActions=computed(()=>expedition.actions());
const expeditionLastLog=computed(()=>expedition.log.length?expedition.log[expedition.log.length-1]:undefined);
const expeditionNeedsFirmware=computed(()=>['combat','elite','boss'].includes(expeditionNode.value??''));
const expeditionFirmwareReady=computed(()=>!expeditionNeedsFirmware.value||sim.status==='success');
const expeditionScenarioActive=ref(false);
const expeditionBattleVerified=ref(false);
const battleGrade=ref('—');
const expeditionScenario=computed(()=>expeditionNeedsFirmware.value?EXPEDITION_SCENARIOS[expeditionNode.value as 'combat'|'elite'|'boss']:(expeditionNode.value?{...EXPEDITION_HUB_SCENARIO,title:expeditionNode.value==='event'?'异常事件': '补给商店'}:undefined));
const gameMode=ref<'story'|'expedition'>('expedition');

const levelNames:Record<string,string>={
  '0-1':'首次启动','0-2':'墙前判断','1-1':'战斗决策','2-1':'计数路线','2-2':'状态切换'
};
const actionNames:Record<string,string>={move_forward:'前进',turn_left:'左转',turn_right:'右转',attack:'攻击',wait:'等待'};
const eventNames:Record<string,string>={EXIT_REACHED:'抵达出口',ROBOT_DESTROYED:'机体损毁',RUNTIME_ERROR:'运行错误',BREAKPOINT:'命中断点',ENEMY_STRIKE:'敌人接触攻击'};

function levelName(id:string){return levelNames[id]??id}
function chapterName(id:string){return id.startsWith('0-')?'启动教学':id.startsWith('1-')?'条件决策':'状态记忆'}
function expeditionNodeName(node:string){return ({combat:'遭遇战',elite:'精英',event:'事件',shop:'商店',boss:'BOSS'} as Record<string,string>)[node]??node}
function actionName(action?:string){return action?`${actionNames[action]??action} · ${action}`:'无动作'}
function eventName(event:string){if(event.startsWith('WATCHPOINT:'))return `监视点：${event.slice(11)}`;return eventNames[event]??event}
function localizeMessage(message:string){
  const exact:Record<string,string>={Ready:'系统就绪',Running:'固件运行中',Paused:'模拟已暂停',Stopped:'模拟已停止','Build succeeded':'构建成功，可以运行','Exit reached':'任务完成：已抵达出口','Robot destroyed':'任务失败：机器人已损毁','Source changed; build required':'源码已修改，请重新构建','Slime hit':'攻击命中史莱姆','Slime destroyed':'史莱姆已被消灭','Enemy strike':'敌人接触攻击：本拍受到伤害','Snapshot saved':'快照已保存','Rolled back to snapshot':'已回滚至快照','Hot reload applied':'热重载已应用','Example loaded':'已载入本关示例','Route node loaded':'已载入远征节点'};
  if(exact[message])return exact[message];
  if(message.startsWith('Build error '))return message.replace('Build error ','构建错误 ');
  if(message.startsWith('Runtime error '))return message.replace('Runtime error ','运行错误 ');
  if(message.startsWith('Breakpoint set at line '))return `已在第 ${message.slice(23)} 行设置断点`;
  if(message.startsWith('Breakpoint hit at line '))return `程序在第 ${message.slice(23)} 行命中断点`;
  if(message.startsWith('Watchpoint changed: '))return `监视变量 ${message.slice(20)} 已变化，程序已暂停`;
  if(message.startsWith('Watchpoint set: '))return `已添加监视变量 ${message.slice(16)}`;
  if(message==='Watchpoints cleared')return '已清除全部监视变量';
  return message;
}
function syncEditorScroll(){editorScroll.value=editorRef.value?.scrollTop??0}
function handleEditorKeydown(event:KeyboardEvent){
  if(event.key!=='Tab'||running.value)return;
  event.preventDefault();
  const editor=event.currentTarget as HTMLTextAreaElement;
  const start=editor.selectionStart;
  const end=editor.selectionEnd;
  const value=editor.value;
  if(event.shiftKey){
    const lineStart=value.lastIndexOf('\n',Math.max(0,start-1))+1;
    const remove=value.slice(lineStart,lineStart+2)==='  '?2:value[lineStart]===' '?1:0;
    if(remove){editor.setRangeText('',lineStart,lineStart+remove,'preserve');editor.dispatchEvent(new Event('input',{bubbles:true}));editor.setSelectionRange(Math.max(lineStart,start-remove),Math.max(lineStart,start-remove));}
    return;
  }
  editor.setRangeText('  ',start,end,'end');
  editor.dispatchEvent(new Event('input',{bubbles:true}));
}
function beep(kind:'run'|'success'|'fail'='run'){if(!audioEnabled.value||typeof window==='undefined')return;try{const AudioContextClass=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioContextClass)return;const ctx=new AudioContextClass();const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.type='square';oscillator.frequency.value=kind==='success'?660:kind==='fail'?150:330;gain.gain.setValueAtTime(.025,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.12)}catch{}}
function dismissTutorial(){tutorialVisible.value=false;try{window.localStorage.setItem('coderogue.tutorial.dismissed','1')}catch{}}
function showTutorial(){tutorialStep.value=0;tutorialVisible.value=true;try{window.localStorage.removeItem('coderogue.tutorial.dismissed')}catch{}}
function finishTutorial(){gameMode.value='story';expeditionScenarioActive.value=false;sim.selectLevel(0);loadLevelExample(0);build();dismissTutorial()}
function loadLevelExample(index=sim.levelIndex){const level=STORY_LEVELS[index];const starter=expeditionScenarioActive.value?expeditionScenario.value?.starterCode:LEVEL_STARTER_CODE[level.id];code.value=starter??DEFAULT_CODE;built.value=false;buildError.value='';sim.status='idle';sim.message='Example loaded';levelNotice.value=expeditionScenarioActive.value?'已载入远征战场示例固件':`已进入 ${levelName(level.id)} · 示例程序已载入`;try{window.localStorage.setItem('coderogue.firmware',code.value);window.localStorage.setItem('coderogue.firmware-level',expeditionScenarioActive.value?'expedition':level.id)}catch{}}
function prepareLevel(){loadLevelExample();build()}
function tutorialNext(){tutorialStep.value=Math.min(2,tutorialStep.value+1)}
function tutorialBack(){tutorialStep.value=Math.max(0,tutorialStep.value-1)}
function build(){const result=sim.build(code.value);built.value=result.ok;buildError.value=result.ok?'':sim.message;sim.status=result.ok?'idle':'error';if(result.ok){try{window.localStorage.setItem('coderogue.firmware',code.value);buildHistory.value=[new Date().toLocaleTimeString(),...buildHistory.value].slice(0,5);window.localStorage.setItem('coderogue.build-history',JSON.stringify(buildHistory.value))}catch{}}}
function hotReload(){const result=sim.hotReload(code.value);built.value=result.ok;buildError.value=result.ok?'':sim.message;if(result.ok){running.value=false;clearTimer()}}
function markCodeDirty(){built.value=false;buildError.value='';if(sim.status!=='paused')sim.status='idle';sim.message='Source changed; build required';try{window.localStorage.setItem('coderogue.firmware',code.value)}catch{}}
function clearTimer(){if(timer!==undefined){clearInterval(timer);timer=undefined}}
function persistProgress(){saveStoryProgress(sim.getProgress(),storage)}
function completeExpeditionBattle(){if(gameMode.value!=='expedition'||!expeditionNeedsFirmware.value||expedition.nodeCleared)return;expedition.recordBattlePerformance(sim.robot.hp);expeditionBattleVerified.value=true;const damage=Math.max(0,maxHp.value-sim.robot.hp);const energyUsed=Math.max(0,maxEnergy.value-sim.robot.energy);const actions=sim.frames.filter(frame=>!!frame.action).length;const sensorReads=sim.frames.reduce((sum,frame)=>sum+frame.sensors.length,0);let score=0;if(damage===0)score+=3;else if(damage===1)score+=2;else if(damage===2)score+=1;if(sim.tick<=10)score+=3;else if(sim.tick<=15)score+=2;else if(sim.tick<=20)score+=1;if(energyUsed<=12)score+=2;else if(energyUsed<=16)score+=1;if(actions<=sim.tick+2)score+=1;if(sensorReads>0&&sensorReads<=sim.tick*2)score+=1;battleGrade.value=score>=9?'S':score>=7?'A':score>=5?'B':'C';sim.message=`战斗固件通过 · ${battleGrade.value} 评级 · ${damage} 伤 · ${sim.tick} Tick · ${energyUsed} 能耗，请选择战术结算`}
function startTimer(){clearTimer();timer=window.setInterval(()=>{sim.step();selected.value=Math.max(0,sim.frames.length-1);if(sim.status!=='running'){running.value=false;clearTimer();persistProgress();if(sim.status==='success'){completeExpeditionBattle();beep('success')}if(sim.status==='failed'||sim.status==='error')beep('fail')}},speed.value)}
function run(){if(gameMode.value==='expedition'&&!expeditionNeedsFirmware.value){sim.message='这是路线节点，请先选择上方行动';return}if(!built.value)build();if(!built.value)return;sim.reset();persistProgress();selected.value=0;running.value=true;stepMode.value=false;beep('run');startTimer()}
function stepOnce(){if(running.value||gameMode.value==='expedition'&&!expeditionNeedsFirmware.value)return;if(!built.value)build();if(!built.value)return;if(sim.status==='idle'||sim.status==='success'||sim.status==='failed'||sim.status==='error')sim.reset();sim.status='running';sim.step();selected.value=Math.max(0,sim.frames.length-1);if(sim.status==='success'){completeExpeditionBattle();beep('success')}if(sim.status==='failed'||sim.status==='error')beep('fail');stepMode.value=true}
function pulse(){if(sim.usePulse()){selected.value=Math.max(0,sim.frames.length-1);beep('run')}}
function handleGlobalKey(event:KeyboardEvent){const target=event.target as HTMLElement|null;if(target?.tagName==='TEXTAREA'||target?.tagName==='INPUT'||target?.isContentEditable)return;if(event.code==='Space'){event.preventDefault();if(running.value||sim.status==='paused')togglePause()}else if(event.key.toLowerCase()==='n'&&gameMode.value==='expedition'){event.preventDefault();stepOnce()}}
function stop(){running.value=false;clearTimer();sim.status='idle';sim.message='Stopped'}
function togglePause(){if(sim.status==='paused'){sim.resume();running.value=true;beep('run');startTimer()}else if(sim.status==='running'){sim.pause();running.value=false;clearTimer()}}
function setBp(){if(breakpoint.value){sim.setBreakpoint(breakpoint.value);sim.message=`Breakpoint set at line ${breakpoint.value}`}}
function clearBp(){sim.clearBreakpoints();sim.message='Breakpoints cleared'}
function setWatch(){if(sim.setWatchpoint(watchVariable.value)){sim.message=`Watchpoint set: ${watchVariable.value.trim()}`;watchVariable.value=''}}
function clearWatch(){sim.clearWatchpoints();sim.message='Watchpoints cleared'}
function takeSnapshot(){snapshotState=sim.snapshot();hasSnapshot.value=true;sim.message='Snapshot saved'}
function rollback(){if(snapshotState){sim.rollback(snapshotState);selected.value=Math.max(0,sim.frames.length-1);running.value=false;clearTimer()}}
function chooseReward(id:string){selectedReward.value=id}
function chooseExpeditionAction(id:string){selectedExpeditionAction.value=id}
function enterExpeditionScenario(loadExample=true){const scenario=expeditionScenario.value;if(!scenario)return;expeditionScenarioActive.value=true;expeditionBattleVerified.value=false;sim.setScenario(scenario,expedition.modifiers());running.value=false;clearTimer();selected.value=0;buildError.value='';if(loadExample){code.value=scenario.starterCode;built.value=false;levelNotice.value=`已载入${scenario.title}地图与示例固件`;try{window.localStorage.setItem('coderogue.firmware-level','expedition')}catch{}}}
function resetExpeditionFirmware(){stop();if(expeditionNeedsFirmware.value)enterExpeditionScenario(true);else{expeditionScenarioActive.value=true;sim.setScenario(EXPEDITION_HUB_SCENARIO,expedition.modifiers());selected.value=0;built.value=false;code.value=EXPEDITION_HUB_SCENARIO.starterCode;sim.message='Route node loaded'}selected.value=0;buildError.value='';levelNotice.value=''}
function resolveExpeditionAction(){const actionId=selectedExpeditionAction.value;if(!actionId){sim.message='请先选择一个行动，再确认执行';return}if(expeditionNeedsFirmware.value&&!expeditionBattleVerified.value){sim.message='请先在模拟舱运行固件并抵达出口，再执行遭遇战';return}if(expedition.resolveAction(actionId,expeditionBattleVerified.value||expeditionFirmwareReady.value)){selectedExpeditionAction.value=undefined;expeditionBattleVerified.value=false;if(expeditionNode.value==='boss')expedition.clearNode();else rewardModalVisible.value=true}else if(expeditionNode.value==='shop'&&actionId==='buy'){sim.message='资源不足：购买补给需要 3 credits'} }
function openRewardModal(){if(expedition.nodeCleared&&expeditionNode.value!=='boss')rewardModalVisible.value=true}
function confirmReward(){if(selectedReward.value){expedition.choose(selectedReward.value);expedition.clearNode();selectedReward.value=undefined;rewardModalVisible.value=false;resetExpeditionFirmware()}}
function settleExpeditionEscape(){expedition.clearNode();resetExpeditionFirmware()}
function level(index:number){stop();gameMode.value='story';expeditionScenarioActive.value=false;sim.selectLevel(index);loadLevelExample(index);persistProgress();selected.value=0;built.value=false}
function showStoryMode(){stop();gameMode.value='story';expeditionScenarioActive.value=false;sim.selectLevel(sim.levelIndex);loadLevelExample(sim.levelIndex)}
function bankExpedition(){meta.credits+=expedition.stats.credits;if(expedition.stats.nodesCleared>0)meta.runs+=1;if(expedition.stats.victory&&battleGrade.value){const order=['S','A','B','C'];if(!meta.bestGrade||order.indexOf(battleGrade.value)<order.indexOf(meta.bestGrade))meta.bestGrade=battleGrade.value}saveMeta(meta,storage)}
function newExpedition(){stop();bankExpedition();const seedText=seedInput.value.trim();const parsed=Number(seedText);const seed=Number.isFinite(parsed)&&parsed>=0?Math.floor(parsed):Date.now();expedition.reset(seed);seedInput.value='';showExpeditionMode()}
function showExpeditionMode(){stop();gameMode.value='expedition';if(expeditionNeedsFirmware.value)enterExpeditionScenario(true);else{expeditionScenarioActive.value=true;sim.setScenario(EXPEDITION_HUB_SCENARIO,expedition.modifiers());sim.status='idle';sim.message='Route node loaded';built.value=false;code.value=EXPEDITION_HUB_SCENARIO.starterCode}}
showExpeditionMode();
onMounted(()=>window.addEventListener('keydown',handleGlobalKey));
onBeforeUnmount(()=>{clearTimer();window.removeEventListener('keydown',handleGlobalKey)});
</script>

<template>
  <main class="shell">
    <div v-if="rewardModalVisible" class="reward-modal-backdrop" @click.self="rewardModalVisible=false"><section class="reward-modal"><div class="reward-modal-head"><div><span class="panel-kicker">NODE CLEARED / 节点结算</span><h2>{{expeditionNodeName(expeditionNode??'')}} · 战利品</h2></div><button class="modal-close" @click="rewardModalVisible=false" aria-label="关闭结算">×</button></div><div class="reward-modal-outcome"><span>本次行动</span><b>{{expeditionLastLog}}</b><em>伤害 {{expedition.lastOutcome.damageDealt}} · 受伤 {{expedition.lastOutcome.damageTaken}} · 资源 {{expedition.lastOutcome.credits >= 0 ? '+' : ''}}{{expedition.lastOutcome.credits}}</em></div><p class="reward-modal-tip">选择一个模块装入机体。模块会在之后的节点持续生效，重复获得的模块会转化为额外资源。</p><div class="reward-cards"><button v-for="reward in expedition.choices()" :key="reward.id" :class="{selected:selectedReward===reward.id}" @click="chooseReward(reward.id)"><span class="reward-kind">{{reward.kind}}</span><strong>{{reward.title}}</strong><small>{{reward.description}}</small><i>{{selectedReward===reward.id?'已选择':'选择模块'}}</i></button></div><button class="confirm-reward modal-confirm" @click="confirmReward" :disabled="!selectedReward">{{selectedReward?'装入机体并继续':'请选择一个模块'}}</button></section></div>
    <div v-if="tutorialVisible" class="tutorial-backdrop"><section class="tutorial-card"><div class="tutorial-top"><span class="panel-kicker">FIRST BOOT / 新手引导</span><span class="tutorial-count">{{tutorialStep+1}} / 3</span></div><div v-if="tutorialStep===0"><h2>你不需要先学会 C++</h2><p>在这里，你只需要写下“机器人每一拍要做什么”。程序会重复执行，直到机器人抵达出口。</p><div class="tutorial-code"><code>void update() {</code><code>  move_forward();</code><code>}</code></div><p class="tutorial-note"><b>读法：</b>每次 update() 执行一次，move_forward() 就让机器人向前走一格。每行末尾的 <code>;</code> 表示这一句结束。</p></div><div v-else-if="tutorialStep===1"><h2>先问路，再行动</h2><p>传感器只负责回答问题，动作才会改变地图。你可以把它们理解成机器人的眼睛和手。</p><div class="tutorial-terms"><span><code>wall_ahead()</code><b>前面是墙吗？返回 是 / 否</b></span><span><code>enemy_ahead()</code><b>前面有敌人吗？返回 是 / 否</b></span><span><code>turn_right()</code><b>向右转，不会向前走</b></span><span><code>attack()</code><b>攻击正前方的史莱姆</b></span></div><p class="tutorial-note"><b>重要：</b>每一拍只会提交第一个动作，先观察 Trace 再修改代码。</p></div><div v-else><h2>你的第一关只有一步</h2><p>示例会先自动载入并完成构建检查。之后点击“运行”，观察机器人抵达金色出口。</p><div class="tutorial-flow"><span><b>1</b><strong>载入示例</strong><small>获得一份能成功的程序</small></span><span><b>2</b><strong>构建检查</strong><small>检查拼写和括号</small></span><span><b>3</b><strong>运行模拟</strong><small>观察代码如何影响机器人</small></span></div><p class="tutorial-note">之后再尝试改一行代码，重新构建，看看结果有什么不同。关闭引导后，左侧“本关怎么想”下方有完整语法速查。</p></div><div class="tutorial-actions"><button v-if="tutorialStep>0" @click="tutorialBack">上一步</button><button class="quiet" @click="dismissTutorial">跳过引导</button><button v-if="tutorialStep<2" class="primary" @click="tutorialNext">下一步</button><button v-else class="primary" @click="finishTutorial">载入示例并检查</button></div></section></div>
    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark">CR</div>
        <div><div class="eyebrow">PROGRAMMING ROGUELITE</div><h1>代码浪客 <span>CODE ROGUE</span></h1></div>
      </div>
      <div class="mode-tabs topbar-tabs"><button :class="{active:gameMode==='story'}" @click="showStoryMode">教学关卡</button><button :class="{active:gameMode==='expedition'}" @click="showExpeditionMode">远征模式</button></div>
      <div class="run-summary">
        <div :class="['status',sim.status]"><small>运行状态</small><strong>{{statusLabel}}</strong><span>TICK {{sim.tick}}</span></div>
        <div class="vital"><div><span>机体</span><b>{{sim.robot.hp}} / {{maxHp}}</b></div><i><em :style="{width:hpPercent}"></em></i></div>
        <div class="vital energy"><div><span>能量</span><b>{{sim.robot.energy}} / {{maxEnergy}}</b></div><i><em :style="{width:energyPercent}"></em></i></div>
      </div>
      <button class="settings-toggle" @click="settingsOpen=!settingsOpen" aria-label="打开设置">⚙ 设置</button>
    </header>
    <section v-if="settingsOpen" class="settings-panel"><label><input type="checkbox" v-model="audioEnabled" @change="()=>{try{window.localStorage.setItem('coderogue.audio',audioEnabled?'1':'0')}catch{}}"> 音效反馈</label><span>最近构建：{{buildHistory.length?buildHistory.join(' · '):'暂无记录'}}</span><button @click="showTutorial">重新查看引导</button></section>

    <section class="story-strip">

      <div v-if="gameMode==='story'" class="story-heading"><div><span>STORY MODE</span><strong>教学关卡</strong></div><div class="story-progress"><b>{{completedCount}}</b> / {{STORY_LEVELS.length}} 已完成</div></div>
      <nav v-if="gameMode==='story'" class="levels" aria-label="故事关卡">
        <button v-for="(item,index) in STORY_LEVELS" :key="item.id" :class="{active:index===sim.levelIndex,completed:sim.completedLevels.has(item.id)}" @click="level(index)">
          <span class="level-id">{{item.id}}</span><span class="level-copy"><b>{{levelName(item.id)}}</b><small>{{chapterName(item.id)}}</small></span><span class="level-state">{{sim.completedLevels.has(item.id)?'✓':'›'}}</span>
        </button>
      </nav>
      <div v-if="gameMode==='story'" class="level-context"><div><span>当前关卡</span><strong>{{currentLevel.id}} · {{levelName(currentLevel.id)}}</strong><small>{{currentLevel.objective}}</small></div><button class="context-action" @click="prepareLevel" :disabled="running">载入示例并构建</button><em v-if="levelNotice">{{levelNotice}}</em></div>
    </section>

    <section v-if="gameMode==='expedition'" class="expedition-strip">
      <div class="expedition-head"><div><span>EXPEDITION · SEED {{expedition.seed}}</span><strong>远征路线</strong></div><div class="expedition-stats">节点 {{expedition.stats.nodesCleared}} / {{expedition.route.length}} · 本局资源 {{expedition.stats.credits}} · 耐久 {{expedition.hull}} / {{expedition.maxHull()}} · 总资源 {{meta.credits}} · 最佳 {{meta.bestGrade||'—'}}</div><div class="seed-controls"><input v-model="seedInput" type="number" inputmode="numeric" placeholder="种子" aria-label="远征种子"><button @click="newExpedition">新远征</button></div></div>
      <div v-if="expedition.rewards.length" class="reward-bag"><span>已装备构筑</span><b v-for="reward in expedition.rewards" :key="reward.id">{{reward.title}}</b></div>
      <div class="expedition-route"><span v-for="(node,index) in expedition.route" :key="index" :class="['route-node',`node-${node}`,{current:index===expedition.nodeIndex,cleared:index<expedition.nodeIndex}]">{{index+1}}<small>{{expeditionNodeName(node)}}</small></span></div>
      <div v-if="expeditionLastLog" class="expedition-log">最近行动 <b>{{expeditionLastLog}}</b></div>
      <div v-if="expeditionNode && !expedition.nodeCleared && !expeditionNeedsFirmware" class="encounter-row"><div class="encounter-copy"><b>{{expeditionNode==='event'?'异常事件':'补给商店'}}</b><span>{{expeditionNode==='event'?'未知遗迹等待你的决定。':'用 credits 换取下一段路的优势。'}}</span><small class="encounter-hint">此节点无需运行固件，请先选择一个行动</small></div><div class="encounter-actions"><button v-for="action in expeditionActions" :key="action.id" :class="{selected:selectedExpeditionAction===action.id}" @click="chooseExpeditionAction(action.id)"><b>{{action.title}}</b><small>{{action.description}}</small></button><button class="confirm-reward" @click="resolveExpeditionAction" :disabled="!selectedExpeditionAction">{{selectedExpeditionAction?'确认执行':'请选择行动'}}</button></div></div>
      <div v-else-if="expeditionNode && !expedition.nodeCleared && expeditionNeedsFirmware && (sim.status==='failed'||sim.status==='error')" class="encounter-row battle-failure"><div class="encounter-copy"><b>{{sim.status==='failed'?'本次部署失效':'固件执行中断'}}</b><span>{{sim.status==='failed'?'敌方压制了机体。检查最后几帧，调整决策后重新部署。':'请依据控制台的行号修正固件，再回到战场。'}}</span><small class="encounter-hint">本战尚未结算，不会跳过路线节点。</small></div><div class="encounter-actions"><button class="confirm-reward" @click="enterExpeditionScenario(false)">保留代码重试</button><button @click="enterExpeditionScenario(true)">载入战术示例</button></div></div>
      <div v-else-if="expeditionNode && !expedition.nodeCleared && expeditionNeedsFirmware && expeditionBattleVerified" class="encounter-row battle-resolve"><div class="encounter-copy"><b>固件验证通过</b><span>你已击破敌人并抵达撤离门。现在决定如何把这次胜利转化为资源。</span><small class="encounter-hint">战术会改变伤害、受伤和资源收益，然后进入构筑选择。</small></div><div class="encounter-actions"><button v-for="action in expeditionActions" :key="action.id" :class="{selected:selectedExpeditionAction===action.id}" @click="chooseExpeditionAction(action.id)"><b>{{action.title}}</b><small>{{action.description}}</small></button><button class="confirm-reward" @click="resolveExpeditionAction" :disabled="!selectedExpeditionAction">确认战术</button></div></div>
      <div v-else-if="expeditionNode && !expedition.nodeCleared && expeditionNeedsFirmware" class="encounter-row battle-gate"><div class="encounter-copy"><b>{{expeditionNode==='boss'?'终局 BOSS':expeditionNode==='elite'?'精英战场':'遭遇战'}}</b><span>这是一场真正的代码战斗：地图上的机器人需要击败敌人并抵达出口。</span><small class="encounter-hint">请在下方远征战场编写并运行固件</small></div><div class="encounter-actions"><button class="confirm-reward" @click="enterExpeditionScenario(true)" :disabled="expeditionScenarioActive">{{expeditionScenarioActive?'已在战场中':'进入战场'}}</button></div></div>
      <div v-else-if="expeditionNode && expeditionNode!=='boss'" class="reward-row reward-pending"><span class="reward-label">节点已清除</span><div class="outcome-note">结算已准备<br><b>伤害 {{expedition.lastOutcome.damageDealt}} · 受伤 {{expedition.lastOutcome.damageTaken}} · 资源 {{expedition.lastOutcome.credits >= 0 ? '+' : ''}}{{expedition.lastOutcome.credits}}</b></div><button class="confirm-reward" @click="openRewardModal">打开战利品选择</button></div>
      <div v-else class="reward-row expedition-complete"><span>{{expedition.stats.victory?`远征完成 · 造成 ${expedition.stats.damageDealt} 伤害 · 受伤 ${expedition.stats.damageTaken}`:expedition.lastOutcome.victory===false?'BOSS 已撤离 · 保留当前战利品':'BOSS 已击破 · 结算战利品'}}</span><button v-if="!expedition.stats.victory" @click="settleExpeditionEscape">结算</button><button v-else @click="newExpedition">开启新远征</button></div>
    </section>

    <section v-if="gameMode==='expedition'" class="mission-brief"><div><span>当前任务</span><strong>{{expeditionScenario?.title??(expeditionNode==='event'?'异常事件':'补给商店')}}</strong><small>{{expeditionScenario?.objective??'选择路线决策，换取下一场战斗的优势。'}}</small></div><div class="brief-stat"><span>敌方强度</span><b v-if="expeditionScenario?.enemy">{{expeditionScenario.enemy.hp}} HP · {{expeditionScenario.enemy.moveEvery?`每 ${expeditionScenario.enemy.moveEvery} Tick 逼近`:'静止守卫'}}<br><small v-if="expeditionScenario.enemy.attackEvery">{{expeditionScenario.enemy.kind==='turret'?'远程每':'接触后每'}} {{expeditionScenario.enemy.attackEvery}} Tick {{expeditionScenario.enemy.kind==='turret'?'射击':'攻击'}}</small><em v-if="enemyAttackCountdown" class="attack-countdown">⚠ 下次攻击 {{enemyAttackCountdown}} Tick</em></b><b v-else>无战斗</b></div><div class="brief-stat"><span>当前构筑</span><b>{{expedition.rewards.length?`${expedition.rewards.length} 个模块`: '标准机体'}}</b></div><div class="brief-stat"><span>{{expeditionBattleVerified?'本战评级':'胜利收益'}}</span><b>{{expeditionBattleVerified?battleGrade:(expeditionNeedsFirmware?'资源 +4 起，越快越高':'路线分支奖励')}}</b></div></section>

    <section class="layout">
      <div class="left-column">
        <section class="panel editor-panel">
          <div class="panel-head"><div><span class="panel-kicker">FIRMWARE WORKBENCH</span><strong>固件编辑器</strong></div><div class="panel-tools"><span v-if="currentSourceLine" class="source-line">执行行 {{currentSourceLine}}</span><button class="example-button" @click="loadLevelExample()" :disabled="running">{{gameMode==='expedition'?'载入战场示例':'载入本关示例'}}</button><span class="chip">RoboC++</span></div></div>
          <div class="file-tab"><span class="file-dot"></span>firmware.cpp <small>{{built?'已构建':'未构建'}}</small></div>
          <div class="editor-shell">
            <div class="line-gutter" :style="{transform:`translateY(-${editorScroll}px)`}" aria-hidden="true"><span v-for="(_,index) in codeLines" :key="index" :class="{current:index+1===currentSourceLine}">{{index+1}}</span></div>
            <div v-if="currentSourceLine" class="line-highlight" :style="{top:`${EDITOR_PADDING+(currentSourceLine-1)*EDITOR_LINE_HEIGHT-editorScroll}px`}" aria-hidden="true"></div>
            <textarea ref="editorRef" v-model="code" spellcheck="false" aria-label="Firmware editor" :readonly="running" @keydown="handleEditorKeydown" @input="markCodeDirty" @scroll="syncEditorScroll"></textarea>
          </div>
          <div class="actions">
            <button class="primary" @click="build" :disabled="running || sim.status==='paused' || (gameMode==='expedition'&&!expeditionNeedsFirmware)"><span>⚙</span> 构建</button>
            <button v-if="sim.status==='paused'" @click="hotReload">热重载</button>
            <button class="run-button" @click="run" :disabled="running || sim.status==='paused' || (gameMode==='expedition'&&!expeditionNeedsFirmware)"><span>▶</span> 运行</button>
            <button @click="togglePause" :disabled="!running && sim.status!=='paused'"><span>{{sim.status==='paused'?'▶':'Ⅱ'}}</span> {{sim.status==='paused'?'继续':'暂停'}}</button>
            <button v-if="gameMode==='expedition'" :class="['step-button',{active:stepMode}]" @click="stepOnce" :disabled="running || !expeditionNeedsFirmware"><span>⏭</span> 单步</button>
            <button v-if="gameMode==='expedition'" class="pulse-button" @click="pulse" :disabled="!pulseAvailable"><span>✦</span> 脉冲干扰 <small>{{sim.pulseUsed?'已使用':'耗能 3'}}</small></button>
            <button class="quiet" @click="stop"><span>■</span> 停止</button>
            <label for="run-speed">速度<select id="run-speed" v-model.number="speed" aria-label="运行速度"><option :value="1000">1×</option><option :value="500">2×</option><option :value="250">4×</option></select></label>
          </div>
          <div v-if="gameMode==='story'" class="debug-controls">
            <span class="debug-title">断点调试</span><label for="breakpoint-line">源码行</label><input id="breakpoint-line" v-model.number="breakpoint" type="number" min="1" step="1" placeholder="3">
            <button @click="setBp" :disabled="!breakpoint">设置断点</button><button @click="clearBp" :disabled="!sim.breakpoints.size">清除</button>
            <span v-if="sim.breakpoints.size" class="breakpoint-list">生效行：{{Array.from(sim.breakpoints).sort((a,b)=>a-b).join(', ')}}</span><span v-else class="breakpoint-list muted">暂无断点</span>
            <span class="debug-divider"></span><label for="watch-variable">监视变量</label><input id="watch-variable" v-model="watchVariable" @keyup.enter="setWatch" placeholder="例如 n">
            <button @click="setWatch" :disabled="!watchVariable.trim()">添加</button><button @click="clearWatch" :disabled="!sim.watchpoints.size">清除</button>
            <span v-if="sim.watchpoints.size" class="watch-list"><b v-for="name in Array.from(sim.watchpoints)" :key="name">{{name}} = {{frame?.variables[name] === undefined ? '—' : String(frame.variables[name])}}</b></span><span v-else class="watch-list muted">暂无监视变量</span>
            <span class="debug-divider"></span><button @click="takeSnapshot">保存快照</button><button @click="rollback" :disabled="!hasSnapshot">回滚</button>
          </div>
        </section>

        <section v-if="gameMode==='expedition'" class="lesson-panel battle-advice"><div class="lesson-heading"><div><span class="panel-kicker">TACTICAL BRIEF</span><strong>{{expeditionNeedsFirmware?'战术情报':'路线情报'}}</strong></div><span>{{expeditionNeedsFirmware?'读局势，再写固件':'先选行动，再进入下一战'}}</span></div><p>{{expeditionNeedsFirmware?'每一拍只能执行一个动作。敌人接触机体会造成伤害，先把感知条件放在移动之前。':'这里是决策节点，不需要运行代码。你的选择会改变资源、耐久和下一场战斗的优势。'}}</p><ol><li v-for="tip in expeditionScenario?.tactics" :key="tip">{{tip}}</li></ol><div v-if="expeditionNeedsFirmware" class="api-guide"><div><code>enemy_ahead()</code><span>敌人在正前方时为 true</span></div><div><code>enemy_near()</code><span>敌人距离 ≤ 2 时为 true</span></div><div><code>attack()</code><span>攻击正前方的敌人</span></div><div><code>shield()</code><span>本拍展开护盾，抵挡下一次伤害</span></div><div><code>wall_ahead()</code><span>前方是否被墙阻断</span></div><div><code>low_hp()</code><span>生命 ≤ 2 时为 true</span></div></div></section>
        <section v-else class="lesson-panel"><div class="lesson-heading"><div><span class="panel-kicker">LEARNING DECK</span><strong>本关怎么想</strong></div><span>先成功，再改动</span></div><p>{{currentLevel.id==='0-1'?'这一关只需要让机器人一直向前。先运行示例，确认你看到了出口。':currentLevel.id==='0-2'?'撞到墙不会前进，所以先用 wall_ahead() 问路，再决定转弯还是前进。':currentLevel.id==='1-1'?'史莱姆挡路时要先攻击；没有敌人时，再处理墙和移动。':currentLevel.id==='2-1'?'变量会记住之前的 Tick。walls 可以记录遇到过几次墙，帮助机器人改变路线。':'用 bool 变量记住上一次选择，让机器人在两个路口做不同的转向。'}}</p><div class="api-guide"><div><code>move_forward()</code><span>向前走一格</span></div><div><code>wall_ahead()</code><span>检查前方是不是墙</span></div><div><code>turn_right()</code><span>向右转 90°</span></div><div><code>enemy_ahead()</code><span>检查前方有没有史莱姆</span></div></div><details class="syntax-guide" open><summary>RoboC++ 语法速查（可直接改示例）</summary><div class="syntax-grid"><div><b>每拍执行的入口</b><code>void update() {\n  move_forward();\n}</code><small>大括号包住程序；每一拍从 update 开始。</small></div><div><b>记住一个数字或开关</b><code>int n = 0;\nbool ready = false;\nn = n + 1;</code><small>int 是整数，bool 只有 true / false；赋值要用 =。</small></div><div><b>做选择</b><code>if (wall_ahead()) {\n  turn_right();\n} else {\n  move_forward();\n}</code><small>if 条件为真执行前半段，否则执行 else。</small></div><div><b>重复有限次</b><code>for (int i = 0; i &lt; 3; i = i + 1) {\n  wait();\n}</code><small>for 会重复执行；每次循环必须让 i 改变。</small></div><div><b>常用符号</b><code>== 相等   != 不等\n&amp;&amp; 且      || 或\n! 取反      // 注释</code><small>比较用 ==，单个 = 是保存新值。</small></div><div><b>可用模块</b><code>传感器：wall_ahead()  enemy_ahead()\nlow_hp()  enemy_near()  low_energy()\n动作：move_forward()  turn_left()\nturn_right()  attack()  wait()  shield()</code><small>传感器只回答问题，动作才会改变机器人。</small></div></div></details></section>

        <section class="panel terminal">
          <div class="panel-head compact"><div><span class="panel-kicker">SYSTEM CONSOLE</span><strong>控制台</strong></div><span class="console-code">{{buildError||sim.status==='error'?'ERR':'SYS'}}</span></div>
          <div :class="['terminal-line',buildError||sim.status==='error'?'error':'']"><span class="prompt">›</span><span class="dot"></span>{{terminalMessage}}</div>
          <div v-if="sim.coreDump" class="core-dump">
            <div class="core-head"><strong>FAILURE CORE DUMP</strong><span>{{sim.coreDump.cause==='runtime_error'?'运行时错误':'机体损毁'}} · Tick {{sim.coreDump.tick}}</span></div>
            <div class="core-grid"><span>源码行 <b>{{sim.coreDump.sourceLine??'—'}}</b></span><span>位置 <b>{{sim.coreDump.robot.x}}, {{sim.coreDump.robot.y}}</b></span><span>朝向 <b>{{sim.coreDump.robot.dir}}</b></span><span>HP <b>{{sim.coreDump.robot.hp}}</b></span></div>
            <code>{{sim.coreDump.message}}</code>
            <div class="core-vars"><span v-for="(value,key) in sim.coreDump.variables" :key="key">{{key}}={{String(value)}}</span></div>
          </div>
          <div class="profiler"><span>PROFILER</span><b>Ticks {{sim.frames.length}}</b><b>Actions {{sim.frames.filter(item => !!item.action).length}}</b><b>Errors {{sim.frames.filter(item => !!item.error).length}}</b></div>
        </section>
      </div>

      <div class="right-column">
        <section :class="['panel','world',{threatened:enemyThreat,failed:sim.status==='failed'||sim.status==='error',success:sim.status==='success'}]">
          <div class="panel-head"><div><span class="panel-kicker">{{expeditionScenarioActive?'EXPEDITION BATTLEFIELD':'SIMULATION CHAMBER'}}</span><strong>{{expeditionScenarioActive?`远征战场 · ${expeditionScenario?.title??''}`:`模拟舱 · ${levelName(currentLevel.id)}`}}</strong></div><div class="coord"><span>X {{sim.robot.x}}</span><span>Y {{sim.robot.y}}</span><b>{{sim.robot.dir}}</b></div></div>
          <div class="objective"><span>{{expeditionScenarioActive?'远征目标':'关卡目标'}}</span><strong>{{expeditionScenarioActive?expeditionScenario?.objective:currentLevel.objective}}</strong><em v-if="sim.enemy.hp>0" :class="{danger:enemyThreat}">{{enemyThreat?'⚠ 接触危险':'史莱姆剩余'}} {{enemyThreat?'':' '+sim.enemy.hp+' HP'}}</em></div>
          <div class="map" :aria-label="expeditionScenarioActive?'远征地图':'关卡地图'">
            <div v-for="(row,y) in grid" :key="y" class="map-row">
              <div v-for="item in row" :key="item.x" :class="['tile',item.cell==='#'?'wall':'floor',item.cell==='E'?'exit':'',item.x===sim.robot.x&&item.y===sim.robot.y?'robot':'',item.x===sim.enemy.x&&item.y===sim.enemy.y&&sim.enemy.hp>0?'enemy':'']">
                <img v-if="item.x===sim.robot.x&&item.y===sim.robot.y" :src="robotSprite" :class="['robot-sprite',`dir-${sim.robot.dir}`]" alt="机器人">
                <img v-else-if="item.x===sim.enemy.x&&item.y===sim.enemy.y&&sim.enemy.hp>0" :src="slimeSprite" class="slime-sprite" alt="史莱姆">
                <img v-else-if="item.cell==='E'" :src="exitSprite" class="exit-sprite" alt="出口">
              </div>
            </div>
          </div>
          <div class="legend"><span><i class="robot-key"></i>机器人</span><span><i class="enemy-key"></i>史莱姆</span><span><i class="exit-key"></i>出口</span><span><i class="wall-key"></i>墙体</span></div>
        </section>

        <section class="panel trace">
          <div class="panel-head"><div><span class="panel-kicker">EXECUTION TRACE</span><strong>执行追踪</strong></div><span class="frame-count">{{sim.frames.length}} 帧</span></div>
          <div class="timeline"><button v-for="(item,index) in sim.frames" :key="item.tick" :class="{active:index===selected}" @click="selected=index">{{item.tick}}</button><span v-if="!sim.frames.length" class="empty">运行固件后，这里会记录每一次决策</span></div>
          <div v-if="frame" class="inspector">
            <div class="inspect-grid">
              <div><small>动作 ACTION</small><strong>{{actionName(frame.action)}}</strong></div><div><small>源码 SOURCE</small><strong>{{frame.sourceLine?`第 ${frame.sourceLine} 行`:'-'}}</strong></div><div><small>坐标 POSITION</small><strong>{{frame.robot.x}}, {{frame.robot.y}}</strong></div><div><small>朝向 FACING</small><strong>{{frame.robot.dir}}</strong></div><div><small>生命 HP</small><strong>{{frame.robot.hp}}</strong></div>
            </div>
            <div class="detail"><div><small>传感器 SENSORS</small><code v-for="sensor in frame.sensors" :key="sensor.name">{{sensor.name}}() → {{String(sensor.value)}}</code><span v-if="!frame.sensors.length">本 Tick 未读取传感器</span></div><div><small>变量 VARIABLES</small><code v-for="(value,key) in frame.variables" :key="key">{{key}} = {{String(value)}}</code><span v-if="!Object.keys(frame.variables).length">暂无持久变量</span></div></div>
            <div v-if="frame.events.length" class="event"><span v-for="item in frame.events" :key="item">{{eventName(item)}}</span></div>
          </div>
        </section>
      </div>
    </section>

    <footer><span>{{gameMode==='expedition'?`EXPEDITION / 节点 ${Math.min(expedition.nodeIndex+1,expedition.route.length)} · ${expeditionNodeName(expeditionNode??'')}`:`STORY / ${currentLevel.id} · ${levelName(currentLevel.id)}`}}</span><span>编写 CODE → 构建 BUILD → 运行 RUN → 追踪 TRACE</span></footer>
  </main>
</template>
