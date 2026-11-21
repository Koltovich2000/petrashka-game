export type HairWetness=0|1|2|3|4;
const dryingStep=15*60_000;
const phases=[4,3,2,1] as const;

export function hairWetness(game:{hairWashedAt:number|null;updated:number}):HairWetness{
 const {hairWashedAt,updated}=game;
 if(hairWashedAt==null||hairWashedAt>updated)return 0;
 return phases[Math.floor((updated-hairWashedAt)/dryingStep)]??0;
}
