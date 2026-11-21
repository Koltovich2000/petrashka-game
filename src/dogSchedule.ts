import {isLocation,locationIds,type Location} from './activities';

export const dogVisitDuration=18_000;
export const dogMessInterval=12*3_600_000;
export type DogMess={at:number;location:Location;x:number;y:number};
export type DogCare={startedAt:number;seed:number;nextWindow:number;messes:DogMess[]};

export function dogVisitAt(now:number){
 const index=Math.floor(now/dogVisitDuration);
 return {index,location:locationIds[index%locationIds.length],elapsed:now-index*dogVisitDuration};
}

export function newDogCare(now:number):DogCare{
 return {startedAt:Math.floor(now),seed:Math.floor(Math.random()*2**32),nextWindow:0,messes:[]};
}

export function dogRandom(seed:number,index:number){
 let bits=(seed+Math.imul(index+1,0x9e3779b1))>>>0;
 bits=Math.imul(bits^(bits>>>16),0x85ebca6b);
 return ((bits^(bits>>>13))>>>0)/2**32;
}

export function advanceDogCare(care:DogCare,now:number):DogCare{
 const messes:DogMess[]=[];
 let nextWindow=care.nextWindow;
 for(;;nextWindow++){
  const at=care.startedAt+nextWindow*dogMessInterval+Math.floor(dogRandom(care.seed,nextWindow*3)*dogMessInterval);
  if(at>now)break;
  messes.push({at,location:dogVisitAt(at).location,x:.37+.26*dogRandom(care.seed,nextWindow*3+1),y:.705+.09*dogRandom(care.seed,nextWindow*3+2)});
 }
 return messes.length?{...care,nextWindow,messes:[...care.messes,...messes]}:care;
}

export function parseDogCare(raw:unknown,now:number):DogCare|null{
 if(!raw||typeof raw!=='object')return null;
 const {startedAt,seed,nextWindow,messes}=raw as DogCare;
 if(!Number.isSafeInteger(startedAt)||startedAt<0||startedAt>now||!Number.isInteger(seed)||seed<0||seed>=2**32||
  !Number.isSafeInteger(nextWindow)||nextWindow<0||nextWindow>Math.floor((now-startedAt)/dogMessInterval)+1||!Array.isArray(messes))return null;
 const seen=new Set<number>();
 const clean=messes.filter(mess=>{
  if(!mess||!isLocation(mess.location)||!Number.isSafeInteger(mess.at)||mess.at<startedAt||mess.at>now||seen.has(mess.at)||
   !Number.isFinite(mess.x)||mess.x<.1||mess.x>.9||!Number.isFinite(mess.y)||mess.y<.6||mess.y>.9)return false;
  seen.add(mess.at);
  return true;
 });
 return {startedAt,seed,nextWindow,messes:clean};
}
