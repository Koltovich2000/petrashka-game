import {randomUUID} from 'node:crypto';
import {parseSave} from '../src/game.ts';
import {settleGame} from '../src/gameCommands.ts';
import {gameTime} from '../src/world.ts';
import {TUTORIAL} from '../src/balance.ts';

export const notificationTables=`
 CREATE TABLE IF NOT EXISTS petrashka_notifications (
  player_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, granted INTEGER NOT NULL DEFAULT 0,
  prompted INTEGER NOT NULL DEFAULT 0, enabled_at BIGINT NOT NULL DEFAULT 0, permission_at BIGINT NOT NULL DEFAULT 0,
  tracking TEXT NOT NULL DEFAULT '{}'
 );
 CREATE TABLE IF NOT EXISTS petrashka_notification_queue (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL, event_key TEXT NOT NULL, kind TEXT NOT NULL,
  priority INTEGER NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL, available_at BIGINT NOT NULL, attempted_at BIGINT NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0, message_id BIGINT, error_code TEXT,
  UNIQUE(player_id,event_key)
 );
 CREATE INDEX IF NOT EXISTS petrashka_notification_ready ON petrashka_notification_queue(status,available_at,priority);
 CREATE INDEX IF NOT EXISTS petrashka_notification_history ON petrashka_notification_queue(player_id,attempted_at);
 CREATE TABLE IF NOT EXISTS petrashka_notification_worker (
  id INTEGER PRIMARY KEY, owner TEXT NOT NULL, lease_until BIGINT NOT NULL, next_send_at BIGINT NOT NULL
 );`;

export const notificationTexts={
 welcome:'🎉 Добро пожаловать в Петрашку!\n\nТеперь у тебя есть собственный виртуальный персонаж! Заботься обо мне, зарабатывай деньги и обустраивай квартиру. Только не забывай меня кормить!',
 poll:'🗳️ СРОЧНО! РЕШАЕТСЯ МОЯ СУДЬБА!\n\nНачалось новое голосование! Заходи и решай, что со мной произойдёт!',
 absence:'👀 День второй. Хозяин пропал.\n\nНачинаю подозревать, что меня бросили. Может, хотя бы проверишь, жив ли я?',
 food:['🍔 Я сейчас начну есть обои! Покорми меня!','🚨 АЛЛО! Я УМИРАЮ ОТ ГОЛОДА!'],
 energy:['🔋 У меня батарейка садится. Дай мне поспать!','😵 У меня совсем нет сил! Хочу спать!'],
 hygiene:['🚿 От меня уже пахнет через экран. Мне нужен душ!','🧼 Пора вызывать санитарную службу!'],
 mood:['😞 Мне скучно. Ты вообще помнишь обо мне?','😭 Я ТУТ СОВСЕМ ОДИН!'],
};
const stats=['food','energy','hygiene','mood'];
const day=86_400_000;
export const activeWindow=60_000;
const complete=game=>game?.introCompleted&&game.tutorial>=TUTORIAL.done&&!game.tourSection;
const defaults={enabled:0,granted:0,prompted:0};
const publicPreference=row=>({enabled:Boolean(row.enabled),granted:Boolean(row.granted),prompted:Boolean(row.prompted)});
const readPreference='SELECT * FROM petrashka_notifications WHERE player_id=?';
const createPreference='INSERT INTO petrashka_notifications(player_id) VALUES (?) ON CONFLICT(player_id) DO NOTHING';

function* currentPlayer(id,now){
 const [row]=yield ['SELECT state,last_seen_at FROM petrashka_players WHERE id=?',id];
 if(!row?.state)return null;
 const pauses=(yield ['SELECT started_at,ends_at FROM petrashka_pauses ORDER BY started_at'])
  .map(row=>({start:Number(row.started_at),end:row.ends_at===null?null:Number(row.ends_at)}));
 const at=gameTime(now,pauses);
 const saved=JSON.parse(row.state);
 const game=settleGame(saved.version===4?saved:parseSave(row.state,at,true),at,pauses,now);
 return {game,lastSeen:Number(row.last_seen_at),paused:pauses.at(-1)?.end===null};
}

function* enqueue(id,key,kind,payload,now,priority=1){
 yield [`INSERT INTO petrashka_notification_queue(id,player_id,event_key,kind,priority,payload,created_at,available_at)
  VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(player_id,event_key) DO NOTHING`,randomUUID(),id,key,kind,priority,JSON.stringify(payload),now,now];
}

