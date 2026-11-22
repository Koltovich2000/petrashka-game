import {advanceDogCare,dogFoodPrice,dogMessInterval,dogReclaimPrice,dogSatiety,newDogCare,parseDogCare,type DogCare} from './dogSchedule';
import {admit,billHospital,parseHospital,type Hospital} from './hospital';
import {beds,parseBed,parseBusinesses,type Businesses} from './property';
import {migrateCareer} from './saveMigration';
import {BATH_READY_AT,startActivity,finishActivity,parseFurniture,parseRoomAction,activities,activityLocation,locationIds,type Furniture,type Location,type RoomAction} from './activities';
import {parseCloset,refreshClosetOutfits,type Closet} from './wardrobe';
import {newEconomy,parseEconomy,type Economy} from './economy';
import {BALANCE,FOOD,TUTORIAL,tutorialRewards,legacyXP,type FoodId} from './balance';
import {statKeys,type PlayerStat} from './adminTypes';
import {parseCharacterName} from './characterName';
import type {DailyProgress,DailyReward} from './dailyTasks';
export type Stat=PlayerStat;
export type Action='feed'|'pet'|'sleep'|'heal'|'wash'|'play';
export const LAST_INTRO_SCENE=3;
export type Game=Record<Stat,number>&{daily?:DailyProgress;dailyRewards?:DailyReward[];characterName?:string;statLimits?:Partial<Record<Stat,number>>;introEdits?:Stat[];introScene?:number;hospital:Hospital|null;medicalDebt:number;protectedUntil:number;hairWashedAt:number|null;furnitureCosts:Partial<Record<keyof Furniture,number>>;bedPurchasePrice:number|null;dog:boolean;dogCare:DogCare|null;dogFood?:number;roomAction:RoomAction|null;floorMess:Partial<Record<Location,true>>;accidentActive:boolean;bed:keyof typeof beds;businesses:Businesses;furniture:Furniture;fitnessXP:number;training:{day:string;count:number};toiletBonusAt:number;version:4;economy:Economy;closet:Closet|null;introCompleted:boolean;rentPaid:boolean;cooldowns:Record<Action,number>;updated:number;born:number;sleepUntil:number|null;restUntil:number|null;baseClock:number;exhaustionClock:number;freeFoodAt:number;tutorial:number;cares:number;petStrokes:number};
export const KEY='petrashka:v1';
export const fresh=(now=Date.now()):Game=>({hospital:null,medicalDebt:0,protectedUntil:0,hairWashedAt:null,furnitureCosts:{},bedPurchasePrice:null,dog:false,dogCare:null,roomAction:null,floorMess:{},accidentActive:false,bed:'standard',businesses:{},furniture:{},fitnessXP:0,training:{day:'',count:0},toiletBonusAt:0,version:4,economy:{...newEconomy(),balance:0},closet:null,introCompleted:true,rentPaid:true,cooldowns:{feed:0,pet:0,sleep:0,heal:0,wash:0,play:0},health:100,food:100,mood:100,energy:100,hygiene:100,updated:now,born:now,sleepUntil:null,restUntil:null,baseClock:0,exhaustionClock:0,freeFoodAt:0,tutorial:TUTORIAL.done,cares:0,petStrokes:0});
export const beginIntro=(now=Date.now()):Game=>({...fresh(now),introCompleted:false,rentPaid:false,tutorial:0});
export const beginTutorial=(now=Date.now()):Game=>({...fresh(now),tutorial:0,food:55,energy:85,mood:75,hygiene:70,economy:{...newEconomy(),balance:0}});
export const gameDay=(g:Game)=>1+Math.max(0,Math.floor((g.updated-g.born)/86_400_000));
export function statLimit(game:Game,stat:Stat){
 const limit=game.statLimits?.[stat];
 return typeof limit==='number'&&Number.isSafeInteger(limit)&&limit>100?limit:100;
}
export function changeStat(game:Game,stat:Stat,delta:number){
 return Math.max(0,Math.min(statLimit(game,stat),game[stat]+delta));
}
// Called on a new game-state object. Preserve independent limits for the other stats.
export function setAdminStat(game:Game,stat:Stat,value:number){
 game[stat]=value;
 if(value>statLimit(game,stat))game.statLimits={...game.statLimits,[stat]:Math.ceil(value)};
 if(!game.introCompleted&&!game.introEdits?.includes(stat))game.introEdits=[...(game.introEdits??[]),stat];
}
export const hygieneStage=(n:number)=>n<=10?'accident':n<=20?'smelly':n<=50?'wet':'clean';
export const hygieneMessage=(n:number)=>n<=10?'Ой… Пора помыться!':n<=20?'От Петрашки пахнет. Пора помыться!':n<=50?'Штаны намокли. Пора помыться.':'';
export function recordFloorMess(g:Game,location:Location):Game{
 if(g.hygiene>10)return g.accidentActive?{...g,accidentActive:false}:g;
 if(g.accidentActive||!g.introCompleted||g.health===0)return g;
 const room=g.roomAction?activityLocation(g.roomAction):location;
 return {...g,accidentActive:true,floorMess:{...g.floorMess,[room]:true}};
}
export function tutorialReward(g:Game,step:number):Game{
 if(g.tutorial!==step)return g;
 const reward=tutorialRewards[step];
 if(!reward)return g;
 return {...g,tutorial:step+1,economy:{xp:g.economy.xp+reward.xp,balance:step===TUTORIAL.sleep?0:g.economy.balance+reward.money}};
}
function idle(g:Game,end:number):Game{
 let s={...g},dt=end-g.updated;
 if(g.health===0||g.tutorial<TUTORIAL.done)return {...s,updated:end};
 const total=g.baseClock+dt,ticks=Math.floor(total/BALANCE.tick);
 s.baseClock=total%BALANCE.tick;
 // Process full ticks, preserving the remainder across calls and reloads.
 for(let i=0;i<ticks;i++){
  s.food=changeStat(s,'food',-1);s.energy=changeStat(s,'energy',-1);s.mood=changeStat(s,'mood',-.5);s.hygiene=changeStat(s,'hygiene',-.5);
  if(s.hygiene===0)s.mood=changeStat(s,'mood',-.5);
  const tickAt=g.updated+BALANCE.tick-g.baseClock+i*BALANCE.tick;
  if(s.food===0||s.energy===0){
   const prev=s.exhaustionClock;s.exhaustionClock+=BALANCE.tick;
   const damage=Math.max(0,Math.floor((s.exhaustionClock-BALANCE.exhaustionGrace)/3_600_000))-Math.max(0,Math.floor((prev-BALANCE.exhaustionGrace)/3_600_000));
   if(damage>0)s.health=Math.max(tickAt<s.protectedUntil?1:0,s.health-damage*BALANCE.damagePerHour);
  }else s.exhaustionClock=0;
  if(s.health===0)return admit(s,tickAt);
 }
 return {...s,updated:end};
}
export function advance(g:Game,now=Date.now(),offline=false):Game{
 now=Math.max(now,g.updated);let s={...g,hairWashedAt:g.hairWashedAt??null,economy:{...g.economy}};
 if(!g.introCompleted)return {...s,updated:now};
 s.closet=refreshClosetOutfits(s.closet);
 if(s.dog){
  s.dogCare=advanceDogCare(s.dogCare??newDogCare(now),now);
  s.dog=s.dogCare.diedAt===null&&!s.dogCare.sheltered;
 }
 if(s.hospital)return billHospital(s,now);
 if(s.health===0){
  if(s.updated>=s.protectedUntil)return billHospital(admit(s,s.updated),now);
  s.health=1;
 }
 if(g.sleepUntil!==null)return {...s,energy:changeStat(g,'energy',beds[g.bed].energy*(now-g.updated)/3_600_000),updated:now};
 if(s.roomAction&&s.roomAction.ends!==null){if(now<s.roomAction.ends)return {...s,updated:now};s={...s,updated:Math.max(s.updated,s.roomAction.ends)};s=finishActivity(s);}
 if(s.restUntil!==null){if(now<s.restUntil)return {...s,updated:now};s={...s,energy:changeStat(s,'energy',10),updated:Math.max(s.updated,s.restUntil),restUntil:null};}
 const end=offline?Math.min(now,s.updated+BALANCE.offlineCap):now;
 const next=idle(s,end);
 if(next.hospital)return billHospital(next,now);
 // Keep the normal offline needs cap, while still detecting a critical decline during a longer absence.
 if(end<now&&next.tutorial===TUTORIAL.done){
  const critical=idle(next,now);
  if(critical.hospital)return billHospital(critical,now);
 }
 return {...next,updated:now};
}
export function cancelActivity(g:Game,now=Date.now()):Game{
 const time=Math.max(now,g.updated);
 if(g.health===0)return g;
 const end=g.roomAction?.ends??g.restUntil;
 const untimed=g.roomAction?.ends===null;
 if(!untimed&&(end==null||time>=end))return g;
 const s=untimed?advance(g,time):g;
 const bathed=s.roomAction?.kind==='bath'&&time-s.roomAction.started>=BATH_READY_AT;
 return {...s,updated:time,roomAction:null,restUntil:null,hairWashedAt:bathed?time:s.hairWashedAt};
}
export const COOLDOWNS:Record<Action,number>={feed:30000,pet:0,sleep:0,heal:60000,wash:45000,play:30000};
export function blocked(g:Game,action:Action):string{
 if(g.health===0)return 'Петрашка в больнице';
 if(g.sleepUntil!==null)return 'Сначала разбудите Петрашку';
 if(g.restUntil!==null)return 'Петрашка отдыхает';
 if(g.roomAction)return 'Петрашка занят: '+activities[g.roomAction.kind].name.toLowerCase();
 if(g.tutorial<TUTORIAL.done){const expected:Partial<Record<number,Action>>={[TUTORIAL.sandwich]:'feed',[TUTORIAL.noodles]:'feed',[TUTORIAL.bath]:'wash',[TUTORIAL.sleep]:'sleep'};if(expected[g.tutorial]!==action)return 'Сначала выполните задание обучения';}
 const left=Math.ceil((g.cooldowns[action]-g.updated)/1000);
 if(action!=='pet'&&g.tutorial===TUTORIAL.done&&left>0)return `Ещё ${left} сек.`;
 if(action==='play'&&g.energy<10)return 'Нужно 10 энергии';
 return '';
}
export function foodReason(g:Game,id:FoodId):string{
 const common=blocked(g,'feed');if(common)return common;
 if(g.tutorial===0)return id==='free'?'':'Возьмите стартовый бутерброд';
 if(g.tutorial===TUTORIAL.noodles)return id==='noodles'?'':`Купите учебную лапшу за ${TUTORIAL.noodlePrice} ₽`;
 const item=FOOD.find(f=>f.id===id);if(!item)return 'Еда недоступна';
 if(id==='free'&&g.updated<g.freeFoodAt)return `Помощь через ${Math.ceil((g.freeFoodAt-g.updated)/60000)} мин.`;
 if(g.economy.balance<item.price)return `Не хватает ${item.price-g.economy.balance} ₽`;
 return '';
}
export function feed(g:Game,id:FoodId,now=Date.now()):Game{
 let s=advance(g,now);if(foodReason(s,id))return s;const item=FOOD.find(f=>f.id===id)!;
 const price=s.tutorial===TUTORIAL.noodles?TUTORIAL.noodlePrice:item.price;
 if(s.economy.balance<price)return s;
 s={...s,food:changeStat(s,'food',item.food),mood:changeStat(s,'mood',item.mood),health:changeStat(s,'health',item.health),economy:{...s.economy,balance:s.economy.balance-price},freeFoodAt:id==='free'?s.updated+BALANCE.freeFoodCooldown:s.freeFoodAt,exhaustionClock:0,cares:s.cares+1,cooldowns:{...s.cooldowns,feed:s.updated+COOLDOWNS.feed}};
 if(s.tutorial===0)s=tutorialReward(s,0);else if(s.tutorial===TUTORIAL.noodles)s=tutorialReward(s,TUTORIAL.noodles);
 return s;
}
export function act(g:Game,action:Action,now=Date.now()):Game{
 if(action==='wash')return startActivity(g,'bath',now);
 if(action==='feed')return feed(g,g.tutorial===TUTORIAL.noodles?'noodles':'free',now);
 let s=advance(g,now);if(blocked(s,action))return s;
 if(action==='pet'){
  s.petStrokes=s.mood<70?s.petStrokes+1:0;
  if(s.petStrokes===3){
   s.mood=Math.min(70,s.mood+1);
   s.petStrokes=0;
  }
 }
 if(action==='heal')s.health=changeStat(s,'health',20);
 if(action==='sleep'){s.sleepUntil=-1;s.baseClock=0;}
 if(action==='play'){s.mood=changeStat(s,'mood',20);s.energy-=10;}
 if(action==='sleep'&&s.tutorial===TUTORIAL.sleep)s=tutorialReward(s,TUTORIAL.sleep);
 s.cooldowns={...s.cooldowns,[action]:s.updated+COOLDOWNS[action]};s.cares++;return s;
}
export function adoptDog(game:Game,dogName:unknown):Game{
 const name=parseCharacterName(dogName);
 if(!name||game.dog||game.dogCare?.sheltered||game.tutorial<TUTORIAL.done||game.health===0)return game;
 return {...game,dog:true,dogCare:{...newDogCare(game.updated,game.dogCare?.messes),name}};
}
export function surrenderDog(game:Game):Game{
 if(!game.dog||!game.dogCare||game.dogCare.diedAt!==null||game.tutorial<TUTORIAL.done||game.health===0)return game;
 return {...game,dog:false,dogCare:{...game.dogCare,sheltered:true}};
}
export function reclaimDog(game:Game):Game{
 const care=game.dogCare;
 if(game.dog||!care?.sheltered||game.tutorial<TUTORIAL.done||game.health===0||game.economy.balance<dogReclaimPrice)return game;
 const {sheltered:_,...dogCare}=care;
 const now=Math.floor(game.updated);
 return {...game,dog:true,
  dogCare:{...dogCare,startedAt:now,lastFedAt:now,nextMessAt:now+dogMessInterval},
  economy:{...game.economy,balance:game.economy.balance-dogReclaimPrice},
 };
}
export function buyDogFood(game:Game):Game{
 const portions=game.dogFood??0;
 if(!game.dog||game.economy.balance<dogFoodPrice||!Number.isSafeInteger(portions+1))return game;
 return {...game,dogFood:portions+1,economy:{...game.economy,balance:game.economy.balance-dogFoodPrice}};
}
export function feedDog(game:Game):Game{
 const portions=game.dogFood??0,care=game.dogCare;
 const now=Math.floor(game.updated);
 if(!game.dog||!care||portions<=0||dogSatiety(care,now)===100)return game;
 return {...game,dogFood:portions-1,dogCare:{...care,lastFedAt:now}};
}
export function wake(g:Game,now=Date.now()):Game{const s=advance(g,now);return s.sleepUntil===null?s:{...s,sleepUntil:null,baseClock:0};}
export function rest(g:Game,now=Date.now()):Game{const s=advance(g,now);if(s.health===0||s.sleepUntil!==null||s.restUntil!==null||s.roomAction||s.tutorial<TUTORIAL.done)return s;return {...s,food:changeStat(s,'food',-2),restUntil:s.updated+600000};}
export function parseSave(raw:string|null,now=Date.now(),deferAdvance=false):Game{
 if(!raw)return beginIntro(now);
 try{
  const saved=JSON.parse(raw);if(!saved||![1,2,3,4].includes(saved.version))return beginIntro(now);
  const {study,learnedSkills:_removedSkills,...data}=saved;
  const old=data.version<3;
  const base=fresh(now);
  const s={...base,...data,version:4,economy:parseEconomy(data.economy),closet:parseCloset(data.closet,data.version<4)} as Game;
  if(old){s.tutorial=TUTORIAL.done;s.baseClock=0;s.exhaustionClock=0;s.freeFoodAt=0;s.restUntil=null;s.economy.xp=legacyXP(s.economy.xp);if(data.version===1){s.hygiene=100;s.cooldowns=base.cooldowns;}if(s.sleepUntil!==null)s.sleepUntil=-1;}
  if(!s.introCompleted)s.introScene=Number.isInteger(data.introScene)&&data.introScene>=0&&data.introScene<=LAST_INTRO_SCENE?data.introScene:0;
  if(data.introEdits!==undefined)s.introEdits=statKeys.filter(key=>Array.isArray(data.introEdits)&&data.introEdits.includes(key));
  s.dog=data.dog===true;
  s.furniture=parseFurniture(data.furniture);
  s.furnitureCosts={};
  for(const id of Object.keys(s.furniture) as (keyof Furniture)[]){
   const price=data.furnitureCosts?.[id];
   if(Number.isSafeInteger(price)&&price>=0)s.furnitureCosts[id]=price;
  }
  s.bedPurchasePrice=Number.isSafeInteger(data.bedPurchasePrice)&&data.bedPurchasePrice>=0?data.bedPurchasePrice:null;
  s.medicalDebt=Number.isSafeInteger(data.medicalDebt)&&data.medicalDebt>=0?data.medicalDebt:0;
  s.protectedUntil=Number.isSafeInteger(data.protectedUntil)&&data.protectedUntil>=0?data.protectedUntil:0;
  s.floorMess={};
  for(const room of locationIds)if(data.floorMess?.[room]===true)s.floorMess[room]=true;
  s.accidentActive=data.accidentActive===true;
  s.hairWashedAt=typeof data.hairWashedAt==='number'&&Number.isSafeInteger(data.hairWashedAt)&&data.hairWashedAt>=0&&data.hairWashedAt<=s.updated
   ?data.hairWashedAt:null;
  s.bed=parseBed(data.bed);
  s.businesses=parseBusinesses(data.businesses,s.updated);
  if(!Number.isFinite(s.fitnessXP)||s.fitnessXP<0)s.fitnessXP=0;
  if(!s.training||typeof s.training.day!=='string'||!Number.isInteger(s.training.count)||s.training.count<0)s.training={day:'',count:0};
  if(!Number.isFinite(s.toiletBonusAt)||s.toiletBonusAt<0)s.toiletBonusAt=0;
  for(const k of statKeys){if(!Number.isFinite(s[k]))return beginIntro(now);s[k]=changeStat(s,k,0);}
  if(!Number.isFinite(s.updated)||s.updated<0||s.updated>now+60000||!Number.isFinite(s.born)||s.born<0||s.born>s.updated)return beginIntro(now);
  if(!s.cooldowns||Object.keys(COOLDOWNS).some(a=>!Number.isFinite(s.cooldowns[a as Action])))s.cooldowns=base.cooldowns;
  if(data.version<4)migrateCareer(s,old?undefined:data.tutorial,data.economy,study);
  else if(!Number.isInteger(s.tutorial)||s.tutorial<0||s.tutorial>TUTORIAL.done)s.tutorial=TUTORIAL.done;
  const dogCare=parseDogCare(data.dogCare,s.updated,now);
  s.dogCare=s.dog||dogCare?.sheltered||dogCare?.diedAt!=null?dogCare:null;
  if(data.dogFood!==undefined)s.dogFood=Number.isSafeInteger(data.dogFood)&&data.dogFood>=0?data.dogFood:0;
  if(dogCare?.sheltered||dogCare?.diedAt!=null)s.dog=false;
  s.hospital=parseHospital(data.hospital,s.updated);
  if(s.hospital){s.health=0;s.sleepUntil=null;s.restUntil=null;}
  s.roomAction=s.hospital?null:parseRoomAction(data.roomAction,s);
  if(s.roomAction){s.sleepUntil=null;s.restUntil=null;}
  for(const k of ['baseClock','exhaustionClock','freeFoodAt','cares'] as const)if(!Number.isFinite(s[k])||s[k]<0)s[k]=0;
  if(s.petStrokes!==1&&s.petStrokes!==2)s.petStrokes=0;
 s.baseClock%=BALANCE.tick;
  if(s.sleepUntil!==null&&s.sleepUntil!==-1)s.sleepUntil=null;
  if(s.restUntil!==null&&(!Number.isFinite(s.restUntil)||s.restUntil>s.updated+600000))s.restUntil=null;
  return deferAdvance?s:advance(s,now,true);
 }catch{return beginIntro(now);}
}
export function feeling(g:Game){if(g.health===0)return 'faint';if(g.sleepUntil!==null)return 'sleep';if(g.health<30)return 'sick';if(g.food<20)return 'hungry';if(g.energy<20)return 'tired';if(g.hygiene<=50)return 'dirty';if(g.mood<30)return 'sad';if(Math.min(g.health,g.food,g.mood,g.energy,g.hygiene)>=80)return 'happy';return 'normal';}
