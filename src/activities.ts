import {TUTORIAL} from './balance';
import {advance,blocked,clamp,COOLDOWNS,tutorialReward,type Game} from './game';
import {playerLevel} from './economy';
export const locationIds=['room','bathroom','hallway','hall'] as const;
export type Location=typeof locationIds[number];
export const locationLabels:Record<Location,string>={room:'Комната',bathroom:'Ванная',hallway:'Прихожая',hall:'Зал'};
export function isLocation(value:unknown):value is Location{return locationIds.some(id=>id===value);}
export const furnitureCatalog=[
 {id:'yoga',name:'Коврик для йоги',price:7500,level:3,location:'hall',x:.24,y:.86,icon:'🧘'},
 {id:'dumbbells',name:'Гантели',price:18000,level:5,location:'hall',x:.78,y:.78,icon:'🏋️'},
 {id:'tray',name:'Лоток для животных',price:35000,level:8,location:'bathroom',x:.29,y:.77,icon:'🐾'},
] as const;
export type FurnitureId=typeof furnitureCatalog[number]['id'];
export type Furniture=Partial<Record<FurnitureId,{x:number;y:number}>>;
export const activities={
 clean:{name:'Убирает пол',location:'room',minutes:.05,energy:0,food:0,hygiene:0,mood:0,fitness:0,minEnergy:0,minFood:0},
 bath:{name:'Моется',location:'bathroom',minutes:null,energy:2,food:0,hygiene:0,mood:0,fitness:0,minEnergy:0,minFood:0},
 toilet:{name:'На унитазе',location:'bathroom',minutes:1,energy:0,food:0,hygiene:0,mood:4,fitness:0,minEnergy:0,minFood:0},
 ball:{name:'Играет в мяч',location:'hallway',minutes:null,energy:10,food:0,hygiene:0,mood:0,fitness:0,minEnergy:10,minFood:0},
 computer:{name:'Играет за компьютером',location:'room',minutes:10,energy:10,food:4,hygiene:1,mood:12,fitness:0,minEnergy:15,minFood:10},
 yoga:{name:'Занимается йогой',location:'hall',minutes:10,energy:8,food:5,hygiene:2,mood:8,fitness:6,minEnergy:13,minFood:15},
 dumbbells:{name:'Тренируется с гантелями',location:'hall',minutes:10,energy:18,food:12,hygiene:8,mood:3,fitness:10,minEnergy:23,minFood:30},
 tray:{name:'Проверяет лоток',location:'bathroom',minutes:1,energy:0,food:0,hygiene:12,mood:10,fitness:0,minEnergy:0,minFood:0},
} as const;
export type ActivityKind=keyof typeof activities;
export type ToiletVisit='pee'|'poop';
type TimedActivity=Exclude<ActivityKind,'bath'|'ball'|'yoga'>;
type ActionSession={id:string;started:number;bonus:boolean;toiletVisit?:ToiletVisit;cleanupLocation?:Location;cleanupDogMessAt?:number};
export type RoomAction=ActionSession&(
 {kind:TimedActivity;ends:number}
 | {kind:'yoga';ends:number;yogaSeed:number}
 | {kind:'bath';ends:null}
 | {kind:'ball';ends:null;returns:number}
);
export const BATH_READY_AT=680, BATH_STROKE_GAIN=1, BALL_RETURN_GAIN=1;
export const computerReward={money:200,xp:16} as const;

