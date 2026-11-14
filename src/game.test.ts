import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,advance,act,parseSave,feeling,beginTutorial,feed,wake,rest,foodReason,hygieneStage,blocked,KEY} from './game';
import {startShift,workReason,shiftCost,professions,claimSalary,applyClothing} from './economy';
import {xpProgress,levelRequirement} from './balance';
const leaflets=professions[0],courier=professions[1];
test('пять нужд: точный десятиминутный тик и дробные остатки',()=>{
 const g=fresh(0);assert.equal(advance(g,599999).food,100);
 const s=advance(g,600000);assert.deepEqual([s.food,s.energy,s.mood,s.hygiene,s.health],[99,99,99.5,99.5,100]);
 assert.deepEqual(advance(advance(g,123456),600123),advance(g,600123));
});
test('8 часов офлайн: пример из PDF',()=>{
 const s=advance({...fresh(0),food:80,energy:90,mood:80,hygiene:80},8*3600000,true);
 assert.deepEqual([s.food,s.energy,s.mood,s.hygiene],[32,42,56,56]);
});
test('офлайн ограничен 12 часами, повторный вход не повторяет расход',()=>{
 const s=advance(fresh(0),7*86400000,true);assert.equal(s.food,28);
 const loaded=parseSave(JSON.stringify(s),7*86400000);assert.equal(loaded.food,28);
 assert.equal(loaded.updated,7*86400000);
});
test('истощение: два часа отсрочки, общий штраф, офлайн пол здоровья 30',()=>{
 const g={...fresh(0),food:0,energy:0};
 assert.equal(advance(g,7200000).health,100);assert.equal(advance(g,10800000).health,98);
 assert.equal(advance({...g,health:31},12*3600000,true).health,30);
 assert.equal(advance({...g,health:25},12*3600000,true).health,25);
 assert.equal(advance({...g,health:2},10800000).health,0);
});
test('сон без таймера: заморозка, энергия, явное пробуждение',()=>{
 const g=act({...fresh(0),energy:20,food:55,hygiene:40},'sleep',0);
 const s=advance(g,8*3600000,true);assert.deepEqual([s.energy,s.food,s.hygiene,s.health],[100,55,40,100]);assert.equal(s.sleepUntil,-1);
 const awake=wake(s,s.updated);assert.equal(awake.sleepUntil,null);assert.equal(advance(awake,s.updated+600000).food,54);
 assert.equal(parseSave(JSON.stringify(g),8*3600000).sleepUntil,-1);
});
test('сон не запускается закрытием игры и не совместим с работой',()=>{
 assert.equal(parseSave(JSON.stringify(fresh(0)),600000).sleepUntil,null);
 const working=startShift(fresh(0),10,'leaflets',0);assert.equal(act(working,'sleep',0).sleepUntil,null);
 assert.equal(startShift(act(fresh(0),'sleep',0),10,'leaflets',0).economy.shift,null);
});
test('ограничения гигиены включают границы 50, 20 и 10',()=>{
 for(const [value,stage] of [[51,'clean'],[50,'wet'],[21,'wet'],[20,'smelly'],[11,'smelly'],[10,'accident'],[0,'accident']] as const)assert.equal(hygieneStage(value),stage);
 for(const hygiene of [50,20,10,0]){const g={...fresh(0),hygiene};assert.match(workReason(g,10,leaflets),/Мокрые штаны/);assert.equal(startShift(g,10,'leaflets',0).economy.shift,null);}
 assert.ok(startShift({...fresh(0),hygiene:51},10,'leaflets',0).economy.shift);
 assert.ok(startShift(advance(act({...fresh(0),hygiene:50},'wash',0),120000),10,'leaflets',120000).economy.shift);
});
test('мытьё снимает стадии постепенно, сохранение их восстанавливает',()=>{
 const g={...fresh(0),hygiene:10};const washed=advance(act(g,'wash',0),120000);assert.equal(hygieneStage(washed.hygiene),'wet');
 const clean=advance(act(washed,'wash',120000),240000);assert.equal(hygieneStage(clean.hygiene),'clean');
 assert.equal(parseSave(JSON.stringify(g),0).hygiene,10);
});
test('цены и эффекты еды, нет отрицательного баланса',()=>{
 const g={...fresh(0),food:25,mood:50,economy:{...fresh(0).economy,balance:150}};
 const s=feed(g,'burger',0);assert.deepEqual([s.food,s.mood,s.economy.balance],[65,53,0]);
 assert.match(foodReason({...g,economy:{...g.economy,balance:0}},'burger'),/Не хватает/);
 assert.equal(feed({...g,economy:{...g.economy,balance:0}},'burger',0).food,25);
});
test('защита от тупика: бесплатная еда, душ и отдых с нулевыми ресурсами',()=>{
 let g={...fresh(0),food:0,energy:0,hygiene:0};g=feed(g,'free',0);assert.equal(g.food,25);
 assert.equal(feed(g,'free',60000).cares,1);assert.match(foodReason(advance(g,60000),'free'),/Помощь/);
 const resting=rest(g,0),done=advance(resting,600000);assert.equal(done.energy,10);assert.equal(done.food,23);
 assert.equal(advance(done,600001).energy,10);assert.equal(advance(act(done,'wash',600000),720000).hygiene,40);
});
test('профессии используют основную таблицу и формулу голода',()=>{
 assert.equal(shiftCost({...fresh(0),food:25},courier,10).energy,14);
 assert.deepEqual(shiftCost(fresh(0),courier,10),{energy:12,food:8,hygiene:5,mood:2});
 assert.match(workReason({...fresh(0),energy:12},10,leaflets),/Не хватает 1 энергии/);
 assert.equal(startShift({...fresh(0),energy:12},10,'leaflets',0).economy.shift,null);
});
test('смена списывает ресурсы один раз и не удваивает фон',()=>{
 const started=startShift(fresh(0),10,'leaflets',0);assert.deepEqual([started.food,started.energy,started.hygiene,started.mood],[96,92,98,99]);
 assert.equal(startShift(started,10,'leaflets',1).food,96);
 const done=advance(started,600000);assert.equal(done.food,96);assert.equal(done.economy.balance,200);assert.equal(done.economy.shift,null);
 assert.equal(advance(done,1200000).food,95);assert.equal(claimSalary(done,600000).economy.balance,200);
});
test('работа через офлайн и граница перехода к бодрствованию',()=>{
 const g=startShift(fresh(0),10,'leaflets',0),s=parseSave(JSON.stringify(g),1200000);
 assert.equal(s.economy.balance,200);assert.equal(s.food,95);assert.equal(s.economy.xp,16);
 assert.equal(parseSave(JSON.stringify(s),1200000).economy.balance,200);
});
test('обучение: 5 реальных событий, точные награды и перезапуск на шаге 3',()=>{
 let g=beginTutorial(0);assert.equal(advance(g,86400000,true).food,55);
 assert.ok(blocked(g,'wash'));g=feed(g,'free',0);assert.equal(g.food,80);assert.equal(g.economy.xp,15);assert.equal(g.tutorial,1);
 assert.equal(feed(g,'free',0).economy.xp,15);
 g=startShift(g,10,'leaflets',0);assert.equal(g.economy.shift?.ends,15000);
 assert.equal(advance(g,14999).economy.balance,0);
 g=parseSave(JSON.stringify(g),15000);assert.equal(g.tutorial,2);assert.equal(g.economy.balance,250);assert.equal(g.economy.xp,45);
 g=parseSave(JSON.stringify(g),15000);assert.equal(g.economy.balance,250);
 g=feed(g,'noodles',15000);assert.equal(g.economy.balance,150);assert.equal(g.food,100);assert.equal(g.economy.xp,60);
 g=advance(act(g,'wash',15000),135000);assert.equal(g.hygiene,100);assert.equal(g.economy.xp,75);
 g=act(g,'sleep',135000);assert.equal(g.tutorial,5);assert.equal(g.economy.balance,250);assert.equal(g.economy.xp,100);assert.equal(xpProgress(g.economy.xp).level,2);assert.equal(g.sleepUntil,-1);
 assert.equal(act(g,'sleep',136000).economy.balance,250);
 assert.equal(parseSave(JSON.stringify(g),86400000).economy.xp,100);
});
test('кривая опыта и лимит 20 уровней',()=>{
 assert.equal(levelRequirement(2),128);assert.equal(levelRequirement(5),248);
 assert.deepEqual(xpProgress(100),{level:2,progress:0,required:128,max:false});assert.equal(xpProgress(228).level,3);assert.equal(xpProgress(1e12).level,20);
});
test('миграция версии 2 сохраняет деньги, нужды, текущую смену и достигнутый уровень',()=>{
 const old={...fresh(0),version:2,tutorial:undefined,food:55,economy:{balance:777,xp:250,completedJobs:['courier'],jobId:'courier',shift:{id:'old',profession:'courier',minutes:15,started:0,ends:900000,pay:125},lastClaimed:null}};
 const g=parseSave(JSON.stringify(old),0);assert.equal(g.version,3);assert.equal(g.tutorial,5);assert.equal(g.food,55);assert.equal(g.economy.balance,777);assert.equal(xpProgress(g.economy.xp).level,3);
 assert.equal(advance(g,900000).economy.balance,902);assert.equal(KEY,'petrashka:v1');
});
test('смерть не отменяется ни сном ни бесплатной помощью',()=>{
 const g={...fresh(0),health:0};assert.equal(feeling(g),'faint');assert.equal(act(g,'heal',0).health,0);assert.equal(feed(g,'free',0).cares,0);assert.equal(advance(g,86400000,true).health,0);
});
test('покупки не позволяют потратить деньги учебной лапши',()=>{
 const g={...beginTutorial(0),economy:{...fresh(0).economy,balance:500}};assert.equal(applyClothing(g,'hat',1),g);
});
test('онлайн расчёт одинаков при разной частоте тиков',()=>{
 const g={...fresh(0),food:3,energy:2};let live=g;
 for(let t=1000;t<=14400000;t+=1000)live=advance(live,t);
 assert.deepEqual(live,advance(g,14400000));
});

