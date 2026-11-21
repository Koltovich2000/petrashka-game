import {TUTORIAL,tutorialRewards} from './balance';
import type {Game} from './game';

const courseRewards={book:{xp:12,fitness:2},online:{xp:18,fitness:4},practice:{xp:25,fitness:6}};

export function migrateCareer(game:Game,oldTutorial:unknown,oldEconomy:unknown,oldStudy:unknown){
 const {balance,xp}=game.economy;
 const economy=oldEconomy as {shift?:{id?:string;started?:number;ends?:number;minutes?:number;pay?:number;tutorial?:boolean};lastClaimed?:string}|null;
 const shift=economy?.shift;
 if(oldTutorial===1&&game.introCompleted){
  game.economy={balance:balance+tutorialRewards[0].money,xp:xp+30};
 }else if(shift&&game.health>0&&!shift.tutorial&&typeof shift.id==='string'&&shift.id!==economy?.lastClaimed&&
  typeof shift.started==='number'&&shift.started>=0&&shift.started<=game.updated&&
  typeof shift.minutes==='number'&&[10,15,20,30,60].includes(shift.minutes)&&shift.ends===shift.started+shift.minutes*60_000&&
  typeof shift.pay==='number'&&shift.pay>=0&&Number.isSafeInteger(balance+shift.pay)){
  game.economy={balance:balance+shift.pay,xp:xp+Math.floor(100*shift.minutes/60)};
 }else if(game.health>0&&oldStudy&&typeof oldStudy==='object'){
  const {course,skill,started,ends}=oldStudy as {course:keyof typeof courseRewards;skill:string;started:number;ends:number};
  if(Object.hasOwn(courseRewards,course)&&Number.isFinite(started)&&started>=0&&started<=game.updated&&[600_000,720_000].includes(ends-started)){
   game.economy={balance,xp:xp+courseRewards[course].xp};
   if(skill==='fitness')game.fitnessXP=Math.min(100,game.fitnessXP+courseRewards[course].fitness);
  }
 }
 game.tutorial=oldTutorial===0?TUTORIAL.sandwich:oldTutorial===1||oldTutorial===2?TUTORIAL.noodles:
  oldTutorial===3?TUTORIAL.bath:oldTutorial===4?TUTORIAL.sleep:TUTORIAL.done;
}
