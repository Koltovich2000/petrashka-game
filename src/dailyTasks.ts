import {FOOD} from './balance';
import type {ActivityKind} from './activities';
import type {Game} from './game';

const dailyPay=[500,1000,1800] as const;
const task=(tier:0|1|2,target:number,title:string)=>({title,target,tier,reward:dailyPay[tier]});
const activeTasks={
 bathStart:task(0,1,'Начни мыться в ванной'),
 petTen:task(0,10,'Погладь Петрашку 10 раз'),
 computerOnce:task(0,1,'Заверши одно занятие за компьютером'),
 ballReturns:task(0,3,'Верни мяч 3 раза'),
 toiletVisit:task(0,1,'Посети туалет один раз'),
 differentActions:task(1,5,'Выполни 5 разных видов действий'),
 computerThree:task(1,3,'Заверши 3 занятия за компьютером'),
 noodlesTwice:task(1,2,'Покорми Петрашку Дошираком 2 раза'),
 wakeBeforeTen:task(1,1,'Разбуди Петрашку до 10:00 МСК'),
 computerFive:task(2,5,'Заверши 5 занятий за компьютером'),
 dumbbellSessions:task(2,3,'Заверши 3 тренировки с гантелями'),
 balancedStats:task(2,1,'Подними сытость, энергию, гигиену и настроение до 80% или выше одновременно'),
};
const legacyTasks={
 noodles:{title:'Покорми Петрашку лапшой 5 раз',target:5,reward:320,tier:0},
 computer:{title:'Заверши 3 сеанса за компьютером',target:3,reward:320,tier:0},
 shower:{title:'Отправь Петрашку в душ',target:1,reward:320,tier:0},
 feed:{title:'Покорми персонажа 10 раз',target:10,reward:320,tier:0},
 earlyWake:{title:'Разбуди персонажа с 00:00 до 10:00 МСК',target:1,reward:550,tier:1},
 variety:{title:'Выполни 5 разных действий',target:5,reward:550,tier:1},
 pet:{title:'Погладь Петрашку 20 раз',target:20,reward:550,tier:1},
 healthy:{title:'К концу дня держи сытость, энергию, гигиену и настроение выше 80%',target:1,reward:1000,tier:2},
 noSleep:{title:'Проведи 24 часа без сна',target:1,reward:1000,tier:2},
 dumbbells:{title:'Заверши 5 тренировок с гантелями',target:5,reward:1000,tier:2},
 nightComputer:{title:'Заверши сеанс за компьютером, начатый с 23:00 до полуночи МСК',target:1,reward:1000,tier:2},
} as const;
export const tasks={...activeTasks,...legacyTasks};
type ActiveTask=keyof typeof activeTasks;
export type TaskId=keyof typeof tasks;
export type DailyProgress={
 day:number;rules?:2;ids:TaskId[];counts:Partial<Record<TaskId,number>>;
 actions:string[];
};
export type DailyReward={day:number;id:TaskId};

const hour=3_600_000;
const dayMs=24*hour;
const moscowNoon=9*hour; // 12:00 in Moscow is 09:00 UTC.
export const dailyDay=(time:number)=>Math.floor((time-moscowNoon)/dayMs);
export const dailyStart=(day:number)=>day*dayMs+moscowNoon;
export const nextDailyReset=(time:number)=>dailyStart(dailyDay(time)+1);
const tierTasks:readonly (readonly ActiveTask[])[]=[
 ['bathStart','petTen','computerOnce','ballReturns','toiletVisit'],
 ['differentActions','computerThree','noodlesTwice','wakeBeforeTen'],
 ['computerFive','dumbbellSessions','balancedStats'],
];
const noodlePrice=FOOD.find(item=>item.id==='noodles')!.price;

export function newDaily(day:number,game:Game,now:number):DailyProgress{
 const previous=game.daily&&game.daily.day<day?game.daily.ids:[];
 const availableMoney=(game.dailyRewards??[]).reduce((sum,{id})=>sum+(tasks[id]?.reward??0),game.economy.balance);
 const ids=tierTasks.map(tier=>{
  const available=tier.filter(id=>(id!=='dumbbellSessions'||game.furniture.dumbbells)&&
   (id!=='noodlesTwice'||availableMoney>=noodlePrice*activeTasks.noodlesTwice.target)&&
   (id!=='wakeBeforeTen'||now<dailyStart(day)+22*hour));
  const index=((day%available.length)+available.length)%available.length;
  return [...available.slice(index),...available.slice(0,index)].find(id=>!previous.includes(id))??available[index];
 });
 return {day,rules:2,ids,counts:{},actions:[]};
}

