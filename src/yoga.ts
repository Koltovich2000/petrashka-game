export const yogaPoses=['tree','warrior','child'] as const;
export type YogaPose=typeof yogaPoses[number];
export const yogaPoseDuration=30_000;
export const yogaSetup=[
 {phase:'walk-to-mat',duration:560},
 {phase:'pick-up',duration:380},
 {phase:'carry',duration:620},
 {phase:'unroll',duration:760},
] as const;
export const yogaSetupDuration=yogaSetup.reduce((total,{duration})=>total+duration,0);

export function yogaPoseAt(seed:number,index:number):YogaPose{
 let random=seed;
 let previous:YogaPose|undefined;
 let order:YogaPose[]=[...yogaPoses];
 for(let group=0;group<=Math.floor(index/yogaPoses.length);group++){
  order=[...yogaPoses];
  for(let i=order.length-1;i>0;i--){
   random=(Math.imul(random,1664525)+1013904223)>>>0;
   const j=Math.floor(random/2**32*(i+1));
   [order[i],order[j]]=[order[j],order[i]];
  }
  if(order[0]===previous)[order[0],order[1]]=[order[1],order[0]];
  previous=order[order.length-1];
 }
 return order[index%yogaPoses.length];
}

export function yogaFrame(elapsed:number,seed:number){
 let start=0;
 for(const {phase,duration} of yogaSetup){
  if(elapsed<start+duration)return {phase,start,duration,pose:null} as const;
  start+=duration;
 }
 const index=Math.floor((elapsed-start)/yogaPoseDuration);
 return {phase:'practice',start:start+index*yogaPoseDuration,duration:yogaPoseDuration,pose:yogaPoseAt(seed,index)} as const;
}
