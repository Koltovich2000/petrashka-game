import {useId} from 'react';
import {PixelAvatar} from './PixelAvatar';
import type {Outfit} from './wardrobe';
import type {HairWetness} from './hair';

export function SleepScene({outfit,wetness}:{outfit:Outfit;wetness:HairWetness}){
 const duvet=useId();
 return <svg className="sleep-scene-art" viewBox="0 0 640 585" preserveAspectRatio="none" role="img" aria-label="Петрашка спит под одеялом">
  <defs>
   <clipPath id={duvet}><path d="M0 330L19 314L85 287L163 288Q176 290 178 301V333L171 350L140 379H0Z"/></clipPath>
  </defs>
  <g transform="rotate(-25 48 282)">
   <svg className="sleep-head" x="9" y="242" width="82" height="82" overflow="visible">
    <PixelAvatar outfit={outfit} wetness={wetness} state="sleep" viewBox="21 -3 58 58"/>
   </svg>
  </g>
  <g clipPath={`url(#${duvet})`}>
   <image className="sleep-blanket" href="/assets/bedroom-navy.png" width="640" height="585" preserveAspectRatio="none"/>
  </g>
  <g className="sleep-cloud" transform="translate(60 174)" aria-hidden="true">
   <path d="M9 16H15V10H25V5H42V9H51V14H57V23H62V35H57V42H50V47H39V51H24V47H14V42H7V35H3V25H9Z M6 51H12V57H6Z M0 61H4V65H0Z"
    fill="#f4eaff" stroke="#302345" strokeWidth="2"/>
   <text x="20" y="36" fill="#31274d" fontFamily="system-ui" fontSize="21" fontWeight="900">z<tspan dy="-8">Z</tspan></text>
  </g>
 </svg>;
}
