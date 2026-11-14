import {RoomObjectOutline,objectBounds,type RoomObject} from './RoomObjectOutline';
import {useState,type PointerEvent,type CSSProperties} from 'react';
import {FurnitureArt} from './FurnitureArt';
import {activityReason,furnitureCatalog,placement,type ActivityKind,type FurnitureId,type Location} from './activities';
import {blocked,type Game} from './game';
interface Props{game:Game;location:Location;onActivity:(a:ActivityKind)=>void;onSleep:()=>void;onWake:()=>void;onMove:(id:FurnitureId,x:number,y:number)=>void}
export function RoomObjects({game,location,onActivity,onSleep,onWake,onMove}:Props){
 const [arrange,setArrange]=useState(false),[drag,setDrag]=useState<{id:FurnitureId;x:number;y:number}|null>(null);
 const busy=Boolean(game.study||game.roomAction||game.economy.shift||game.restUntil!==null||game.sleepUntil!==null);
 function move(e:PointerEvent<HTMLButtonElement>,id:FurnitureId){if(!arrange||!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=e.currentTarget.closest('.photo-room')!.getBoundingClientRect();setDrag({id,...placement(id,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)});}
 const fixed:Partial<Record<Location,{id:ActivityKind;name:string;className:Exclude<RoomObject,'bed'>}[]>>={room:[{id:'computer',name:'Компьютер',className:'computer'}],bathroom:[{id:'bath',name:'Ванна',className:'bath'},{id:'toilet',name:'Унитаз',className:'toilet'}]};
 return <>
 {location==='room'&&<button className="room-object object-bed" style={objectBounds('bed')} aria-label={game.sleepUntil!==null ? 'Разбудить' : 'Кровать'} title={game.sleepUntil!==null?'Разбудить':blocked(game,'sleep')||'Уложить спать'} disabled={game.sleepUntil===null&&Boolean(blocked(game,'sleep'))} onClick={game.sleepUntil!==null?onWake:onSleep}><RoomObjectOutline object="bed"/></button>}
 {fixed[location]?.map(o=><button key={o.id} className={'room-object object-'+o.className} style={objectBounds(o.className)} aria-label={o.name} title={activityReason(game,o.id)||o.name} disabled={busy||game.health===0||(game.tutorial<5&&!(game.tutorial===3&&o.id==='bath'))} onClick={()=>onActivity(o.id)}><RoomObjectOutline object={o.className}/></button>)}
 {furnitureCatalog.filter(i=>i.location===location&&game.furniture[i.id]).map(item=>{
  const point=drag?.id===item.id?drag:game.furniture[item.id]!;
  return <button key={item.id} className={'placed-furniture '+(arrange?'arranging':'')} aria-label={item.name} disabled={busy||game.health===0} title={arrange?'Перетащите предмет по свободному полу':activityReason(game,item.id)||item.name} style={{left:point.x*100+'%',top:point.y*100+'%'} as CSSProperties} onClick={()=>{if(!arrange)onActivity(item.id);}}
   onPointerDown={e=>{if(arrange){e.currentTarget.setPointerCapture(e.pointerId);setDrag({id:item.id,...point});}}} onPointerMove={e=>move(e,item.id)} onPointerUp={e=>{if(arrange&&drag){onMove(item.id,drag.x,drag.y);setDrag(null);}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>setDrag(null)}>
   <FurnitureArt kind={item.id}/>
  </button>;
 })}
 {furnitureCatalog.some(i=>i.location===location&&game.furniture[i.id])&&<button className="arrange-toggle" disabled={busy} aria-pressed={arrange} onClick={()=>{setArrange(!arrange);setDrag(null);}}>{arrange?'✓ Готово':'✥ Обустроить'}</button>}
 </>;
}
