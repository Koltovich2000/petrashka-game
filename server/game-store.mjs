import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';

const tables=`
 CREATE TABLE IF NOT EXISTS petrashka_players (id TEXT PRIMARY KEY, state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS petrashka_medical_history (
  player_id TEXT NOT NULL, event_id TEXT NOT NULL, details TEXT NOT NULL,
  PRIMARY KEY(player_id,event_id)
 )`;

export async function openGameStore(path,url){
 if(url){
  const pool=new pg.Pool({connectionString:url});
  try{await pool.query(tables);}catch(error){await pool.end();throw error;}
  return {
   async change(id,change){
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     await client.query("INSERT INTO petrashka_players(id,state) VALUES($1,'') ON CONFLICT DO NOTHING",[id]);
     const player=await client.query('SELECT state FROM petrashka_players WHERE id=$1 FOR UPDATE',[id]);
     const {state,events}=change(player.rows[0].state);
     await client.query('UPDATE petrashka_players SET state=$1 WHERE id=$2',[JSON.stringify(state),id]);
     for(const {key,...event} of events)await client.query('INSERT INTO petrashka_medical_history VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,key,JSON.stringify(event)]);
     await client.query('COMMIT');
     return state;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   },
   close:()=>pool.end(),
  };
 }
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;'+tables);
 const read=db.prepare('SELECT state FROM petrashka_players WHERE id=?');
 const write=db.prepare('INSERT INTO petrashka_players VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state');
 const log=db.prepare('INSERT INTO petrashka_medical_history VALUES(?,?,?) ON CONFLICT DO NOTHING');
 return {
  change(id,change){
   db.exec('BEGIN IMMEDIATE');
   try{
    const {state,events}=change(read.get(id)?.state??'');
    write.run(id,JSON.stringify(state));
    for(const {key,...event} of events)log.run(id,key,JSON.stringify(event));
    db.exec('COMMIT');
    return state;
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  close:()=>db.close(),
 };
}
