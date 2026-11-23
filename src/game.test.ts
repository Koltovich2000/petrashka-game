import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,advance,act,adoptDog,parseSave,feeling,beginTutorial,feed,wake,rest,foodReason,hygieneStage,blocked,cancelActivity,recordFloorMess,KEY,type Game} from './game';
import {applyClothing} from './economy';
import {TUTORIAL,xpProgress,levelRequirement} from './balance';
test('пять нужд: точный десятиминутный тик и дробные остатки',()=>{
 const g=fresh(0);assert.equal(advance(g,599999).food,100);
 const s=advance(g,600000);assert.deepEqual([s.food,s.energy,s.mood,s.hygiene,s.health],[99.25,99.25,99.5,99.5,100]);
 assert.deepEqual(advance(advance(g,123456),600123),advance(g,600123));
});
test('8 часов офлайн: снижение сытости и энергии на 36 пунктов',()=>{
 const s=advance({...fresh(0),food:80,energy:90,mood:80,hygiene:80},8*3600000,true);
 assert.deepEqual([s.food,s.energy,s.mood,s.hygiene],[44,54,56,56]);
});
test('офлайн ограничен 12 часами, повторный вход не повторяет расход',()=>{
 const s=advance(fresh(0),24*3600000,true);assert.equal(s.food,46);
 const loaded=parseSave(JSON.stringify(s),24*3600000);assert.equal(loaded.food,46);
 assert.equal(loaded.updated,24*3600000);
});
test('истощение: два часа отсрочки, общий штраф и экстренная госпитализация',()=>{
 const g={...fresh(0),food:0,energy:0};
 assert.equal(advance(g,7200000).health,100);assert.equal(advance(g,10800000).health,98);
 assert.equal(advance({...g,health:31},12*3600000,true).health,11);
 assert.equal(advance({...g,health:25},12*3600000,true).health,5);
 assert.equal(advance({...g,health:2},10800000).health,0);
});
test('сон без таймера: заморозка, энергия, явное пробуждение',()=>{
 const g=act({...fresh(0),energy:20,food:55,hygiene:40},'sleep',0);
 assert.equal(advance(g,3_600_000,true).energy,44);
 const exhausted=act({...fresh(0),energy:0},'sleep',0);
 const fullSleep=(4*60+10)*60_000;
 assert.ok(advance(exhausted,fullSleep-1).energy<100);
 assert.equal(parseSave(JSON.stringify(exhausted),fullSleep).energy,100);
 const s=advance(g,8*3600000,true);assert.deepEqual([s.energy,s.food,s.hygiene,s.health],[100,55,40,100]);assert.equal(s.sleepUntil,-1);
 const awake=wake(s,s.updated);assert.equal(awake.sleepUntil,null);assert.equal(advance(awake,s.updated+600000).food,54.25);
 assert.equal(parseSave(JSON.stringify(g),8*3600000).sleepUntil,-1);
});
test('сон запускается вручную из любой комнаты и прерывает незавершённое занятие',()=>{
 assert.equal(parseSave(JSON.stringify(fresh(0)),600000).sleepUntil,null);
 const playing=startActivity(fresh(0),'computer',0);
 const sleeping=runGameCommand(playing,{kind:'care',action:'sleep'},60_000,'bathroom');
 assert.deepEqual([sleeping.sleepUntil,sleeping.roomAction,sleeping.energy,sleeping.food],[-1,null,90,96]);
 const reloaded=parseSave(JSON.stringify(sleeping),600_000);
 assert.deepEqual([reloaded.sleepUntil,reloaded.roomAction,reloaded.economy.xp],[-1,null,0]);
 assert.equal(wake(reloaded,reloaded.updated).sleepUntil,null);
 assert.equal(startActivity(act(fresh(0),'sleep',0),'computer',0).roomAction,null);
 assert.equal(act(fresh(0),'sleep',0).sleepUntil,-1);
 assert.equal(act(beginTutorial(0),'sleep',0).sleepUntil,null);
 assert.equal(act(rest(fresh(0),0),'sleep',0).restUntil,null);
 const bathing=startActivity(fresh(0),'bath',0);
 const afterBath=act(bathing,'sleep',BATH_READY_AT);
 assert.deepEqual([afterBath.roomAction,afterBath.sleepUntil,afterBath.hairWashedAt],[null,-1,BATH_READY_AT]);
 const completed=advance(playing,600_000,true);
 assert.deepEqual([completed.energy,completed.food,completed.economy.xp],[90,96,16]);
 const later=advance(completed,1_200_000,true);
 assert.deepEqual([later.energy,later.food],[89.25,95.25]);
});
test('ограничения гигиены включают границы 50, 20 и 10',()=>{
 for(const [value,stage] of [[51,'clean'],[50,'wet'],[21,'wet'],[20,'smelly'],[11,'smelly'],[10,'accident'],[0,'accident']] as const)assert.equal(hygieneStage(value),stage);
});
test('мытьё снимает стадии постепенно, сохранение их восстанавливает',()=>{
 const g={...fresh(0),hygiene:10},bath=act(g,'wash',0);
 const washed=scrubTimes(bath,40,120_000);assert.equal(hygieneStage(washed.hygiene),'wet');
 const clean=scrubTimes(washed,1,240_000);assert.equal(hygieneStage(clean.hygiene),'clean');
 assert.equal(parseSave(JSON.stringify(g),0).hygiene,10);
});
test('цены и эффекты еды, нет отрицательного баланса',()=>{
 const g={...fresh(0),food:25,mood:50,economy:{...fresh(0).economy,balance:150}};
 const s=feed(g,'burger',0);assert.deepEqual([s.food,s.mood,s.economy.balance],[65,53,35]);
 assert.match(foodReason({...g,economy:{...g.economy,balance:0}},'burger'),/Не хватает/);
 assert.equal(feed({...g,economy:{...g.economy,balance:0}},'burger',0).food,25);
});
test('защита от тупика: бесплатная еда, душ и отдых с нулевыми ресурсами',()=>{
 let g={...fresh(0),food:0,energy:0,hygiene:0};g=feed(g,'free',0);assert.equal(g.food,25);
 assert.equal(feed(g,'free',60000).cares,1);assert.match(foodReason(advance(g,60000),'free'),/Помощь/);
 const resting=rest(g,0),done=advance(resting,600000);assert.equal(done.energy,10);assert.equal(done.food,23);
 assert.equal(advance(done,600001).energy,10);assert.equal(scrubTimes(act(done,'wash',600_000),40,720_000).hygiene,40);
});
test('обучение из четырёх шагов даёт 2 уровень и завершает обучение с 0 ₽',()=>{
 let g=beginTutorial(0);
 assert.ok(blocked(g,'wash'));
 g=feed(g,'free',0);
 assert.deepEqual([g.food,g.tutorial,g.economy.xp,g.economy.balance],[80,TUTORIAL.noodles,45,100]);
 g=parseSave(JSON.stringify(g),15000);
 g=feed(g,'noodles',15000);
 assert.deepEqual([g.economy.balance,g.food,g.economy.xp],[0,100,60]);
 g=scrubTimes(act(g,'wash',15_000),100,135_000);
 assert.equal(g.economy.xp,75);
 g=act(cancelActivity(g,135_000),'sleep',135000);
 assert.deepEqual([g.tutorial,g.economy.balance,g.economy.xp,g.sleepUntil],[TUTORIAL.done,0,100,-1]);
 assert.equal(g.tourSection,'room');
 assert.equal(xpProgress(g.economy.xp).level,2);
 assert.equal(parseSave(JSON.stringify(g),86400000).economy.xp,100);
});
test('знакомство с разделами идёт по порядку, сохраняется между входами и завершено один раз',()=>{
 const ts=135_000;
 let game=act({...beginTutorial(ts),tutorial:TUTORIAL.sleep},'sleep',ts);
 const ack=(section:TourSection)=>{game=runGameCommand(game,{kind:'tourNext',section},ts,'room');};
 ack('shop');
 assert.equal(game.tourSection,'room');
 for(const section of tourSections){
  game=parseSave(JSON.stringify(game),ts);
  assert.equal(game.tourSection,section);
  ack(section);
  const advanced=game.tourSection;
  ack(section);
  assert.equal(game.tourSection,advanced);
 }
 assert.equal(game.tourSection,undefined);
 assert.equal(parseSave(JSON.stringify(game),ts).tourSection,undefined);
 const returning=runGameCommand(fresh(ts),{kind:'tourNext',section:'room'},ts,'room');
 assert.equal(returning.tourSection,undefined);
 assert.equal(game.economy.balance,0);
});
test('кривая опыта и лимит 20 уровней',()=>{
 assert.equal(levelRequirement(2),128);assert.equal(levelRequirement(5),248);
 assert.deepEqual(xpProgress(100),{level:2,progress:0,required:128,max:false});assert.equal(xpProgress(228).level,3);assert.equal(xpProgress(1e12).level,20);
});
test('при удалении карьеры расчёт прошлого занятия выполняется один раз',()=>{
 const old={...fresh(0),version:2,tutorial:undefined,food:55,economy:{balance:777,xp:250,shift:{id:'old',minutes:15,started:0,ends:900000,pay:125}}};
 const g=parseSave(JSON.stringify(old),0);
 assert.deepEqual([g.version,g.tutorial,g.food,g.economy.balance],[4,TUTORIAL.done,55,902]);
 assert.equal(xpProgress(g.economy.xp).level,3);
 assert.deepEqual(parseSave(JSON.stringify(g),900000).economy,g.economy);
 assert.equal(KEY,'petrashka:v1');

 const stopped={...beginTutorial(0),version:3,tutorial:1,economy:{balance:0,xp:15}};
 const migrated=parseSave(JSON.stringify(stopped),0);
 assert.deepEqual([migrated.tutorial,migrated.economy.balance,migrated.economy.xp],[TUTORIAL.noodles,100,45]);
 assert.deepEqual(parseSave(JSON.stringify(migrated),10).economy,migrated.economy);

 const study={...fresh(0),version:3,tutorial:5,study:{course:'book',skill:'fitness',started:0,ends:600_000}};
 const earned=parseSave(JSON.stringify(study),0);
 assert.equal(earned.fitnessXP,2);assert.equal(earned.economy.xp,12);assert.ok(!('study' in earned));
});
test('сон и бесплатная помощь недоступны в больнице',()=>{
 const g=advance({...fresh(0),health:0},0);
 assert.equal(g.hospital?.status,'hospitalized');
 assert.equal(act(g,'heal',0).health,0);assert.equal(feed(g,'free',0).cares,0);
 assert.equal(advance(g,86400000,true).hospital?.cost,2400);
});
test('покупки не позволяют потратить деньги учебной лапши',()=>{
 const g={...beginTutorial(0),economy:{...fresh(0).economy,balance:500}};assert.equal(applyClothing(g,'hat',1),g);
});
test('онлайн расчёт одинаков при разной частоте тиков',()=>{
 const g={...fresh(0),food:3,energy:2};let live=g;
 for(let t=1000;t<=14400000;t+=1000)live=advance(live,t);
 assert.deepEqual(live,advance(g,14400000));
});

