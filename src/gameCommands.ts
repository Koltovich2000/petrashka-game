import {activityReason,buyFurniture,furnitureCatalog,activities,isLocation,moveFurniture,returnBall,scrubBath,startActivity,type ActivityKind,type FurnitureId,type Location} from './activities';
import {FOOD,TUTORIAL,type FoodId} from './balance';
import {applyClothing} from './economy';
import {act,adoptDog,surrenderDog,reclaimDog,buyDogFood,feedDog,advance,beginTutorial,LAST_INTRO_SCENE,setAdminStat,cancelActivity,feed,recordFloorMess,wake,type Action,type Game} from './game';
import {acknowledgeHospital,dischargeHospital} from './hospital';
import {categoryKeys,type Category} from './wardrobe';
import {defaultCharacterName,parseCharacterName} from './characterName';
import {
 claimDailyReward,dailyDay,dailyStart,finishDaily,newDaily,recordDailyActivity,recordDailyFinish,
 recordDailyMeal,recordDailyPet,recordDailySleep,recordDailyWake,type TaskId,
} from './dailyTasks';
import {gameTime,realGameTime,type PausePeriod} from './world';
import type {AdminValues} from './adminTypes';
export type {AdminValues} from './adminTypes';

export type GameCommand=
 {kind:'sync'|'cancel'|'wake'|'buyDogFood'|'feedDog'|'surrenderDog'|'reclaimDog'}
 |{kind:'intro';characterName?:string}
 |{kind:'adopt';dogName:string}
 |{kind:'introNext';scene:number}
 |{kind:'vote';pollId:string;choice:number}
 |{kind:'dailyClaim';day:number;id:TaskId}
 |{kind:'care';action:Action;food?:FoodId}
 |{kind:'activity';activity:ActivityKind;dogMessAt?:number}
 |{kind:'wash'|'ball';id:string}
 |{kind:'clothing';category:Category;index:number}
 |{kind:'buyFurniture';id:FurnitureId}
 |{kind:'move';id:FurnitureId;x:number;y:number}
 |{kind:'notice'|'discharge';notice:number}
 |{kind:'admin';values:AdminValues};

export function settleGame(game:Game,now:number,pauses:readonly PausePeriod[]=[],wallTime=now):Game{
 let updated=advance(game,now,true);
 if(game.tutorial<TUTORIAL.done)return updated;
 const day=dailyDay(wallTime);
 const activity=game.roomAction;
 const completion=!game.hospital&&game.sleepUntil===null&&
  (activity?.kind==='computer'||activity?.kind==='dumbbells')&&
  activity.ends<=updated.updated&&activity!==updated.roomAction
  ?{kind:activity.kind,start:realGameTime(activity.started,pauses),end:realGameTime(activity.ends,pauses)}:null;
 if(game.daily&&game.daily.day<day){
  if(completion&&dailyDay(completion.end)===game.daily.day){
   updated=recordDailyFinish(updated,completion.kind,completion.start,completion.end);
  }
  const boundary=gameTime(dailyStart(game.daily.day+1)-1,pauses);
  updated=finishDaily(updated,advance(game,boundary,true));
 }
 if(!game.daily||game.daily.day<day){
  const startsAt=dailyStart(day);
  const started=game.updated<=gameTime(startsAt,pauses);
  const atStart=started?advance(game,gameTime(startsAt,pauses),true):game;
  updated={...updated,daily:newDaily(day,atStart,started)};
 }
 if(completion&&dailyDay(completion.end)===day){
  updated=recordDailyFinish(updated,completion.kind,completion.start,completion.end);
 }
 return updated;
}

export function runGameCommand(game:Game,command:GameCommand,now:number,location:Location,admin=false,wallTime=now,pauses:readonly PausePeriod[]=[]):Game{
 const current=recordFloorMess(settleGame(game,now,pauses,wallTime),location);
 if(command.kind==='dailyClaim')return claimDailyReward(current,command.day,command.id);
 const next=recordFloorMess(applyCommand(current,command,location,admin),location);
 if(current.tutorial<TUTORIAL.done||current.hospital)return next;
 if(command.kind==='care'&&next.cares>current.cares){
  if(command.action==='feed')return recordDailyMeal(next,command.food==='noodles',wallTime);
  if(command.action==='pet')return recordDailyPet(next,wallTime);
  if(command.action==='sleep')return recordDailySleep(next,wallTime);
 }
 if(command.kind==='wake'&&current.sleepUntil!==null&&next.sleepUntil===null)return recordDailyWake(next,wallTime);
 if(command.kind==='activity'&&next.roomAction&&next.roomAction.id!==current.roomAction?.id){
  return recordDailyActivity(next,next.roomAction.kind,wallTime);
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
  if(command.kind==='notice')return acknowledgeHospital(game,command.notice);
  if(command.kind==='discharge')return dischargeHospital(game,command.notice);
  return game;
 }
 switch(command.kind){
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
