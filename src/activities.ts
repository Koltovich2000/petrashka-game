import {advance,clamp,tutorialReward,type Game} from './game';
import {playerLevel} from './economy';
export type Location='room'|'bathroom'|'hallway';
export const furnitureCatalog=[
 {id:'yoga',name:'Коврик для йоги',price:7500,level:3,location:'room',x:.32,y:.89,icon:'🧘'},
 {id:'dumbbells',name:'Гантели',price:18000,level:5,location:'hallway',x:.68,y:.89,icon:'🏋️'},
 {id:'tray',name:'Лоток для животных',price:35000,level:8,location:'bathroom',x:.50,y:.88,icon:'🐾'},
] as const;
export type FurnitureId=typeof furnitureCatalog[number]['id'];
export type Furniture=Partial<Record<FurnitureId,{x:number;y:number}>>;
export const activities={
 bath:{name:'Моется',location:'bathroom',minutes:2,energy:2,food:0,hygiene:0,mood:4,fitness:0,minEnergy:0,minFood:0},
 toilet:{name:'На унитазе',location:'bathroom',minutes:1,energy:0,food:0,hygiene:0,mood:4,fitness:0,minEnergy:0,minFood:0},
 computer:{name:'Играет за компьютером',location:'room',minutes:10,energy:10,food:4,hygiene:1,mood:12,fitness:0,minEnergy:15,minFood:10},
 yoga:{name:'Занимается йогой',location:'room',minutes:10,energy:8,food:5,hygiene:2,mood:8,fitness:6,minEnergy:13,minFood:15},
 dumbbells:{name:'Тренируется с гантелями',location:'hallway',minutes:10,energy:18,food:12,hygiene:8,mood:3,fitness:10,minEnergy:23,minFood:30},
 tray:{name:'Проверяет лоток',location:'bathroom',minutes:1,energy:0,food:0,hygiene:12,mood:10,fitness:0,minEnergy:0,minFood:0},
} as const;
export type ActivityKind=keyof typeof activities;
export type ToiletVisit='pee'|'poop';
export type RoomAction={id:string;kind:ActivityKind;started:number;ends:number;bonus:boolean;toiletVisit?:ToiletVisit};
export const gameDate=(time:number)=>new Date(time+3*3600000).toISOString().slice(0,10); // Fixed game time zone: Europe/Moscow (UTC+3).
export function activityReason(g:Game,kind:ActivityKind):string{
 if(g.health===0)return 'Персонаж погиб';
 if(g.sleepUntil!==null)return 'Сначала разбудите Петрашку';
 if(g.study||g.roomAction||g.economy.shift||g.restUntil!==null)return 'Сначала завершите текущее занятие';
 if(g.tutorial<5&&!(g.tutorial===3&&kind==='bath'))return 'Сначала выполните задание обучения';
 if(furnitureCatalog.some(i=>i.id===kind)&&!g.furniture[kind as FurnitureId])return 'Сначала купите предмет в магазине';
 if(kind==='bath'&&g.hygiene===100)return 'Гигиена уже 100% — бонусов не будет';
 const a=activities[kind];
 if(g.energy<a.minEnergy)return `Нужно ${a.minEnergy} энергии (не хватает ${Math.ceil(a.minEnergy-g.energy)})`;
 if(g.food<a.minFood)return `Нужно ${a.minFood} сытости (не хватает ${Math.ceil(a.minFood-g.food)})`;
 return '';
}
export function startActivity(g:Game,kind:ActivityKind,now=Date.now()):Game{
 const s=advance(g,now);if(activityReason(s,kind))return s;const a=activities[kind];
 return {...s,energy:clamp(s.energy-a.energy),food:clamp(s.food-a.food),hygiene:clamp(s.hygiene-a.hygiene),roomAction:{id:`${s.updated}-${kind}`,kind,started:s.updated,ends:s.updated+a.minutes*60000,bonus:kind==='toilet'||kind==='tray'?s.updated>=s.toiletBonusAt:true,...(kind==='toilet'?{toiletVisit:Math.random()<.5?'pee' as const:'poop' as const}:{})}};
}
export function finishActivity(g:Game):Game{
 const action=g.roomAction;if(!action)return g;const a=activities[action.kind];
 const toilet=action.kind==='toilet'||action.kind==='tray',day=gameDate(action.ends),count=g.training.day===day?g.training.count:0;
 let s:Game={...g,roomAction:null,cares:g.cares+1,mood:clamp(g.mood+(action.bonus?a.mood:0)),hygiene:action.kind==='bath'?(g.tutorial===3?100:clamp(g.hygiene+40)):g.hygiene,toiletBonusAt:toilet&&action.bonus?action.ends+90*60000:g.toiletBonusAt};
 if(a.fitness)s={...s,fitnessXP:Math.max(g.fitnessXP,Math.min(100,g.fitnessXP+a.fitness*(count<3?1:.5))),training:{day,count:count+1}};
 if(action.kind==='bath'&&g.tutorial===3)s=tutorialReward(s,3);
 return s;
}
export function buyFurniture(g:Game,id:FurnitureId):Game{
 const item=furnitureCatalog.find(i=>i.id===id);
 if(!item||g.tutorial<5||g.furniture[id]||g.economy.balance<item.price||playerLevel(g.economy.xp)<item.level)return g;
 return {...g,economy:{...g.economy,balance:g.economy.balance-item.price},furniture:{...g.furniture,[id]:{x:item.x,y:item.y}}};
}
// Movable items stay in a central floor zone, clear of the bed, desk, bathtub and toilet.
export function placement(id:FurnitureId,x:number,y:number){
 const minX=id==='tray'?.4:.32,maxX=id==='tray'?.6:.68;
 return {x:Math.max(minX,Math.min(maxX,Number.isFinite(x)?x:.5)),y:Math.max(.85,Math.min(.90,Number.isFinite(y)?y:.88))};
}
export function moveFurniture(g:Game,id:FurnitureId,x:number,y:number):Game{
 if(!g.furniture[id]||g.roomAction)return g;
 return {...g,furniture:{...g.furniture,[id]:placement(id,x,y)}};
}
export function parseFurniture(raw:unknown):Furniture{
 const result:Furniture={};if(!raw||typeof raw!=='object')return result;
 for(const i of furnitureCatalog){const point=(raw as Furniture)[i.id];if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y))result[i.id]=placement(i.id,point.x,point.y);}
 return result;
}