import {buyFurniture,moveFurniture,startActivity,activityReason,activityLocation,gameDate,furnitureCatalog,scrubBath,returnBall,BATH_READY_AT} from './activities';
import {advanceBathStroke,advanceBathSwipe,type BathStroke,type BathSwipe} from './bathScrub';
import {yogaFrame,yogaPoseAt,yogaPoseDuration,yogaPoses,yogaSetupDuration} from './yoga';
import {roomLighting} from './roomLighting';
function scrubTimes(g:ReturnType<typeof fresh>,count:number,now:number){
 for(let stroke=0;stroke<count&&g.roomAction?.kind==='bath';stroke++)g=scrubBath(g,g.roomAction.id,now);
 return g;
}
import {starterCloset,savePreset,wearPreset,renamePreset,deletePreset,defaultOutfit,wardrobeItems,categoryKeys,parseOutfit} from './wardrobe';
import {hairWetness} from './hair';
const rich=()=>({...fresh(0),economy:{...fresh(0).economy,balance:100000,xp:5000}});
test('освещение меняется по московскому времени на границах расписания',()=>{
 const expected=[
  ['05:29','night'],['05:30','morning'],['06:59','morning'],['07:00','day'],
  ['11:59','day'],['12:00','golden'],['13:59','golden'],['14:00','sunset'],
  ['14:59','sunset'],['15:00','night'],['21:00','night'],
 ];
 for(const [clock,lighting] of expected){
  assert.equal(roomLighting(Date.parse(`2026-11-20T${clock}:00Z`)),lighting);
 }
 assert.equal(roomLighting(Date.parse('2026-11-20T17:00:00+03:00')),roomLighting(Date.parse('2026-11-20T09:00:00-05:00')));
});
test('йога переносит купленный коврик в зал и сохраняет случайную последовательность',()=>{
 const game=moveFurniture(buyFurniture(rich(),'yoga'),'yoga',.26,.88);
 assert.equal(furnitureCatalog.find(item=>item.id==='yoga')?.location,'hall');
 const started=startActivity(game,'yoga',0);
 assert.equal(started.roomAction?.kind,'yoga');
 if(started.roomAction?.kind!=='yoga')return;
 const action=started.roomAction;
 const resumed=parseSave(JSON.stringify(started),45_000);
 assert.equal(activityLocation(action),'hall');
 assert.deepEqual(resumed.furniture.yoga,{x:.26,y:.88});
 assert.deepEqual(resumed.roomAction,action);
 assert.equal(yogaFrame(0,action.yogaSeed).phase,'walk-to-mat');
 assert.equal(yogaFrame(yogaSetupDuration-1,action.yogaSeed).phase,'unroll');
 for(let block=0;block<3;block++){
  const poses=Array.from({length:3},(_,i)=>yogaPoseAt(action.yogaSeed,block*3+i));
  assert.deepEqual(new Set(poses),new Set(yogaPoses));
  if(block)assert.notEqual(poses[0],yogaPoseAt(action.yogaSeed,block*3-1));
 }
 const first=yogaFrame(yogaSetupDuration,action.yogaSeed);
 assert.equal(yogaFrame(yogaSetupDuration+yogaPoseDuration-1,action.yogaSeed).pose,first.pose);
 assert.notEqual(yogaFrame(yogaSetupDuration+yogaPoseDuration,action.yogaSeed).pose,first.pose);
 const legacy={...started,roomAction:{id:action.id,kind:action.kind,started:action.started,ends:action.ends,bonus:action.bonus}};
 assert.equal(parseSave(JSON.stringify(legacy),1000).roomAction?.kind,'yoga');
});
test('мебель: покупка каждого предмета ровно один раз и сохранение',()=>{
 let g=adoptDog(rich(),'Шарик');for(const i of furnitureCatalog){const before=g.economy.balance;g=buyFurniture(g,i.id);assert.equal(g.economy.balance,before-i.price);assert.equal(buyFurniture(g,i.id),g);assert.ok(parseSave(JSON.stringify(g),0).furniture[i.id]);}
 assert.equal(buyFurniture(fresh(0),'yoga').furniture.yoga,undefined);
 assert.equal(buyFurniture({...rich(),economy:{...rich().economy,balance:0}},'yoga').furniture.yoga,undefined);
});
test('мебель: расстановка ограничена полом и не изменяет чужие предметы',()=>{
 let g=buyFurniture(rich(),'yoga');g=moveFurniture(g,'yoga',-10,100);assert.deepEqual(g.furniture.yoga,{x:.2,y:.90});
 assert.deepEqual(parseSave(JSON.stringify(g),0).furniture,g.furniture);assert.equal(moveFurniture(g,'tray',1,1),g);
 assert.deepEqual(fresh(0).furniture,{});
 g=moveFurniture(buyFurniture(g,'roomPlant'),'roomPlant',.44,.78);
 assert.deepEqual(parseSave(JSON.stringify(g),0).furniture,{yoga:{x:.2,y:.90},roomPlant:{x:.44,y:.78}});
});
test('собака сохраняется, а покупка лотка доступна только после её появления',()=>{
 const initial=rich();
 assert.equal(buyFurniture(initial,'tray'),initial);
 assert.equal(adoptDog(initial,'  '),initial);
 assert.equal(adoptDog(initial,undefined),initial);
 const adopted=adoptDog(initial,'  Шарик  ');
 assert.equal(adopted.economy.balance,initial.economy.balance);
 assert.equal(adoptDog(adopted,'Пушок'),adopted);
 const restored=parseSave(JSON.stringify(adopted),0);
 assert.equal(restored.dog,true);
 assert.equal(restored.dogCare?.name,'Шарик');
 assert.equal(adoptDog(fresh(0),'Шарик').dogCare?.name,'Шарик');
 assert.deepEqual(buyFurniture(restored,'tray').furniture.tray,{x:.29,y:.77});
 const legacy=parseSave(JSON.stringify({...initial,dog:undefined,furniture:{tray:{x:.5,y:.88},dumbbells:{x:.68,y:.89}}}),0);
 assert.equal(legacy.dog,false);
 assert.deepEqual(legacy.furniture.tray,{x:.34,y:.80});
 assert.deepEqual(legacy.furniture.dumbbells,{x:.72,y:.80});
 const workout=startActivity(legacy,'dumbbells',0);
 assert.equal(activityLocation(workout.roomAction!),'hall');
});
test('мочалка засчитывает только завершённое движение туда и обратно',()=>{
 const stroke:BathStroke={start:{x:0,y:0},direction:null,peak:0};
 const move=(x:number,y=0)=>advanceBathStroke(stroke,{x,y},20);
 assert.equal(move(12),false);
 assert.equal(move(24),false);
 assert.equal(move(60),false);
 assert.equal(move(53),false);
 assert.equal(move(54,24),false);
 assert.equal(move(30,24),true);
 assert.equal(move(28,24),false);
 assert.equal(move(30,80),false);
 assert.equal(move(30,42),true);
});
test('ванна: +1 гигиены за движение, можно начать и продолжать при 100%',()=>{
 const g={...fresh(0),hygiene:30,mood:50,energy:1},start=startActivity(g,'bath',0);
 const id=start.roomAction!.id;
 assert.equal(start.energy,0);assert.equal(start.hygiene,30);assert.equal(start.roomAction?.ends,null);
 assert.equal(startActivity(start,'toilet',0).roomAction?.kind,'bath');
 assert.equal(scrubBath(start,id,BATH_READY_AT-1).hygiene,30);
 assert.equal(scrubBath(start,'another-bath',BATH_READY_AT).hygiene,30);
 assert.equal(advance(start,600_000).hygiene,29.5);
 assert.equal(advance(start,600_000).roomAction?.kind,'bath');
 const first=scrubBath(start,id,BATH_READY_AT);
 assert.deepEqual([first.hygiene,first.mood],[31,50]);
 const resumed=parseSave(JSON.stringify(first),120_000);
 assert.equal(resumed.hygiene,31);assert.equal(resumed.roomAction?.kind,'bath');
 const full=scrubTimes(resumed,75,120_000);
 assert.deepEqual([full.hygiene,full.mood,full.roomAction?.id],[100,50,id]);
 assert.equal(scrubBath(full,id,120_100).roomAction?.kind,'bath');
 assert.equal(cancelActivity(full,120_100).hygiene,100);
 assert.equal(startActivity(fresh(0),'bath',0).roomAction?.kind,'bath');
 assert.equal(act(start,'pet',0).mood,50);
});
test('мочалка звучит один раз за взмах и снова при заметной смене направления',()=>{
 const swipe:BathSwipe={edge:{x:0,y:0},direction:null};
 const move=(x:number,y=0)=>advanceBathSwipe(swipe,{x,y},14);
 assert.equal(move(4),false);
 assert.equal(move(16),true);
 assert.equal(move(32),false);
 assert.equal(move(53),false);
 assert.equal(move(48),false);
 assert.equal(move(37),true);
 assert.equal(move(18),false);
 assert.equal(move(18,18),true);
});
test('отмена ванны сохраняет полученную гигиену, отмена компьютера не даёт опыта',()=>{
 const initial={...fresh(0),hygiene:40,mood:50,tutorial:TUTORIAL.bath};
 const bath=startActivity(initial,'bath',0);
 const id=bath.roomAction!.id;
 const cancelled=cancelActivity(scrubBath(bath,id,BATH_READY_AT),119999);
 assert.equal(cancelled.roomAction,null);
 assert.deepEqual([cancelled.energy,cancelled.hygiene,cancelled.mood,cancelled.tutorial],[98,41,50,TUTORIAL.bath]);
 assert.equal(parseSave(JSON.stringify(cancelled),120000).tutorial,TUTORIAL.bath);
 const done=scrubTimes(bath,70,120_000);
 assert.equal(done.hygiene,100);
 assert.equal(done.tutorial,TUTORIAL.sleep);
 assert.equal(done.economy.xp,15);
 assert.equal(done.roomAction?.kind,'bath');
 assert.equal(cancelActivity(done,120_000).roomAction,null);

 const computer=startActivity({...initial,tutorial:TUTORIAL.done},'computer',0);
 const afterReload=parseSave(JSON.stringify(cancelActivity(computer,1000)),600000);
 assert.equal(afterReload.roomAction,null);
 assert.deepEqual(afterReload.economy,{balance:0,xp:0});
 assert.deepEqual([afterReload.energy,afterReload.food,afterReload.hygiene,afterReload.mood],[90,96,39,50]);
});
test('какашки сохраняются в своей комнате после мытья и перезагрузки',()=>{
 const dirty=recordFloorMess({...fresh(0),hygiene:10},'hallway');
 assert.deepEqual(recordFloorMess(dirty,'bathroom').floorMess,{hallway:true});
 const bathing=scrubTimes(startActivity(dirty,'bath',0),40,BATH_READY_AT);
 const washed=recordFloorMess(cancelActivity(bathing,BATH_READY_AT),'bathroom');
 assert.equal(washed.hygiene,50);
 assert.deepEqual(parseSave(JSON.stringify(washed),120_000).floorMess,{hallway:true});
 assert.deepEqual(recordFloorMess({...washed,hygiene:10},'room').floorMess,{hallway:true,room:true});
});

