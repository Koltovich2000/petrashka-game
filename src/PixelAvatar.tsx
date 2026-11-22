import {useId,type ReactNode} from 'react';
import { catalog, type Outfit } from './wardrobe';
import {DumbbellArt} from './DumbbellArt';
import {YogaArms,YogaLegs} from './YogaLimbs';
import type {YogaPose} from './yoga';
import type {HairWetness} from './hair';
import {AvatarHeadArt} from './AvatarHeadArt';
export type AvatarLayer='head'|'torso'|'right-arm'|'left-arm'|'right-leg'|'left-leg'|'right-forearm'|'left-forearm'|'right-shin'|'left-shin';
export type AvatarJoints=Partial<Record<AvatarLayer|'waist',number>>;
export function PixelAvatar({outfit:o,pose='idle',state='happy',hit='head',viewBox='0 0 100 104',hygiene=100,wetness=0,decals,joints,rangeFaces=false,yogaPose}:{outfit:Outfit;rangeFaces?:boolean;pose?:string;state?:string;hit?:string;viewBox?:string;hygiene?:number;wetness?:HairWetness;joints?:AvatarJoints;decals?:Partial<Record<AvatarLayer,ReactNode>>;yogaPose?:YogaPose}){
 const holdingWeights=pose==='dumbbells'||pose==='dumbbell-stand',eating=pose==='eating';
 const top=catalog.top[o.top].color,pants=catalog.pants[o.pants].color,shoe=catalog.shoes[o.shoes].color,hat=catalog.hat[o.hat]?.color,acc=catalog.accessory[o.accessory]?.color;
 const articulated=joints?.waist!==undefined;
 const kneeClip=useId();
 const joint=(name:AvatarLayer|'waist',x:number,y:number)=>joints?{transform:`rotate(${joints[name]??0}deg)`,transformOrigin:`${x}px ${y}px`,animation:'none'}:undefined;
 const expression=state==='scared'||state==='angry'?2:state==='pain'?3:state==='faint'||state==='detached'||state==='sleep'?1:pose==='dragging'||pose==='falling'||pose==='reacting'?2:['hungry','sick','sad','tired','dirty'].includes(state)?3:0;
 const rangeFace=state==='angry'?2:state==='pain'||state==='detached'?1:0;
 const cape=o.accessory===9&&<path className="avatar-cape" d={yogaPose?'M30 49 24 77H76L70 49Z':'M30 49 20 93 80 93 70 49Z'} fill={acc}/>;
 const torso=<g data-avatar-layer="torso"><path d={yogaPose==='child'?'M33 54Q36 46 46 46H58Q65 46 68 53L69 66Q67 73 64 76H34Q30 70 31 61Z':'M32 49 42 46H58L68 49V75H32Z'} fill={top}/><path d="M36 53V72M64 53V72" stroke="#ffffff30"/>
 {o.top===0&&<g stroke="none" fill="#f5d66c"><path d="M41 56H59V58H41Z"/><path d="M40 63H44V69H40ZM48 61H52V69H48ZM56 63H60V69H56Z"/></g>}
 {o.top===1&&<><path d="M42 49 50 55 58 49M40 66H60V71H40Z" fill="none"/><path d="M44 53V61M56 53V61" stroke="#e8d1ff"/></>}
 {[2,3,4,7,8,9].includes(o.top)&&<path d="M50 50V74M35 60H44V66H35M56 60H65V66H56" fill="none" stroke={o.top===7?'#c4c3cc':'#f0d5b0'} strokeWidth="1"/>}
 {o.top===5&&<path d="M33 56H67M33 63H67M33 70H67" stroke="#334e86" strokeWidth="3"/>}
 {o.top===6&&<path d="m39 60 5-5 6 5 6-5 5 5-5 5-6-5-6 5Z" fill="#ab6b48" stroke="none"/>}
 {!yogaPose&&o.pants===9&&<path d="M56 75V82H64V75" fill="none" stroke="#bcb5ce" strokeWidth="1"/>}
 {decals?.torso}</g>;
 // The square viewport clips the selected sprite without exposing the next atlas frame.
 const head=<g className="avatar-head" data-avatar-layer="head" style={joint('head',50,47)}><AvatarHeadArt x="21" y="-3" width="58" height="58" range={rangeFaces} expression={rangeFaces?rangeFace:expression} wetness={wetness}/>
 {(state==='faint'||state==='detached')&&<path d="m35 31 8 8m0-8-8 8m22-8 8 8m0-8-8 8" stroke="#32243e" strokeWidth="3"/>}
 {!rangeFaces&&state==='pain'&&<g stroke="#502a34" strokeWidth="1.4"><path d="m35 33 7 3-7 2m30-5-7 3 7 2" fill="none"/></g>}
 {!rangeFaces&&state==='angry'&&<g><path d="M34 26 44 30M56 30 66 26" fill="none" stroke="#39202b" strokeWidth="2.4"/><path d="M43 40H58V47H43Z" fill="#f3b080" stroke="none"/><path d="M44 44Q50 40 57 44" fill="none" stroke="#713b37" strokeWidth="1.5"/></g>}
 {o.hat===0&&<path d="M25 16V10H30V5H66V10H71V19H77V23H48V18Z" fill={hat}/>}
 {o.hat===1&&<><path d="M27 15V7H34V2H64V7H71V19H27Z" fill={hat}/><path d="M25 16H73V23H25Z" fill="#ba91e6"/></>}
 {o.hat===2&&<path d="M29 8H69L73 20H81V25H19V20H26Z" fill={hat}/>}
 {o.hat===3&&<path d="m25 3 10 9 15-13 15 13 10-9-4 22H29Z" fill={hat}/>}
 {o.hat===4&&<path d="M33 5H43L49 9 56 5H67L71 20H83V26H17V20H29Z" fill={hat}/>}
 {o.hat===5&&<path d="M23 14V7H35V2H64V7H76V16H67V23H29V18Z" fill={hat}/>}
 {o.hat===6&&<path d="M24 40H19V10H24V2H76V10H81V40H76M24 40V48H76V40" fill="none" stroke={hat} strokeWidth="5"/>}
 {o.hat===7&&<><path d="M22 17 22-2 39 13M61 13 78-2 78 17" fill={hat}/><path d="m26 12 0-7 7 7m34 0 7-7v7" stroke="#e79db5"/></>}
 {o.hat===8&&<path d="M32-4H68V19H78V25H22V19H32Z" fill={hat}/>}
 {o.hat===9&&<path d="M22 12V3H78V12H82V30H73V18H27V30H18V12Z" fill={hat}/>}
 {o.accessory===0&&<><path d="M30 30H45V40H30ZM55 30H70V40H55ZM45 34H55" fill="none" stroke={acc}/></>}
 {o.accessory===1&&<path d="M29 30H45V40H32ZM55 30H71L68 40H55ZM45 33H55" fill={acc}/>}
 {o.accessory===4&&<><path d="M22 35V16H28V10H72V16H78V35" fill="none" stroke={acc} strokeWidth="4"/><path d="M21 27H28V42H21ZM72 27H79V42H72Z" fill={acc}/></>}
 {decals?.head}
 </g>;
 const torsoAccessories=<g className="avatar-torso-accessories">
 {o.accessory===2&&<path d="M39 47H61V54H54V67H47V54H39Z" fill={acc}/>}
 {o.accessory===3&&<path d="M39 51 43 61H57L61 51" fill="none" stroke={acc}/>}
 {o.accessory===5&&<path d="m39 49 11 4 11-4v10l-11-4-11 4Z" fill={acc}/>}
 {o.accessory===6&&<><path d="M35 49 64 71" stroke={acc} strokeWidth="4"/><path d="M56 65H70V78H56Z" fill={acc}/></>}
 {o.accessory===7&&<><path d="m41 49 9 12 9-12" fill="none" stroke="#ed5757"/><path d="m50 58 3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1Z" fill={acc}/></>}
 {o.accessory===8&&<path d="M63 73H72V77H63Z" fill={acc}/>}</g>;
 function leg(side:'right'|'left'){
  const right=side==='right',part=`${side}-leg` as const,shin=`${side}-shin` as const;
  const art=<>
   <path d={right?'M35 70H49V96H33V88H35Z':'M51 70H65V88H67V96H51Z'} fill={pants}/>
   {o.pants===2&&<path d={right?'M35 77H44V84H35':'M56 77H65V84H56'} fill="#95946a"/>}
   {o.pants===7&&<path d={right?'M37 80H45M36 86H44':'M55 80H63M56 86H64'} stroke="#d1c9b5"/>}
   {o.pants===8&&<path d={right?'M35 83H48V96H34Z':'M52 83H65V96H52Z'} fill="#efaa79"/>}
   <path d={right?'M32 92H48V101H27V97H32Z':'M52 92H68V97H73V101H52Z'} fill={shoe}/>
   <path d={right?'M28 100H48M35 95H43':'M52 100H72M57 95H65'} stroke="#f9eddd"/>
   {o.shoes===7&&<path d={right?'M34 84H47V94H33Z':'M53 84H66V94H53Z'} fill={shoe}/>}
  </>;
  const kneeX=right?42:58;
  return <g className={`leg leg-${side}`} data-avatar-layer={part} style={joint(part,right?43:57,73)}>
   {articulated?<>
    <circle cx={kneeX} cy="84" r="6.8" fill={pants}/>
    <g clipPath={`url(#${kneeClip}-thigh)`}>{art}{decals?.[part]}</g>
    <g data-avatar-layer={shin} style={joint(shin,kneeX,84)}>
     <g clipPath={`url(#${kneeClip}-shin)`}>{art}</g>
     {decals?.[shin]}
    </g>
   </>:<>{art}{decals?.[part]}</>}
  </g>;
 }
 const upper=<>
 {torso}
 <g className="arm arm-right" data-avatar-layer="right-arm" style={joint('right-arm',34,52)}><path d="M30 50H38V62H29Z" fill={top}/>{joints||holdingWeights?<> <path d="M29 62H37V71H29Z" fill="#f2ac7c" strokeWidth="1.8"/><path d="M30 65V70" stroke="#ffd1a0"/>{decals?.['right-arm']}
 <g data-avatar-layer="right-forearm" style={joint('right-forearm',33,70)}>{holdingWeights&&<DumbbellArt x={31} y={79} width={24}/>}<path d="M29 70H37V79H33V82H27V76H29Z" fill="#f2ac7c"/><path d="M30 70V76" stroke="#ffd1a0"/>{decals?.['right-forearm']}</g> </>:<> <path d="M29 62H37V79H33V82H27V76H29Z" fill="#f2ac7c"/><path d="M30 66V76" stroke="#ffd1a0" strokeWidth="2"/>{decals?.['right-arm']} </>}</g>
 <g className="arm arm-left" data-avatar-layer="left-arm" style={joint('left-arm',66,52)}><path d="M62 50H70L71 62H62Z" fill={top}/>{joints||holdingWeights?<> <path d="M63 62H71V71H63Z" fill="#f2ac7c" strokeWidth="1.8"/><path d="M66 65V70" stroke="#ffd1a0"/>{decals?.['left-arm']}
 <g data-avatar-layer="left-forearm" style={joint('left-forearm',67,70)}>{holdingWeights&&<DumbbellArt x={69} y={79} width={24}/>}<path d="M63 70H71V76H73V82H67V79H63Z" fill="#f2ac7c"/><path d="M66 70V76" stroke="#ffd1a0"/>{decals?.['left-forearm']}</g> </>:<> <path d="M63 62H71V76H73V82H67V79H63Z" fill="#f2ac7c"/><path d="M66 66V76" stroke="#ffd1a0" strokeWidth="2"/>{decals?.['left-arm']} </>}</g>
 {head}
 {eating&&<path className="eating-mouth" d="M46 43Q51 41 56 43Q55 49 51 49Q47 48 46 43Z" fill="#56272a" stroke="#713827" strokeWidth="1"/>}
 {eating&&<g className="eating-arm">
  <path d="M33 51Q29 53 26 60Q23 66 27 70Q31 74 36 70L41 58L36 54L39 51Z" fill={top}/>
  <path d="M38 61Q33 61 33 56L35 51Q36 47 40 46L43 47Q47 47 46 50L44 51L45 53L42 54L42 58Q41 61 38 61Z" fill="#f2ac7c"/>
  <path d="M38 50Q41 48 44 50M38 54Q40 52 43 53" fill="none" stroke="#994e3a" strokeWidth="1"/>
  <path d="M36 55Q36 51 39 49" fill="none" stroke="#ffd1a0" strokeWidth="1.25"/>
 </g>}
 {torsoAccessories}
 </>;
 return <svg className={`pixel-avatar pose-${pose} hit-${hit} state-${state}${yogaPose?' yoga-pose yoga-pose-'+yogaPose:''}`} viewBox={yogaPose?'-2 -17 104 121':viewBox} shapeRendering="crispEdges" aria-hidden="true">
 {articulated&&<defs>
  <clipPath id={`${kneeClip}-thigh`}><path d="M25 68H75V85H25Z"/></clipPath>
  <clipPath id={`${kneeClip}-shin`}><path d="M25 83H75V103H25Z"/></clipPath>
 </defs>}
 <g className="avatar-body" stroke="#261b34" strokeWidth="2" strokeLinejoin="miter">
 {yogaPose?<>
  <YogaLegs pose={yogaPose} pants={pants} shoe={shoe}/>
  <g className="yoga-upper-body">
   {cape}{torso}{torsoAccessories}{head}
   <YogaArms pose={yogaPose} top={top}/>
  </g>
 </>:<>
 {cape}
 {leg('right')}{leg('left')}
 {hygiene<=50&&<path className="wet-pants" d="M40 73H60V81H58V89H53V80H47V91H42V83H40Z" fill="#c69a2e" fillOpacity=".85" stroke="#f8d768" strokeOpacity=".7" strokeWidth="1"/>}
 {articulated?<g style={joint('waist',50,70)}>{upper}</g>:upper}
 </>}
 </g></svg>;
}
