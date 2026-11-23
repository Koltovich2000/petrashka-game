import {useState} from 'react';
import {requestNotificationAccess} from './telegram';

export type NotificationStatus={enabled:boolean;granted:boolean;prompted:boolean;configured:boolean};

type Props={status:NotificationStatus;onChange:(enabled:boolean)=>Promise<boolean>;offer?:boolean};

export function NotificationSettings({status,onChange,offer=false}:Props){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function change(enabled:boolean){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const allowed=enabled&&(status.granted||await requestNotificationAccess());
   if(!await onChange(allowed))throw new Error('Не удалось сохранить настройку. Попробуй ещё раз.');
   if(enabled&&!allowed)setError('Разрешение не выдано. Уведомления можно включить позже.');
  }catch(failure){setError(failure instanceof Error?failure.message:'Не удалось включить уведомления.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Уведомления Telegram" onClick={event=>event.stopPropagation()}>
  <h2>{offer?'Петрашка может писать тебе':'Уведомления Telegram'}</h2>
  <p>Сообщения от бота о потребностях Петрашки, новых голосованиях и долгом отсутствии. Под каждым сообщением будет кнопка «🎮 Играть».</p>
  {!status.configured&&<p className="muted">Уведомления пока недоступны.</p>}
  {status.enabled&&!status.granted&&<p role="status">Ожидаем разрешение от Telegram. Если оно не подтверждается, открой игру заново.</p>}
  <button type="button" disabled={busy||!status.configured} aria-pressed={status.enabled}
   onClick={()=>void change(!status.enabled)}>{busy?'Сохраняем…':status.enabled?'Отключить уведомления':'Включить уведомления'}</button>
  {offer&&<button type="button" disabled={busy} onClick={()=>void change(false)}>Не сейчас</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