test('уборка убирает только выбранную кучку и не повторяет происшествие при низкой гигиене',()=>{
 const dirty={...recordFloorMess({...fresh(0),hygiene:10},'bathroom'),floorMess:{bathroom:true,room:true} as const};
 assert.equal(startActivity(dirty,'clean',0,'hallway').roomAction,null);
 const started=startActivity(dirty,'clean',0,'bathroom');
 assert.equal(parseSave(JSON.stringify(started),1000).roomAction?.cleanupLocation,'bathroom');
 assert.deepEqual(cancelActivity(started,1000).floorMess,dirty.floorMess);
 const cleaned=parseSave(JSON.stringify(started),3000);
 assert.deepEqual(cleaned.floorMess,{room:true});
 assert.deepEqual(recordFloorMess(cleaned,'bathroom').floorMess,{room:true});
 assert.deepEqual([cleaned.hygiene,cleaned.mood,cleaned.energy,cleaned.cares],[10,100,100,0]);
});
test('компьютер: ресурсы, 10 минут, офлайн и точное завершение',()=>{
 const g={...fresh(0),mood:30,economy:{balance:245,xp:100}};const started=startActivity(g,'computer',0);assert.deepEqual([started.energy,started.food,started.hygiene],[90,96,99]);
 const done=parseSave(JSON.stringify(started),600000);assert.equal(done.mood,42);assert.equal(done.roomAction,null);assert.equal(done.food,96);
 assert.deepEqual(done.economy,{balance:245,xp:116});assert.deepEqual(parseSave(JSON.stringify(done),600000).economy,done.economy);
 assert.deepEqual(runGameCommand(started,{kind:'care',action:'sleep'},600_000,'room').economy,done.economy);
 assert.match(activityReason({...g,energy:14},'computer'),/15 энергии/);assert.match(activityReason({...g,food:9},'computer'),/10 сытости/);
});
test('мяч в прихожей: +1 за возврат без лимита, сохранение счёта и перезарядки',()=>{
 const initial={...fresh(0),mood:97};
 const started=startActivity(initial,'ball',0);
 assert.equal(started.energy,90);
 assert.equal(started.mood,97);
 assert.equal(started.roomAction?.ends,null);
 const id=started.roomAction!.id;
 const once=returnBall(started,id,10_000);
 const resumed=parseSave(JSON.stringify(once),18_000);
 assert.equal(resumed.roomAction?.kind==='ball'&&resumed.roomAction.returns,1);
 assert.equal(resumed.mood,98);
 const twice=returnBall(resumed,id,19_000);
 assert.equal(returnBall(twice,'old-ball',19_500).mood,99);
 const third=returnBall(twice,id,20_000);
 assert.equal(third.mood,100);
 const fourth=returnBall(third,id,21_000);
 assert.equal(fourth.mood,100);
 const continued=parseSave(JSON.stringify(fourth),22_000);
 assert.equal(continued.roomAction?.kind==='ball'&&continued.roomAction.returns,4);
 const done=cancelActivity(continued,22_000);
 assert.equal(done.roomAction,null);
 assert.equal(done.mood,100);
 assert.equal(done.energy,90);
 assert.equal(startActivity(done,'ball',29999).roomAction,null);
 assert.equal(startActivity(done,'ball',30000).roomAction?.kind,'ball');
 assert.equal(startActivity({...initial,energy:9},'ball',0).roomAction,null);
 assert.equal(startActivity({...initial,tutorial:3},'ball',0).roomAction,null);
});
test('сохранения с прежним таймером ванны и мяча продолжаются вручную',()=>{
 const initial={...fresh(0),hygiene:20,mood:40};
 for(const [kind,ends] of [['bath',120_000],['ball',15_000]] as const){
  const legacy={...initial,roomAction:{kind,started:0,ends,id:'existing',bonus:true}};
  const resumed=parseSave(JSON.stringify(legacy),180_000);
  assert.equal(resumed.roomAction?.kind,kind);
  assert.equal(resumed.roomAction?.ends,null);
  assert.equal(resumed.hygiene,20);
  assert.equal(resumed.mood,40);
 }
});
test('унитаз и лоток: общий 90-минутный кулдаун бонуса',()=>{
 let g={...buyFurniture(adoptDog(rich(),'Шарик'),'tray'),mood:10};g=advance(startActivity(g,'toilet',0),60000);assert.equal(g.mood,14);
 g=advance(startActivity(g,'tray',60000),120000);assert.equal(g.mood,14);assert.equal(g.hygiene,88);
 const ready={...g,updated:g.toiletBonusAt};const next=advance(startActivity(ready,'tray',ready.updated),ready.updated+60000);assert.equal(next.mood,24);assert.equal(next.hygiene,76);
});
test('тренировки: пороги, 3 полных награды в день, затем половина',()=>{
 let g=buyFurniture(buyFurniture(rich(),'yoga'),'dumbbells');
 assert.match(activityReason({...g,energy:12},'yoga'),/13 энергии/);assert.match(activityReason({...g,food:29},'dumbbells'),/30 сытости/);
 for(let i=0;i<4;i++){g={...g,energy:100,food:100};g=advance(startActivity(g,'yoga',i*600000),(i+1)*600000);}
 assert.equal(g.fitnessXP,21);assert.equal(g.training.count,4);
 const tomorrow={...g,updated:86400000,energy:100,food:100};const next=advance(startActivity(tomorrow,'dumbbells',86400000),87000000);assert.equal(next.fitnessXP,31);assert.equal(next.training.count,1);
 assert.notEqual(gameDate(Date.UTC(2026,10,14,20,59)),gameDate(Date.UTC(2026,10,14,21,0)));
});
test('3 бесплатных образа: сохранить, надеть, обновить, переименовать, удалить',()=>{
 let c=starterCloset();c=savePreset(c,'Первый');const first=c.presets[0].id;c=savePreset(c,'Второй');c=savePreset(c,'Третий');assert.equal(c.presets.length,3);assert.equal(savePreset(c,'Четвёртый'),c);
 c=wearPreset(c,first);c=savePreset(c,'Обновлён',first);assert.equal(c.presets.length,3);assert.equal(c.presets[0].name,'Обновлён');c=renamePreset(c,first,'На работу');assert.equal(c.presets[0].name,'На работу');
 const loaded=parseSave(JSON.stringify({...fresh(0),closet:c}),0).closet!;assert.deepEqual(loaded,c);assert.equal(loaded.activePreset,first);
 c=deletePreset(c,first);assert.equal(c.presets.length,2);assert.equal(c.activePreset,null);
});
test('существующие вещи, покупка и наряд не теряются после добавления пресетов',()=>{
 let g=applyClothing(rich(),'hat',6);g={...g,closet:savePreset(g.closet!,'Шлем')};const price=g.economy.balance;
 g=applyClothing(g,'hat',-1);g={...g,closet:wearPreset(g.closet!,g.closet!.presets[0].id)};
 assert.equal(g.closet!.outfit.hat,6);assert.equal(g.economy.balance,price);assert.equal(parseSave(JSON.stringify(g),0).closet!.presets.length,1);
 assert.deepEqual(parseOutfit('broken'),defaultOutfit);
});
test('убранные вещи нельзя примерить или купить, старые покупки и остальные слоты сохраняются',()=>{
 assert.deepEqual(categoryKeys.map(key=>wardrobeItems(key).map(item=>item.index)),[
  [0,1,2,5,6],[0,2,6,7,8],[0,1,2,3,9],[6,7],[1,3,5,6,8]
 ]);
 const base=applyClothing(rich(),'shoes',3);
 const outfit={...base.closet!.outfit,top:3,hat:1};
 const closet=savePreset({...base.closet!,outfit,owned:{...base.closet!.owned,top:[0,3],hat:[1]},
  paid:{...base.closet!.paid,top:{3:200},hat:{1:120}}},'Старый наряд');
 const old={...base,closet};
 assert.equal(applyClothing(base,'top',3),base);
 assert.equal(applyClothing(old,'hat',1),old);
 for(const saved of [parseSave(JSON.stringify(old),0),advance(old,0)]){
  const updated=saved.closet!;
  const replacement={...defaultOutfit,shoes:3};
  assert.deepEqual(updated.outfit,replacement);
  assert.deepEqual(updated.presets[0].outfit,replacement);
  assert.deepEqual(updated.paid,closet.paid);
  assert.deepEqual(updated.owned,closet.owned);
  assert.equal(saved.economy.balance,base.economy.balance);
 }
});
test('после ванны волосы сохнут четырьмя фазами по 15 минут, включая время вне игры',()=>{
 const bath=startActivity(rich(),'bath',0);
 assert.equal(hairWetness(cancelActivity(bath,100)),0);
 const finished=cancelActivity(bath,1000);
 assert.equal(finished.roomAction,null);
 assert.equal(finished.hairWashedAt,1000);
 for(const [minutes,phase] of [[0,4],[14,4],[15,3],[30,2],[45,1],[59,1],[60,0]]){
  const loaded=parseSave(JSON.stringify(finished),1000+minutes*60_000);
  assert.equal(hairWetness(loaded),phase);
 }
 const nextBath=startActivity(finished,'bath',3_601_000);
 assert.equal(hairWetness(cancelActivity(nextBath,3_602_000)),4);
});
import {advanceHeadStroke,bodyPart,type HeadStroke} from './body';
test('области тела продолжают различать голову, живот, ноги, руки и ступни',()=>{assert.equal(bodyPart(.5,.25),'head');assert.equal(bodyPart(.5,.6),'belly');assert.equal(bodyPart(.5,.8),'legs');assert.equal(bodyPart(.32,.6),'right-arm');assert.equal(bodyPart(.68,.6),'left-arm');assert.equal(bodyPart(.43,.95),'right-foot');assert.equal(bodyPart(.57,.95),'left-foot');});

