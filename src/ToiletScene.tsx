import {useEffect} from 'react';
import type {ToiletVisit} from './activities';
import {playToiletSound} from './sound';
import {catalog,type Outfit} from './wardrobe';

export type ToiletPhase = 'approach' | 'open' | 'use';

export function ToiletScene({phase, visit, outfit}: {phase: ToiletPhase; visit: ToiletVisit; outfit: Outfit}) {
 useEffect(() => {
  if (phase !== 'use') return;
  return playToiletSound(visit);
 }, [phase, visit]);

 if (phase === 'approach') return null;
 const shirt = catalog.top[outfit.top].color;
 const pants = catalog.pants[outfit.pants].color;
 const shoes = catalog.shoes[outfit.shoes].color;
 return <svg className="toilet-scene-art" viewBox="0 0 320 480" preserveAspectRatio="none" aria-hidden="true">
  <g stroke="#4f344b" strokeWidth="1.5">
   <path d="M23 263Q27 255 51 254Q78 253 81 261Q81 272 52 274Q25 274 23 263Z" fill="#ffd8ca"/>
   <path d="M28 263Q32 258 51 258Q74 258 76 263Q73 270 51 270Q33 269 28 263Z" fill="#987690"/>
   <g className={phase === 'open' ? 'toilet-lid toilet-lid-opening' : 'toilet-lid'}>
    <path d="M25 258L25 234Q25 230 29 229L38 228Q43 229 43 234V258Z" fill="#f7c8bf"/>
    <path d="M28 252V235Q28 232 33 232H37" fill="none" stroke="#ffe8d7"/>
   </g>
  </g>
  {phase === 'use' && (visit === 'pee' ? <>
   <path className="toilet-stream" d="M67 279Q66 264 53 264" fill="none" stroke="#ffe065" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 2"/>
   <g stroke="#241a34" strokeWidth="2" strokeLinejoin="round">
    <path d="M63 282H82V306H75L72 296 71 306H62Z" fill={pants}/>
    <path d="M61 304H70V310H59ZM75 304H83L85 310H75Z" fill={shoes}/>
    <path d="M65 263L79 260 85 270 81 275 81 286H62V274L58 270Z" fill={shirt}/>
    <path d="M57 253L55 246 59 247 56 240 62 242 62 235 67 238 72 232 76 238 82 234 84 241 89 239 87 247 91 245 87 255 82 263 64 264Z" fill="#e6b7aa"/>
    <path d="M60 249L68 243 71 250 77 241 79 251 86 247M63 256L72 251 74 258 83 252" fill="none" stroke="#ffe1d1" strokeWidth="1.4"/>
   </g>
  </> : <>
   <path d="M43 257L65 255 74 266 65 279 43 275Z" fill={shirt} stroke="#241a34" strokeWidth="2"/>
   <path d="M48 269H65L71 286 68 297H60L58 281 55 295 47 295Z" fill="#eca978" stroke="#53334b" strokeWidth="1.6"/>
   <path d="M45 295L55 291 61 295 68 292 73 297 70 303H45Z" fill={pants} stroke="#241a34" strokeWidth="2"/>
   <svg x="35" y="222" width="42" height="42" viewBox="0 0 627 627" overflow="hidden">
    <image href="/assets/pixel-heads.png" width="1254" height="1254"/>
   </svg>
   <g className="toilet-mosaic" shapeRendering="crispEdges">
    {Array.from({length:24}, (_,i) => <rect key={i} x={41+i%6*5} y={267+Math.floor(i/6)*4}
     width="5" height="4" fill={['#846f00','#997e87','#c5ac9e','#51465f'][(i*5+Math.floor(i/6))%4]}/>)}
   </g>
  </>)}
 </svg>;
}
