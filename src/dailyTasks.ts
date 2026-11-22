import type {Game} from './game';

export const tasks={
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
export type TaskId=keyof typeof tasks;
export type DailyProgress={
 day:number;ids:TaskId[];counts:Partial<Record<TaskId,number>>;
 actions:string[];slept:boolean;
};
export type DailyReward={day:number;id:TaskId};

const hour=3_600_000;
const dayMs=24*hour;
const moscowNoon=9*hour; // 12:00 in Moscow is 09:00 UTC.
export const dailyDay=(time:number)=>Math.floor((time-moscowNoon)/dayMs);
export const dailyStart=(day:number)=>day*dayMs+moscowNoon;
export const nextDailyReset=(time:number)=>dailyStart(dailyDay(time)+1);
const tierTasks:readonly (readonly TaskId[])[]=[
 ['noodles','computer','shower','feed'],['earlyWake','variety','pet'],['healthy','noSleep','dumbbells','nightComputer'],
];

export function newDaily(day:number,game:Game,fullDay:boolean):DailyProgress{
 const previous=game.daily&&game.daily.day<day?game.daily.ids:[];
 const ids=tierTasks.map(tier=>{
  const available=tier.filter(id=>(id!=='dumbbells'||game.furniture.dumbbells)&&
   (id!=='noSleep'||fullDay)&&(id!=='earlyWake'||fullDay));
  const index=((day%available.length)+available.length)%available.length;
  return [...available.slice(index),...available.slice(0,index)].find(id=>!previous.includes(id))??available[index];
 });
 return {day,ids,counts:{},actions:[],slept:game.sleepUntil!==null};
}

function progressTask(game:Game,id:TaskId){
 const daily=game.daily;
 if(!daily?.ids.includes(id))return game;
 const before=daily.counts[id]??0;
 if(before>=tasks[id].target)return game;
 const count=before+1;
 const next={...game,daily:{...daily,counts:{...daily.counts,[id]:count}}};
 if(count===tasks[id].target){
  next.dailyRewards=[...(game.dailyRewards??[]),{day:daily.day,id}];
 }
 return next;
}

export function recordDailyAction(game:Game,action:string,at:number){
 const daily=game.daily;
 if(!daily||daily.day!==dailyDay(at))return game;
 let next=game;
 if(daily.ids.includes('variety')&&!daily.actions.includes(action)){
  next=progressTask({...next,daily:{...daily,actions:[...daily.actions,action]}},'variety');
 }
 return next;
}

export function recordDailyMeal(game:Game,noodles:boolean,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 const next=progressTask(recordDailyAction(game,'feed',time),'feed');
 return noodles?progressTask(next,'noodles'):next;
}

export function recordDailyPet(game:Game,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 return progressTask(recordDailyAction(game,'pet',time),'pet');
}

export function recordDailyWake(game:Game,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 const next=recordDailyAction(game,'wake',time);
 const sinceNoon=time-dailyStart(dailyDay(time));
 return sinceNoon>=12*hour&&sinceNoon<22*hour?progressTask(next,'earlyWake'):next;
}

export function recordDailyActivity(game:Game,activity:string,at:number){
 if(game.daily?.day!==dailyDay(at))return game;
 const next=recordDailyAction(game,activity,at);
 return activity==='bath'?progressTask(next,'shower'):next;
}

export function recordDailySleep(game:Game,time:number){
 if(game.daily?.day!==dailyDay(time))return game;
 const next=recordDailyAction(game,'sleep',time);
 return next.daily?{...next,daily:{...next.daily,slept:true}}:next;
}

export function recordDailyFinish(game:Game,activity:'computer'|'dumbbells',startedAt:number,endedAt:number){
 if(game.daily?.day!==dailyDay(endedAt))return game;
 let next=progressTask(game,activity);
 const sinceNoon=startedAt-dailyStart(dailyDay(startedAt));
 if(activity==='computer'&&sinceNoon>=11*hour&&sinceNoon<12*hour){
  next=progressTask(next,'nightComputer');
 }
 return next;
}

export function finishDaily(game:Game,atEnd:Game){
 let next=game;
 if(!game.daily?.slept&&atEnd.sleepUntil===null)next=progressTask(next,'noSleep');
 if(!atEnd.hospital&&[atEnd.food,atEnd.energy,atEnd.hygiene,atEnd.mood].every(value=>value>80)){
  next=progressTask(next,'healthy');
 }
 return next;
}

export function claimDailyReward(game:Game,day:number,id:TaskId){
 const pending=game.dailyRewards;
 if(!pending?.some(reward=>reward.day===day&&reward.id===id))return game;
 const balance=game.economy.balance+tasks[id].reward;
 if(!Number.isSafeInteger(balance))return game;
 return {...game,dailyRewards:pending.filter(reward=>reward.day!==day||reward.id!==id),economy:{...game.economy,balance}};
}