import {buyFurniture,moveFurniture,startActivity,activityReason,gameDate,furnitureCatalog} from './activities';
import {starterCloset,savePreset,wearPreset,renamePreset,deletePreset,defaultOutfit,catalog,categories,parseOutfit} from './wardrobe';
const rich=()=>({...fresh(0),economy:{...fresh(0).economy,balance:100000,xp:5000}});
test('мебель: покупка каждого предмета ровно один раз и сохранение',()=>{
 let g=rich();for(const i of furnitureCatalog){const before=g.economy.balance;g=buyFurniture(g,i.id);assert.equal(g.economy.balance,before-i.price);assert.equal(buyFurniture(g,i.id),g);assert.ok(parseSave(JSON.stringify(g),0).furniture[i.id]);}
 assert.equal(buyFurniture(fresh(0),'yoga').furniture.yoga,undefined);
 assert.equal(buyFurniture({...rich(),economy:{...rich().economy,balance:0}},'yoga').furniture.yoga,undefined);
});
test('мебель: расстановка ограничена полом и не изменяет чужие предметы',()=>{
 let g=buyFurniture(rich(),'yoga');g=moveFurniture(g,'yoga',-10,100);assert.deepEqual(g.furniture.yoga,{x:.32,y:.90});
 assert.deepEqual(parseSave(JSON.stringify(g),0).furniture,g.furniture);assert.equal(moveFurniture(g,'tray',1,1),g);
});
test('ванна: 2 минуты, бонус один раз, при полном показателе бонусов нет',()=>{
 const g={...fresh(0),hygiene:30,mood:50,energy:1},start=startActivity(g,'bath',0);
 assert.equal(start.energy,0);assert.equal(start.hygiene,30);assert.equal(startActivity(start,'toilet',0).roomAction?.kind,'bath');
 assert.equal(advance(start,119999).hygiene,30);const done=advance(start,120000);assert.equal(done.hygiene,70);assert.equal(done.mood,54);assert.equal(done.food,100);
 assert.equal(advance(done,120001).mood,54);assert.equal(startActivity(fresh(0),'bath',0).roomAction,null);
 assert.equal(startShift(start,10,'leaflets',0).economy.shift,null);assert.equal(act(start,'pet',0).mood,50);
});
test('компьютер: ресурсы, 10 минут, офлайн и точное завершение',()=>{
 const g={...fresh(0),mood:30};const started=startActivity(g,'computer',0);assert.deepEqual([started.energy,started.food,started.hygiene],[90,96,99]);
 const done=parseSave(JSON.stringify(started),600000);assert.equal(done.mood,42);assert.equal(done.roomAction,null);assert.equal(done.food,96);
 assert.equal(parseSave(JSON.stringify(done),600000).mood,42);assert.equal(act(started,'sleep',0).sleepUntil,null);
 assert.match(activityReason({...g,energy:14},'computer'),/15 энергии/);assert.match(activityReason({...g,food:9},'computer'),/10 сытости/);
});
test('унитаз и лоток: общий 90-минутный кулдаун бонуса',()=>{
 let g={...buyFurniture(rich(),'tray'),mood:10};g=advance(startActivity(g,'toilet',0),60000);assert.equal(g.mood,14);
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
 for(const k of Object.keys(categories) as (keyof typeof categories)[])assert.equal(catalog[k].length,10);
 let g=applyClothing(rich(),'hat',1);g={...g,closet:savePreset(g.closet!,'Шапка')};const price=g.economy.balance;
 g=applyClothing(g,'hat',-1);g={...g,closet:wearPreset(g.closet!,g.closet!.presets[0].id)};
 assert.equal(g.closet!.outfit.hat,1);assert.equal(g.economy.balance,price);assert.equal(parseSave(JSON.stringify(g),0).closet!.presets.length,1);
 assert.deepEqual(parseOutfit('broken'),defaultOutfit);
});
import {bodyPart} from './body';
test('области тела продолжают различать голову, живот, ноги, руки и ступни',()=>{assert.equal(bodyPart(.5,.25),'head');assert.equal(bodyPart(.5,.6),'belly');assert.equal(bodyPart(.5,.8),'legs');assert.equal(bodyPart(.32,.6),'right-arm');assert.equal(bodyPart(.68,.6),'left-arm');assert.equal(bodyPart(.43,.95),'right-foot');assert.equal(bodyPart(.57,.95),'left-foot');});