function* observe(id,now){
 const [preference]=yield [readPreference,id];
 if(!preference)return;
 const player=yield* currentPlayer(id,now);
 if(!player)return;
 const {game,lastSeen,paused}=player;
 const tracking=JSON.parse(preference.tracking);
 tracking.stats??={};
 // Observe recoveries during foreground actions too, even between worker scans.
 for(const stat of stats){
  const previous=tracking.stats[stat]??{cycle:0,low:false,critical:false};
  tracking.stats[stat]=game[stat]>30&&(previous.low||previous.critical)
   ?{cycle:previous.cycle+1,low:false,critical:false}:previous;
 }
 if(preference.enabled&&preference.granted){
  if(complete(game)){
   yield* enqueue(id,'welcome','welcome',{},now);
   if(lastSeen>0&&now-lastSeen>=2*day)yield* enqueue(id,'absence:'+lastSeen,'absence',{lastSeen},now);
   if(!paused&&!game.hospital&&game.sleepUntil===null&&now-lastSeen>=activeWindow){
    const parts=[];
    for(const stat of stats){
     const flags=tracking.stats[stat];
     if(game[stat]<=0&&!flags.critical){
      parts.push({stat,critical:true,cycle:flags.cycle});
      flags.low=true;flags.critical=true;
     }else if(game[stat]<=20&&!flags.low){
      parts.push({stat,critical:false,cycle:flags.cycle});flags.low=true;
     }
    }
    if(parts.length)yield* enqueue(id,'stats:'+randomUUID(),'stats',{parts},now,parts.some(part=>part.critical)?3:1);
   }
  }
  const polls=yield [`SELECT p.id FROM petrashka_polls p
   LEFT JOIN petrashka_poll_control c ON c.poll_id=p.id LEFT JOIN petrashka_removed_polls r ON r.poll_id=p.id
   WHERE p.started_at>=? AND COALESCE(c.closed_at,p.ends_at)>? AND r.poll_id IS NULL`,preference.enabled_at,now];
  for(const poll of polls)yield* enqueue(id,'poll:'+poll.id,'poll',{pollId:poll.id},now,2);
 }
 yield ['UPDATE petrashka_notifications SET tracking=? WHERE player_id=?',JSON.stringify(tracking),id];
}

function* validMessage(entry,preference,now){
 const payload=JSON.parse(entry.payload);
 const player=yield* currentPlayer(entry.player_id,now);
 if(!player)return null;
 if(entry.kind==='poll'){
  const [poll]=yield [`SELECT p.id FROM petrashka_polls p LEFT JOIN petrashka_poll_control c ON c.poll_id=p.id
   LEFT JOIN petrashka_removed_polls r ON r.poll_id=p.id WHERE p.id=? AND COALESCE(c.closed_at,p.ends_at)>? AND r.poll_id IS NULL`,payload.pollId,now];
  return poll?notificationTexts.poll:null;
 }
 if(!complete(player.game))return null;
 if(entry.kind==='welcome')return notificationTexts.welcome;
 if(entry.kind==='absence')return player.lastSeen===payload.lastSeen&&now-player.lastSeen>=2*day?notificationTexts.absence:null;
 const {game,paused,lastSeen}=player;
 if(paused||game.hospital||game.sleepUntil!==null)return '';
 const flags=JSON.parse(preference.tracking).stats??{};
 const parts=payload.parts.filter(part=>flags[part.stat]?.cycle===part.cycle&&
  (part.critical?game[part.stat]<=0:game[part.stat]>0&&game[part.stat]<=20));
 if(!parts.length)return null;
 if(now-lastSeen<activeWindow)return '';
 return parts.map(part=>notificationTexts[part.stat][part.critical?1:0]).join('\n\n');
}

