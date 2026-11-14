import {catalog,clothingLevel,clothingPrice,defaultOutfit,starterCloset,type Category} from './wardrobe';
import {advance,type Game} from './game';
import {xpProgress} from './balance';
import {skills,skillValue,type Skill} from './study';
export type Profession={id:string;name:string;icon:string;hourly:number;level:number;parent?:string;energy:number;food:number;hygiene:number;mood:number;heavy?:boolean;skill:Skill;skillRequired?:number;};
export const professions:readonly Profession[]=[
 {id:'leaflets',skill:'communication',name:'Листовки',icon:'📄',hourly:1200,level:1,energy:8,food:4,hygiene:2,mood:1},
 {id:'courier',skill:'fitness',name:'Курьер',icon:'🛵',hourly:2400,level:2,parent:'leaflets',energy:12,food:8,hygiene:5,mood:2},
 {id:'seller',skill:'communication',name:'Официант',icon:'🍽️',hourly:3000,level:3,parent:'courier',energy:14,food:7,hygiene:4,mood:4},
 {id:'loader',skill:'fitness',name:'Стройка',icon:'📦',hourly:4800,level:3,parent:'courier',energy:22,food:15,hygiene:10,mood:5,heavy:true},
 {id:'editor',skill:'intelligence',name:'Программист',icon:'💻',hourly:5400,level:6,parent:'seller',energy:13,food:5,hygiene:1,mood:8},
 {id:'blogger',skill:'business',name:'Менеджер',icon:'💼',hourly:7200,level:8,parent:'loader',energy:14,food:6,hygiene:1,mood:10},
 {id:'cashier',name:'Кассир',icon:'🧾',hourly:3600,level:4,parent:'courier',energy:12,food:6,hygiene:3,mood:4,skill:'communication',skillRequired:2},
 {id:'bartender',name:'Бармен',icon:'🍹',hourly:9000,level:9,parent:'seller',energy:15,food:7,hygiene:4,mood:5,skill:'communication',skillRequired:10},
 {id:'logistics',name:'Логист',icon:'🚚',hourly:9600,level:13,parent:'courier',energy:14,food:6,hygiene:2,mood:6,skill:'business',skillRequired:10},
];
export const XP_PER_LEVEL=100;
export const playerLevel=(xp:number)=>xpProgress(xp).level;
export const shiftPay=(job:Profession,minutes:number)=>Math.floor(job.hourly*minutes/60);
export const shiftXP=(minutes:number)=>Math.floor(100*minutes/60);
export type Minutes=10|15|20|30|60;
export function jobUnlockReason(job: Profession, game: Game): string {
 const {economy} = game;
 if (economy.jobId === job.id || economy.completedJobs.includes(job.id)) return '';
 const needs: string[] = [];
 if (playerLevel(economy.xp) < job.level) needs.push(`уровень ${job.level}`);
 const parent = professions.find(p => p.id === job.parent);
 if (parent && !economy.completedJobs.includes(parent.id)) needs.push(`смена «${parent.name}»`);
 if (job.skillRequired && skillValue(game, job.skill) < job.skillRequired) {
  needs.push(`«${skills[job.skill]}» ${job.skillRequired}`);
 }
 return needs.length ? `Требуется: ${needs.join(', ')}` : '';
}
export function jobAvailable(job: Profession, game: Game): boolean {
 return !jobUnlockReason(job, game);
}
export const futurePrices={cheapFood:{min:30,max:700},bed:15000,sofa:25000,tv:30000,stove:35000,roomRenovation:100000,apartmentRenovationFrom:500000};
export type Shift={id:string;profession:string;minutes:Minutes;started:number;ends:number;pay:number;tutorial?:boolean};
export type Economy={balance:number;shift:Shift|null;lastClaimed:string|null;xp:number;completedJobs:string[];jobId:string};
export const newEconomy=():Economy=>({balance:500,shift:null,lastClaimed:null,xp:0,completedJobs:[],jobId:'leaflets'});
export const rubles=(n:number)=>`${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
export function parseEconomy(value:unknown):Economy{
 const base=newEconomy();if(!value||typeof value!=='object')return base;
 const e=value as Economy;base.balance=Number.isSafeInteger(e.balance)&&e.balance>=0?e.balance:500;
 base.lastClaimed=typeof e.lastClaimed==='string'?e.lastClaimed:null;base.xp=Number.isSafeInteger(e.xp)&&e.xp>=0?e.xp:0;
 base.completedJobs=Array.isArray(e.completedJobs)?professions.filter(p=>e.completedJobs.includes(p.id)).map(p=>p.id):[];
 if(professions.some(p=>p.id===e.jobId))base.jobId=e.jobId;
 const s=e.shift;
 // A running shift retains its agreed duration and salary across balance updates.
 if(s&&typeof s.id==='string'&&s.id!==base.lastClaimed&&professions.some(p=>p.id===s.profession)&&[10,15,20,30,60].includes(s.minutes)&&Number.isSafeInteger(s.started)&&s.started>=0&&s.ends===s.started+(s.tutorial?15000:s.minutes*60000)&&Number.isSafeInteger(s.pay)&&s.pay>=0)base.shift={...s};
 return base;
}
export function shiftCost(g:Game,job:Profession,minutes:number){
 if(g.tutorial===1)return {energy:8,food:4,hygiene:2,mood:1};
 const blocks=minutes/10,hunger=1+.3*Math.max(0,(50-g.food)/50);
 const skillDiscount = Math.min(.2, skillValue(g, job.skill) * .01);
 return {energy:Math.ceil(job.energy*blocks*hunger*(1-skillDiscount)),food:job.food*blocks,hygiene:job.hygiene*blocks,mood:job.mood*blocks};
}
export function workReason(g:Game,minutes:Minutes,job:Profession):string{
 if(g.health===0)return 'Персонаж погиб';
 if(g.sleepUntil!==null)return 'Сначала разбудите Петрашку';
 if(g.study)return 'Дождись окончания занятия';
 if(g.roomAction)return 'Сначала завершите занятие в комнате';
 if(g.restUntil!==null)return 'Дождитесь конца отдыха';
 if(g.economy.shift)return 'Смена уже идёт';
 if(g.tutorial<5&&!(g.tutorial===1&&job.id==='leaflets'))return 'Сначала выполните задание обучения';
 const unlock = jobUnlockReason(job,g);
 if(unlock)return unlock;
 if(g.hygiene<=50)return 'Мокрые штаны: помойтесь до гигиены выше 50%';
 if(g.health<(job.heavy?60:30))return `Нужно здоровье ${job.heavy?60:30}%`;
 const cost=shiftCost(g,job,minutes),minFood=Math.max(job.heavy?40:15,cost.food);
 if(g.food<minFood)return `Не хватает ${Math.ceil(minFood-g.food)} сытости`;
 if(g.energy<cost.energy+5)return `Не хватает ${Math.ceil(cost.energy+5-g.energy)} энергии (включая резерв 5)`;
 return '';
}
export function startShift(g:Game,minutes:Minutes,profession=g.economy.jobId,now=Date.now()):Game{
 const next=advance(g,now),job=professions.find(p=>p.id===profession);
 if(!job||![10,15,20,30,60].includes(minutes)||workReason(next,minutes,job))return next;
 const cost=shiftCost(next,job,minutes),tutorial=next.tutorial===1,started=next.updated;
 return {...next,energy:next.energy-cost.energy,food:Math.max(0,next.food-cost.food),hygiene:Math.max(0,next.hygiene-cost.hygiene),mood:Math.max(0,next.mood-cost.mood),economy:{...next.economy,jobId:job.id,shift:{id:`${started}-${Math.random().toString(36).slice(2)}`,profession,minutes,started,ends:started+(tutorial?15000:minutes*60000),pay:tutorial?250:shiftPay(job,minutes),tutorial}}};
}
export function claimSalary(g:Game,now=Date.now()):Game{return advance(g,now);}

export function applyClothing(game:Game,category:Category,index:number):Game{
 if(game.tutorial<5)return game;
 const closet=game.closet??starterCloset();
 const outfit={...closet.outfit,[category]:index};
 if(index===defaultOutfit[category]||closet.owned[category].includes(index)){
  return {...game,closet:{...closet,outfit}};
 }
 if(!catalog[category][index]||playerLevel(game.economy.xp)<clothingLevel(index))return game;
 const price=clothingPrice(index);
 if(game.economy.balance<price)return game;
 return {
  ...game,
  economy:{...game.economy,balance:game.economy.balance-price},
  closet:{...closet,outfit,owned:{...closet.owned,[category]:[...closet.owned[category],index]}},
 };
}
