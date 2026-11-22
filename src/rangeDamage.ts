import type {AvatarLayer} from './PixelAvatar';
import {limit} from './rangePhysics';
import type {TrapStrike} from './rangeTraps';

export const RANGE_BALANCE={
 durability:300,
 thresholds:{head:{collision:20,bat:10,pistol:4},'left-arm':{collision:25,bat:12,pistol:5},'right-arm':{collision:25,bat:12,pistol:5},'left-leg':{collision:30,bat:15,pistol:6},'right-leg':{collision:30,bat:15,pistol:6},torso:{collision:60,bat:30,pistol:12}},
 collisionMinSpeed:360,collisionDelay:220,regrowDelay:1000,pistolCollapseDelay:1000,markLifetime:3000,emotionDelay:1200,
} as const;
export type RangePart=keyof typeof RANGE_BALANCE.thresholds;
export type Source='collision'|'bat'|'pistol'|TrapStrike;
const trapDamage={spikes:38,weight:55,saw:44} satisfies Record<TrapStrike,number>;
export const rangeParts=Object.keys(RANGE_BALANCE.thresholds) as RangePart[];
export type RangeHealth={damage:Record<RangePart,number>;detached:Set<RangePart>;seen:Set<string>};
export function freshRange():RangeHealth{return {damage:Object.fromEntries(rangeParts.map(p=>[p,0])) as RangeHealth['damage'],detached:new Set(),seen:new Set()};}
export function rangePart(layer:AvatarLayer):RangePart{
 switch(layer){
  case 'right-forearm':return 'right-arm';
  case 'left-forearm':return 'left-arm';
  case 'right-shin':return 'right-leg';
  case 'left-shin':return 'left-leg';
  default:return layer;
 }
}
export function hitRange(state:RangeHealth,part:RangePart,source:Source,id:string){
 if(state.detached.has(part)||state.seen.has(id))return state;
 const points=source==='collision'||source==='bat'||source==='pistol'
  ?RANGE_BALANCE.durability/RANGE_BALANCE.thresholds[part][source]:trapDamage[source];
 const damage={...state.damage,[part]:Math.min(RANGE_BALANCE.durability,state.damage[part]+points)};
 const detached=new Set(state.detached);
 if(damage[part]>=RANGE_BALANCE.durability){if(part==='torso')rangeParts.forEach(p=>detached.add(p));else detached.add(part);}
 return {...state,damage,seen:new Set([...state.seen,id]),detached};
}

export function regrowPart(state:RangeHealth,part:RangePart):RangeHealth{
 const detached=new Set(state.detached);detached.delete(part);
 return {...state,detached,damage:{...state.damage,[part]:0}};
}

type Surface=[left:number,top:number,right:number,bottom:number];
// Inset into the painted sprite so an entire mark fits, including at a hitbox corner.
const damageSurfaces:Record<AvatarLayer,{scale:number;areas:Surface[]}>={
 head:{scale:1,areas:[[47,13,57,22],[38,20,63,36],[47,34,56,41]]},
 torso:{scale:1,areas:[[39,54,61,69]]},
 'right-arm':{scale:.49,areas:[[33,54,34,66]]},
 'left-arm':{scale:.49,areas:[[66,54,67,66]]},
 'right-forearm':{scale:.51,areas:[[33,74,33.5,75.5]]},
 'left-forearm':{scale:.51,areas:[[66.5,74,67,75.5]]},
 'right-leg':{scale:.64,areas:[[40,76,44,80]]},
 'left-leg':{scale:.64,areas:[[56,76,60,80]]},
 'right-shin':{scale:.72,areas:[[40,87,44,91],[37,94,43,96]]},
 'left-shin':{scale:.72,areas:[[56,87,60,91],[57,94,63,96]]},
};

export function anchorRangeMark(layer:AvatarLayer,x:number,y:number,strength=1){
 const {scale,areas}=damageSurfaces[layer];
 let distance=Infinity;
 let anchor={x:0,y:0};
 for(const [left,top,right,bottom] of areas){
  const point={x:limit(x,left,right),y:limit(y,top,bottom)};
  const offset=(point.x-x)**2+(point.y-y)**2;
  if(offset<distance){anchor=point;distance=offset;}
 }
 return {...anchor,strength:strength*scale};
}

