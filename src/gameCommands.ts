import {activityReason,buyFurniture,furnitureCatalog,activities,isLocation,moveFurniture,returnBall,scrubBath,startActivity,type ActivityKind,type FurnitureId,type Location} from './activities';
import {FOOD,TUTORIAL,type FoodId} from './balance';
import {applyClothing} from './economy';
import {act,adoptDog,surrenderDog,reclaimDog,buyDogFood,feedDog,advance,beginTutorial,LAST_INTRO_SCENE,setAdminStat,cancelActivity,feed,recordFloorMess,wake,type Action,type Game} from './game';
import {dischargeHospital} from './hospital';
import {categoryKeys,type Category} from './wardrobe';
import {defaultCharacterName,parseCharacterName} from './characterName';
import {
 claimDailyReward,dailyDay,dailyStart,dailyEnd,updateDaily,recordDailyAction,recordDailyActivity,recordDailyBallReturn,
 recordDailyFinish,recordDailyMeal,recordDailyPet,recordDailyStats,recordDailyWake,type TaskId,
} from './dailyTasks';
import {gameTime,realGameTime,type PausePeriod} from './world';
import type {AdminValues} from './adminTypes';
import {isTourSection,tourSections,type TourSection} from './tutorial';
export type {AdminValues} from './adminTypes';

export type GameCommand=
 {kind:'sync'|'cancel'|'wake'|'buyDogFood'|'feedDog'|'surrenderDog'|'reclaimDog'}
 |{kind:'intro';characterName?:string}
 |{kind:'adopt';dogName:string}
 |{kind:'introNext';scene:number}
 |{kind:'tourNext';section:TourSection}
 |{kind:'vote';pollId:string;choice:number}
 |{kind:'dailyClaim';day:number;id:TaskId}
 |{kind:'care';action:Action;food?:FoodId}
 |{kind:'activity';activity:ActivityKind;dogMessAt?:number}
 |{kind:'wash'|'ball';id:string}
 |{kind:'clothing';category:Category;index:number}
 |{kind:'buyFurniture';id:FurnitureId}
 |{kind:'move';id:FurnitureId;x:number;y:number}
 |{kind:'discharge';startedAt:number;cost:number;balance:number}
 |{kind:'hospitalAdStart';startedAt:number}
 |{kind:'hospitalAdCancel';attempt:string}
 |{kind:'notifications';enabled:boolean}
 |{kind:'admin';values:AdminValues};

export function settleGame(game:Game,now:number,pauses:readonly PausePeriod[]=[],wallTime=now):Game{
 let updated=advance(game,now,true);
 if(game.tutorial<TUTORIAL.done)return updated;
 updated=recordDailyStats(updated,realGameTime(game.updated,pauses),game);
 const day=dailyDay(wallTime);
 const activity=game.roomAction;
 const ends=activity?.ends??game.restUntil;
 const completion=!game.hospital&&game.sleepUntil===null&&ends!==null&&ends<=now
  ?{at:realGameTime(ends,pauses),state:advance(game,ends,true)}:null;
 function recordCompletion(state:Game){
  if(!completion)return state;
  const finished=activity?.ends!=null&&!completion.state.roomAction
   ?recordDailyFinish(state,activity.kind,completion.at):state;
  return recordDailyStats(finished,completion.at,completion.state);
 }
 if(game.daily&&game.daily.day<day){
  updated=recordCompletion(updated);
  const boundary=dailyEnd(game.daily.day)-1;
  if(updated.daily?.ids.includes('balancedStats'))updated=recordDailyStats(updated,boundary,advance(game,gameTime(boundary,pauses),true));
 }
 updated=updateDaily(updated,wallTime);
 const startsAt=dailyStart(day),gameStart=gameTime(startsAt,pauses);
 if(game.daily?.day!==day&&game.updated<=gameStart&&updated.daily?.ids.includes('balancedStats')){
  updated=recordDailyStats(updated,startsAt,advance(game,gameStart,true));
 }
 return recordDailyStats(recordCompletion(updated),wallTime);
}

