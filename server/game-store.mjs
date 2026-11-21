import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';

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
 )`;
const indexes=`
 CREATE INDEX IF NOT EXISTS petrashka_players_last_seen ON petrashka_players(last_seen_at DESC,id);
 CREATE INDEX IF NOT EXISTS petrashka_admin_actions_date ON petrashka_admin_actions(at DESC,admin_id,operation_id)`;
const pageSize=20;

const readPlayer='SELECT id, state, display_name, last_seen_at FROM petrashka_players WHERE id=?';
const writePlayer=`UPDATE petrashka_players SET state=?, last_seen_at=
 CASE WHEN last_seen_at<? THEN ? ELSE last_seen_at END WHERE id=?`;
const addPlayer="INSERT INTO petrashka_players(id,state) VALUES(?,'') ON CONFLICT(id) DO NOTHING";
const logMedical='INSERT INTO petrashka_medical_history VALUES(?,?,?) ON CONFLICT DO NOTHING';
const readAction='SELECT request,player_id FROM petrashka_admin_actions WHERE admin_id=? AND operation_id=?';
const logAction='INSERT INTO petrashka_admin_actions(admin_id,operation_id,player_id,at,request,details) VALUES(?,?,?,?,?,?)';

function alreadyApplied(action,row,audit){
 if(!audit)return false;
 if(audit.request!==action.request||audit.player_id!==row.id){
  throw Object.assign(new Error('Admin operation ID was reused'),{status:409,code:'operation_reused'});
 }
 return true;
}

function playerQueries(query,change,close,fold='LOWER'){
 return {
  change,close,
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
   const added=await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='petrashka_players' AND column_name='last_seen_at'`);
   await client.query(`ALTER TABLE petrashka_players ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE petrashka_players ADD COLUMN IF NOT EXISTS last_seen_at BIGINT NOT NULL DEFAULT 0;`);
   if(!added.rowCount)await client.query(`UPDATE petrashka_players SET last_seen_at=COALESCE((state::jsonb->>'updated')::bigint,0) WHERE state<>''`);
   await client.query(indexes);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){await pool.end();throw error;}

 return playerQueries(async(sql,args)=>(await pool.query(postgresParams(sql),args)).rows,
  async(id,change,{activeAt=0,action}={})=>{
   const client=await pool.connect();
   const run=(sql,...args)=>client.query(postgresParams(sql),args);
   try{
    await client.query('BEGIN');
    if(action){
     // Serialize retries by one administrator before locking the target profile.
     await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[action.adminId,action.id]);
    }else await run(addPlayer,id);
    const row=(await run(readPlayer+' FOR UPDATE',id)).rows[0];
    if(!row){await client.query('COMMIT');return null;}
    if(action&&alreadyApplied(action,row,(await run(readAction,action.adminId,action.id)).rows[0])){
     await client.query('COMMIT');return row.state?JSON.parse(row.state):null;
    }
    const {state,events,details}=change(row.state);
    await run(writePlayer,JSON.stringify(state),activeAt,activeAt,id);
    for(const {key,...event} of events)await run(logMedical,id,key,JSON.stringify(event));
    if(action)await run(logAction,action.adminId,action.id,id,action.at,action.request,JSON.stringify(details));
    await client.query('COMMIT');
    return state;
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },()=>pool.end());
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
  db.exec(indexes+'; COMMIT');
 }catch(error){db.close();throw error;}
 const read=db.prepare(readPlayer),add=db.prepare(addPlayer),write=db.prepare(writePlayer),log=db.prepare(logMedical);
 const audit=db.prepare(readAction),logAdmin=db.prepare(logAction);
 db.function('petrashka_fold',{deterministic:true},value=>value.toLowerCase());

 return playerQueries((sql,args)=>db.prepare(sql).all(...args),(id,change,{activeAt=0,action}={})=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   if(!action)add.run(id);
   const row=read.get(id);
   if(!row){db.exec('COMMIT');return null;}
   if(action&&alreadyApplied(action,row,audit.get(action.adminId,action.id))){
    db.exec('COMMIT');return row.state?JSON.parse(row.state):null;
   }
   const {state,events,details}=change(row.state);
   write.run(JSON.stringify(state),activeAt,activeAt,id);
   for(const {key,...event} of events)log.run(id,key,JSON.stringify(event));
   if(action)logAdmin.run(action.adminId,action.id,id,action.at,action.request,JSON.stringify(details));
   db.exec('COMMIT');
   return state;
  }catch(error){db.exec('ROLLBACK');throw error;}
 },()=>db.close(),'petrashka_fold');
}
