import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHmac,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {fresh} from '../src/game.ts';
import {applyClothing} from '../src/economy.ts';
import {issueGameSession,gameSessionId} from './game-session.mjs';
import {createGameApi} from './game-api.mjs';
import {openGameStore} from './game-store.mjs';
import {createAppServer} from './index.mjs';

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

test('admin directory upgrades existing profiles and applies only authorized, idempotent changes',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'petrashka-admin-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const databasePath=join(directory,'game.sqlite');
 const now=Date.now();
 const legacy=new DatabaseSync(databasePath);
 legacy.exec('CREATE TABLE petrashka_players (id TEXT PRIMARY KEY, state TEXT NOT NULL)');
 const add=legacy.prepare('INSERT INTO petrashka_players VALUES(?,?)');
 add.run('111',JSON.stringify(fresh(now-hour)));
 add.run('222',JSON.stringify(fresh(now-48*hour)));
 add.run('333',JSON.stringify({...fresh(now-48*hour),economy:{balance:200,xp:90}}));
 legacy.close();

 const botToken='temporary-admin-test-secret';
 const server=createAppServer({botToken,adminIds:'111',game:{databasePath,databaseUrl:'',clock:()=>now},gifts:{databasePath:':memory:'}});
 t.after(()=>server.emit('close'));
 const dispatch=server.listeners('request')[0];
 const token=id=>issueGameSession(id,botToken,now);
 async function request(url,authorization,body){
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  req.url=url;req.method=body===undefined?'GET':'POST';
  req.headers={authorization:authorization?'Bearer '+authorization:undefined,'content-type':'application/json'};
  let status,data;
  await dispatch(req,{setHeader(){},writeHead(value){status=value;},end(raw){data=JSON.parse(raw);}});
  return {status,data};
 }
 function signedProfile(id,username){
  const params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,username})});
  const key=createHmac('sha256','WebAppData').update(botToken).digest();
  const message=Array.from(params,([key,value])=>`${key}=${value}`).join('\n');
  params.set('hash',createHmac('sha256',key).update(message).digest('hex'));
  return params.toString();
 }

 assert.equal((await request('/api/admin/players',undefined)).status,401);
 assert.equal((await request('/api/admin/players',token('222'))).status,403);
 assert.equal((await request('/api/admin/journal',token('222'))).status,403);
 assert.equal((await request('/api/admin/gifts',token('222'))).status,403);
 const auth=await request('/api/telegram/auth',undefined,{initData:signedProfile(222,'TestPlayer')});
 assert.equal(auth.data.user.isAdmin,false);
 const searched=await request('/api/admin/players?q=testplayer',token('111'));
 assert.equal(searched.data.total,3);
 assert.equal(searched.data.active,2);
 assert.deepEqual(searched.data.players.map(row=>[row.id,row.name]),[['222','@TestPlayer']]);
 assert.equal((await request('/api/admin/players?q=333',token('111'))).data.players[0].id,'333');

 const edit={kind:'edit',values:{health:85,mood:59,xp:300},operationId:randomUUID()};
 assert.equal((await request('/api/admin/players/333',token('222'),edit)).status,403);
 assert.equal((await request('/api/admin/players/999',token('111'),edit)).status,404);
 assert.equal((await request('/api/admin/players/333',token('111'),{...edit,values:{hygiene:101}})).status,400);
 const edited=await request('/api/admin/players/333',token('111'),edit);
 assert.equal(edited.data.player.values.health,85);
 assert.equal(edited.data.player.values.mood,59);
 assert.equal(edited.data.player.values.xp,300);

 const credit={kind:'credit',amount:1000,operationId:randomUUID()};
 const retries=await Promise.all([request('/api/admin/players/333',token('111'),credit),request('/api/admin/players/333',token('111'),credit)]);
 assert.deepEqual(retries.map(reply=>reply.data.player.balance),[1200,1200]);
 assert.equal((await request('/api/admin/players/333',token('111'),{...credit,amount:2000})).status,409);
 const updated=await request('/api/game',token('333'),{location:'room',command:{kind:'sync'}});
 assert.equal(updated.data.state.economy.balance,1200);
 assert.equal(updated.data.state.mood,59);
 assert.equal((await request('/api/admin/players/111',token('111'))).data.player.balance,0);
 const journal=(await request('/api/admin/journal',token('111'))).data.entries;
 assert.equal(journal.length,2);
 const entry=journal.find(row=>row.kind==='credit');
 assert.deepEqual(entry.changes.balance,{before:200,after:1200});
 assert.equal(entry.playerId,'333');
 assert.equal(entry.adminId,'111');

 const newcomer=await request('/api/telegram/auth',undefined,{initData:signedProfile(444,'NewPlayer')});
 const gift=await request('/api/admin/players/444',token('111'),{...credit,operationId:randomUUID()});
 assert.equal(gift.data.player.balance,1000);
 const afterIntro=await request('/api/game',newcomer.data.user.gameToken,{location:'room',command:{kind:'intro'}});
 assert.equal(afterIntro.data.state.economy.balance,1000);
});

test('reopening the server keeps intro scenes, tutorial progress and money for the same Telegram ID',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'petrashka-restart-'));
 const databasePath=join(directory,'game.sqlite');
 const botToken='restart-test-token';
 const options={botToken,admins:new Set(),databasePath,databaseUrl:''};
 let api=createGameApi(options);
 t.after(async()=>{await api.close();await rm(directory,{recursive:true,force:true});});
 async function restart(){
  await api.close();
  api=createGameApi(options);
  await api.rememberProfile({id:'123',displayName:'Test'});
 }
 async function command(command){
  const req=Readable.from([Buffer.from(JSON.stringify({location:'room',command}))]);
  req.method='POST';
  req.headers={'content-type':'application/json',authorization:'Bearer '+issueGameSession('123',botToken)};
  let status,reply;
  await api.handle(req,{writeHead(code){status=code;},end(raw){reply=JSON.parse(raw);}});
  assert.equal(status,200);
  return reply.state;
 }
 await command({kind:'introNext',scene:0});
 await restart();
 assert.equal((await command({kind:'sync'})).introScene,1);
 assert.equal((await command({kind:'introNext',scene:0})).introScene,1);
 await command({kind:'introNext',scene:1});
 await command({kind:'introNext',scene:2});
 await command({kind:'intro'});
 const before=await command({kind:'care',action:'feed',food:'free'});
 assert.ok(before.tutorial>0);
 await restart();
 const restored=await command({kind:'sync'});
 assert.equal(restored.introCompleted,true);
 assert.equal(restored.tutorial,before.tutorial);
 assert.deepEqual(restored.economy,before.economy);
});
