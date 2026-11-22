import {useRef, useState, type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {FOOD,TUTORIAL, type FoodId} from './balance';
import {foodReason, type Game} from './game';

type Drag = {id: FoodId; x: number; y: number};
const dishesPerPage=2;

function touchesMouth(button: HTMLButtonElement, x: number, y: number) {
 const mouth = button.closest('.photo-room')?.querySelector('.feed-mouth-target');
 const bounds = mouth?.getBoundingClientRect();
 return Boolean(bounds && Math.hypot(
  (x - bounds.left - bounds.width / 2) / (bounds.width / 2),
  (y - bounds.top - bounds.height / 2) / (bounds.height / 2),
 ) <= 1);
}

export function FoodPicture({id}: {id: FoodId}) {
 return <span className="food-picture" aria-hidden="true">
  {id === 'free' ? '🥪' : <img className={`dish-art-${id}`} src={`/assets/food/${id}.jpg`} alt="" draggable={false}/>}
 </span>;
}

export function FoodTray({game, onFeed}: {game: Game; onFeed: (id: FoodId) => void}) {
 const [drag, setDrag] = useState<Drag | null>(null);
 const [page, setPage] = useState(0);
 const pointer = useRef<number | null>(null);
 const foods = FOOD.filter(item => game.tutorial === 0 ? item.id === 'free'
  : game.tutorial === TUTORIAL.noodles ? item.id === 'noodles'
  : item.id !== 'free' || game.economy.balance < FOOD[0].price);
 const pageCount = Math.ceil(foods.length / dishesPerPage);
 const visiblePage = Math.min(page, pageCount - 1);

 function finish(event: PointerEvent<HTMLButtonElement>, id: FoodId) {
  if (pointer.current !== event.pointerId) return;
  pointer.current = null;
  setDrag(null);
  if (event.type === 'pointerup' && touchesMouth(event.currentTarget, event.clientX, event.clientY)) onFeed(id);
 }

 const draggedItem = drag && FOOD.find(item => item.id === drag.id);
 return <div className="scene-food scene-feeding" role="group" aria-label="Выбор еды. Перетащи еду к рту Петрашки">
  <div className="scene-food-grid">
   {foods.slice(visiblePage*dishesPerPage,(visiblePage+1)*dishesPerPage).map(item => {
    const reason = foodReason(game, item.id);
    const price = item.id === 'free' ? '0 ₽' : `${game.tutorial === TUTORIAL.noodles ? TUTORIAL.noodlePrice : item.price} ₽`;
    const effects = [`+${item.food} сытости`, item.mood && `+${item.mood} настроения`,
     item.health && `+${item.health} здоровья`].filter(Boolean).join(', ');
    return <button key={item.id} type="button" aria-label={`${item.name}, ${price}, ${effects}`}
     title={reason || `${item.name}. ${item.description}`} disabled={Boolean(reason)}
     onClick={event => {if(event.detail===0)onFeed(item.id);}}
     onPointerDown={event => {
      if (event.button !== 0 || pointer.current !== null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current = event.pointerId;
      setDrag({id: item.id, x: event.clientX, y: event.clientY});
     }}
     onPointerMove={event => {
      if (pointer.current !== event.pointerId) return;
      if (touchesMouth(event.currentTarget,event.clientX,event.clientY)) {
       pointer.current=null;
       setDrag(null);
       onFeed(item.id);
       return;
      }
      setDrag({id: item.id, x: event.clientX, y: event.clientY});
     }}
     onPointerUp={event => finish(event, item.id)}
     onPointerCancel={event => finish(event, item.id)}
     onLostPointerCapture={event => finish(event, item.id)}>
     <FoodPicture id={item.id}/>
     <strong>{price}</strong>
     <small>+{item.food} 🍽{item.mood > 0 && ` · +${item.mood} ☺`}{item.health > 0 && ` · +${item.health} ♥`}</small>
    </button>;
   })}
  </div>
  {pageCount>1&&<div className="food-pages">
   <button type="button" className="food-arrow" aria-label="Предыдущие блюда"
    disabled={visiblePage===0||!!drag} onClick={()=>setPage(visiblePage-1)}>‹</button>
   <button type="button" className="food-arrow" aria-label="Следующие блюда"
    disabled={visiblePage===pageCount-1||!!drag} onClick={()=>setPage(visiblePage+1)}>›</button>
  </div>}
  {drag && draggedItem && createPortal(
   <span className="food-drag"
    aria-hidden="true" style={{left: drag.x, top: drag.y}}><FoodPicture id={draggedItem.id}/></span>, document.body,
  )}
 </div>;
}