import {buyBed, openBusiness, businessIncome, collectBusiness} from './property';
test('отмена отдыха пропускает награду',()=>{
 const ready={...fresh(0),energy:80};
 assert.equal(advance(cancelActivity(rest(ready,0),1000),600000).energy,80);
});

test('кровать списывает цену один раз и сохраняет скорость восстановления после загрузки', () => {
 const initial = {...rich(), energy: 10};
 const bought = buyBed(initial, 'comfort', 0);
 assert.equal(bought.economy.balance, initial.economy.balance - 4_500);
 assert.equal(buyBed(bought, 'comfort', 0).economy.balance, bought.economy.balance);
 const asleep = act(bought, 'sleep', 0);
 assert.equal(parseSave(JSON.stringify(asleep), 3_600_000).energy, 30);
});

test('бизнес требует уровень 15 и начисляет максимум 8 часов до сбора', () => {
 const initial = rich();
 assert.equal(openBusiness(initial, 'lemonade', 0).businesses.lemonade, undefined);
 const ready = {...initial, economy: {...initial.economy, xp: 50_000}};
 const opened = openBusiness(ready, 'lemonade', 0);
 assert.equal(opened.economy.balance, ready.economy.balance - 12_000);
 assert.equal(openBusiness(opened, 'lemonade', 0).economy.balance, opened.economy.balance);
 const loaded = parseSave(JSON.stringify(act(opened, 'sleep', 0)), 10 * 3_600_000);
 assert.equal(businessIncome(loaded, 'lemonade'), 1000);
 const collected = collectBusiness(loaded, 'lemonade', loaded.updated);
 assert.equal(collected.economy.balance, opened.economy.balance + 1000);
 assert.equal(collectBusiness(collected, 'lemonade', loaded.updated).economy.balance, collected.economy.balance);
});