export function runGameCommand(game:Game,command:GameCommand,now:number,location:Location,admin=false,wallTime=now,pauses:readonly PausePeriod[]=[]):Game{
 const current=recordFloorMess(settleGame(game,now,pauses,wallTime),location);
 if(command.kind==='dailyClaim')return claimDailyReward(current,command.day,command.id);
 const next=recordDailyStats(recordFloorMess(applyCommand(current,command,location,admin),location),wallTime);
 if(current.tutorial<TUTORIAL.done||current.hospital)return next;
 if(command.kind==='care'&&next.cares>current.cares){
  if(command.action==='feed')return recordDailyMeal(next,command.food==='noodles',wallTime);
  if(command.action==='pet')return recordDailyPet(next,wallTime);
  if(command.action==='sleep')return recordDailyAction(next,'sleep',wallTime);
 }
 if(command.kind==='wake'&&current.sleepUntil!==null&&next.sleepUntil===null)return recordDailyWake(next,wallTime);
 if(command.kind==='activity'&&next.roomAction&&next.roomAction.id!==current.roomAction?.id){
  return recordDailyActivity(next,next.roomAction.kind,wallTime);
 }
 if(command.kind==='ball'&&current.roomAction?.kind==='ball'&&next.roomAction?.kind==='ball'&&next.roomAction.returns>current.roomAction.returns){
  return recordDailyBallReturn(next,wallTime);
 }
 return next;
}

function applyCommand(game:Game,command:GameCommand,location:Location,admin:boolean):Game{
 if(!command||!isLocation(location))return game;
 if(!game.introCompleted){
  const scene=game.introScene??0;
  if(command.kind==='introNext'&&command.scene===scene&&scene<LAST_INTRO_SCENE)return {...game,introScene:scene+1};
  if(command.kind!=='intro')return game;
  const characterName=command.characterName===undefined?defaultCharacterName:parseCharacterName(command.characterName);
  if(!characterName)return game;
  const started={...beginTutorial(game.updated),characterName,economy:game.economy,statLimits:game.statLimits};
  for(const field of game.introEdits??[])started[field]=game[field];
  return started;
 }
 if(game.hospital){
  if(command.kind==='discharge')return dischargeHospital(game,command.startedAt,command.cost,command.balance);
  return game;
 }
 switch(command.kind){
 case 'tourNext': {
  if(game.tutorial!==TUTORIAL.done||!isTourSection(command.section)||command.section!==game.tourSection)return game;
  const next={...game};
  const section=tourSections[tourSections.indexOf(command.section)+1];
  if(section)next.tourSection=section;
  else delete next.tourSection;
  return next;
 }
 case 'care':
  if(command.action==='feed')return FOOD.some(item=>item.id===command.food)?feed(game,command.food!,game.updated):game;
  return command.action==='pet'||command.action==='sleep'?act(game,command.action,game.updated):game;
 case 'activity':return Object.hasOwn(activities,command.activity)&&!activityReason(game,command.activity,location,command.dogMessAt)?startActivity(game,command.activity,game.updated,location,command.dogMessAt):game;
 case 'cancel':return cancelActivity(game,game.updated);
 case 'wake':return wake(game,game.updated);
 case 'adopt':return adoptDog(game,command.dogName);
 case 'surrenderDog':return surrenderDog(game);
 case 'reclaimDog':return reclaimDog(game);
 case 'buyDogFood':return buyDogFood(game);
 case 'feedDog':return feedDog(game);
 case 'wash':return scrubBath(game,command.id,game.updated);
 case 'ball':return returnBall(game,command.id,game.updated);
 case 'clothing':{
  const {category,index}=command;
  return categoryKeys.includes(category)&&Number.isInteger(index)?applyClothing(game,category,index):game;
 }
 case 'move':return furnitureCatalog.some(item=>item.id===command.id)?moveFurniture(game,command.id,command.x,command.y):game;
 case 'buyFurniture':return buyFurniture(game,command.id);
 case 'admin':{
  if(!admin||!command.values||typeof command.values!=='object')return game;
  const next={...game,economy:{...game.economy}};
  for(const key of ['health','food','energy','mood','hygiene'] as const){
   const value=command.values[key];
   if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)setAdminStat(next,key,value);
  }
  for(const key of ['balance','xp'] as const){
   const value=command.values[key];
   if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)next.economy[key]=value;
  }
  return advance(next,game.updated);
 }
 default:return game;
 }
}
