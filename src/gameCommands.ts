import {activityReason,buyFurniture,furnitureCatalog,activities,isLocation,moveFurniture,returnBall,scrubBath,startActivity,type ActivityKind,type FurnitureId,type Location} from './activities';
import {FOOD,type FoodId} from './balance';
import {applyClothing} from './economy';
import {act,adoptDog,advance,beginTutorial,cancelActivity,feed,recordFloorMess,wake,type Action,type Game} from './game';
import {acknowledgeHospital,dischargeHospital} from './hospital';
import {availableBeds,businessKeys,buyBed,collectBusiness,openBusiness,type BedUpgrade,type Business} from './property';
import {categoryKeys,type Category} from './wardrobe';
import type {AdminValues} from './adminTypes';
export type {AdminValues} from './adminTypes';

export type GameCommand=
 {kind:'sync'|'intro'|'cancel'|'wake'|'adopt'}
 |{kind:'care';action:Action;food?:FoodId}
 |{kind:'activity';activity:ActivityKind;dogMessAt?:number}
 |{kind:'wash'|'ball';id:string}
 |{kind:'clothing';category:Category;index:number}
 |{kind:'buyFurniture';id:FurnitureId}
 |{kind:'move';id:FurnitureId;x:number;y:number}
 |{kind:'buyBed';id:BedUpgrade}
 |{kind:'openBusiness'|'collectBusiness';id:Business}
 |{kind:'notice'|'discharge';notice:number}
 |{kind:'admin';values:AdminValues};

export function runGameCommand(game:Game,command:GameCommand,now:number,location:Location,admin=false):Game{
 const current=recordFloorMess(advance(game,now,true),location);
 return recordFloorMess(applyCommand(current,command,location,admin),location);
}

function applyCommand(game:Game,command:GameCommand,location:Location,admin:boolean):Game{
 if(!command||!isLocation(location))return game;
 if(!game.introCompleted)return command.kind==='intro'?{...beginTutorial(game.updated),economy:game.economy}:game;
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
 case 'adopt':return adoptDog(game);
 case 'wash':return scrubBath(game,command.id,game.updated);
 case 'ball':return returnBall(game,command.id,game.updated);
 case 'clothing':{
  const {category,index}=command;
  return categoryKeys.includes(category)&&Number.isInteger(index)?applyClothing(game,category,index):game;
 }
 case 'move':return furnitureCatalog.some(item=>item.id===command.id)?moveFurniture(game,command.id,command.x,command.y):game;
 case 'buyFurniture':return buyFurniture(game,command.id);
 case 'buyBed':return availableBeds.includes(command.id)?buyBed(game,command.id,game.updated):game;
 case 'openBusiness':return businessKeys.includes(command.id)?openBusiness(game,command.id,game.updated):game;
 case 'collectBusiness':return businessKeys.includes(command.id)?collectBusiness(game,command.id,game.updated):game;
 case 'admin':{
  if(!admin||!command.values||typeof command.values!=='object')return game;
  const next={...game,economy:{...game.economy}};
  for(const key of ['health','food','energy','mood','hygiene'] as const){
   const value=command.values[key];
   if(typeof value==='number'&&Number.isFinite(value))next[key]=Math.min(100,Math.max(0,value));
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