import {startStudy, skillValue} from './study';
import {buyBed, openBusiness, businessIncome, collectBusiness} from './property';

test('курс после уровня 2 восстанавливается из сохранения и выдаёт награду один раз', () => {
 const base = fresh(0);
 assert.equal(startStudy(base, 'book', 'communication', 0).study, null);
 const ready = {...base, mood: 29, economy: {...base.economy, xp: 100}};
 const started = startStudy(ready, 'book', 'communication', 0);
 assert.equal(started.study?.ends, 720_000);
 assert.deepEqual([started.energy, started.food, started.mood], [95, 98, 28]);
 assert.equal(startShift(started, 10, 'leaflets', 1).economy.shift, null);
 assert.equal(act(started, 'sleep', 1).sleepUntil, null);
 const loaded = parseSave(JSON.stringify(started), 600_000);
 assert.ok(loaded.study);
 const finished = parseSave(JSON.stringify(loaded), 720_000);
 assert.equal(finished.study, null);
 assert.equal(finished.food, 98);
 assert.equal(skillValue(finished, 'communication'), 2);
 assert.equal(finished.economy.xp, 112);
 assert.equal(parseSave(JSON.stringify(finished), 720_000).economy.xp, 112);
});

test('профессия требует навык, а скидка энергии ограничена 20%', () => {
 const base = rich();
 const cashier = professions.find(job => job.id === 'cashier')!;
 const player = {...base, economy: {...base.economy, completedJobs: ['courier']}};
 assert.match(workReason(player, 10, cashier), /Общение/);
 const trained = {...player, learnedSkills: {...player.learnedSkills, communication: 100}};
 assert.equal(workReason(trained, 10, cashier), '');
 assert.equal(shiftCost(trained, cashier, 10).energy, 10);
});

