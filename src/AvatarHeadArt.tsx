import {useId,type ReactNode,type SVGProps} from 'react';
import type {HairWetness} from './hair';

const portraitHair='M0 0H627V405H555L529 389H511L490 406L477 420V287L465 266L443 240L420 218L400 203L384 211L357 235L338 263L333 285L321 281L308 263L302 222L259 263H246L232 235L206 257L179 287L174 318V416L164 401L146 390L128 390L111 405H0Z';
const rangeHair=[
 'M0 0H724V483H629L607 469H589L557 492L549 524L550 406L543 379L529 340L503 302L473 264L448 272L416 295L389 340L378 350L365 333L356 280L337 289L303 334L290 335L279 294L253 314L222 349L211 387L214 521L198 491L168 467L150 470L124 488H0Z',
 'M0 0H724V482H625L602 468H581L556 490L547 522L551 411L546 382L533 343L511 312L477 283L462 279L439 293L419 312L399 339L383 372L369 380L355 365L347 319L324 332L301 372L285 379L272 363L263 328L235 350L214 382L215 426L213 521L196 490L162 467L141 470L120 481H0Z',
 'M0 0H724V481H624L603 468H584L556 489L545 522L550 409L543 383L530 345L507 313L473 283L454 279L429 295L407 316L386 348L376 374L365 380L349 366L341 318L318 335L299 370L283 379L271 365L260 328L228 351L211 382L212 423L209 522L194 492L161 468L138 472L121 481H0Z',
];
const profileHair='M190 60H751V356H682L663 317L646 283L620 273L596 292L583 329L567 322L543 302L520 333L515 370L500 384V452L485 446L448 411L421 415L402 430L390 460L393 486L415 508L445 519L465 513L456 538L433 566H190Z';
const dryShades=[1,.94,.86,.77,.67] as const;
export const rearHairColors=['#b8b8c2','#adafbc','#9da2b1','#8c94a7','#7d89a0'] as const;

function HairTint({path,wetness,children}:{path:string;wetness:HairWetness;children:ReactNode}){
 const clip=useId(),filter=useId();
 const gain=dryShades[wetness];
 return <>
  <defs>
   <clipPath id={clip}><path d={path}/></clipPath>
   <filter id={filter} colorInterpolationFilters="sRGB">
    <feColorMatrix values={`
     ${.20*gain} ${.63*gain} ${.11*gain} 0 .022
     ${.21*gain} ${.66*gain} ${.12*gain} 0 .030
     ${.22*gain} ${.68*gain} ${.13*gain} 0 ${.046+wetness*.011}
     0 0 0 1 0`}/>
   </filter>
  </defs>
  <g clipPath={`url(#${clip})`} pointerEvents="none">
   <g filter={`url(#${filter})`}>{children}</g>
  </g>
 </>;
}

type HeadProps=SVGProps<SVGSVGElement>&{expression?:number;range?:boolean;wetness?:HairWetness};
export function AvatarHeadArt({expression=0,range=false,wetness=0,...svg}:HeadProps){
 const size=range?724:627;
 const width=range?2172:1254,height=range?724:1254;
 const x=-(range?expression:expression%2)*size,y=range?0:-Math.floor(expression/2)*size;
 const href=range?'/assets/range-emotions.png':'/assets/pixel-heads.png';
 const sprite=<image href={href} x={x} y={y} width={width} height={height}/>;
 return <svg {...svg} viewBox={`0 0 ${size} ${size}`} overflow="hidden" data-hair-wetness={wetness}>
  {sprite}
  <HairTint path={range?rangeHair[expression]:portraitHair} wetness={wetness}>{sprite}</HairTint>
  {wetness>=2&&<g transform={`scale(${size/627})`} stroke="#d4f4ff" strokeOpacity={wetness>=3?.82:.63} strokeWidth="5" strokeLinecap="round" fill="none" pointerEvents="none">
   <path d="M259 108l26 10 18 2"/>
   {wetness>=3&&<path d="M454 114l-8-19-12-14"/>}
   {wetness===4&&<path d="M534 257l20 12 13 3"/>}
  </g>}
 </svg>;
}

export function ComputerHair({wetness}:{wetness:HairWetness}){
 return <HairTint path={profileHair} wetness={wetness}><image href="/assets/computer-profile.png" width="1148" height="1370"/></HairTint>;
}
