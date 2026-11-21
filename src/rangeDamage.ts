export const RANGE_BALANCE={
 durability:300,
 thresholds:{head:{collision:20,bat:10,pistol:4},'left-arm':{collision:25,bat:12,pistol:5},'right-arm':{collision:25,bat:12,pistol:5},'left-leg':{collision:30,bat:15,pistol:6},'right-leg':{collision:30,bat:15,pistol:6},torso:{collision:60,bat:30,pistol:12}},
 collisionMinSpeed:360,collisionDelay:220,regrowDelay:1000,pistolCollapseDelay:1000,markLifetime:3000,emotionDelay:1200,
} as const;
export type RangePart=keyof typeof RANGE_BALANCE.thresholds;
export type Source='collision'|'bat'|'pistol';
export const rangeParts=Object.keys(RANGE_BALANCE.thresholds) as RangePart[];
export type RangeHealth={damage:Record<RangePart,number>;detached:Set<RangePart>;seen:Set<string>};
export function freshRange():RangeHealth{return {damage:Object.fromEntries(rangeParts.map(p=>[p,0])) as RangeHealth['damage'],detached:new Set(),seen:new Set()};}
export function rangePart(layer:string):RangePart{return layer==='right-forearm'?'right-arm':layer==='left-forearm'?'left-arm':layer as RangePart;}
export function hitRange(state:RangeHealth,part:RangePart,source:Source,id:string){
 if(state.detached.has(part)||state.seen.has(id))return state;
 const damage={...state.damage,[part]:Math.min(RANGE_BALANCE.durability,state.damage[part]+RANGE_BALANCE.durability/RANGE_BALANCE.thresholds[part][source])};
 const detached=new Set(state.detached);
 if(damage[part]>=RANGE_BALANCE.durability){if(part==='torso')rangeParts.forEach(p=>detached.add(p));else detached.add(part);}
 return {...state,damage,seen:new Set([...state.seen,id]),detached};
}

export function regrowPart(state:RangeHealth,part:RangePart):RangeHealth{
 const detached=new Set(state.detached);detached.delete(part);
 return {...state,detached,damage:{...state.damage,[part]:0}};
}
