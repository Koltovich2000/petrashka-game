import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {adminLabels,type AdminField,type AdminGift,type AdminJournalEntry,type AdminValues,type PlayerDetails,type PlayerSummary} from './adminTypes';
import {rubles} from './economy';
import {maxGiftWishLength} from './giftWish';
import {GameIcon} from './GameIcon';
import './admin.css';

type Section='players'|'gifts'|'journal';
type Page={page:number;pages:number};
type PlayersPage=Page&{total:number;active:number;players:PlayerSummary[]};
type GiftsPage=Page&{total:number;gifts:AdminGift[]};
type JournalPage=Page&{entries:AdminJournalEntry[]};
type PlayerCommand={kind:'edit';values:AdminValues}|{kind:'credit';amount:number};
type GiftCommand={kind:'edit';anonymous?:boolean;wish?:string}|{kind:'move';position:number}|{kind:'remove'|'reset'};
type Request=<T>(path:string,body?:object,signal?:AbortSignal)=>Promise<T>;
type ChangePlayer=(id:string,command:PlayerCommand)=>Promise<PlayerDetails>;
const fields=Object.keys(adminLabels) as AdminField[];
const sectionLabels={players:'Игроки',gifts:'Подарки',journal:'Журнал'} as const;
const date=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'});
const errors:Record<string,string>={
 expired_session:'Сессия истекла. Открой игру заново через бота.',admin_required:'Доступ к админ-панели закрыт.',
 player_not_found:'Игрок не найден.',gift_not_found:'Подарок уже убран со стенда.',balance_limit:'Сумма превышает допустимый баланс.',
 player_state_changed:'Состояние игрока изменилось. Обнови его карточку.',operation_reused:'Запрос уже обработан с другими данными. Обнови карточку.',
 invalid_admin_command:'Проверь введённые значения.',invalid_gift_command:'Проверь пожелание и номер позиции.',
};

function useResource<T>(request:Request,path:string){
 const [data,setData]=useState<T>();
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setData(undefined);setError('');
  void request<T>(path,undefined,controller.signal).then(result=>{
   if(!controller.signal.aborted)setData(result);
  }).catch((failure:Error)=>{if(!controller.signal.aborted)setError(failure.message);});
  return()=>controller.abort();
 },[request,path,revision]);
 return {data,setData,error,reload:()=>setRevision(value=>value+1)};
}

