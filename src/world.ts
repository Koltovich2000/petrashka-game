export type PausePeriod={start:number;end:number|null};
export type PollState={
 id:string;question:string;options:string[];endsAt:number;
 choice:number|null;counts:number[]|null;totalVotes:number;
};
export type WorldState={now:number;paused:boolean;poll:PollState|null};
export const pollLimits={question:160,option:80,options:6,maxMinutes:10_080} as const;

export function gameTime(wallTime:number,pauses:readonly PausePeriod[]){
 let paused=0;
 for(const {start,end} of pauses){
  if(start>=wallTime)break;
  paused+=Math.min(wallTime,end??wallTime)-start;
 }
 return wallTime-paused;
}

export function realGameTime(gameAt:number,pauses:readonly PausePeriod[]){
 let paused=0;
 for(const {start,end} of pauses){
  if(gameAt<=start-paused)return gameAt+paused;
  if(end===null)return start;
  paused+=end-start;
 }
 return gameAt+paused;
}
