import {useEffect,useRef,useState} from 'react';
import {GameIcon} from './GameIcon';
import {giftPaymentAvailable,giftPaymentRequest,onTelegramLifecycle,openGiftInvoice} from './telegram';
import {maxGiftWishLength} from './giftWish';
import './gifts.css';

type GiftItem = {id:string; name:string; icon:string; price:number; currency:'XTR'};
type Gift = GiftItem & {sender:string; receivedAt:number; wish?:string; priceRank?:number|null};
type GiftPage = {gifts:Gift[]; page:number; pages:number; total:number};
type Catalog = {catalog:GiftItem[]; paymentsEnabled:boolean};
type Modal = {kind:'details'; gift:Gift} | {kind:'catalog'} | {kind:'confirm'; gift:GiftItem};
const numbers = new Intl.NumberFormat('ru-RU');
const dates = new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short'});
const pageSize = 15;

function Stars({price}:{price:number}) {
 return <span className="gifts-stars" aria-label={numbers.format(price) + ' Telegram Stars'}>
  <span aria-hidden="true">★</span> {numbers.format(price)}
 </span>;
}

export function GiftsScreen({active}:{active:boolean}) {
 const [page,setPage] = useState(1);
 const [wall,setWall] = useState<GiftPage|null>(null);
 const [wallError,setWallError] = useState(false);
 const [refresh,setRefresh] = useState(0);
 const [modal,setModal] = useState<Modal|null>(null);
 const [catalog,setCatalog] = useState<Catalog|null>(null);
 const [catalogError,setCatalogError] = useState(false);
 const [anonymous,setAnonymous] = useState(false);
 const [wish,setWish] = useState('');
 const [paying,setPaying] = useState(false);
 const paymentInProgress = useRef(false);
 const [notice,setNotice] = useState('');
 const dialog = useRef<HTMLDialogElement>(null);
 const catalogRequest = useRef<AbortController|null>(null);

 useEffect(() => {
  if (!active) return;
  let request:AbortController|undefined;
  async function load() {
   if (document.hidden || request) return;
   const controller = new AbortController();
   request = controller;
   const timeout = window.setTimeout(() => controller.abort(),10_000);
   try {
    const response = await fetch('/api/gifts?page=' + page,{signal:controller.signal});
    if (!response.ok) throw new Error();
    const next:GiftPage = await response.json();
    if (controller.signal.aborted) return;
    setWall(next);
    setWallError(false);
    if (next.page !== page) setPage(next.page);
   } catch {
    if (!controller.signal.aborted) setWallError(true);
   } finally {
    if (controller.signal.aborted && request === controller) setWallError(true);
    window.clearTimeout(timeout);
    if (request === controller) request = undefined;
   }
  }
  const visibilityChanged = () => {if (!document.hidden) void load();};
  void load();
  const interval = window.setInterval(load,5000);
  document.addEventListener('visibilitychange',visibilityChanged);
  const unsubscribe = onTelegramLifecycle(visibilityChanged,() => {});
  return () => {
   const controller = request;
   request = undefined;
   controller?.abort();
   window.clearInterval(interval);
   document.removeEventListener('visibilitychange',visibilityChanged);
   unsubscribe?.();
  };
 },[active,page,refresh]);

 useEffect(() => {
  const element = dialog.current;
  if (active && modal && element && !element.open) element.showModal();
  if ((!active || !modal) && element?.open) element.close();
 },[active,modal]);

 useEffect(() => {
  if (active) return;
  setModal(null);
  catalogRequest.current?.abort();
 },[active]);

 async function openCatalog() {
  setModal({kind:'catalog'});
  setAnonymous(false);
  setWish('');
  setNotice('');
  setCatalogError(false);
  catalogRequest.current?.abort();
  const controller = new AbortController();
  catalogRequest.current = controller;
  const timeout = window.setTimeout(() => controller.abort(),10_000);
  try {
   const response = await fetch('/api/gifts/catalog',{signal:controller.signal});
   if (!response.ok) throw new Error();
   const next:Catalog = await response.json();
   if (!controller.signal.aborted) setCatalog(next);
  } catch {
   if (catalogRequest.current === controller) setCatalogError(true);
  } finally {
   window.clearTimeout(timeout);
  }
 }

 async function pay(gift:GiftItem) {
  if (paymentInProgress.current || !catalog?.paymentsEnabled || !giftPaymentAvailable()) return;
  paymentInProgress.current = true;
  setPaying(true);
  setNotice('');
  try {
   const {id,url} = await giftPaymentRequest<{id:string;url:string}>('/api/gifts/invoice',{giftId:gift.id,anonymous,wish:wish.trim()});
   const status = await openGiftInvoice(url);
   if (status === 'cancelled' || status === 'failed') {
    setNotice(status === 'cancelled' ? 'Оплата отменена.' : 'Оплата не прошла. Попробуйте ещё раз.');
    return;
   }
   setModal(null);
   setNotice('Ждём подтверждение платежа от Telegram…');
   for (let attempt = 0; attempt < 8; attempt++) {
    const payment = await giftPaymentRequest<{status:string}>('/api/gifts/status',{id});
    if (payment.status === 'paid' || payment.status === 'refunded') {
     setNotice(payment.status === 'paid' ? 'Подарок появился на стенде.' : 'Платёж возвращён.');
     setRefresh(value => value + 1);
     return;
    }
    if (attempt < 7) await new Promise<void>(done => window.setTimeout(done,1500));
   }
   setNotice('Подарок появится автоматически после подтверждения платежа.');
  } catch (error) {
   setNotice(error instanceof Error ? error.message : 'Не удалось открыть оплату.');
  } finally {
   setPaying(false);
   paymentInProgress.current = false;
  }
 }

 const unavailable = !giftPaymentAvailable() ? 'Подарки можно отправлять в приложении Telegram.'
  : !catalog?.paymentsEnabled ? 'Оплата пока недоступна.' : '';
 const changingPage = Boolean(wall && wall.page !== page);
 return <section className="gifts-screen" aria-labelledby="gifts-title">
  <div className="gifts-header">
   <h1 id="gifts-title"><GameIcon name="gifts"/>Подарки</h1>
   <button type="button" className="gold-button gifts-send" onClick={openCatalog} disabled={paying}><GameIcon name="gifts"/>Подарить</button>
  </div>
  {!modal && notice && <p className="gifts-notice" role="status">{notice}</p>}
  {wallError && <p className="gifts-notice" role="status">Стенд временно недоступен. <button type="button" onClick={() => setRefresh(value => value + 1)}>Обновить</button></p>}
  <div className="gifts-wall" aria-label="Общий стенд подарков" aria-busy={(!wall || changingPage) && !wallError}>
   <div className="gifts-shelves">
    {Array.from({length:pageSize},(_,index) => {
     const gift = wall?.gifts[index];
     const place = gift?.priceRank===undefined&&(wall?.page??1)===1 ? index+1 : gift?.priceRank;
     const rank = place ? ['gold','silver','bronze'][place-1] : undefined;
     return <div className="gifts-slot" key={gift?.id ?? 'empty-' + index}>
      {gift && <button type="button" className="gifts-tile" data-rank={rank} onClick={() => setModal({kind:'details',gift})}>
       <GameIcon name={gift.icon}/>
       <span className="gifts-plaque">
        <strong>{gift.name}</strong>
        <span className="gifts-sender" dir="auto">{gift.sender}</span>
        <Stars price={gift.price}/>
       </span>
      </button>}
     </div>;
    })}
   </div>
   {wall?.total === 0 && <p className="gifts-empty">Здесь появятся подарки от зрителей</p>}
   {!wall && !wallError && <p className="gifts-empty" role="status">Загружаем стенд…</p>}
  </div>
  <nav className="gifts-pages" aria-label="Страницы подарков">
   <button type="button" aria-label="Предыдущая страница" disabled={!wall || changingPage || page <= 1} onClick={() => setPage(page - 1)}>←</button>
   <span aria-live="polite">{wall?.page ?? 1} / {wall?.pages ?? 1}</span>
   <button type="button" aria-label="Следующая страница" disabled={!wall || changingPage || page >= wall.pages} onClick={() => setPage(page + 1)}>→</button>
  </nav>
  <dialog ref={dialog} className="gifts-dialog" aria-labelledby="gift-dialog-title"
   onClose={() => {if (!dialog.current?.open) setModal(null);}}
   onCancel={event => {if (paying) event.preventDefault();}}
   onClick={event => {if (event.target === dialog.current && !paying) setModal(null);}}>
   {modal && <div className="gifts-dialog-content">
    <button type="button" className="gifts-dialog-close" aria-label="Закрыть" disabled={paying} onClick={() => setModal(null)}>×</button>
    {modal.kind === 'details' && <>
     <div className="gifts-detail-art"><GameIcon name={modal.gift.icon}/></div>
     <h2 id="gift-dialog-title">{modal.gift.name}</h2>
     <dl className="gifts-facts">
      <div><dt>Отправитель</dt><dd dir="auto">{modal.gift.sender}</dd></div>
      <div><dt>Стоимость</dt><dd><Stars price={modal.gift.price}/></dd></div>
      <div><dt>Получен</dt><dd><time dateTime={new Date(modal.gift.receivedAt).toISOString()}>{dates.format(modal.gift.receivedAt)}</time></dd></div>
     </dl>
     {modal.gift.wish && <div className="gifts-wish-display">
      <h3>Пожелание</h3>
      <p dir="auto">{modal.gift.wish}</p>
     </div>}
    </>}
    {modal.kind === 'catalog' && <>
     <h2 id="gift-dialog-title">Выбрать подарок</h2>
     {catalogError && <p role="status">Не удалось загрузить каталог. <button type="button" onClick={openCatalog}>Повторить</button></p>}
     {!catalog && !catalogError && <p role="status">Загружаем каталог…</p>}
     {catalog && <div className="gifts-catalog">{catalog.catalog.map(gift =>
      <button key={gift.id} type="button" onClick={() => setModal({kind:'confirm',gift})}>
       <GameIcon name={gift.icon}/><strong>{gift.name}</strong><Stars price={gift.price}/>
      </button>)}</div>}
    </>}
    {modal.kind === 'confirm' && <>
     <div className="gifts-detail-art"><GameIcon name={modal.gift.icon}/></div>
     <h2 id="gift-dialog-title">{modal.gift.name}</h2>
     <p className="gifts-confirm-price"><Stars price={modal.gift.price}/> Telegram Stars</p>
     <label className="gifts-wish-field">
      <span>Пожелание <small>{wish.length} / {maxGiftWishLength}</small></span>
      <textarea value={wish} onChange={event => setWish(event.target.value)} maxLength={maxGiftWishLength}
       placeholder="По желанию" rows={3} disabled={paying}/>
     </label>
     <label className="gifts-anonymous"><input type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)} disabled={paying}/>Подарить анонимно</label>
     {unavailable && <p>{unavailable}</p>}
     {notice && <p className="gifts-notice" role="status">{notice}</p>}
     <div className="gifts-confirm-actions">
      <button type="button" disabled={paying} onClick={() => {setNotice('');setModal({kind:'catalog'});}}>Назад</button>
      <button type="button" className="gold-button" disabled={paying || Boolean(unavailable)} onClick={() => pay(modal.gift)}>{paying ? 'Открываем оплату…' : 'Подтвердить и оплатить'}</button>
     </div>
    </>}
   </div>}
  </dialog>
 </section>;
}
