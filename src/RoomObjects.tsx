import {TUTORIAL} from './balance';
import {RoomObjectOutline,objectBounds,type RoomObject} from './RoomObjectOutline';
import {useRef,useState,type PointerEvent,type CSSProperties} from 'react';
import {FurnitureArt} from './FurnitureArt';
import {activityReason,furnitureCatalog,placement,type ActivityKind,type FurnitureId,type Location} from './activities';
import {blocked,type Game} from './game';
interface Props{game:Game;location:Location;onActivity:(a:ActivityKind)=>void;onSleep:()=>void;onWake:()=>void;onMove:(id:FurnitureId,x:number,y:number)=>void;onDoor:()=>void;doorDisabled:boolean;holdingDumbbells:boolean}
type Point={x:number;y:number};
type DragOrigin={id:FurnitureId;point:Point;clientX:number;clientY:number;width:number;height:number};
export function RoomObjects({game,location,onActivity,onSleep,onWake,onMove,onDoor,doorDisabled,holdingDumbbells}:Props){
 const [arrange,setArrange]=useState(false),[drag,setDrag]=useState<(Point&{id:FurnitureId})|null>(null);
 const origin=useRef<DragOrigin|null>(null);
 const busy=Boolean(game.roomAction||game.restUntil!==null||game.sleepUntil!==null);
 const arranging=arrange&&!busy&&game.health>0;
 function clearDrag(){origin.current=null;setDrag(null);}
 function dragPosition(event:PointerEvent<HTMLButtonElement>){
  const start=origin.current;
  if(!arranging||!start||!event.currentTarget.hasPointerCapture(event.pointerId))return null;
  const x=start.point.x+(event.clientX-start.clientX)/start.width;
  const y=start.point.y+(event.clientY-start.clientY)/start.height;
  return {id:start.id,...placement(start.id,x,y)};
 }
 const fixed:Partial<Record<Location,{id:ActivityKind;name:string;className:Exclude<RoomObject,'bed'|'door'>}[]>>={room:[{id:'computer',name:'Компьютер',className:'computer'}],bathroom:[{id:'bath',name:'Ванна',className:'bath'},{id:'toilet',name:'Унитаз',className:'toilet'}]};
 return <>
 {location==='room'&&<button className="room-object object-bed" style={objectBounds('bed')} aria-label={game.sleepUntil!==null ? 'Разбудить' : 'Кровать'} title={game.sleepUntil!==null?'Разбудить':blocked(game,'sleep')||'Уложить спать'} disabled={game.sleepUntil===null&&Boolean(blocked(game,'sleep'))} onClick={game.sleepUntil!==null?onWake:onSleep}><RoomObjectOutline object="bed"/></button>}
 {location==='hallway'&&<button type="button" className="room-object object-door" style={objectBounds('door')} aria-label="Дверь в комнату" title="Войти в комнату" disabled={busy||doorDisabled||game.health===0} onClick={onDoor}><RoomObjectOutline object="door"/></button>}
 {fixed[location]?.map(o=><button key={o.id} className={'room-object object-'+o.className} style={objectBounds(o.className)} aria-label={o.name} title={activityReason(game,o.id)||o.name} disabled={busy||game.health===0||(game.tutorial<TUTORIAL.done&&!(game.tutorial===TUTORIAL.bath&&o.id==='bath'))} onClick={()=>onActivity(o.id)}><RoomObjectOutline object={o.className}/></button>)}
 {furnitureCatalog.filter(i=>i.location===location&&game.furniture[i.id]&&
  !(i.id==='yoga'&&game.roomAction?.kind==='yoga')&&!(i.id==='dumbbells'&&holdingDumbbells)).map(item=>{
  const saved=game.furniture[item.id]!;
  const point=drag?.id===item.id?drag:saved;
  const decor='art' in item;
  const style:CSSProperties={left:point.x*100+'%',top:point.y*100+'%',width:decor?item.width+'%':undefined};
  const art=<FurnitureArt kind={item.id}/>;
  if(decor&&!arranging)return <div key={item.id} className="apartment-decor" style={style} data-decor={item.id} data-dog-obstacle={item.floor||undefined} aria-hidden="true">{art}</div>;
  return <button key={item.id} type="button" className={(decor?'apartment-decor':'placed-furniture')+(arranging?' arranging':'')}
   data-decor={decor?item.id:undefined} data-dog-obstacle={decor&&item.floor||undefined} data-furniture={decor?undefined:item.id}
   aria-label={item.name} disabled={busy||game.health===0} style={style}
   title={arranging?'Перетащите предмет':decor?item.name:activityReason(game,item.id)||item.name}
   onClick={()=>{if(!arranging&&!decor)onActivity(item.id);}}
   onPointerDown={event=>{
    if(!arranging||origin.current)return;
    const room=event.currentTarget.closest('.photo-room')!.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current={id:item.id,point:saved,clientX:event.clientX,clientY:event.clientY,width:room.width,height:room.height};
   }}
   onPointerMove={event=>{const next=dragPosition(event);if(next)setDrag(next);}}
   onPointerUp={event=>{
    const next=dragPosition(event);
    if(next&&(next.x!==saved.x||next.y!==saved.y))onMove(next.id,next.x,next.y);
    clearDrag();
   }}
   onLostPointerCapture={clearDrag}>
   {art}
  </button>;
 })}
 {furnitureCatalog.some(i=>i.location===location&&game.furniture[i.id])&&<button type="button" className="arrange-toggle" disabled={busy||game.health===0} aria-pressed={arranging} onClick={()=>{setArrange(!arrange);clearDrag();}}>{arrange?'✓ Готово':'✥ Обустроить'}</button>}
 </>;
}
