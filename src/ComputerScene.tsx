import {useRef,type CSSProperties} from 'react';
import {ComputerHair} from './AvatarHeadArt';
import type {HairWetness} from './hair';

export function ComputerScene({elapsed=0,wetness}:{elapsed?:number;wetness:HairWetness}){
 const start=useRef(elapsed%60_000);
 return <svg className="computer-scene" viewBox="0 0 640 585" preserveAspectRatio="none" aria-hidden="true">
  <defs>
   <clipPath id="computer-display"><path d="M536 217 606 219 597 273 530 270Z"/></clipPath>
   <clipPath id="computer-body"><path d="M0 0H1148V1370H0Z M530 657 650 638 730 628 780 650 875 658 905 706 879 743 748 762 654 800 571 809 496 772 498 720Z" clipRule="evenodd"/></clipPath>
   <clipPath id="computer-hands"><path d="M530 657 650 638 730 628 780 650 875 658 905 706 879 743 748 762 654 800 571 809 496 772 498 720Z"/></clipPath>
   <clipPath id="computer-chair"><path d="M451 267Q448 260 460 260L480 264Q492 267 496 286L505 334 512 340 531 339 548 342 553 349 549 355 531 361 518 365 519 397 548 407 552 413 544 417 519 410 528 419 528 428 520 431 513 427 509 415 481 420 472 424 465 424 464 415 475 403 488 397 490 359 476 356 464 345Z"/></clipPath>
  </defs>
  <g clipPath="url(#computer-display)" className="zombie-game" style={{'--game-delay':`${-start.current/1000}s`} as CSSProperties}>
   <path fill="#10152a" d="M525 212H610V278H525Z"/>
   <path d="M529 246h8v-13h7v6h5v-18h11v15h6v-8h9v13h7v-16h11v12h9v9Z" fill="#33304b"/>
   <path d="M529 263h76v15h-76Z" fill="#343a3a"/>
   <path d="M532 267h66" stroke="#747256" strokeWidth=".7"/>
   <g className="zombie-survivor">
    <path d="M541 249h4v4h-4" fill="#ffd1a1"/><path d="M539 253h7v7h-7" fill="#7da7f9"/>
    <path d="M541 260v4m3-4v4" stroke="#c9d3ed"/>
    <path d="M545 254h6" stroke="#b8c0c5" strokeWidth="2"/>
   </g>
   <g className="zombie-muzzle"><path d="m551 252 3 1-1-2 3 3-2 1 1 2-4-2" fill="#ffe37b"/></g>
   <g className="zombie-bullet"><path d="M551 254h3" stroke="#ffeebe"/></g>
   {[0,1,2].map(i=><g key={i} className="zombie-walk" style={{'--wave':`${i*2}s`} as CSSProperties}>
    <g className="zombie-hit">
     <path d="M591 249h5v5h-5" fill="#8fc96b"/><path d="M591 251h1" fill="#152319"/>
     <path d="M590 254h6v7h-6" fill={i===1?'#a96c7c':'#69846c'}/>
     <path d="M590 255h-4" stroke="#a0cb75" strokeWidth="1.6"/>
     <g className="zombie-legs"><path d="M591 261v3m4-3v3" stroke="#a5b38b" strokeWidth="1.4"/></g>
    </g>
   </g>)}
   <g className="zombie-pixels" fill="#b8e68a"><path d="M564 251h2v2h-2M568 255h2v2h-2M563 259h2v2h-2"/></g>
   <path d="M537 222h13" stroke="#67d66d" strokeWidth="2"/>
   <text x="578" y="224" fill="#fff0ba" fontSize="3">{Math.floor(elapsed/1000)%60}</text>
  </g>
  <svg x="395" y="146" width="244" height="291" viewBox="0 0 1148 1370">
   <image href="/assets/computer-profile.webp" width="1148" height="1370" clipPath="url(#computer-body)"/>
   <ComputerHair wetness={wetness}/>
   <g transform="translate(106 0) scale(.8 1)"><g className="computer-typing"><image href="/assets/computer-profile.webp" width="1148" height="1370" clipPath="url(#computer-hands)"/></g></g>
  </svg>
  <image href="/assets/bedroom-navy.webp" width="640" height="585" preserveAspectRatio="none" clipPath="url(#computer-chair)"/>
 </svg>;
}
