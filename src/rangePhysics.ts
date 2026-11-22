// Physics is measured in CSS pixels and seconds, independent of refresh rate.
export const limit=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export type Spring={value:number;velocity:number};
export function springStep(s:Spring,target:number,dt:number,stiffness=135,damping=15):Spring{
 // Small substeps keep joints stable after a slow Telegram WebView frame.
 let value=s.value,velocity=s.velocity;
 const count=Math.max(1,Math.ceil(dt/.008)),step=dt/count;
 for(let i=0;i<count;i++){
  velocity+=((target-value)*stiffness-velocity*damping)*step;
  value+=velocity*step;
 }
 return {value,velocity};
}
export type RangeBounds={left:number;right:number;top:number;bottom:number};
export type Flight={x:number;y:number;vx:number;vy:number};
export type Collision={side:'left'|'right'|'ceiling'|'floor';speed:number;part?:import('./rangeDamage').RangePart;x?:number;y?:number};
export function flightStep(f:Flight,b:RangeBounds,dt:number){
 let vx=f.vx,vy=f.vy+1500*dt,x=f.x+vx*dt,y=f.y+vy*dt;
 const collisions:Collision[]=[];
 if(x<b.left||x>b.right){collisions.push({side:x<b.left?'left':'right',speed:Math.abs(vx)});x=limit(x,b.left,b.right);vx*=-.38;}
 if(y<b.top){collisions.push({side:'ceiling',speed:Math.abs(vy)});y=b.top;vy=Math.abs(vy)*.32;}
 if(y>b.bottom){collisions.push({side:'floor',speed:Math.abs(vy)});y=b.bottom;vy*=-.24;vx*=.68;}
 return {x,y,vx,vy,collisions};
}
