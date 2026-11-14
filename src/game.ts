import {beds,parseBed,parseBusinesses,type Businesses} from './property';
import {emptySkills,finishStudy,parseSkills,parseStudy,type StudySession} from './study';
import {startActivity,finishActivity,parseFurniture,activities,type Furniture,type RoomAction} from './activities';
import {parseCloset,type Closet} from './wardrobe';
import {newEconomy,parseEconomy,type Economy,shiftXP} from './economy';
import {BALANCE,FOOD,legacyXP,type FoodId} from './balance';
export type Stat='health'|'food'|'mood'|'energy'|'hygiene';
export type Action='feed'|'pet'|'sleep'|'heal'|'wash'|'play';
export type Game=Record<Stat,number>&{roomAction:RoomAction|null;bed:keyof typeof beds;businesses:Businesses;study:StudySession|null;learnedSkills:ReturnType<typeof emptySkills>;furniture:Furniture;fitnessXP:number;training:{day:string;count:number};toiletBonusAt:number;version:3;economy:Economy;closet:Closet|null;introCompleted:boolean;rentPaid:boolean;cooldowns:Record<Action,number>;updated:number;born:number;sleepUntil:number|null;restUntil:number|null;baseClock:number;exhaustionClock:number;freeFoodAt:number;tutorial:number;cares:number;petStrokes:number};
export const KEY='petrashka:v1';
export const fresh=(now=Date.now()):Game=>({roomAction:null,bed:'standard',businesses:{},study:null,learnedSkills:emptySkills(),furniture:{},fitnessXP:0,training:{day:'',count:0},toiletBonusAt:0,version:3,economy:{...newEconomy(),balance:0},closet:null,introCompleted:true,rentPaid:true,cooldowns:{feed:0,pet:0,sleep:0,heal:0,wash:0,play:0},health:100,food:100,mood:100,energy:100,hygiene:100,updated:now,born:now,sleepUntil:null,restUntil:null,baseClock:0,exhaustionClock:0,freeFoodAt:0,tutorial:5,cares:0,petStrokes:0});
export const beginIntro=(now=Date.now()):Game=>({...fresh(now),introCompleted:false,rentPaid:false,tutorial:0});
export const beginTutorial=(now=Date.now()):Game=>({...fresh(now),tutorial:0,food:55,energy:85,mood:75,hygiene:70,economy:{...newEconomy(),balance:0,jobId:'leaflets'}});
export const gameDay=(g:Game)=>1+Math.max(0,Math.floor((g.updated-g.born)/86_400_000));
export const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export const hygieneStage=(n:number)=>n<=10?'accident':n<=20?'smelly':n<=50?'wet':'clean';
export const hygieneMessage=(n:number)=>n<=10?'Ой… На полу какашки! Срочно в ванную.':n<=20?'От Петрашки пахнет. Пора помыться!':n<=50?'Штаны намокли. Помойся, чтобы вернуться к работе.':'';
export function tutorialReward(g:Game,step:number):Game{
 if(g.tutorial!==step)return g;
 const rewards=[15,30,15,15,25];
 return {...g,tutorial:step+1,economy:{...g.economy,xp:g.economy.xp+rewards[step],balance:g.economy.balance+(step===4?100:0)}};
}
function idle(g:Game,end:number,offline:boolean):Game{
 let s={...g},dt=end-g.updated;
 if(g.health===0||g.tutorial<5)return {...s,updated:end};
 const total=g.baseClock+dt,ticks=Math.floor(total/BALANCE.tick);
 s.baseClock=total%BALANCE.tick;
 // Process full ticks, preserving the remainder across calls and reloads.
 for(let i=0;i<ticks;i++){
  s.food=clamp(s.food-1);s.energy=clamp(s.energy-1);s.mood=clamp(s.mood-.5);s.hygiene=clamp(s.hygiene-.5);
  if(s.hygiene===0)s.mood=clamp(s.mood-.5);
  if(s.food===0||s.energy===0){
   const prev=s.exhaustionClock;s.exhaustionClock+=BALANCE.tick;
   const damage=Math.max(0,Math.floor((s.exhaustionClock-BALANCE.exhaustionGrace)/3_600_000))-Math.max(0,Math.floor((prev-BALANCE.exhaustionGrace)/3_600_000));
   if(damage>0)s.health=Math.max(offline?Math.min(s.health,BALANCE.offlineHealthFloor):0,s.health-damage*BALANCE.damagePerHour);
  }else s.exhaustionClock=0;
  if(s.health===0)break;
 }
 return {...s,updated:end};
}
export function advance(g:Game,now=Date.now(),offline=false):Game{
 now=Math.max(now,g.updated);let s={...g,economy:{...g.economy}};
 if(!g.introCompleted)return {...s,updated:now};
 if(g.health===0)return {...s,updated:now,sleepUntil:null,restUntil:null,roomAction:null,study:null};
 if(g.sleepUntil!==null)return {...s,energy:clamp(g.energy+beds[g.bed].energy*(now-g.updated)/3_600_000),updated:now};
 if(s.economy.shift){
  const shift=s.economy.shift;
  if(now<shift.ends)return {...s,updated:now};
  s.updated=Math.max(s.updated,shift.ends);
  s.economy={...s.economy,shift:null,lastClaimed:shift.id,balance:s.economy.balance+shift.pay,xp:s.economy.xp+(shift.tutorial?0:shiftXP(shift.minutes)),completedJobs:[...new Set([...s.economy.completedJobs,shift.profession])]};
  if(shift.tutorial)s=tutorialReward(s,1);
 }
 if(s.roomAction){if(now<s.roomAction.ends)return {...s,updated:now};s={...s,updated:Math.max(s.updated,s.roomAction.ends)};s=finishActivity(s);}
 if(s.restUntil!==null){if(now<s.restUntil)return {...s,updated:now};s={...s,energy:clamp(s.energy+10),updated:Math.max(s.updated,s.restUntil),restUntil:null};}
 if (s.study) {
  if (now < s.study.ends) return {...s, updated: now};
  s = finishStudy({...s, updated: Math.max(s.updated, s.study.ends)}, s.study);
 }
 const end=offline?Math.min(now,s.updated+BALANCE.offlineCap):now;
 return {...idle(s,end,offline),updated:now};
}
export const COOLDOWNS:Record<Action,number>={feed:30000,pet:0,sleep:0,heal:60000,wash:45000,play:30000};
export function blocked(g:Game,action:Action):string{
 if(g.health===0)return 'Начните заново';
 if(g.sleepUntil!==null)return 'Сначала разбудите Петрашку';
 if(g.restUntil!==null)return 'Петрашка отдыхает';
 if(g.study)return 'Петрашка учится';
 if(g.roomAction)return 'Петрашка занят: '+activities[g.roomAction.kind].name.toLowerCase();
 if(g.economy.shift&&action==='sleep')return 'Сначала завершите смену';
 if(g.tutorial<5){const expected:Partial<Record<number,Action>>={0:'feed',2:'feed',3:'wash',4:'sleep'};if(expected[g.tutorial]!==action)return 'Сначала выполните задание обучения';}
 const left=Math.ceil((g.cooldowns[action]-g.updated)/1000);
 if(action!=='pet'&&g.tutorial===5&&left>0)return `Ещё ${left} сек.`;
 if(action==='play'&&g.energy<10)return 'Нужно 10 энергии';
 return '';
}
export function foodReason(g:Game,id:FoodId):string{
 const common=blocked(g,'feed');if(common)return common;
 if(g.tutorial===0)return id==='free'?'':'Возьмите стартовый бутерброд';
 if(g.tutorial===2)return id==='noodles'?'':'Купите учебную лапшу за 100 ₽';
 const item=FOOD.find(f=>f.id===id);if(!item)return 'Еда недоступна';
 if(id==='free'&&g.updated<g.freeFoodAt)return `Помощь через ${Math.ceil((g.freeFoodAt-g.updated)/60000)} мин.`;
 if(g.economy.balance<item.price)return `Не хватает ${item.price-g.economy.balance} ₽`;
 return '';
}
export function feed(g:Game,id:FoodId,now=Date.now()):Game{
 let s=advance(g,now);if(foodReason(s,id))return s;const item=FOOD.find(f=>f.id===id)!;
 const price=s.tutorial===2?100:item.price;
 if(s.economy.balance<price)return s;
 s={...s,food:clamp(s.food+item.food),mood:clamp(s.mood+item.mood),health:clamp(s.health+item.health),economy:{...s.economy,balance:s.economy.balance-price},freeFoodAt:id==='free'?s.updated+BALANCE.freeFoodCooldown:s.freeFoodAt,exhaustionClock:0,cares:s.cares+1,cooldowns:{...s.cooldowns,feed:s.updated+COOLDOWNS.feed}};
 if(s.tutorial===0)s=tutorialReward(s,0);else if(s.tutorial===2)s=tutorialReward(s,2);
 return s;
}
export function act(g:Game,action:Action,now=Date.now()):Game{
 if(action==='wash')return startActivity(g,'bath',now);
 if(action==='feed')return feed(g,g.tutorial===2?'noodles':'free',now);
 let s=advance(g,now);if(blocked(s,action))return s;
 if(action==='pet'){
  s.petStrokes=s.mood<70?s.petStrokes+1:0;
  if(s.petStrokes===3){
   s.mood=Math.min(70,s.mood+1);
   s.petStrokes=0;
  }
 }
 if(action==='heal')s.health=clamp(s.health+20);
 if(action==='sleep'){s.sleepUntil=-1;s.baseClock=0;}
 if(action==='play'){s.mood=clamp(s.mood+20);s.energy-=10;}
 if(action==='sleep'&&s.tutorial===4)s=tutorialReward(s,4);
 s.cooldowns={...s.cooldowns,[action]:s.updated+COOLDOWNS[action]};s.cares++;return s;
}
export function wake(g:Game,now=Date.now()):Game{const s=advance(g,now);return s.sleepUntil===null?s:{...s,sleepUntil:null,baseClock:0};}
export function rest(g:Game,now=Date.now()):Game{const s=advance(g,now);if(s.health===0||s.sleepUntil!==null||s.restUntil!==null||s.economy.shift||s.roomAction||s.study||s.tutorial<5)return s;return {...s,food:clamp(s.food-2),restUntil:s.updated+600000};}
export function parseSave(raw:string|null,now=Date.now()):Game{
 if(!raw)return beginIntro(now);
 try{
  const data=JSON.parse(raw);if(!data||![1,2,3].includes(data.version))return beginIntro(now);
  const old=data.version<3;
  const base=fresh(now);
  const s={...base,...data,version:3,economy:parseEconomy(data.economy),closet:parseCloset(data.closet)} as Game;
  if(old){s.tutorial=5;s.baseClock=0;s.exhaustionClock=0;s.freeFoodAt=0;s.restUntil=null;s.economy.xp=legacyXP(s.economy.xp);if(data.version===1){s.hygiene=100;s.cooldowns=base.cooldowns;}if(s.sleepUntil!==null)s.sleepUntil=-1;}
  s.furniture=parseFurniture(data.furniture);
  s.bed=parseBed(data.bed);
  s.businesses=parseBusinesses(data.businesses,s.updated);
  s.learnedSkills=parseSkills(data.learnedSkills);
  s.study=parseStudy(data.study,s.updated);
  if(!Number.isFinite(s.fitnessXP)||s.fitnessXP<0)s.fitnessXP=0;
  if(!s.training||typeof s.training.day!=='string'||!Number.isInteger(s.training.count)||s.training.count<0)s.training={day:'',count:0};
  if(!Number.isFinite(s.toiletBonusAt)||s.toiletBonusAt<0)s.toiletBonusAt=0;
  const action=s.roomAction;
  if(action&&(!activities[action.kind]||!Number.isFinite(action.started)||action.started>s.updated||action.ends!==action.started+activities[action.kind].minutes*60000))s.roomAction=null;
  if(s.economy.shift){s.roomAction=null;s.sleepUntil=null;s.restUntil=null;}
  else if(s.roomAction){s.sleepUntil=null;s.restUntil=null;}
  if(s.economy.shift||s.roomAction||s.sleepUntil!==null||s.restUntil!==null)s.study=null;
  for(const k of ['health','food','mood','energy','hygiene'] as const){if(!Number.isFinite(s[k]))return beginIntro(now);s[k]=clamp(s[k]);}
  if(!Number.isFinite(s.updated)||s.updated<0||s.updated>now+60000||!Number.isFinite(s.born)||s.born<0||s.born>s.updated)return beginIntro(now);
  if(!s.cooldowns||Object.keys(COOLDOWNS).some(a=>!Number.isFinite(s.cooldowns[a as Action])))s.cooldowns=base.cooldowns;
  if(!Number.isInteger(s.tutorial)||s.tutorial<0||s.tutorial>5)s.tutorial=5;
  for(const k of ['baseClock','exhaustionClock','freeFoodAt','cares'] as const)if(!Number.isFinite(s[k])||s[k]<0)s[k]=0;
  if(s.petStrokes!==1&&s.petStrokes!==2)s.petStrokes=0;
 s.baseClock%=BALANCE.tick;
  if(s.sleepUntil!==null&&s.sleepUntil!==-1)s.sleepUntil=null;
  if(s.restUntil!==null&&(!Number.isFinite(s.restUntil)||s.restUntil>s.updated+600000))s.restUntil=null;
  return advance(s,now,true);
 }catch{return beginIntro(now);}
}
export function feeling(g:Game){if(g.health===0)return 'faint';if(g.sleepUntil!==null)return 'sleep';if(g.health<30)return 'sick';if(g.food<20)return 'hungry';if(g.energy<20)return 'tired';if(g.hygiene<=50)return 'dirty';if(g.mood<30)return 'sad';if(Math.min(g.health,g.food,g.mood,g.energy,g.hygiene)>=80)return 'happy';return 'normal';}