test('поглаживание засчитывается только после полного движения туда и обратно',()=>{
 const stroke:HeadStroke={start:{x:0,y:0},direction:null};
 const move=(x:number,y=0)=>advanceHeadStroke(stroke,{x,y},20);
 for(const x of [3,-4,7,0,20,40,60,35,18,6])assert.equal(move(x),false);
 assert.equal(move(0),true);
 assert.equal(move(0),false);
 assert.equal(move(0,40),false);
 assert.equal(move(0,10),false);
 assert.equal(move(0,0),true);
 assert.equal(move(0,-35),false);
 assert.equal(move(0,35),false);
 assert.equal(move(0,0),false);
 assert.equal(move(0,-35),true);
});
test('каждое поглаживание даёт +1 до 70, в том числе в старом сохранении', () => {
 const start = {...fresh(0), mood:68.5, energy:25, food:31, health:42, cooldowns:{...fresh(0).cooldowns,pet:15_000}};
 const loaded=parseSave(JSON.stringify({...start,petStrokes:2}),0);
 const first=act(loaded,'pet',0);
 assert.equal(first.mood,69.5);
 let state=first;
 for(let i=0;i<2;i++)state=act(state,'pet',0);
 assert.deepEqual([state.mood,state.energy,state.food,state.health],[70,25,31,42]);
 assert.equal(state.cares,3);
 assert.equal(act({...state,mood:80},'pet',0).mood,80);
});

