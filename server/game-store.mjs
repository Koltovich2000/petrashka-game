import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';
import {characterNameKey,parseCharacterName} from '../src/characterName.ts';
import {worldStore,worldTables} from './world-store.mjs';
import {notificationStore,notificationTables} from './notification-store.mjs';

const tables=`
 CREATE TABLE IF NOT EXISTS petrashka_players (id TEXT PRIMARY KEY, state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS petrashka_medical_history (
  player_id TEXT NOT NULL, event_id TEXT NOT NULL, details TEXT NOT NULL,
  PRIMARY KEY(player_id,event_id)
 );
 CREATE TABLE IF NOT EXISTS petrashka_admin_actions (
  admin_id TEXT NOT NULL, operation_id TEXT NOT NULL, player_id TEXT NOT NULL,
  at BIGINT NOT NULL, request TEXT NOT NULL, details TEXT NOT NULL,
  PRIMARY KEY(admin_id,operation_id)
 );${worldTables};${notificationTables}`;
const indexes=`
 CREATE INDEX IF NOT EXISTS petrashka_players_last_seen ON petrashka_players(last_seen_at DESC,id);
 CREATE INDEX IF NOT EXISTS petrashka_polls_date ON petrashka_polls(started_at DESC,id DESC);
 CREATE INDEX IF NOT EXISTS petrashka_admin_actions_date ON petrashka_admin_actions(at DESC,admin_id,operation_id)`;
const pageSize=20;

const readPlayer='SELECT id, state, display_name, last_seen_at, character_name_key FROM petrashka_players WHERE id=?';
const writePlayer=`UPDATE petrashka_players SET state=?, last_seen_at=
 CASE WHEN last_seen_at<? THEN ? ELSE last_seen_at END WHERE id=?`;
const nameIndex='petrashka_players_character_name_unique';
const characterNameIndex=`CREATE UNIQUE INDEX IF NOT EXISTS ${nameIndex} ON petrashka_players(character_name_key)`;
const claimCharacterName='UPDATE petrashka_players SET character_name_key=? WHERE id=?';
const addPlayer="INSERT INTO petrashka_players(id,state) VALUES(?,'') ON CONFLICT(id) DO NOTHING";
const logMedical='INSERT INTO petrashka_medical_history VALUES(?,?,?) ON CONFLICT DO NOTHING';
const readAction='SELECT request,player_id,details FROM petrashka_admin_actions WHERE admin_id=? AND operation_id=?';
const allPlayers='SELECT id,state FROM petrashka_players ORDER BY id';
const writeState='UPDATE petrashka_players SET state=? WHERE id=?';
const logAction='INSERT INTO petrashka_admin_actions(admin_id,operation_id,player_id,at,request,details) VALUES(?,?,?,?,?,?)';

function existingCharacterNames(rows){
 const named=[];
 for(const {id,state} of rows){
  try{
   const saved=JSON.parse(state);
   const name=saved?.introCompleted&&parseCharacterName(saved.characterName);
   if(name)named.push({id,key:characterNameKey(name),born:Number.isFinite(saved.born)?saved.born:Infinity});
  }catch{
   // Leave malformed saves for the normal game loader to handle.
  }
 }
 named.sort((a,b)=>(a.born-b.born)||a.id.localeCompare(b.id));
 const names=new Set();
 return named.filter(({key})=>{
  if(names.has(key))return false;
  names.add(key);
  return true;
 });
}

function nameConflict(){
 return Object.assign(new Error('Character name already taken'),{status:409,code:'character_name_taken'});
}

function alreadyApplied(action,row,audit){
 if(!audit)return false;
 if(audit.request!==action.request||audit.player_id!==row.id){
  throw Object.assign(new Error('Admin operation ID was reused'),{status:409,code:'operation_reused'});
 }
 return true;
}