function useMutation(){
 const running=useRef(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function run(action:()=>Promise<void>){
  if(running.current)return;
  running.current=true;setBusy(true);setError('');
  try{await action();}
  catch(failure){setError(failure instanceof Error?failure.message:'Не удалось сохранить изменения.');}
  finally{running.current=false;setBusy(false);}
 }
 return {busy,error,run};
}

function Pagination({data,onPage}:{data:Page;onPage:(page:number)=>void}){
 return data.pages>1&&<nav className="admin-pagination" aria-label="Страницы">
  <button type="button" disabled={data.page<=1} onClick={()=>onPage(data.page-1)} aria-label="Предыдущая страница">‹</button>
  <span>{data.page} / {data.pages}</span>
  <button type="button" disabled={data.page>=data.pages} onClick={()=>onPage(data.page+1)} aria-label="Следующая страница">›</button>
 </nav>;
}

function Feedback({error,reload,children}:{error:string;reload:()=>void;children:ReactNode}){
 return error?<div className="admin-feedback" role="alert">{error}<button type="button" onClick={reload}>Повторить</button></div>:children;
}

function Players({request,changePlayer}:{request:Request;changePlayer:ChangePlayer}){
 const [selected,setSelected]=useState<string>();
 const [query,setQuery]=useState('');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const directory=useResource<PlayersPage>(request,`/players?page=${page}&q=${encodeURIComponent(search)}`);

 function searchPlayers(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setPage(1);setSearch(query.trim());
 }

 if(selected)return <PlayerCard request={request} changePlayer={changePlayer} id={selected} goBack={()=>{setSelected(undefined);directory.reload();}}/>;
 const data=directory.data;
 return <section className="admin-section" aria-label="Игроки">
  <form className="admin-search" onSubmit={searchPlayers}>
   <input type="search" aria-label="Ник или Telegram ID" placeholder="Ник или Telegram ID" value={query} onChange={event=>setQuery(event.target.value)} maxLength={80}/>
   <button type="submit">Найти</button>
  </form>
  <Feedback error={directory.error} reload={directory.reload}>
   {data?<>
    <dl className="admin-summary"><div><dt>Всего игроков</dt><dd>{data.total}</dd></div><div><dt>Активны за 24 ч.</dt><dd>{data.active}</dd></div></dl>
    {data.players.length?<ul className="admin-list">{data.players.map(player=><li key={player.id}>
     <button type="button" onClick={()=>setSelected(player.id)}>
      <span><strong dir="auto">{player.name||`Игрок ${player.id}`}</strong><small>ID {player.id} · Ур. {player.level}</small></span>
      <span>{rubles(player.balance)}<small>{player.lastSeen?date.format(player.lastSeen):'Нет данных о входе'}</small></span>
     </button>
    </li>)}</ul>:<p className="admin-muted">Игроки не найдены.</p>}
    <Pagination data={data} onPage={setPage}/>
    <button type="button" className="admin-back" onClick={directory.reload}>Обновить список</button>
   </>:<p role="status">Загружаем игроков…</p>}
  </Feedback>
 </section>;
}

function PlayerCard({request,changePlayer,id,goBack}:{request:Request;changePlayer:ChangePlayer;id:string;goBack:()=>void}){
 const resource=useResource<{player:PlayerDetails}>(request,`/players/${id}`);
 return <section className="admin-section" aria-label="Карточка игрока">
  <button className="admin-back" type="button" onClick={goBack}>‹ К списку игроков</button>
  <Feedback error={resource.error} reload={resource.reload}>
   {resource.data?<PlayerForm player={resource.data.player} changePlayer={changePlayer} onSave={player=>resource.setData({player})} reload={resource.reload}/>:<p role="status">Загружаем сохранение…</p>}
  </Feedback>
 </section>;
}

function PlayerForm({player,changePlayer,onSave,reload}:{player:PlayerDetails;changePlayer:ChangePlayer;onSave:(player:PlayerDetails)=>void;reload:()=>void}){
 const [draft,setDraft]=useState<Partial<Record<AdminField,string>>>({});
 const [amount,setAmount]=useState('');
 const [notice,setNotice]=useState('');
 const mutation=useMutation();

 function submit(event:FormEvent<HTMLFormElement>,command:PlayerCommand){
  event.preventDefault();setNotice('');
  void mutation.run(async()=>{
   const saved=await changePlayer(player.id,command);
   onSave(saved);
   if(command.kind==='edit')setDraft({});
   else{
    setAmount('');
    setDraft(current=>{const next={...current};delete next.balance;return next;});
   }
   setNotice(command.kind==='credit'?`Начислено ${rubles(command.amount)}.`:'Изменения сохранены.');
  });
 }

 const values=Object.fromEntries(fields.filter(field=>draft[field]!==undefined).map(field=>[field,Number(draft[field])]));
 return <>
  <h3 dir="auto">{player.name||`Игрок ${player.id}`}</h3>
  <p className="admin-muted">ID {player.id} · Ур. {player.level}{player.hospitalized&&' · В больнице'}{!player.introCompleted&&' · Во вступлении'}</p>
  <form className="admin-edit" onSubmit={event=>submit(event,{kind:'edit',values})}>
   <div className="admin-stat-grid">{fields.map(field=>{
    const economy=field==='balance'||field==='xp';
    return <label key={field}>{adminLabels[field]}{field==='balance'?' (₽)':field==='xp'?' (XP)':' (%)'}
     <input type="number" inputMode="numeric" required min={0} step={1} max={economy?Number.MAX_SAFE_INTEGER:100}
      disabled={mutation.busy||(!economy&&(!player.introCompleted||(field==='health'&&player.hospitalized)))}
      value={draft[field]??Math.floor(player.values[field])} onChange={event=>setDraft({...draft,[field]:event.target.value})}/>
    </label>;
   })}</div>
   <button type="submit" disabled={mutation.busy||!Object.keys(draft).length}>Сохранить параметры</button>
  </form>
  <form className="admin-credit" onSubmit={event=>submit(event,{kind:'credit',amount:Number(amount)})}>
   <label>Сумма в ₽<input type="number" inputMode="numeric" required value={amount} min={1} max={Number.MAX_SAFE_INTEGER}
    disabled={mutation.busy} onChange={event=>setAmount(event.target.value)}/></label>
   <button type="submit" className="gold-button" disabled={mutation.busy||!amount}>Начислить рубли</button>
  </form>
  {notice&&<p role="status">{notice}</p>}
  {mutation.error&&<div className="admin-feedback" role="alert">{mutation.error}<button type="button" onClick={reload}>Обновить карточку</button></div>}
 </>;
}

function Gifts({request}:{request:Request}){
 const [page,setPage]=useState(1);
 const [selected,setSelected]=useState<AdminGift>();
 const [notice,setNotice]=useState('');
 const catalog=useResource<GiftsPage>(request,`/gifts?page=${page}`);
 if(selected&&catalog.data)return <GiftForm gift={selected} total={catalog.data.total} request={request}
  goBack={()=>setSelected(undefined)} onSave={(message,destination)=>{
   setSelected(undefined);setNotice(message);
   if(destination!==undefined)setPage(Math.ceil(destination/15));
   catalog.reload();
  }}/>;
 return <section className="admin-section" aria-label="Подарки на стенде">
  {notice&&<p role="status">{notice}</p>}
  <Feedback error={catalog.error} reload={catalog.reload}>
   {catalog.data?<>
    {catalog.data.gifts.length?<ul className="admin-list">{catalog.data.gifts.map(gift=><li key={gift.id}>
     <button type="button" onClick={()=>{setNotice('');setSelected(gift);}}>
      <span className="admin-gift-label"><GameIcon name={gift.icon}/><span><strong>{gift.name}</strong><small dir="auto">{gift.sender}</small></span></span>
      <span>№ {gift.position}<small>★ {gift.price}{gift.manual?' · Вручную':''}</small></span>
     </button>
    </li>)}</ul>:<p className="admin-muted">На стенде пока нет подарков.</p>}
    <Pagination data={catalog.data} onPage={setPage}/>
   </>:<p role="status">Загружаем подарки…</p>}
  </Feedback>
 </section>;
}

function GiftForm({gift,total,request,goBack,onSave}:{gift:AdminGift;total:number;request:Request;goBack:()=>void;onSave:(notice:string,destination?:number)=>void}){
 const [wish,setWish]=useState(gift.wish);
 const [anonymous,setAnonymous]=useState(gift.anonymous);
 const [position,setPosition]=useState(String(gift.position));
 const [confirmRemoval,setConfirmRemoval]=useState(false);
 const mutation=useMutation();

 function apply(command:GiftCommand,notice:string){
  void mutation.run(async()=>{await request('/gifts',{giftId:gift.id,...command});onSave(notice,command.kind==='move'?command.position:undefined);});
 }

 return <section className="admin-section" aria-label="Редактирование подарка">
  <button className="admin-back" type="button" onClick={goBack} disabled={mutation.busy}>‹ К списку подарков</button>
  <h3 className="admin-gift-label"><GameIcon name={gift.icon}/>{gift.name} <small>★ {gift.price}</small></h3>
  <p className="admin-muted" dir="auto">{gift.sender} · Позиция {gift.position}</p>
  <form className="admin-edit" onSubmit={event=>{
   event.preventDefault();
   apply({kind:'edit',wish:wish!==gift.wish?wish:undefined,anonymous:anonymous!==gift.anonymous?anonymous:undefined},'Подарок обновлён.');
  }}>
   <label>Пожелание<textarea value={wish} maxLength={maxGiftWishLength} rows={3} onChange={event=>setWish(event.target.value)} disabled={mutation.busy}/></label>
   <label className="admin-checkbox"><input type="checkbox" checked={anonymous} onChange={event=>setAnonymous(event.target.checked)} disabled={mutation.busy}/>Анонимный подарок</label>
   {gift.anonymous&&!anonymous&&<small>Имя отправителя станет видно всем, кто откроет стенд.</small>}
   <button type="submit" disabled={mutation.busy||(gift.wish===wish&&gift.anonymous===anonymous)}>Сохранить подарок</button>
  </form>
  <form className="admin-credit" onSubmit={event=>{event.preventDefault();apply({kind:'move',position:Number(position)},'Подарок перемещён.');}}>
   <label>Место на стенде<input type="number" inputMode="numeric" required min={1} max={total}
    value={position} onChange={event=>setPosition(event.target.value)} disabled={mutation.busy}/></label>
   <button type="submit" disabled={mutation.busy}>Переместить</button>
  </form>
  <div className="admin-inline">
   {gift.manual&&<button type="button" disabled={mutation.busy} onClick={()=>apply({kind:'reset'},'Возвращена сортировка по цене.')}>Вернуть сортировку по цене</button>}
   <button className="admin-remove" type="button" disabled={mutation.busy} onClick={()=>setConfirmRemoval(true)}>Удалить со стенда</button>
  </div>
  {confirmRemoval&&<div className="admin-feedback">
   <span>Убрать подарок со стенда? Запись о платеже сохранится.</span>
   <button type="button" disabled={mutation.busy} onClick={()=>setConfirmRemoval(false)}>Отмена</button>
   <button type="button" disabled={mutation.busy} onClick={()=>apply({kind:'remove'},'Подарок убран со стенда.')}>Убрать</button>
  </div>}
  {mutation.error&&<p role="alert">{mutation.error}</p>}
 </section>;
}

function Journal({request}:{request:Request}){
 const [page,setPage]=useState(1);
 const resource=useResource<JournalPage>(request,`/journal?page=${page}`);
 return <section className="admin-section" aria-label="Журнал действий с игроками">
  <Feedback error={resource.error} reload={resource.reload}>
   {resource.data?<>
    {resource.data.entries.length?<ul className="admin-list admin-journal">{resource.data.entries.map(entry=><li key={`${entry.adminId}:${entry.id}`}>
     <strong>{entry.kind==='credit'?`Начисление ${rubles(entry.amount??0)}`:'Изменение параметров'} · {entry.name||entry.playerId}</strong>
     <small>{date.format(entry.at)} МСК · Игрок {entry.playerId} · Админ {entry.adminId}</small>
     {fields.map(field=>{const value=entry.changes[field];return value&&<span key={field}>{adminLabels[field]} {value.before} → {value.after}</span>;})}
    </li>)}</ul>:<p className="admin-muted">Журнал пока пуст.</p>}
    <Pagination data={resource.data} onPage={setPage}/>
   </>:<p role="status">Загружаем журнал…</p>}
  </Feedback>
 </section>;
}

export function AdminDashboard({token}:{token:string}){
 const dialog=useRef<HTMLDialogElement>(null);
 const operations=useRef(new Map<string,string>());
 const [open,setOpen]=useState(false);
 const [section,setSection]=useState<Section>('players');
 const request=useCallback<Request>(async<T,>(path:string,body?:object,signal?:AbortSignal)=>{
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  const timeout=window.setTimeout(abort,12000);
  let response:Response;
  let result;
  try{
   response=await fetch('/api/admin'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,
    ...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,
    signal:controller.signal});
   result=await response.json();
  }catch{throw new Error('Связь с сервером прервалась. Попробуй ещё раз.');}
  finally{window.clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  if(!response.ok)throw new Error(errors[result.error]??'Админ-панель временно недоступна.');
  return result as T;
 },[token]);

 async function changePlayer(id:string,command:PlayerCommand){
  const key=JSON.stringify([id,command]);
  const operationId=operations.current.get(key)??crypto.randomUUID();
  operations.current.set(key,operationId);
  const {player}=await request<{player:PlayerDetails}>(`/players/${id}`,{...command,operationId});
  operations.current.delete(key);
  return player;
 }

 return <>
  <button type="button" className="dev-tools-toggle" onClick={()=>{setOpen(true);dialog.current?.showModal();}}>Админ-панель</button>
  <dialog ref={dialog} className="dev-tools admin-dashboard" aria-labelledby="admin-dashboard-title" onClose={()=>setOpen(false)}>
   <div className="admin-header">
    <h2 id="admin-dashboard-title">Админ-панель</h2>
    <button type="button" aria-label="Закрыть админ-панель" onClick={()=>dialog.current?.close()} autoFocus>×</button>
    <nav aria-label="Разделы админ-панели">{(Object.keys(sectionLabels) as Section[]).map(tab=><button type="button" key={tab}
     aria-pressed={section===tab} onClick={()=>setSection(tab)}>{sectionLabels[tab]}</button>)}</nav>
   </div>
   {open&&(section==='players'?<Players request={request} changePlayer={changePlayer}/>:section==='gifts'?<Gifts request={request}/>:<Journal request={request}/>)}
  </dialog>
 </>;
}
