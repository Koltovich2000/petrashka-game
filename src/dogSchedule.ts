import {parseCharacterName} from './characterName';
import {isLocation,locationIds,type Location} from './activities';

export const dogVisitDuration=18_000;
export const dogMessInterval=3_600_000;
export const dogHungerLimit=48*dogMessInterval;
export const dogFoodPrice=80;
export const dogReclaimPrice=5000;
export type DogMess={at:number;location:Location;x:number;y:number;kind:'pee'|'poop'};
export type DogCare={
 name?:string;sheltered?:true;startedAt:number;seed:number;nextMessAt:number;lastFedAt:number;diedAt:number|null;messes:DogMess[];
};

export function dogVisitAt(now:number){
 const index=Math.floor(now/dogVisitDuration);
 return {index,location:locationIds[index%locationIds.length],elapsed:now-index*dogVisitDuration};
}

export function newDogCare(now:number,messes:DogMess[]=[]):DogCare{
 const at=Math.floor(now);
 return {startedAt:at,seed:Math.floor(Math.random()*2**32),nextMessAt:at+dogMessInterval,lastFedAt:at,diedAt:null,messes};
}

export function dogSatiety(care:DogCare,now:number){
 return Math.max(0,Math.min(100,Math.ceil(100*(1-(now-care.lastFedAt)/dogHungerLimit))));
}

export function dogRandom(seed:number,index:number){
 let bits=(seed+Math.imul(index+1,0x9e3779b1))>>>0;
 bits=Math.imul(bits^(bits>>>16),0x85ebca6b);
 return ((bits^(bits>>>13))>>>0)/2**32;
}

export function advanceDogCare(care:DogCare,now:number):DogCare{
 if(!Number.isSafeInteger(care.lastFedAt)){
  return parseDogCare(care,now)??newDogCare(now);
 }
 if(care.sheltered||care.diedAt!==null)return care;
 const deadline=care.lastFedAt+dogHungerLimit;
 const diedAt=now>=deadline?deadline:null;
 const messes:DogMess[]=[];
 let at=care.nextMessAt;
 for(;at<=now&&at<deadline;at+=dogMessInterval){
  const window=(at-care.startedAt)/dogMessInterval;
  const sample=(field:number)=>dogRandom(care.seed,window*4+field);
  messes.push({at,kind:sample(0)<.5?'pee':'poop',location:locationIds[Math.floor(sample(1)*locationIds.length)],
   x:.37+.26*sample(2),y:.705+.09*sample(3)});
 }
 if(!messes.length&&diedAt===null)return care;
 return {...care,nextMessAt:at,diedAt,messes:[...care.messes,...messes]};
}

export function parseDogCare(raw:unknown,savedAt:number,migrateAt=savedAt):DogCare|null{
 if(!raw||typeof raw!=='object')return null;
 const {name:rawName,sheltered,startedAt,seed,nextMessAt,lastFedAt,diedAt,messes}=raw as DogCare;
 const name=parseCharacterName(rawName);
 if(!Number.isSafeInteger(startedAt)||startedAt<0||startedAt>savedAt||!Number.isInteger(seed)||seed<0||seed>=2**32||
  !Array.isArray(messes))return null;
 const seen=new Set<number>();
 const clean=messes.flatMap(mess=>{
  if(!mess||!isLocation(mess.location)||!Number.isSafeInteger(mess.at)||mess.at<0||mess.at>savedAt||seen.has(mess.at)||
   !Number.isFinite(mess.x)||mess.x<.1||mess.x>.9||!Number.isFinite(mess.y)||mess.y<.6||mess.y>.9)return [];
  seen.add(mess.at);
  return [{...mess,kind:mess.kind==='pee'?'pee' as const:'poop' as const}];
 });
 if(lastFedAt===undefined){
  const at=Math.floor(Math.max(migrateAt,savedAt));
  return {...newDogCare(at,clean),seed,...(name?{name}:{})};
 }
 if(!Number.isSafeInteger(lastFedAt)||lastFedAt<startedAt||lastFedAt>savedAt||
  !Number.isSafeInteger(nextMessAt)||nextMessAt<startedAt+dogMessInterval||
  (nextMessAt-startedAt)%dogMessInterval!==0||
  !(diedAt===null||(Number.isSafeInteger(diedAt)&&diedAt===lastFedAt+dogHungerLimit&&diedAt<=savedAt)))return null;
 return {startedAt,seed,nextMessAt,lastFedAt,diedAt,messes:clean,...(name?{name}:{}),...(diedAt===null&&sheltered===true?{sheltered:true}:{})};
}
