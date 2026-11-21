import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fresh} from '../src/game.ts';
import {applyClothing} from '../src/economy.ts';
import {issueGameSession,gameSessionId} from './game-session.mjs';
import {createGameApi} from './game-api.mjs';
import {openGameStore} from './game-store.mjs';

const hour=3_600_000;

test('the game API authenticates players, applies server time, and commits billing and sales once',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'petrashka-medical-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const databasePath=join(directory,'game.sqlite');
 const origin=1_700_000_000_000;
 let now=origin;
 const botToken='temporary-test-secret';
 const api=createGameApi({botToken,admins:new Set(),databasePath,databaseUrl:'',clock:()=>now});
 t.after(()=>api.close());
 const token=issueGameSession('123',botToken,origin);
 assert.equal(gameSessionId('Bearer '+token,botToken,origin+12*hour),null);
 assert.equal(gameSessionId('Bearer '+token.replace('123.','456.'),botToken,origin),null);

 async function request(player,command,extra={},authorization=issueGameSession(player,botToken,now)){
  const body=Buffer.from(JSON.stringify({location:'room',command,...extra}));
  const req={method:'POST',headers:{authorization:'Bearer '+authorization,'content-type':'application/json'},
   iterator:async function*(){yield body;}};
  let code,value;
  const res={setHeader(){},writeHead(status){code=status;},end(raw){value=JSON.parse(raw);}};
  await api.handle(req,res);
  return {code,...value};
 }

 const initial=fresh(origin);
 const bought=applyClothing({...initial,economy:{balance:220,xp:500}},'top',1);
 const trusted=await openGameStore(databasePath);
 await trusted.change('123',()=>({state:{...bought,health:0},events:[]}));
 await trusted.close();
 assert.equal((await request('123',{kind:'sync'},{},'forged')).code,401);
 let result=await request('123',{kind:'sync'},{now:origin+100*hour});
 assert.equal(result.state.hospital.startedAt,origin);
 assert.equal(result.state.hospital.cost,0);

 now+=3*hour;
 const simultaneous=await Promise.all([request('123',{kind:'sync'}),request('123',{kind:'sync'})]);
 for(const {state} of simultaneous){
  assert.equal(state.hospital.cost,300);
  assert.equal(state.hospital.balanceSpent,100);
  assert.equal(state.hospital.debt,80);
  assert.equal(state.hospital.sales.length,1);
  assert.equal(state.closet.outfit.top,0);
 }
 const another=await request('456',{kind:'sync'},{legacySave:JSON.stringify(bought)});
 assert.equal(another.state.hospital,null);
 assert.equal(another.state.introCompleted,false);
 assert.equal(another.state.economy.balance,0);

 result=await request('123',{kind:'admin',values:{balance:99999}});
 assert.equal(result.code,403);
 assert.equal((await request('123',{kind:'sync'})).state.economy.balance,0);
 await request('123',{kind:'notice',notice:0});
 const repeats=await Promise.all([request('123',{kind:'notice',notice:1}),request('123',{kind:'notice',notice:1})]);
 assert.ok(repeats.every(reply=>reply.state.hospital.notice===2));
 result=await request('123',{kind:'discharge',notice:2});
 assert.equal(result.state.hospital,null);
 assert.equal(result.state.health,50);
 assert.equal(result.state.medicalDebt,80);
 const stored=new DatabaseSync(databasePath);
 const kinds=stored.prepare("SELECT details FROM petrashka_medical_history WHERE player_id='123' ORDER BY rowid").all().map(row=>JSON.parse(row.details).type);
 assert.deepEqual(kinds,['admit','bill','sale','discharge']);
 stored.close();
});