test('старое посещение туалета загружается без удалённого варианта сцены', () => {
 const started = startActivity(fresh(0),'toilet',0);
 const saved={...started,roomAction:{...started.roomAction,toiletVisit:'poop'}};
 const restored = parseSave(JSON.stringify(saved),30_000);
 assert.deepEqual(restored.roomAction,started.roomAction);
 assert.equal(advance(restored,60_000).roomAction,null);
});

import {advanceDogCare,dogFoodPrice,dogHungerLimit,dogIsSleepingAt,dogMessInterval,dogReclaimPrice,dogSatiety,dogShelterAfter,newDogCare} from './dogSchedule';
import {dogPointAt,dogRoute,measureDogRoute} from './dogNavigation';

test('собака спит с 22:00 до 08:00 по Москве, включая смену даты',()=>{
 for(const [stamp,asleep] of [
  ['2026-11-23T21:59:59+03:00',false],
  ['2026-11-23T19:00:00Z',true],
  ['2026-11-24T00:00:00+03:00',true],
  ['2026-11-24T07:59:59+03:00',true],
  ['2026-11-24T05:00:00Z',false],
 ] as const)assert.equal(dogIsSleepingAt(Date.parse(stamp)),asleep,stamp);
});
import {runGameCommand} from './gameCommands';

test('собака оставляет след раз в четыре часа с общим пределом в четыре следа',()=>{
 const initial={...newDogCare(0),seed:1234};
 assert.equal(advanceDogCare(initial,dogMessInterval-1),initial);
 const now=4*dogMessInterval;
 const after=advanceDogCare(initial,now);
 assert.equal(after.nextMessAt,5*dogMessInterval);
 assert.equal(after.messes.length,4);
 after.messes.forEach((mess,index)=>assert.equal(mess.at,(index+1)*dogMessInterval));
 assert.ok(after.messes.every(mess=>mess.kind==='pee'||mess.kind==='poop'));
 assert.equal(advanceDogCare(after,now),after);
 const capped=advanceDogCare(after,8*dogMessInterval);
 assert.deepEqual(capped.messes,after.messes);
 assert.equal(capped.nextMessAt,9*dogMessInterval);
 const slot={...capped,messes:capped.messes.slice(1)};
 assert.equal(advanceDogCare(slot,9*dogMessInterval-1),slot);
 assert.deepEqual(advanceDogCare(slot,9*dogMessInterval).messes.map(mess=>mess.at),
  [2,3,4,9].map(window=>window*dogMessInterval));
 const saved=parseSave(JSON.stringify({...fresh(0),dog:true,dogCare:after,updated:now}),now);
 assert.deepEqual(saved.dogCare,after);
 assert.ok(parseSave(JSON.stringify({...fresh(0),dog:true}),0).dogCare);
});

test('уборка собачьей кучки удаляет только выбранную, включая продолжение после загрузки',()=>{
 const state=advanceDogCare({...newDogCare(0),seed:1234},4*dogMessInterval);
 const item=state.messes[0],now=4*dogMessInterval;
 const game={...fresh(now),dog:true,dogCare:state,floorMess:{[item.location]:true}};
 assert.equal(startActivity(game,'clean',now,item.location,item.at+1).roomAction,null);
 const cleaning=startActivity(game,'clean',now,item.location,item.at);
 assert.equal(cleaning.roomAction?.cleanupDogMessAt,item.at);
 const after=parseSave(JSON.stringify(cleaning),now+3000);
 assert.equal(after.dogCare?.messes.some(mess=>mess.at===item.at),false);
 assert.equal(after.dogCare?.messes.length,3);
 assert.equal(after.floorMess[item.location],true);
 const nextWindow=5*dogMessInterval;
 const offline=parseSave(JSON.stringify(cleaning),nextWindow);
 assert.deepEqual(offline.dogCare,advance(after,nextWindow,true).dogCare);
 assert.ok(offline.dogCare?.messes.some(mess=>mess.at===nextWindow));
});

test('собака проходит по глубине и ширине свободного пола и обходит мебель',()=>{
 const furniture=[{left:.45,right:.53,top:.565,bottom:.83},{left:.68,right:.75,top:.78,bottom:.85}];
 const points=dogRoute('hall',furniture,390,630,13,false);
 const route=measureDogRoute(points,390,630);
 assert.ok(route.length>550);
 assert.ok(Math.max(...points.map(point=>point.y))-Math.min(...points.map(point=>point.y))>.25);
 for(let i=0;i<=600;i++){
  const point=dogPointAt(route,i/600);
  assert.ok(furniture.every(rect=>point.x<rect.left||point.x>rect.right||point.y<rect.top||point.y>rect.bottom));
 }
});

test('изменения админ-панели применяются только для авторизованного администратора',()=>{
 const start=fresh(0);
 const admin={kind:'admin',values:{mood:46,balance:1729}} as const;
 assert.deepEqual(runGameCommand(start,admin,0,'room'),runGameCommand(start,{kind:'sync'},0,'room'));
 const updated=runGameCommand(start,admin,0,'room',true);
 assert.equal(updated.mood,46);
 assert.equal(updated.economy.balance,1729);
});

test('личный максимум характеристики переживает уход, расход и загрузку сохранения',()=>{
 const boosted=runGameCommand(fresh(0),{kind:'admin',values:{food:110}},0,'room',true);
 const loaded=parseSave(JSON.stringify(boosted),600000);
 assert.equal(loaded.food,109.25);
 assert.equal(feed(loaded,'free',600000).food,110);
 assert.equal(feed(fresh(0),'free',0).food,100);
});

function withDaily(game:Game,ids:TaskId[]){
 const day=dailyDay(game.updated);
 return {...game,daily:{...newDaily(day,game,game.updated),ids}};
}

test('дейлики: два Доширака, разные действия и выдача каждой награды ровно один раз',()=>{
 const noon=Date.UTC(2026,10,22,9);
 const day=dailyDay(noon);
 assert.equal(dailyDay(noon-1),day-.5);
 assert.equal(dailyDay(noon),day);
 const start=withDaily({...fresh(noon),economy:{balance:110,xp:100}},['noodlesTwice','differentActions']);
 const first=runGameCommand(start,{kind:'care',action:'feed',food:'noodles'},noon,'room');
 const early=runGameCommand(first,{kind:'care',action:'feed',food:'noodles'},noon+1000,'room');
 assert.equal(early.daily?.counts.noodlesTwice,1);
 const second=runGameCommand(early,{kind:'care',action:'feed',food:'noodles'},noon+30_000,'room');
 assert.equal(second.daily?.counts.noodlesTwice,2);
 assert.equal(second.daily?.counts.differentActions,1);
 assert.equal(second.economy.balance,0);
 assert.deepEqual(second.dailyRewards,[{day,id:'noodlesTwice'}]);
 const claim={kind:'dailyClaim',id:'noodlesTwice',day} as const;
 const midnight=dailyStart(day+.5);
 const paid=runGameCommand(second,claim,midnight,'room');
 assert.equal(paid.daily?.day,day+.5);
 assert.equal(paid.economy.balance,1000);
 assert.equal(runGameCommand(paid,claim,midnight,'room').economy.balance,1000);
});