export function activityLocation(action:RoomAction):Location{
 return action.kind==='clean'&&action.cleanupLocation?action.cleanupLocation:activities[action.kind].location;
}
export const gameDate=(time:number)=>new Date(time+3*3600000).toISOString().slice(0,10); // Fixed game time zone: Europe/Moscow (UTC+3).
export function activityReason(g:Game,kind:ActivityKind,location?:Location,dogMessAt?:number):string{
 if(g.health===0)return 'Петрашка в больнице';
 if(g.sleepUntil!==null)return 'Сначала разбудите Петрашку';
 if(g.roomAction||g.restUntil!==null)return 'Сначала завершите текущее занятие';
 if(g.tutorial<TUTORIAL.done&&kind!=='clean'&&!(g.tutorial===TUTORIAL.bath&&kind==='bath'))return 'Сначала выполните задание обучения';
 if(kind==='clean'&&!canClean(g,location,dogMessAt))return 'Пол уже чистый';
 if(furnitureCatalog.some(i=>i.id===kind)&&!g.furniture[kind as FurnitureId])return 'Сначала купите предмет в магазине';
 if(kind==='ball')return blocked(g,'play');
 const a=activities[kind];
 if(g.energy<a.minEnergy)return `Нужно ${a.minEnergy} энергии (не хватает ${Math.ceil(a.minEnergy-g.energy)})`;
 if(g.food<a.minFood)return `Нужно ${a.minFood} сытости (не хватает ${Math.ceil(a.minFood-g.food)})`;
 return '';
}
function canClean(game:Game,location:Location|undefined,dogMessAt?:number){
 if(!location)return false;
 return dogMessAt===undefined?Boolean(game.floorMess[location]):
  Boolean(game.dogCare?.messes.some(mess=>mess.at===dogMessAt&&mess.location===location));
}
export function startActivity(g:Game,kind:ActivityKind,now=Date.now(),location?:Location,dogMessAt?:number):Game{
 const s=advance(g,now);if(activityReason(s,kind,location,dogMessAt))return s;const a=activities[kind];
 const cooldowns=kind==='ball'?{...s.cooldowns,play:s.updated+COOLDOWNS.play}:s.cooldowns;
 const session={id:`${s.updated}-${kind}`,started:s.updated,bonus:kind==='toilet'||kind==='tray'?s.updated>=s.toiletBonusAt:true};
 const roomAction:RoomAction=kind==='bath'?{...session,kind,ends:null}
  :kind==='ball'?{...session,kind,ends:null,returns:0}
  :kind==='yoga'?{...session,kind,ends:s.updated+activities.yoga.minutes*60000,yogaSeed:Math.floor(Math.random()*2**32)}
  :{...session,kind,ends:s.updated+activities[kind].minutes*60000,
   ...(kind==='clean'?{cleanupLocation:location,...(dogMessAt===undefined?{}:{cleanupDogMessAt:dogMessAt})}:{}),
   ...(kind==='toilet'?{toiletVisit:Math.random()<.5?'pee':'poop'}:{})};
 return {...s,cooldowns,energy:clamp(s.energy-a.energy),food:clamp(s.food-a.food),hygiene:clamp(s.hygiene-a.hygiene),roomAction};
}
export function parseRoomAction(raw:unknown,g:Game):RoomAction|null{
 if(!raw||typeof raw!=='object')return null;
 const action=raw as ActionSession&{kind:ActivityKind;ends:number|null;returns?:number;yogaSeed?:number};
 const {kind,id,started,ends,bonus}=action;
 if(!Object.hasOwn(activities,kind)||typeof id!=='string'||!Number.isFinite(started)||started>g.updated)return null;
 if(kind==='bath'){
  return ends===null||ends===started+120_000?{id,kind,started,ends:null,bonus}:null;
 }
 if(kind==='ball'){
  if(ends===started+15_000)return {...action,kind,ends:null,returns:0};
  const returns=action.returns;
  return ends===null&&typeof returns==='number'&&Number.isSafeInteger(returns)&&returns>=0
   ?{...action,kind,ends,returns}:null;
 }
 if(kind==='clean'&&(!isLocation(action.cleanupLocation)||!canClean(g,action.cleanupLocation,action.cleanupDogMessAt)))return null;
 if(ends!==started+activities[kind].minutes*60000)return null;
 if(kind==='yoga'){
  const seed=action.yogaSeed;
  return {...action,kind,ends,yogaSeed:typeof seed==='number'&&Number.isInteger(seed)&&seed>=0&&seed<2**32?seed:started>>>0};
 }
 return {...action,kind,ends};
}
export function scrubBath(g:Game,id:string,now=Date.now()):Game{
 const s=advance(g,now),action=s.roomAction;
 if(s.health===0||action?.kind!=='bath'||action.id!==id||s.updated-action.started<BATH_READY_AT)return s;
 const hygiene=clamp(s.hygiene+BATH_STROKE_GAIN);
 const next={...s,hygiene,cares:s.cares+Number(hygiene>s.hygiene)};
 return hygiene===100&&s.tutorial===TUTORIAL.bath?tutorialReward(next,TUTORIAL.bath):next;
}
export function returnBall(g:Game,id:string,now=Date.now()):Game{
 const s=advance(g,now),action=s.roomAction;
 if(s.health===0||action?.kind!=='ball'||action.id!==id)return s;
 const mood=clamp(s.mood+BALL_RETURN_GAIN);
 return {...s,mood,roomAction:{...action,returns:action.returns+1},cares:s.cares+Number(mood>s.mood)};
}
export function finishActivity(g:Game):Game{
 const action=g.roomAction;if(!action||action.ends===null)return g;const a=activities[action.kind];
 if(action.kind==='clean'){
  if(action.cleanupDogMessAt!==undefined&&g.dogCare)return {...g,roomAction:null,
   dogCare:{...g.dogCare,messes:g.dogCare.messes.filter(mess=>mess.at!==action.cleanupDogMessAt)}};
  const floorMess={...g.floorMess};
  if(action.cleanupLocation)delete floorMess[action.cleanupLocation];
  return {...g,roomAction:null,floorMess};
 }
 const toilet=action.kind==='toilet'||action.kind==='tray';
 const day=gameDate(action.ends),count=g.training.day===day?g.training.count:0;
 let s:Game={...g,roomAction:null,cares:g.cares+1,mood:clamp(g.mood+(action.bonus?a.mood:0)),toiletBonusAt:toilet&&action.bonus?action.ends+90*60000:g.toiletBonusAt};
 if(action.kind==='computer')s.economy={balance:g.economy.balance+computerReward.money,xp:g.economy.xp+computerReward.xp};
 if(a.fitness)s={...s,fitnessXP:Math.max(g.fitnessXP,Math.min(100,g.fitnessXP+a.fitness*(count<3?1:.5))),training:{day,count:count+1}};
 return s;
}
export function buyFurniture(g:Game,id:FurnitureId):Game{
 const item=furnitureCatalog.find(i=>i.id===id);
 if(!item||g.health===0||g.tutorial<TUTORIAL.done||g.furniture[id]||g.economy.balance<item.price||playerLevel(g.economy.xp)<item.level||(id==='tray'&&!g.dog))return g;
 return {...g,economy:{...g.economy,balance:g.economy.balance-item.price},furniture:{...g.furniture,[id]:{x:item.x,y:item.y}},furnitureCosts:{...g.furnitureCosts,[id]:item.price}};
}
const furnitureBounds:Record<FurnitureId,[number,number,number,number]>={
 yoga:[.2,.30,.82,.90], dumbbells:[.72,.84,.74,.80], tray:[.26,.34,.73,.80],
};
export function placement(id:FurnitureId,x:number,y:number){
 const [minX,maxX,minY,maxY]=furnitureBounds[id];
 return {x:Math.max(minX,Math.min(maxX,x)),y:Math.max(minY,Math.min(maxY,y))};
}
export function moveFurniture(g:Game,id:FurnitureId,x:number,y:number):Game{
 if(!g.furniture[id]||g.health===0||g.roomAction||!Number.isFinite(x)||!Number.isFinite(y))return g;
 return {...g,furniture:{...g.furniture,[id]:placement(id,x,y)}};
}
export function parseFurniture(raw:unknown):Furniture{
 const result:Furniture={};if(!raw||typeof raw!=='object')return result;
 for(const i of furnitureCatalog){const point=(raw as Furniture)[i.id];if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y))result[i.id]=placement(i.id,point.x,point.y);}
 return result;
}