function bulkDetails(action,affected,total){
 return {kind:'adjust',...JSON.parse(action.request),affected,total,changes:{}};
}
function playerQueries(query,change,changeAll,close,world,notifications,fold='LOWER'){
 return {
  change,changeAll,close,world,notifications,
  async savedPlayerCount(){
   const [row]=await query("SELECT COUNT(*) AS total FROM petrashka_players WHERE state<>''",[]);
   return Number(row.total);
  },
  async rememberProfile(id,displayName,at){
   await query(`INSERT INTO petrashka_players(id,state,display_name,last_seen_at) VALUES(?,'',?,?)
    ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,
     last_seen_at=CASE WHEN petrashka_players.last_seen_at<excluded.last_seen_at
      THEN excluded.last_seen_at ELSE petrashka_players.last_seen_at END`,[id,displayName,at]);
  },
  async player(id){return (await query(readPlayer,[id]))[0];},
  async players(search,page,since){
   const like='%'+search.toLowerCase().replace(/[!%_]/g,char=>'!'+char)+'%';
   const match=`id LIKE ? ESCAPE '!' OR ${fold}(display_name) LIKE ? ESCAPE '!'`;
   const [summary,matching]=await Promise.all([
    query('SELECT COUNT(*) AS total, SUM(CASE WHEN last_seen_at>=? THEN 1 ELSE 0 END) AS active FROM petrashka_players',[since]),
    query(`SELECT COUNT(*) AS matches FROM petrashka_players WHERE ${match}`,[like,like]),
   ]);
   const pages=Math.max(1,Math.ceil(Number(matching[0].matches)/pageSize));
   page=Math.min(page,pages);
   const players=await query(`SELECT id, state, display_name, last_seen_at FROM petrashka_players
    WHERE ${match} ORDER BY last_seen_at DESC,id LIMIT ? OFFSET ?`,[like,like,pageSize,(page-1)*pageSize]);
   return {players,page,pages,total:Number(summary[0].total),active:Number(summary[0].active)};
  },
  async journal(page){
   const [count]=await query('SELECT COUNT(*) AS total FROM petrashka_admin_actions',[]);
   const pages=Math.max(1,Math.ceil(Number(count.total)/pageSize));
   page=Math.min(page,pages);
   const entries=await query(`SELECT a.admin_id, a.operation_id, a.player_id, a.at, a.details, p.display_name
     FROM petrashka_admin_actions a LEFT JOIN petrashka_players p ON p.id=a.player_id
     ORDER BY a.at DESC,a.admin_id,a.operation_id LIMIT ? OFFSET ?`,[pageSize,(page-1)*pageSize]);
   return {page,pages,entries:entries.map(row=>({id:row.operation_id,adminId:row.admin_id,playerId:row.player_id,
    name:row.display_name,at:Number(row.at),...JSON.parse(row.details)}))};
  },
 };
}

function postgresParams(sql){
 let index=0;
 return sql.replace(/\?/g,()=>`$${++index}`);
}