test('задания обновляются в полдень и полночь, ранний подъём учитывается только до 10:00 МСК',()=>{
 const noon=Date.UTC(2026,10,22,9),midnight=Date.UTC(2026,10,22,21),nextNoon=Date.UTC(2026,10,23,9);
 const afternoon=withDaily(fresh(noon),['petTen','wakeBeforeTen']);
 const started=runGameCommand(afternoon,{kind:'care',action:'pet'},noon,'room');
 assert.equal(started.daily?.counts.petTen,1);
 assert.equal(nextDailyReset(noon),midnight);
 assert.equal(nextDailyReset(midnight),nextNoon);
 const rotated=runGameCommand(started,{kind:'sync'},midnight,'room');
 assert.equal(rotated.daily?.day,dailyDay(noon)+.5);
 assert.deepEqual(rotated.daily?.counts,{});
 assert.equal(runGameCommand(rotated,{kind:'sync'},nextNoon,'room').daily?.day,dailyDay(noon)+1);
 const sleeping=withDaily({...fresh(midnight),sleepUntil:-1},['wakeBeforeTen']);
 const wake=(at:number)=>runGameCommand(sleeping,{kind:'wake'},at,'room');
 const ten=Date.UTC(2026,10,23,7);
 assert.equal(wake(ten-1).daily?.counts.wakeBeforeTen,1);
 assert.equal(wake(ten).daily?.counts.wakeBeforeTen,undefined);
 assert.ok(!newDaily(dailyDay(noon),fresh(noon),noon).ids.includes('wakeBeforeTen'));
});

test('компьютер засчитывается только по завершении и в день завершения',()=>{
 const noon=Date.UTC(2026,10,22,9);
 const start=withDaily(fresh(noon),['computerOnce','computerThree','computerFive']);
 let game=start;
 for(let i=0;i<5;i++){
  const at=noon+i*600_000;
  game=runGameCommand(game,{kind:'activity',activity:'computer'},at,'room');
  assert.equal(game.daily?.counts.computerFive??0,i);
  game=runGameCommand(game,{kind:'sync'},at+600_000,'room');
 }
 assert.deepEqual(game.daily?.counts,{computerOnce:1,computerThree:3,computerFive:5});
 assert.deepEqual(game.dailyRewards,start.daily.ids.map(id=>({day:start.daily.day,id})));
 assert.equal(game.economy.balance,0);

 const before=withDaily(fresh(noon-60_000),['computerOnce']);
 const playing=runGameCommand(before,{kind:'activity',activity:'computer'},noon-60_000,'room');
 const crossed=runGameCommand(playing,{kind:'sync'},noon+540_000,'room');
 assert.ok(crossed.dailyRewards?.every(reward=>reward.day!==before.daily.day)??true);
});

test('цель по показателям засчитывается на отметке 80 в течение дня, включая сон и офлайн-завершение',()=>{
 const noon=Date.UTC(2026,10,22,9);
 const at=noon+3_600_000;
 const base=withDaily({...fresh(at),mood:80,hygiene:80,food:80,energy:79,sleepUntil:-1},['balancedStats']);
 assert.equal(runGameCommand(base,{kind:'sync'},at,'room').dailyRewards,undefined);
 const ready=runGameCommand(base,{kind:'sync'},at+225_000,'room');
 assert.deepEqual(ready.dailyRewards,[{day:base.daily.day,id:'balancedStats'}]);
 const completed=withDaily({...fresh(at),mood:68,energy:90,food:84,hygiene:81},['balancedStats']);
 const playing=runGameCommand(completed,{kind:'activity',activity:'computer'},at,'room');
 const after=runGameCommand(playing,{kind:'sync'},at+1_200_000,'room');
 assert.ok(after.food<80);
 assert.deepEqual(after.dailyRewards,[{day:base.daily.day,id:'balancedStats'}]);
});

test('лёгкие задания учитывают только действительные возвраты и посещение туалета',()=>{
 const noon=Date.UTC(2026,10,22,9);
 const start=withDaily(fresh(noon),['ballReturns','toiletVisit']);
 let game=runGameCommand(start,{kind:'activity',activity:'ball'},noon,'hallway');
 assert.equal(game.roomAction?.kind,'ball');
 assert.equal(runGameCommand(game,{kind:'ball',id:'wrong'},noon,'hallway').daily?.counts.ballReturns,undefined);
 for(let i=0;i<4;i++)game=runGameCommand(game,{kind:'ball',id:game.roomAction!.id},noon+i*1000,'hallway');
 game=runGameCommand(game,{kind:'cancel'},noon+4000,'hallway');
 game=runGameCommand(game,{kind:'activity',activity:'toilet'},noon+5000,'bathroom');
 assert.equal(game.daily?.counts.toiletVisit,undefined);
 game=runGameCommand(game,{kind:'sync'},noon+65_000,'bathroom');
 assert.deepEqual(game.daily?.counts,{ballReturns:3,toiletVisit:1});
 assert.deepEqual(game.dailyRewards,start.daily.ids.map(id=>({day:start.daily.day,id})));
});

test('смена заданий сохраняет старые награды и исключает недоступные цели',()=>{
 const noon=Date.UTC(2026,10,22,9);
 const day=dailyDay(noon);
 const base={...fresh(noon-1000),sleepUntil:-1};
 const repeated=newDaily(day,base,noon).ids;
 const state={...base,daily:{rules:2 as const,day:day-1,ids:repeated,counts:{[repeated[0]]:1},actions:['feed']}};
 assert.equal(runGameCommand(state,{kind:'sync'},noon,'room').daily?.day,day);
 assert.ok(runGameCommand(state,{kind:'sync'},noon,'room').daily?.ids.every(id=>!repeated.includes(id)));
 const pending={day,id:'shower'} as const;
 const legacy={...base,mood:79,updated:noon,daily:{day,ids:['shower','variety','noSleep'] as TaskId[],counts:{shower:1,variety:2},actions:['feed','pet']},dailyRewards:[pending]};
 const migrated=runGameCommand(legacy,{kind:'sync'},noon,'room');
 assert.equal(migrated.daily?.ids[0],'shower');
 assert.equal(migrated.daily?.counts.differentActions,2);
 assert.ok(!migrated.daily?.ids.includes('noSleep'));
 const paid=runGameCommand(migrated,{kind:'dailyClaim',...pending},noon,'room');
 assert.equal(paid.economy.balance,320);
 assert.deepEqual(runGameCommand(paid,{kind:'sync'},noon,'room').dailyRewards,[]);
 for(let i=0;i<20;i++){
  const date=dailyStart(day+i);
  const empty=newDaily(day+i,fresh(date),date).ids;
  assert.ok(!empty.includes('dumbbellSessions')&&!empty.includes('noodlesTwice'));
 }
 const rich={...fresh(noon),economy:{balance:110,xp:100},furniture:{dumbbells:{x:.78,y:.78}}};
 const eligible=Array.from({length:12},(_,i)=>newDaily(day+i,rich,dailyStart(day+i)).ids).flat();
 assert.ok(eligible.includes('noodlesTwice')&&eligible.includes('dumbbellSessions'));
});