function progressTask(game:Game,id:ActiveTask,amount=1){
 const daily=game.daily;
 if(!daily?.ids.includes(id))return game;
 const before=daily.counts[id]??0;
 if(before>=tasks[id].target)return game;
 const count=Math.min(before+amount,tasks[id].target);
 const next={...game,daily:{...daily,counts:{...daily.counts,[id]:count}}};
 if(count===tasks[id].target){
  next.dailyRewards=[...(game.dailyRewards??[]),{day:daily.day,id}];
 }
 return next;
}

const replacements:Partial<Record<TaskId,ActiveTask>>={
 computer:'computerOnce',variety:'differentActions',dumbbells:'dumbbellSessions',healthy:'balancedStats',
};

export function updateDaily(game:Game,now:number):Game{
 const previous=game.daily,day=dailyDay(now);
 if(previous?.day===day&&previous.rules===2)return game;
 const daily=newDaily(day,game,now);
 const next={...game,daily};
 if(previous?.day!==day)return next;

 // Completed tasks retain their promised rewards and occupy their original difficulty slot.
 const transfers:{id:ActiveTask;count:number}[]=[];
 for(const id of previous.ids){
  if(!Object.hasOwn(legacyTasks,id))continue;
  const {tier,target}=tasks[id];
  const count=previous.counts[id]??0;
  if(count>=target||game.dailyRewards?.some(reward=>reward.day===day&&reward.id===id)){
   daily.ids[tier]=id;
   daily.counts[id]=target;
   continue;
  }
  const replacement=replacements[id];
  if(!replacement||(!count&&id!=='healthy')||(id==='dumbbells'&&!game.furniture.dumbbells))continue;
  daily.ids[tier]=replacement;
  if(id==='variety')daily.actions=previous.actions;
  if(count)transfers.push({id:replacement,count});
 }
 return transfers.reduce<Game>((state,{id,count})=>progressTask(state,id,count),next);
}

export function recordDailyAction(game:Game,action:string,at:number){
 const daily=game.daily;
 if(!daily||daily.day!==dailyDay(at)||!daily.ids.includes('differentActions')||daily.actions.includes(action))return game;
 return progressTask({...game,daily:{...daily,actions:[...daily.actions,action]}},'differentActions');
}

export function recordDailyMeal(game:Game,noodles:boolean,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 const next=recordDailyAction(game,'feed',time);
 return noodles?progressTask(next,'noodlesTwice'):next;
}

export function recordDailyPet(game:Game,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 return progressTask(recordDailyAction(game,'pet',time),'petTen');
}

export function recordDailyWake(game:Game,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 const next=recordDailyAction(game,'wake',time);
 const sinceNoon=time-dailyStart(dailyDay(time));
 return sinceNoon>=12*hour&&sinceNoon<22*hour?progressTask(next,'wakeBeforeTen'):next;
}

export function recordDailyActivity(game:Game,activity:string,at:number){
 if(game.daily?.day!==dailyDay(at))return game;
 const next=recordDailyAction(game,activity,at);
 return activity==='bath'?progressTask(next,'bathStart'):next;
}

export function recordDailyBallReturn(game:Game,at:number){
 return game.daily?.day===dailyDay(at)?progressTask(game,'ballReturns'):game;
}

export function recordDailyFinish(game:Game,activity:ActivityKind,at:number){
 if(game.daily?.day!==dailyDay(at))return game;
 if(activity==='computer'){
  return progressTask(progressTask(progressTask(game,'computerOnce'),'computerThree'),'computerFive');
 }
 if(activity==='toilet')return progressTask(game,'toiletVisit');
 if(activity==='dumbbells')return progressTask(game,'dumbbellSessions');
 return game;
}

export function recordDailyStats(game:Game,at:number,state=game){
 if(game.daily?.day!==dailyDay(at)||!game.daily.ids.includes('balancedStats')||state.hospital||state.health===0)return game;
 return [state.food,state.energy,state.hygiene,state.mood].every(value=>value>=80)?progressTask(game,'balancedStats'):game;
}

export function claimDailyReward(game:Game,day:number,id:TaskId){
 const pending=game.dailyRewards;
 if(!Object.hasOwn(tasks,id)||!pending?.some(reward=>reward.day===day&&reward.id===id))return game;
 const balance=game.economy.balance+tasks[id].reward;
 if(!Number.isSafeInteger(balance))return game;
 return {...game,dailyRewards:pending.filter(reward=>reward.day!==day||reward.id!==id),economy:{...game.economy,balance}};
}
