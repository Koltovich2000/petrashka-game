export type Hit='head'|'belly'|'legs'|'right-foot'|'left-foot'|'right-arm'|'left-arm';
// Coordinates are normalized to the upright sprite square; right/left are the character's.
export function bodyPart(x:number,y:number):Hit|null {
 if(x<.23||x>.77||y<.02||y>1)return null;
 if(y<.49)return 'head';
 if(y>.88)return x<.5?'right-foot':'left-foot';
 if(y<.76&&x<.39)return 'right-arm';
 if(y<.76&&x>.61)return 'left-arm';
 if(y<.69)return 'belly';
 return 'legs';
}
export const reactions:Record<Hit,{cell:number;text:string}>={
 head:{cell:0,text:'Ой! По голове не надо!'},belly:{cell:1,text:'Уф! Щекотно… и неожиданно!'},legs:{cell:2,text:'Ой-ой! Осторожнее!'},
 'right-foot':{cell:3,text:'Правую ступню убрал!'},'left-foot':{cell:4,text:'Левую ступню убрал!'},
 'right-arm':{cell:5,text:'Ой, моя правая рука!'},'left-arm':{cell:6,text:'Ой, моя левая рука!'}
};
