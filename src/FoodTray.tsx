import {useEffect, useRef, useState, type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {FOOD, type FoodId} from './balance';
import {foodReason, type Game} from './game';

type Drag = { id: FoodId; x: number; y: number; overMouth: boolean};

function touchesMouth(button: HTMLButtonElement, x: number, y: number) {
 const mouth = button.closest('.photo-room')?.querySelector('.feed-mouth-target');
 const bounds = mouth?.getBoundingClientRect();
 return Boolean(bounds && Math.hypot(
  (x - bounds.left - bounds.width / 2) / (bounds.width / 2),
  (y - bounds.top - bounds.height / 2) / (bounds.height / 2),
 ) <= 1);
}

function FoodPicture({id}: {id: FoodId}) {
 return <span className="food-picture" aria-hidden="true">
  {id === 'free' ? '🥪' : <img className={`dish-art-${id}`} src={`/assets/food/${id}.jpg`} alt="" draggable={false}/>}
 </span>;
}

export function FoodTray({game, onFeed}: {game: Game; onFeed: (id: FoodId) => void}) {
 const [drag, setDrag] = useState<Drag | null>(null);
 const [page, setPage] = useState(0);
 const pointer = useRef<number | null>(null);
 const tray = useRef<HTMLDivElement>(null);
 const foods = FOOD.filter(item => game.tutorial === 0 ? item.id === 'free'
  : game.tutorial === 2 ? item.id === 'noodles'
  : item.id !== 'free' || game.economy.balance < FOOD[0].price);
 const pageCount = Math.ceil(foods.length / 3);
 const visiblePage = Math.min(page, pageCount - 1);

 useEffect(() => {
  tray.current?.closest('.photo-room')?.querySelector('.actor-position')?.scrollIntoView({block: 'nearest'});
  tray.current?.scrollIntoView({block: 'nearest'});
 }, []);

 function finish(event: PointerEvent<HTMLButtonElement>, id: FoodId) {
  if (pointer.current !== event.pointerId) return;
  pointer.current = null;
  setDrag(null);
  if (event.type === 'pointerup' && touchesMouth(event.currentTarget, event.clientX, event.clientY)) onFeed(id);
 }

 const draggedItem = drag && FOOD.find(item => item.id === drag.id);
 return <div ref={tray} className="scene-food" role="group" aria-label="Выбор еды. Перетащи еду к рту Петрашки">
  {pageCount > 1 && <button type="button" className="food-arrow" aria-label="Предыдущие блюда"
   disabled={visiblePage===0 || !!drag} onClick={()=>setPage(visiblePage-1)}>‹</button>}
  <div className="scene-food-viewport">
   <div className="scene-food-track" style={{transform: `translateX(-${visiblePage * 100}%)`}}>
   {Array.from({length:pageCount}, (_, index)=>
    <div key={index} className="scene-food-grid" inert={index!==visiblePage} aria-hidden={index!==visiblePage}>
    {foods.slice(index*3,index*3+3).map(item => {
    const reason = foodReason(game, item.id);
    const price = item.id === 'free' ? '0 ₽' : `${game.tutorial === 2 ? 100 : item.price} ₽`;
    const effects = [`+${item.food} сытости`, item.mood && `+${item.mood} настроения`,
     item.health && `+${item.health} здоровья`].filter(Boolean).join(', ');
    return <button key={item.id} type="button" aria-label={`${item.name}, ${price}, ${effects}`}
     title={reason || `${item.name}. ${item.description}`} disabled={Boolean(reason)}
     onPointerDown={event => {
      if (event.button !== 0 || pointer.current !== null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current = event.pointerId;
      setDrag({id: item.id, x: event.clientX, y: event.clientY, overMouth: false});
     }}
     onPointerMove={event => {
      if (pointer.current !== event.pointerId) return;
      setDrag({id: item.id, x: event.clientX, y: event.clientY,
       overMouth: touchesMouth(event.currentTarget, event.clientX, event.clientY)});
     }}
     onPointerUp={event => finish(event, item.id)}
     onPointerCancel={event => finish(event, item.id)}
     onLostPointerCapture={event => finish(event, item.id)}>
     <FoodPicture id={item.id}/>
     <strong>{price}</strong>
     <small>+{item.food} 🍽{item.mood > 0 && ` · +${item.mood} ☺`}{item.health > 0 && ` · +${item.health} ♥`}</small>
    </button>;
   })}
   </div>)}
   </div>
  </div>
  {pageCount > 1 && <button type="button" className="food-arrow" aria-label="Следующие блюда"
   disabled={visiblePage===pageCount-1 || !!drag} onClick={()=>setPage(visiblePage+1)}>›</button>}
  {drag && draggedItem && createPortal(
   <span className={`food-drag${drag.overMouth ? ' food-drag-ready' : ''}`}
    aria-hidden="true" style={{left: drag.x, top: drag.y}}><FoodPicture id={draggedItem.id}/></span>, document.body,
  )}
 </div>;
}
