import {useEffect,useId} from 'react';
import {playToiletSound,prepareToiletPeeSound} from './sound';
import {catalog,type Outfit} from './wardrobe';
import type {HairWetness} from './hair';
import rearHead from './assets/toilet-rear-head.webp';

export type ToiletPhase='approach'|'open'|'use';

export function ToiletScene({phase,muted,active}:{phase:ToiletPhase;muted:boolean;active:boolean}){
 const rim=useId(),bowl=useId(),lid=useId();
 useEffect(()=>{
  if(!active||muted)return;
  if(phase==='use')return playToiletSound();
  prepareToiletPeeSound();
 },[active,phase,muted]);

 if(phase==='approach')return null;
 return <svg className="toilet-scene-art" viewBox="0 0 320 480" preserveAspectRatio="none" aria-hidden="true">
  <defs>
   <linearGradient id={rim} x2="0" y2="1">
    <stop stopColor="#fff5e3"/><stop offset="1" stopColor="#efb9c9"/>
   </linearGradient>
   <linearGradient id={bowl} x2="0" y2="1">
    <stop stopColor="#75425d"/><stop offset=".65" stopColor="#a4788f"/><stop offset="1" stopColor="#c296aa"/>
   </linearGradient>
   <linearGradient id={lid} x2="1" y2="1">
    <stop stopColor="#fff2db"/><stop offset="1" stopColor="#f3a9c2"/>
   </linearGradient>
  </defs>
  <g stroke="#4d3048" strokeLinejoin="round">
   {/* This rim follows the closed seat painted in the bathroom and covers that area. */}
   <path d="M18 261C20 256 32 246 46 246C59 245 75 245 80 251C83 254 82 260 81 263C76 271 40 275 22 268C19 267 18 265 18 261Z" fill={`url(#${rim})`} strokeWidth="1.5"/>
   <path d="M22 263C32 271 66 269 78 261" fill="none" stroke="#fff4e8" strokeWidth="1.3"/>
   <g className={phase==='open'?'toilet-lid toilet-lid-opening':'toilet-lid'}>
    <path d="M24 261C20 255 20 244 20 232C20 219 23 209 29 208C36 207 42 215 44 227C47 239 45 252 43 258Z" fill={`url(#${lid})`} strokeWidth="1.7"/>
    <path d="M24 255C22 242 22 218 28 213C34 209 38 216 40 225" fill="none" stroke="#fff1df" strokeWidth="1.6" strokeLinecap="round"/>
   </g>
   <path d="M21 261C25 254 39 248 57 248C70 248 80 251 81 255C82 262 66 266 50 267C36 268 24 265 21 261Z" fill={`url(#${rim})`} strokeWidth="1.3"/>
   <path d="M29 260C33 255 43 251 58 251C67 251 75 252 77 255C76 260 64 263 49 264C40 264 32 263 29 260Z" fill={`url(#${bowl})`} stroke="#80536a" strokeWidth=".9"/>
  </g>
  {phase==='use'&&<g>
   <path d="M48 244Q46 251 45 259" fill="none" stroke="#b48836" strokeWidth="2.8" strokeLinecap="round"/>
   <path className="toilet-stream" d="M48 244Q46 251 45 259" fill="none" stroke="#ffe372" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2"/>
   <path d="M43 260h5m-8 1h2" stroke="#ffe372" strokeWidth="1.1" strokeLinecap="round"/>
  </g>}
 </svg>;
}

export function ToiletRearAvatar({outfit,wetness}:{outfit:Outfit;wetness:HairWetness}){
 const shirt=catalog.top[outfit.top].color,pants=catalog.pants[outfit.pants].color,shoes=catalog.shoes[outfit.shoes].color;
 return <svg className="pixel-avatar toilet-rear-avatar" viewBox="0 0 100 104" aria-hidden="true">
  <g stroke="#261b34" strokeWidth="2.3" strokeLinejoin="round">
   <path d="M31 91H48V101H27V96ZM52 91H69L73 96V101H52Z" fill={shoes}/>
   <path d="M28 99H47M53 99H72" stroke="#fff0df" strokeWidth="1.65"/>
   <path d="M34 68H66L68 83L71 91L69 96H52L50 89L48 96H30L29 91L32 83Z" fill={pants}/>
   <path d="M34 86Q41 91 47 87M54 87Q61 91 67 86M40 95H46M54 95H60" fill="none" stroke="#241a32" strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round"/>
   <path d="M32 58L36 68L32 81L28 75L27 64ZM68 58L64 68L68 81L72 75L73 64Z" fill="#f3aa79"/>
   <path d="M40 46H60L69 51L74 62L66 66L67 76Q50 81 33 76L34 66L26 62L31 51Z" fill={shirt}/>
   <path d="M31 62L35 64M69 62L65 64M39 71Q48 76 60 72M47 70Q55 72 61 69" fill="none" strokeOpacity=".65" strokeWidth="1.6" strokeLinecap="round"/>
   <path d="M43 47Q50 53 57 47" fill="none" strokeWidth="1.7"/>
  </g>
  <image href={rearHead} x="20" y="-2" width="60" height="55" style={{filter:wetness?`brightness(${1-wetness*.07})`:undefined}}/>
 </svg>;
}
