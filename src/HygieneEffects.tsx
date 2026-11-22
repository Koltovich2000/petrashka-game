import type {CSSProperties} from 'react';
export function PixelPoop(){return <svg viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true"><path d="M11 2h3v4h3v4h3v4h2v6H2v-6h3v-4h3V6h3Z" fill="#382335"/><path d="M11 5h3v4h3v4h3v5H4v-3h3v-4h4Z" fill="#8e5539"/><path d="M8 13h8v2H8zm4-5h3v2h-3" fill="#bc8053"/><path d="M7 16h2v2H7zm8 0h2v2h-2" fill="#251b2a"/></svg>;}
export function HygieneEffects({hygiene}:{hygiene:number}){
 return <div className="hygiene-effects" aria-hidden="true">
  {hygiene<=50&&<div className="wet-drips"><i/><i/><i/></div>}
  {hygiene<=20&&<div className="stink-cloud">{[0,1,2].map(i=><svg key={i} viewBox="0 0 20 70" style={{'--delay':`${i*.6}s`} as CSSProperties}><path d="M10 65V50H4V35H15V20H8V5" fill="none" stroke="#a7bf55" strokeWidth="4"/></svg>)}</div>}
  {hygiene<=10&&<div className="flying-mess">{[0,1,2,3].map(i=><span key={i} style={{'--delay':`${i*-.8}s`,'--orbit':`${i*90}deg`} as CSSProperties}><PixelPoop/></span>)}</div>}
 </div>;
}

export function PixelPuddle(){
 return <svg viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">
  <path d="M7 11h10v2h4v2h2v3h-4v2H5v-2H1v-3h3v-2h3Z" fill="#6c3e30"/>
  <path d="M7 13h10v2h4v2h-4v1H7v-1H3v-2h4Z" fill="#e1ae4d"/>
  <path d="M7 15h7v1H7Zm9 1h2v1h-2Z" fill="#fff497"/>
 </svg>;
}
