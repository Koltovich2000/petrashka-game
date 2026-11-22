import type {AvatarLayer} from './PixelAvatar';
import {limit,springStep,type Spring} from './rangePhysics';

const joints={
 tilt:{stiffness:110,damping:13,min:-Infinity,max:Infinity},
 squash:{stiffness:135,damping:12,min:-.34,max:.17},
 waist:{stiffness:94,damping:8,min:-42,max:42},
 head:{stiffness:100,damping:8,min:-52,max:52},
 'right-arm':{stiffness:82,damping:8,min:-103,max:104},
 'left-arm':{stiffness:82,damping:8,min:-104,max:103},
 'right-forearm':{stiffness:74,damping:7,min:-112,max:98},
 'left-forearm':{stiffness:74,damping:7,min:-98,max:112},
 'right-leg':{stiffness:100,damping:9,min:-58,max:66},
 'left-leg':{stiffness:100,damping:9,min:-66,max:58},
 'right-shin':{stiffness:79,damping:8,min:-76,max:54},
 'left-shin':{stiffness:79,damping:8,min:-54,max:76},
};
type RigKey=keyof typeof joints;
export type RangeRig=Record<RigKey,number>;
export type RigSprings=Record<RigKey,Spring>;
const keys=Object.keys(joints) as RigKey[];
export const restRig=()=>Object.fromEntries(keys.map(key=>[key,0])) as RangeRig;
export const restSprings=()=>Object.fromEntries(keys.map(key=>[key,{value:0,velocity:0}])) as RigSprings;

export function rigStep(springs:RigSprings,pose:RangeRig,dt:number){
 const rig=restRig();
 let moving=false;
 for(const key of keys){
  const joint=joints[key];
  const next=springStep(springs[key],pose[key],dt,joint.stiffness,joint.damping);
  const angle=limit(next.value,joint.min,joint.max);
  if(angle!==next.value){next.value=angle;next.velocity*=-.18;}
  springs[key]=next;
  rig[key]=angle;
  if(Math.abs(angle-pose[key])>.03||Math.abs(next.velocity)>.03)moving=true;
 }
 return {rig,moving};
}

export function loosePose(vx:number,vy:number,angle:number,spin:number,compression:number,grip?:AvatarLayer):RangeRig{
 const swing=limit(vx/26,-54,54),fall=limit(vy/34,-42,42);
 const lag=limit(spin/24,-25,25),fold=limit(-compression/.28,0,1);
 const side=grip?.startsWith('right-')?1:-1;
 const hangingByLeg=grip?.endsWith('-leg')||grip?.endsWith('-shin');
 const hangingByArm=grip?.endsWith('-arm')||grip?.endsWith('-forearm');
 const hang=hangingByLeg?side*137:hangingByArm?side*47:0;
 const lift=hangingByArm?side*69:hangingByLeg?side*13:0;
 return {
  tilt:angle+hang-limit(swing*.58,-30,30),
  squash:0,
  waist:limit(-swing*.52-lag*.46+(grip?hang*.15:0)+fold*16,-37,37),
  head:limit(swing*.55-lag*.62-fold*19,-45,45),
  'right-arm':limit(swing-fall*.7-lag+(side===1?lift:0)-fold*19,-97,97),
  'left-arm':limit(swing+fall*.7-lag+(side===-1?lift:0)+fold*19,-97,97),
  'right-forearm':limit(swing*.72+fall*.84-lag+fold*33,-85,85),
  'left-forearm':limit(swing*.72-fall*.84-lag-fold*33,-85,85),
  'right-leg':limit(swing*.72+fall*.54-lag*.52+fold*32,-51,62),
  'left-leg':limit(swing*.72-fall*.54-lag*.52-fold*32,-62,51),
  'right-shin':limit(-swing*.57-fall*.68-lag*.66-fold*48,-70,46),
  'left-shin':limit(-swing*.57+fall*.68-lag*.66+fold*48,-46,70),
 };
}

// An impulse first moves the struck joint. The rest of the pose catches up with its own springs.
export function joltRig(springs:RigSprings,layer:AvatarLayer,impulse:number,direction:number,vertical:boolean){
 const turn=direction*impulse;
 springs.tilt.velocity+=turn*2.7;
 springs.waist.velocity-=turn*(vertical?4.7:3.3);
 springs.squash.velocity-=Math.min(5.5,impulse*.055);
 springs.head.velocity-=turn*(layer==='head'?9:3.7);
 for(const side of ['right','left'] as const){
  const sign=side==='right'?1:-1;
  const arm=layer===`${side}-arm`||layer===`${side}-forearm`;
  const leg=layer===`${side}-leg`||layer===`${side}-shin`;
  springs[`${side}-arm`].velocity+=turn*(arm?8:2.6)-sign*impulse*(vertical?4:1);
  springs[`${side}-forearm`].velocity-=turn*(arm?9:3.4)-sign*impulse*(vertical?5:1.6);
  springs[`${side}-leg`].velocity+=turn*(leg?6:1.4)+sign*impulse*(vertical?5.4:1.5);
  springs[`${side}-shin`].velocity-=turn*(leg?8:2.2)+sign*impulse*(vertical?7.4:2);
 }
}
