import {parseCharacterName} from './characterName';
import {isLocation,locationIds,type Location} from './activities';
import {moscowMinuteOfDay} from './roomLighting';

export const dogVisitDuration=18_000;
const hour=3_600_000;
const messScheduleVersion=2;
const dogMessLimit=4;
export const dogMessInterval=4*hour;
export const dogHungerLimit=48*hour;
export const dogShelterAfter=dogHungerLimit+24*hour;
export const dogFoodPrice=80;
export const dogReclaimPrice=5000;
export type DogMess={at:number;location:Location;x:number;y:number;kind:'pee'|'poop'};
export type DogCare={
 name?:string;sheltered?:true;hungerShelterAt?:number;startedAt:number;seed:number;nextMessAt:number;
 lastFedAt:number;diedAt:number|null;messes:DogMess[];messSchedule?:typeof messScheduleVersion;
};

export function dogIsSleepingAt(wallTime:number){
 const minutes=moscowMinuteOfDay(wallTime);
 return minutes>=22*60||minutes<8*60;
}

export function dogVisitAt(now:number){
 const index=Math.floor(now/dogVisitDuration);
 return {index,location:locationIds[index%locationIds.length],elapsed:now-index*dogVisitDuration};
}

export function newDogCare(now:number,messes:DogMess[]=[]):DogCare{
 const at=Math.floor(now);
 return {startedAt:at,seed:Math.floor(Math.random()*2**32),nextMessAt:at+dogMessInterval,
  lastFedAt:at,diedAt:null,messes:messes.slice(0,dogMessLimit),messSchedule:messScheduleVersion};
}

export function dogSatiety(care:DogCare,now:number){
 return Math.max(0,Math.min(100,Math.ceil(100*(1-(now-care.lastFedAt)/dogHungerLimit))));
}

export function dogRandom(seed:number,index:number){
 let bits=(seed+Math.imul(index+1,0x9e3779b1))>>>0;
 bits=Math.imul(bits^(bits>>>16),0x85ebca6b);
 return ((bits^(bits>>>13))>>>0)/2**32;
}

export function advanceDogCare(saved:DogCare,now:number,savedAt=now):DogCare{
 const care=saved.messSchedule===messScheduleVersion?saved:parseDogCare(saved,savedAt,now)??newDogCare(now);
 if(care.sheltered||care.diedAt!==null)return care;
 const deadline=care.lastFedAt+dogShelterAfter;
 const shelterDue=now>=deadline;
 const cutoff=Math.min(now,deadline-1);
 const due=Math.max(0,Math.floor((cutoff-care.nextMessAt)/dogMessInterval)+1);
 if(!due&&!shelterDue)return care;
 const messes=[...care.messes];
 for(let i=0;i<due&&messes.length<dogMessLimit;i++){
  const at=care.nextMessAt+i*dogMessInterval;
  const window=Math.floor((at-care.startedAt)/dogMessInterval);
  const sample=(field:number)=>dogRandom(care.seed,window*4+field);
  messes.push({at,kind:sample(0)<.5?'pee':'poop',location:locationIds[Math.floor(sample(1)*locationIds.length)],
   x:.37+.26*sample(2),y:.705+.09*sample(3)});
 }
 // Windows skipped at the cap do not create a backlog when the player cleans.
 return {...care,nextMessAt:care.nextMessAt+due*dogMessInterval,messes,
  ...(shelterDue?{sheltered:true,hungerShelterAt:deadline}:{})};
}

export function parseDogCare(raw:unknown,savedAt:number,migrateAt=savedAt):DogCare|null{
 if(!raw||typeof raw!=='object')return null;
 const {name:rawName,sheltered,hungerShelterAt,startedAt,seed,nextMessAt,lastFedAt,diedAt,messes,messSchedule}=raw as DogCare;
 const name=parseCharacterName(rawName);
 if(!Number.isSafeInteger(startedAt)||startedAt<0||startedAt>savedAt||!Number.isInteger(seed)||seed<0||seed>=2**32||
  !Array.isArray(messes))return null;
 const seen=new Set<number>();
 const clean=messes.flatMap(mess=>{
  if(!mess||!isLocation(mess.location)||!Number.isSafeInteger(mess.at)||mess.at<0||mess.at>savedAt||seen.has(mess.at)||
   !Number.isFinite(mess.x)||mess.x<.1||mess.x>.9||!Number.isFinite(mess.y)||mess.y<.6||mess.y>.9)return [];
  seen.add(mess.at);
  return [{...mess,kind:mess.kind==='pee'?'pee' as const:'poop' as const}];
 }).slice(0,dogMessLimit);
 if(lastFedAt===undefined){
  const at=Math.floor(Math.max(migrateAt,savedAt));
  return {...newDogCare(at,clean),seed,...(name?{name}:{})};
 }
 const oldSchedule=messSchedule!==messScheduleVersion;
 if(!Number.isSafeInteger(lastFedAt)||lastFedAt<startedAt||lastFedAt>savedAt||
  !Number.isSafeInteger(nextMessAt)||nextMessAt<startedAt+(oldSchedule?hour:dogMessInterval)||
  (oldSchedule&&(nextMessAt-startedAt)%hour!==0)||
  !(diedAt===null||(Number.isSafeInteger(diedAt)&&diedAt===lastFedAt+dogHungerLimit&&diedAt<=savedAt)))return null;
 const isSheltered=diedAt===null&&sheltered===true;
 const hungerTransfer=isSheltered&&hungerShelterAt===lastFedAt+dogShelterAfter&&hungerShelterAt<=savedAt;
 // The first new window is four hours after the last scheduled window in the old hourly save.
 return {startedAt,seed,nextMessAt:oldSchedule?nextMessAt+dogMessInterval-hour:nextMessAt,
  lastFedAt,diedAt,messes:clean,messSchedule:messScheduleVersion,...(name?{name}:{}),
  ...(isSheltered?{sheltered:true}:{}),...(hungerTransfer?{hungerShelterAt}:{})};
}