export function notificationStore(transaction){
 return {
  status(id){return transaction(function*(){const [row]=yield [readPreference,id];return publicPreference(row??defaults);});},
  grant(id,allowed,at){return transaction(function*(){
   yield [createPreference,id];
   yield [`UPDATE petrashka_notifications SET granted=?,permission_at=?,
    enabled=CASE WHEN prompted=0 AND ?=1 THEN 1 ELSE enabled END,
    enabled_at=CASE WHEN prompted=0 AND ?=1 THEN ? ELSE enabled_at END,
    prompted=CASE WHEN ?=1 THEN 1 ELSE prompted END
    WHERE player_id=? AND permission_at<=?`,allowed?1:0,at,allowed?1:0,allowed?1:0,at,allowed?1:0,id,at];
   if(!allowed)yield ["UPDATE petrashka_notification_queue SET status='cancelled' WHERE player_id=? AND status='pending'",id];
  });},
  preference(id,enabled,now){return transaction(function*(){
   yield [createPreference,id];
   const [old]=yield [readPreference,id];
   yield ['UPDATE petrashka_notifications SET enabled=?,prompted=1,enabled_at=? WHERE player_id=?',enabled?1:0,enabled&&!old.enabled?now:old.enabled_at,id];
   if(!enabled)yield ["UPDATE petrashka_notification_queue SET status='cancelled' WHERE player_id=? AND status='pending'",id];
   yield* observe(id,now);
   const [row]=yield [readPreference,id];return publicPreference(row);
  });},
  observe(id,now){return transaction(function*(){yield* observe(id,now);});},
  scan(after,now){return transaction(function*(){
   const rows=yield ['SELECT player_id FROM petrashka_notifications WHERE enabled=1 AND granted=1 AND player_id>? ORDER BY player_id LIMIT 100',after];
   for(const row of rows)yield* observe(row.player_id,now);
   return rows.length===100?rows.at(-1).player_id:'';
  });},
  acquire(owner,now){return transaction(function*(){
   yield ["INSERT INTO petrashka_notification_worker VALUES(1,'',0,0) ON CONFLICT(id) DO NOTHING"];
   const [worker]=yield ['SELECT * FROM petrashka_notification_worker WHERE id=1'];
   if(Number(worker.lease_until)>now&&worker.owner!==owner||Number(worker.next_send_at)>now)return false;
   yield ['UPDATE petrashka_notification_worker SET owner=?,lease_until=? WHERE id=1',owner,now+30_000];
   return true;
  });},
  release(owner,nextAt){return transaction(function*(){
   yield ['UPDATE petrashka_notification_worker SET lease_until=0,next_send_at=? WHERE id=1 AND owner=?',nextAt,owner];
  });},
  claim(owner,now){return transaction(function*(){
   const [worker]=yield ['SELECT * FROM petrashka_notification_worker WHERE id=1'];
   if(worker?.owner!==owner||Number(worker.lease_until)<=now)return null;
   const entries=yield ["SELECT * FROM petrashka_notification_queue WHERE status='pending' AND available_at<=? ORDER BY priority DESC,created_at,id LIMIT 100",now];
   for(const entry of entries){
    const [preference]=yield [readPreference,entry.player_id];
    const text=preference?.enabled&&preference.granted?yield* validMessage(entry,preference,now):null;
    if(text===null){yield ["UPDATE petrashka_notification_queue SET status='cancelled' WHERE id=?",entry.id];continue;}
    if(text===''){
     yield ['UPDATE petrashka_notification_queue SET available_at=? WHERE id=?',now+60_000,entry.id];continue;
    }
    const [recent]=yield [`SELECT MAX(attempted_at) AS latest FROM petrashka_notification_queue
     WHERE player_id=? AND status IN ('sent','sending','unknown')`,entry.player_id];
    if(Number(recent.latest)>now-1500)continue;
    if(entry.priority===1){
     const rows=yield ["SELECT attempted_at FROM petrashka_notification_queue WHERE player_id=? AND priority=1 AND status IN ('sent','sending','unknown') AND attempted_at>? ORDER BY attempted_at",entry.player_id,now-day];
     if(rows.length>=2){
      yield ['UPDATE petrashka_notification_queue SET available_at=? WHERE id=?',Number(rows[0].attempted_at)+day+1,entry.id];continue;
     }
    }
    yield ["UPDATE petrashka_notification_queue SET status='sending',attempted_at=?,attempts=attempts+1 WHERE id=?",now,entry.id];
    return {...entry,text,attempts:Number(entry.attempts)+1};
   }
   return null;
  });},
  finish(id,status,at,{messageId=null,errorCode=null}={}){return transaction(function*(){
   yield ["UPDATE petrashka_notification_queue SET status=?,available_at=?,message_id=?,error_code=? WHERE id=? AND status='sending'",status,at,messageId,errorCode,id];
  });},
 };
}