async function openPostgres(url){
 const pool=new pg.Pool({connectionString:url});
 try{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(641150389)');
   await client.query(tables);
   const {rows:columns}=await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='petrashka_players'`);
   await client.query(`ALTER TABLE petrashka_players ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE petrashka_players ADD COLUMN IF NOT EXISTS last_seen_at BIGINT NOT NULL DEFAULT 0;`);
   if(!columns.some(column=>column.column_name==='last_seen_at'))await client.query(`UPDATE petrashka_players SET last_seen_at=COALESCE((state::jsonb->>'updated')::bigint,0) WHERE state<>''`);
   if(!columns.some(column=>column.column_name==='character_name_key')){
    await client.query('ALTER TABLE petrashka_players ADD COLUMN character_name_key TEXT');
    const {rows}=await client.query(allPlayers);
    for(const {id,key} of existingCharacterNames(rows)){
     await client.query(postgresParams(claimCharacterName),[key,id]);
    }
   }
   await client.query(characterNameIndex);
   await client.query(indexes);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){await pool.end();throw error;}

 const query=async(sql,args)=>(await pool.query(postgresParams(sql),args)).rows;
 const transaction=async steps=>{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(641150390)');
   const operations=steps();
   let step=operations.next();
   while(!step.done){
    const [sql,...args]=step.value;
    step=operations.next((await client.query(postgresParams(sql),args)).rows);
   }
   await client.query('COMMIT');
   return step.value;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 };
 const world=worldStore(transaction);
 const notifications=notificationStore(transaction);
 return playerQueries(query,
  async(id,change,{activeAt=0,action,existingOnly=false}={})=>{
   const client=await pool.connect();
   const run=(sql,...args)=>client.query(postgresParams(sql),args);
   try{
    await client.query('BEGIN');
    if(action){
     // Serialize retries by one administrator before locking the target profile.
     await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[action.adminId,action.id]);
    }else if(!existingOnly)await run(addPlayer,id);
    const row=(await run(readPlayer+' FOR UPDATE',id)).rows[0];
    if(!row||existingOnly&&!row.state){await client.query('COMMIT');return null;}
    if(action&&alreadyApplied(action,row,(await run(readAction,action.adminId,action.id)).rows[0])){
     await client.query('COMMIT');return row.state?JSON.parse(row.state):null;
    }
    const {state,events,details,nameKey}=change(row.state,row.character_name_key);
    if(nameKey){
     try{await run(claimCharacterName,nameKey,id);}
     catch(error){if(error.code==='23505'&&error.constraint===nameIndex)throw nameConflict();throw error;}
    }
    await run(writePlayer,JSON.stringify(state),activeAt,activeAt,id);
    for(const {key,...event} of events)await run(logMedical,id,key,JSON.stringify(event));
    if(action)await run(logAction,action.adminId,action.id,id,action.at,action.request,JSON.stringify(details));
    await client.query('COMMIT');
    return state;
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },async(action,change)=>{
   const client=await pool.connect();
   const run=(sql,...args)=>client.query(postgresParams(sql),args);
   try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[action.adminId,action.id]);
    const previous=(await run(readAction,action.adminId,action.id)).rows[0];
    if(alreadyApplied(action,{id:'*'},previous)){
     await client.query('COMMIT');return JSON.parse(previous.details);
    }
    const {rows}=await client.query(allPlayers+' FOR UPDATE');
    let affected=0;
    for(const row of rows){
     const {state,events,changed}=change(row.state);
     await run(writeState,JSON.stringify(state),row.id);
     for(const {key,...event} of events)await run(logMedical,row.id,key,JSON.stringify(event));
     if(changed)affected++;
    }
    const result=bulkDetails(action,affected,rows.length);
    await run(logAction,action.adminId,action.id,'*',action.at,action.request,JSON.stringify(result));
    await client.query('COMMIT');
    return result;
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },()=>pool.end(),world,notifications);
}

export async function openGameStore(path,url){
 if(url)return openPostgres(url);
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;'+tables);
  const columns=db.prepare('PRAGMA table_info(petrashka_players)').all();
  if(!columns.some(column=>column.name==='display_name'))db.exec("ALTER TABLE petrashka_players ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
  if(!columns.some(column=>column.name==='last_seen_at'))db.exec(`
   ALTER TABLE petrashka_players ADD COLUMN last_seen_at BIGINT NOT NULL DEFAULT 0;
   UPDATE petrashka_players SET last_seen_at=COALESCE(CAST(json_extract(state,'$.updated') AS INTEGER),0) WHERE json_valid(state)`);
  if(!columns.some(column=>column.name==='character_name_key')){
   db.exec('ALTER TABLE petrashka_players ADD COLUMN character_name_key TEXT');
   const claim=db.prepare(claimCharacterName);
   for(const {id,key} of existingCharacterNames(db.prepare(allPlayers).all()))claim.run(key,id);
  }
  db.exec(characterNameIndex);
  db.exec(indexes+'; COMMIT');
 }catch(error){db.close();throw error;}
 const read=db.prepare(readPlayer),add=db.prepare(addPlayer),write=db.prepare(writePlayer),log=db.prepare(logMedical);
 const audit=db.prepare(readAction),logAdmin=db.prepare(logAction);
 const claimName=db.prepare(claimCharacterName);
 db.function('petrashka_fold',{deterministic:true},value=>value.toLowerCase());

 const query=(sql,args)=>db.prepare(sql).all(...args);
 const transaction=steps=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   const operations=steps();
   let step=operations.next();
   while(!step.done){
    const [sql,...args]=step.value;
    step=operations.next(query(sql,args));
   }
   db.exec('COMMIT');
   return step.value;
  }catch(error){db.exec('ROLLBACK');throw error;}
 };
 const world=worldStore(transaction);
 const notifications=notificationStore(transaction);
 return playerQueries(query,(id,change,{activeAt=0,action,existingOnly=false}={})=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   if(!action&&!existingOnly)add.run(id);
   const row=read.get(id);
   if(!row||existingOnly&&!row.state){db.exec('COMMIT');return null;}
   if(action&&alreadyApplied(action,row,audit.get(action.adminId,action.id))){
    db.exec('COMMIT');return row.state?JSON.parse(row.state):null;
   }
   const {state,events,details,nameKey}=change(row.state,row.character_name_key);
   if(nameKey){
    try{claimName.run(nameKey,id);}
    catch(error){if(error.errcode===2067)throw nameConflict();throw error;}
   }
   write.run(JSON.stringify(state),activeAt,activeAt,id);
   for(const {key,...event} of events)log.run(id,key,JSON.stringify(event));
   if(action)logAdmin.run(action.adminId,action.id,id,action.at,action.request,JSON.stringify(details));
   db.exec('COMMIT');
   return state;
  }catch(error){db.exec('ROLLBACK');throw error;}
 },(action,change)=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   const previous=audit.get(action.adminId,action.id);
   if(alreadyApplied(action,{id:'*'},previous)){
    db.exec('COMMIT');return JSON.parse(previous.details);
   }
   const rows=db.prepare(allPlayers).all();
   const save=db.prepare(writeState);
   let affected=0;
   for(const row of rows){
    const {state,events,changed}=change(row.state);
    save.run(JSON.stringify(state),row.id);
    for(const {key,...event} of events)log.run(row.id,key,JSON.stringify(event));
    if(changed)affected++;
   }
   const result=bulkDetails(action,affected,rows.length);
   logAdmin.run(action.adminId,action.id,'*',action.at,action.request,JSON.stringify(result));
   db.exec('COMMIT');
   return result;
  }catch(error){db.exec('ROLLBACK');throw error;}
 },()=>db.close(),world,notifications,'petrashka_fold');
}