test('кровать списывает цену один раз и ускоряет сон после загрузки', () => {
 const initial = {...rich(), energy: 10};
 const bought = buyBed(initial, 'comfort', 0);
 assert.equal(bought.economy.balance, initial.economy.balance - 15_000);
 assert.equal(buyBed(bought, 'comfort', 0).economy.balance, bought.economy.balance);
 const asleep = act(bought, 'sleep', 0);
 assert.equal(parseSave(JSON.stringify(asleep), 3_600_000).energy, 30);
});

test('бизнес требует уровень 15 и начисляет максимум 8 часов до сбора', () => {
 const initial = rich();
 assert.equal(openBusiness(initial, 'lemonade', 0).businesses.lemonade, undefined);
 const ready = {...initial, economy: {...initial.economy, xp: 50_000}};
 const opened = openBusiness(ready, 'lemonade', 0);
 assert.equal(opened.economy.balance, ready.economy.balance - 5_000);
 assert.equal(openBusiness(opened, 'lemonade', 0).economy.balance, opened.economy.balance);
 const loaded = parseSave(JSON.stringify(act(opened, 'sleep', 0)), 10 * 3_600_000);
 assert.equal(businessIncome(loaded, 'lemonade'), 800);
 const collected = collectBusiness(loaded, 'lemonade', loaded.updated);
 assert.equal(collected.economy.balance, opened.economy.balance + 800);
 assert.equal(collectBusiness(collected, 'lemonade', loaded.updated).economy.balance, collected.economy.balance);
});

test('поглаживания подряд дают +1 за три до 70, включая сохранение между нажатиями', () => {
 const start = {...fresh(0), mood:68.5, energy:25, food:31, health:42, cooldowns:{...fresh(0).cooldowns,pet:15_000}};
 const twice = act(act(start,'pet',0),'pet',0);
 assert.equal(twice.mood,68.5);
 const third = act(parseSave(JSON.stringify(twice),0),'pet',0);
 assert.equal(third.mood,69.5);
 let state = third;
 for(let i=0;i<12;i++)state=act(state,'pet',0);
 assert.deepEqual([state.mood,state.energy,state.food,state.health],[70,25,31,42]);
 assert.equal(state.cares,15);
 assert.equal(act({...state,mood:80},'pet',0).mood,80);
});

test('случайный вариант посещения туалета сохраняется до конца занятия', () => {
 const started = startActivity(fresh(0),'toilet',0);
 assert.ok(['pee','poop'].includes(started.roomAction?.toiletVisit ?? ''));
 const restored = parseSave(JSON.stringify(started),30_000);
 assert.equal(restored.roomAction?.toiletVisit,started.roomAction?.toiletVisit);
 assert.equal(advance(restored,60_000).roomAction,null);
});
