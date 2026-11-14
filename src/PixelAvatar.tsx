import { catalog, type Outfit } from './wardrobe';
export function PixelAvatar({outfit:o,pose='idle',state='happy',hit='head',viewBox='0 0 100 104',hygiene=100}:{outfit:Outfit;pose?:string;state?:string;hit?:string;viewBox?:string;hygiene?:number}){
 const top=catalog.top[o.top].color,pants=catalog.pants[o.pants].color,shoe=catalog.shoes[o.shoes].color,hat=catalog.hat[o.hat]?.color,acc=catalog.accessory[o.accessory]?.color;
 const expression=state==='faint'||state==='sleep'?1:pose==='dragging'||pose==='falling'||pose==='reacting'?2:['hungry','sick','sad','tired','dirty'].includes(state)?3:0;
 return <svg className={`pixel-avatar pose-${pose} hit-${hit} state-${state}`} viewBox={viewBox} shapeRendering="crispEdges" aria-hidden="true"><g className="avatar-body" stroke="#261b34" strokeWidth="2" strokeLinejoin="miter">
 {o.accessory===9&&<path d="M30 49 20 93 80 93 70 49Z" fill={acc}/>}
 <g className="leg leg-right"><path d="M35 70H49V96H33V88H35Z" fill={pants}/>{o.pants===2&&<path d="M35 77H44V84H35" fill="#95946a"/>}{o.pants===7&&<path d="M37 80H45M36 86H44" stroke="#d1c9b5"/>}{o.pants===8&&<path d="M35 83H48V96H34Z" fill="#efaa79"/>}<path d="M32 92H48V101H27V97H32Z" fill={shoe}/><path d="M28 100H48M35 95H43" stroke="#f9eddd"/>{o.shoes===7&&<path d="M34 84H47V94H33Z" fill={shoe}/>}</g>
 <g className="leg leg-left"><path d="M51 70H65V88H67V96H51Z" fill={pants}/>{o.pants===2&&<path d="M56 77H65V84H56" fill="#95946a"/>}{o.pants===7&&<path d="M55 80H63M56 86H64" stroke="#d1c9b5"/>}{o.pants===8&&<path d="M52 83H65V96H52Z" fill="#efaa79"/>}<path d="M52 92H68V97H73V101H52Z" fill={shoe}/><path d="M52 100H72M57 95H65" stroke="#f9eddd"/>{o.shoes===7&&<path d="M53 84H66V94H53Z" fill={shoe}/>}</g>
 {hygiene<=50&&<path className="wet-pants" d="M40 73H60V81H58V89H53V80H47V91H42V83H40Z" fill="#172432" fillOpacity=".85" stroke="#4386aa" strokeOpacity=".5" strokeWidth="1"/>}
 <path d="M32 49 42 46H58L68 49V75H32Z" fill={top}/><path d="M36 53V72M64 53V72" stroke="#ffffff30"/>
 {o.top===0&&<g stroke="none" fill="#f5d66c"><path d="M41 56H59V58H41Z"/><path d="M40 63H44V69H40ZM48 61H52V69H48ZM56 63H60V69H56Z"/></g>}
 {o.top===1&&<><path d="M42 49 50 55 58 49M40 66H60V71H40Z" fill="none"/><path d="M44 53V61M56 53V61" stroke="#e8d1ff"/></>}
 {[2,3,4,7,8,9].includes(o.top)&&<path d="M50 50V74M35 60H44V66H35M56 60H65V66H56" fill="none" stroke={o.top===7?'#c4c3cc':'#f0d5b0'} strokeWidth="1"/>}
 {o.top===5&&<path d="M33 56H67M33 63H67M33 70H67" stroke="#334e86" strokeWidth="3"/>}
 {o.top===6&&<path d="m39 60 5-5 6 5 6-5 5 5-5 5-6-5-6 5Z" fill="#ab6b48" stroke="none"/>}
 {o.pants===9&&<path d="M56 75V82H64V75" fill="none" stroke="#bcb5ce" strokeWidth="1"/>}
 <g className="arm arm-right"><path d="M30 50H38V62H29Z" fill={top}/><path d="M29 62H37V79H33V82H27V76H29Z" fill="#f2ac7c"/><path d="M30 66V76" stroke="#ffd1a0" strokeWidth="2"/></g>
 <g className="arm arm-left"><path d="M62 50H70L71 62H62Z" fill={top}/><path d="M63 62H71V76H73V82H67V79H63Z" fill="#f2ac7c"/><path d="M66 66V76" stroke="#ffd1a0" strokeWidth="2"/></g>
 {/* A square viewport clips exactly one atlas frame, without exposing adjacent frames in the side gutters. */}
 <g className="avatar-head"><svg x="21" y="-3" width="58" height="58" overflow="hidden" viewBox={`${expression%2*627} ${Math.floor(expression/2)*627} 627 627`}><image href="/assets/pixel-heads.png" width="1254" height="1254"/></svg>
 {state==='faint'&&<path d="m35 31 8 8m0-8-8 8m22-8 8 8m0-8-8 8" stroke="#32243e" strokeWidth="3"/>}
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
 </g>
 {o.accessory===2&&<path d="M39 47H61V54H54V67H47V54H39Z" fill={acc}/>}
 {o.accessory===3&&<path d="M39 51 43 61H57L61 51" fill="none" stroke={acc}/>}
 {o.accessory===5&&<path d="m39 49 11 4 11-4v10l-11-4-11 4Z" fill={acc}/>}
 {o.accessory===6&&<><path d="M35 49 64 71" stroke={acc} strokeWidth="4"/><path d="M56 65H70V78H56Z" fill={acc}/></>}
 {o.accessory===7&&<><path d="m41 49 9 12 9-12" fill="none" stroke="#ed5757"/><path d="m50 58 3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1Z" fill={acc}/></>}
 {o.accessory===8&&<path d="M63 73H72V77H63Z" fill={acc}/>}
 </g></svg>;
}