import {dailyDay,dailyStart,nextDailyReset,newDaily,type TaskId} from './dailyTasks';
import {tourSections,type TourSection} from './tutorial';

test('сытость собаки падает до нуля через 48 часов, ещё через сутки её забирают в приют',()=>{
 const initial=adoptDog({...fresh(0),economy:{balance:dogFoodPrice+dogReclaimPrice,xp:100}},'Шарик');
 assert.equal(runGameCommand({...initial,economy:{balance:0,xp:100}},{kind:'buyDogFood'},0,'room').dogFood,undefined);
 const stocked=runGameCommand(initial,{kind:'buyDogFood'},0,'room');
 assert.equal(stocked.dogFood,1);
 assert.equal(stocked.economy.balance,dogReclaimPrice);
 const sleeping=act(stocked,'sleep',0);
 const hungry=advance(sleeping,dogHungerLimit,true);
 assert.equal(dogSatiety(sleeping.dogCare!,dogHungerLimit-1),1);
 assert.equal(dogSatiety(hungry.dogCare!,dogHungerLimit),0);
 assert.equal(hungry.dog,true);

 const almostSheltered=advance(hungry,dogShelterAfter-1,true);
 assert.equal(almostSheltered.dog,true);
 const fed=runGameCommand(almostSheltered,{kind:'feedDog'},dogShelterAfter-1,'room');
 assert.equal(dogSatiety(fed.dogCare!,fed.updated),100);
 assert.equal(fed.dogFood,0);
 assert.equal(advance(fed,dogShelterAfter,true).dog,true);

 const sheltered=advance(almostSheltered,dogShelterAfter,true);
 assert.equal(sheltered.dog,false);
 assert.equal(sheltered.dogCare?.sheltered,true);
 assert.equal(sheltered.dogCare?.hungerShelterAt,dogShelterAfter);
 assert.equal(sheltered.dogCare?.diedAt,null);
 assert.deepEqual(advance(sleeping,dogShelterAfter,true).dogCare,sheltered.dogCare);
 const reloaded=parseSave(JSON.stringify(sheltered),dogShelterAfter+1000);
 assert.deepEqual(reloaded.dogCare,sheltered.dogCare);
 assert.equal(reloaded.dogFood,1);

 const returned=runGameCommand(reloaded,{kind:'reclaimDog'},reloaded.updated,'room');
 assert.equal(returned.dog,true);
 assert.equal(returned.dogCare?.name,'Шарик');
 assert.equal(returned.dogCare?.hungerShelterAt,undefined);
 assert.equal(dogSatiety(returned.dogCare!,returned.updated),100);
 assert.equal(returned.economy.balance,0);
});

test('у старого питомца начинается новый отсчёт сытости с первой загрузки, старые следы остаются',()=>{
 const now=12*dogHungerLimit;
 const saved={...fresh(10_000),dog:true,dogCare:{startedAt:0,seed:123,nextWindow:1,
  messes:[{at:1000,location:'room',x:.4,y:.75}]}};
 const loaded=parseSave(JSON.stringify(saved),now);
 assert.equal(loaded.dog,true);
 assert.equal(loaded.dogCare?.lastFedAt,now);
 assert.equal(loaded.dogCare?.nextMessAt,now+dogMessInterval);
 assert.equal(loaded.dogCare?.messes[0]?.kind,'poop');
});

test('старое расписание переводится на четырёхчасовые окна с сохранением даты кормления',()=>{
 const hour=3_600_000, now=6*hour;
 const legacy={...fresh(now),dog:true,dogCare:{name:'Шарик',startedAt:0,seed:123,nextMessAt:7*hour,lastFedAt:5*hour,diedAt:null,
  messes:Array.from({length:6},(_,index)=>({at:(index+1)*hour,location:'room' as const,x:.4,y:.75,kind:'pee' as const}))}};
 const loaded=parseSave(JSON.stringify(legacy),now);
 assert.deepEqual(advance(legacy,now).dogCare,loaded.dogCare);
 assert.equal(loaded.dog,true);
 assert.equal(loaded.dogCare?.name,'Шарик');
 assert.equal(loaded.dogCare?.lastFedAt,5*hour);
 assert.equal(loaded.dogCare?.nextMessAt,10*hour);
 assert.equal(loaded.dogCare?.messes.length,4);
 assert.deepEqual(parseSave(JSON.stringify(loaded),now).dogCare,loaded.dogCare);
});

test('при длительной госпитализации собака переходит в приют по обычному расписанию',()=>{
 const home=adoptDog(fresh(0),'Шарик');
 const hospital=advance({...home,health:0},0);
 assert.equal(advance(hospital,dogHungerLimit,true).dog,true);
 const after=advance(hospital,dogShelterAfter,true);
 assert.equal(after.hospital?.billedHours,72);
 assert.equal(after.dog,false);
 assert.equal(after.dogCare?.hungerShelterAt,dogShelterAfter);
 assert.equal(after.dogCare?.messes.length,4);
});

test('приют сохраняет собаку, а выкуп восстанавливает её за 5000 только один раз',()=>{
 const adopted=adoptDog({...fresh(0),dogFood:3,economy:{balance:dogReclaimPrice+25,xp:100}},'Шарик');
 const sleeping=act(adopted,'sleep',0);
 const shelter=runGameCommand(sleeping,{kind:'surrenderDog'},dogMessInterval,'room');
 assert.equal(shelter.dog,false);
 assert.equal(shelter.dogCare?.sheltered,true);
 const now=dogMessInterval+dogHungerLimit*2;
 const restored=parseSave(JSON.stringify(shelter),now);
 assert.deepEqual(restored.dogCare,shelter.dogCare);
 assert.equal(adoptDog(restored,'Другое имя'),restored);
 const poor={...restored,economy:{...restored.economy,balance:dogReclaimPrice-1}};
 assert.equal(runGameCommand(poor,{kind:'reclaimDog'},now,'room').dog,false);
 const returned=runGameCommand(restored,{kind:'reclaimDog'},now,'room');
 assert.equal(returned.dog,true);
 assert.equal(returned.dogCare?.name,'Шарик');
 assert.equal(returned.dogCare?.seed,adopted.dogCare?.seed);
 assert.equal(returned.dogCare?.sheltered,undefined);
 assert.equal(returned.dogCare?.lastFedAt,now);
 assert.equal(returned.dogCare?.nextMessAt,now+dogMessInterval);
 assert.deepEqual(returned.dogCare?.messes,shelter.dogCare?.messes);
 assert.equal(returned.dogFood,3);
 assert.equal(returned.economy.balance,25);
 assert.equal(runGameCommand(returned,{kind:'reclaimDog'},now,'room').economy.balance,25);
});
