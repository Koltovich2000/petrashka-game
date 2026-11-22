import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {createGiftsApi} from './gifts-api.mjs';
import {createGiftStore, giftCatalog} from './gifts-store.mjs';
import {maxGiftWishLength} from '../src/giftWish.ts';
import {createAdminApi} from './admin-api.mjs';
import {issueGameSession} from './game-session.mjs';

const botToken = 'gift-test-bot';
const webhookSecret = 'test_secret_123456789012345678901234567890';
const webhook = '/api/telegram/gifts-webhook';
const spender = {id:105, first_name:'Имя', username:'nickname'};
const secondPlayer = {id:106, first_name:'Зритель'};
const shawarma = giftCatalog.find(item => item.id === 'shawarma');
const crown = giftCatalog.find(item => item.id === 'hype-crown');
const slipper = giftCatalog.find(item => item.id === 'mom-slipper');

function sign(user) {
 const params = new URLSearchParams({auth_date:String(Math.floor(Date.now() / 1000)), user:JSON.stringify(user)});
 const key = createHmac('sha256','WebAppData').update(botToken).digest();
 const message = Array.from(params, ([name,value]) => name + '=' + value).join('\n');
 params.set('hash',createHmac('sha256',key).update(message).digest('hex'));
 return params.toString();
}

async function request(api, address, body, headers = {}) {
 const url = new URL(address,'http://localhost');
 const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
 req.headers = headers;
 req.method = body === undefined ? 'GET' : 'POST';
 const result = {};
 await api.handle(req,{
  writeHead(status) {result.status = status;},
  end(payload) {result.body = JSON.parse(payload);},
 },url.pathname,url.searchParams);
 return result;
}

test('publishes a gift only after verified Telegram payment, with idempotency and anonymous display', async t => {
 const calls = [];
 const api = createGiftsApi({
  botToken, webhookSecret, databasePath:':memory:', databaseUrl:'',
  botApi(method,data) {
   calls.push({method,data});
   return 'https://t.me/\u0024gift_invoice';
  },
 });
 t.after(() => api.close());
 const update = body => request(api,webhook,body,{'x-telegram-bot-api-secret-token':webhookSecret});
 const wall = async () => (await request(api,'/api/gifts')).body;
 const status = (id,user = spender) => request(api,'/api/gifts/status',{id,initData:sign(user)});
 const invoice = (user, anonymous, wish) => request(api,'/api/gifts/invoice',{
  initData:sign(user),giftId:shawarma.id,anonymous,wish,price:1,sender:'Подмена',
 });
 const checkout = (id,queryId,fields = {}) => ({
  pre_checkout_query:{id:queryId,from:spender,invoice_payload:id,total_amount:shawarma.price,currency:'XTR',...fields},
 });
 const successful = (id,chargeId) => ({message:{
  from:spender,date:1700000000,successful_payment:{
   invoice_payload:id,total_amount:shawarma.price,currency:'XTR',telegram_payment_charge_id:chargeId,
  },
 }});
 const denied = await request(api,'/api/gifts/invoice',{initData:sign(spender).replace('nickname','fake'),giftId:shawarma.id});
 assert.equal(denied.status,401);
 assert.equal((await invoice(spender,true,'я'.repeat(maxGiftWishLength+1))).body.error,'invalid_gift_wish');
 assert.equal(calls.length,0);
 const wish = 'Хорошего дня!\nУдачи, Петрашка!';
 const created = await invoice(spender,true,`  ${wish}  `);
 assert.equal(created.status,200);
 const {id} = created.body;
 assert.deepEqual(calls[0].data.prices,[{label:shawarma.name,amount:shawarma.price}]);
 assert.equal(calls[0].data.currency,'XTR');
 assert.equal(calls[0].data.payload,id);
 assert.equal((await wall()).total,0);
 assert.equal((await request(api,webhook,checkout(id,'checkout-1'))).status,403);
 assert.equal((await update(checkout(id,'checkout-1',{total_amount:1}))).body.ok,false);
 assert.equal((await update(checkout(id,'checkout-1',{from:secondPlayer}))).body.ok,false);
 const reserved = await update(checkout(id,'checkout-1'));
 assert.deepEqual(reserved.body,{method:'answerPreCheckoutQuery',pre_checkout_query_id:'checkout-1',ok:true});
 assert.equal((await update(checkout(id,'checkout-1'))).body.ok,true);
 assert.equal((await update(checkout(id,'checkout-2'))).body.ok,false);
 assert.equal((await status(id)).body.status,'pending');
 assert.equal((await status(id,secondPlayer)).status,404);
 assert.equal((await wall()).total,0);
 const replies = await Promise.all([update(successful(id,'charge-1')),update(successful(id,'charge-1'))]);
 assert.deepEqual(replies.map(reply => reply.status),[200,200]);
 assert.equal((await status(id)).body.status,'paid');
 assert.deepEqual(await wall(),{gifts:[{
  id,name:shawarma.name,icon:shawarma.icon,price:shawarma.price,currency:'XTR',sender:'Аноним',receivedAt:1700000000000,wish,priceRank:1,
 }],page:1,pages:1,total:1,senders:1});
 const duplicate = (await invoice(spender,false)).body.id;
 await update(checkout(duplicate,'checkout-duplicate'));
 assert.equal((await update(successful(duplicate,'charge-1'))).status,503);
 assert.equal((await wall()).total,1);
 const visible = (await invoice(secondPlayer,false)).body.id;
 await update(checkout(visible,'checkout-2',{from:secondPlayer}));
 const secondPayment = successful(visible,'charge-2');
 secondPayment.message.from = secondPlayer;
 await update(secondPayment);
 assert.equal((await wall()).gifts[1].sender,'Зритель');
 const refund = successful(id,'charge-1').message.successful_payment;
 await update({message:{refunded_payment:refund}});
 assert.equal((await status(id)).body.status,'refunded');
 await update(successful(id,'charge-1'));
 assert.equal((await wall()).total,1);
 const catalog = (await request(api,'/api/gifts/catalog')).body.catalog;
 assert.equal(catalog.length,48);
 assert.equal(new Set(catalog.map(gift => gift.id)).size,catalog.length);
 assert.ok(catalog.every(gift => Number.isInteger(gift.price) && gift.price>=25 && gift.price<=5000));
 assert.ok(!catalog.some(gift => gift.id==='drone'));
 const expandedGift = catalog.find(gift => gift.id==='fireworks');
 const expandedInvoice = await request(api,'/api/gifts/invoice',{initData:sign(spender),giftId:expandedGift.id,price:1});
 assert.equal(expandedInvoice.status,200);
 assert.deepEqual(calls.at(-1).data.prices,[{label:expandedGift.name,amount:expandedGift.price}]);
});

async function checkRanking(open, t) {
 let store = await open();
 t.after(() => store?.close());
 const sender = {id:String(spender.id),displayName:'@nickname'};
 const start = 1700000000000;
 const paid = async (item,index,moment) => {
  const id = await store.create(item,sender,{now:start});
  assert.equal(await store.checkout(id,sender.id,item.price,'XTR','query-' + index,start + 10),true);
  assert.equal(await store.complete(id,sender.id,item.price,'XTR','charge-' + index,moment),true);
  return id;
 };
 assert.deepEqual(await store.page(1),{gifts:[],total:0,senders:0,page:1,pages:1});
 const ids = [];
 for (let index = 0; index < 16; index++) {
  ids.push(await paid(shawarma,index,start + (index < 2 ? 3 - index : index + 2)));
 }
 const expensive = await paid(crown,'highest',start + 100);
 await store.close();
 store = null;
 store = await open();
 const first = await store.page(1);
 const second = await store.page(2);
 assert.deepEqual(first.gifts.map(gift => gift.id),[expensive,ids[1],ids[0],...ids.slice(2,14)]);
 assert.equal(first.gifts[0].sender,'@nickname');
 assert.deepEqual(second.gifts.map(gift => gift.id),ids.slice(14));
 assert.equal(first.total,17);
 assert.equal(first.senders,1);
 assert.equal(first.pages,2);
 assert.deepEqual(await store.page(Number.MAX_SAFE_INTEGER),second);
}

test('sorts shared gifts across 15-item pages and persists them after reopening SQLite',async t => {
 const directory = await mkdtemp(join(tmpdir(),'petrashka-gifts-'));
 try {
  await checkRanking(() => createGiftStore(join(directory,'gifts.sqlite')),t);
 } finally {
  t.after(() => rm(directory,{recursive:true,force:true}));
 }
});

test('upgrades a SQLite gift database with already paid gifts',async t => {
 const directory = await mkdtemp(join(tmpdir(),'petrashka-gifts-'));
 t.after(() => rm(directory,{recursive:true,force:true}));
 const path = join(directory,'gifts.sqlite');
 const legacyGift={id:'burger',name:'Бургер',icon:'food',price:100,currency:'XTR'};
 const original = await createGiftStore(path);
 const id = await original.create(legacyGift,{id:'105',displayName:'Имя'});
 assert.ok(await original.checkout(id,'105',legacyGift.price,'XTR','legacy-checkout'));
 assert.ok(await original.complete(id,'105',legacyGift.price,'XTR','legacy-charge',1700000000000));
 await original.close();
 const legacy = new DatabaseSync(path);
 legacy.exec('ALTER TABLE gifts DROP COLUMN wish');
 legacy.close();

 const upgraded = await createGiftStore(path);
 try {
  const [gift] = (await upgraded.page(1)).gifts;
  assert.equal(gift.id,id);
  assert.equal(gift.wish,'');
  assert.equal(gift.name,legacyGift.name);
  assert.equal(gift.icon,legacyGift.icon);
  assert.equal(await upgraded.paymentStatus(id,'105'),'paid');
 } finally {
  await upgraded.close();
 }
});

test('admin gift moderation keeps payment data and manual positions across pages',async t=>{
 const api=createGiftsApi({botToken,webhookSecret,databasePath:':memory:',databaseUrl:'',botApi:()=> 'https://t.me/$test_invoice'});
 t.after(()=>api.close());
 const admin={handle:createAdminApi({botToken,admins:new Set(['105']),gifts:api})};
 const authorization={authorization:'Bearer '+issueGameSession('105',botToken),'content-type':'application/json'};
 const update=body=>request(api,webhook,body,{'x-telegram-bot-api-secret-token':webhookSecret});
 const page=async(number=1)=>(await request(api,`/api/gifts?page=${number}`)).body;
 const moderate=(giftId,command,headers=authorization)=>request(admin,'/api/admin/gifts',{giftId,...command},headers);
 let sequence=0;
 async function pay(item,anonymous=false){
  const invoice=await request(api,'/api/gifts/invoice',{giftId:item.id,anonymous,wish:'Изначальное пожелание',initData:sign(spender)});
  const id=invoice.body.id;
  const n=++sequence;
  const payment={invoice_payload:id,total_amount:item.price,currency:item.currency};
  const checkout=await update({pre_checkout_query:{...payment,from:spender,id:`checkout-${n}`}});
  assert.equal(checkout.body.ok,true);
  const successful={message:{from:spender,date:1700000000,successful_payment:{...payment,telegram_payment_charge_id:`charge-${n}`}}};
  assert.equal((await update(successful)).status,200);
  return {id,successful};
 }

 const top=await pay(crown);
 for(let i=0;i<15;i++)await pay(shawarma);
 const last=await pay(slipper,true);
 assert.equal((await page(2)).gifts[1].id,last.id);
 assert.equal((await moderate(last.id,{kind:'remove'},{authorization:'Bearer '+issueGameSession('106',botToken)})).status,403);
 assert.equal((await moderate(last.id,{kind:'edit',wish:'x'.repeat(maxGiftWishLength+1)})).status,400);
 assert.equal((await moderate(last.id,{kind:'edit',wish:'  Новое пожелание  ',anonymous:false})).status,200);
 assert.equal((await moderate(last.id,{kind:'move',position:1})).status,200);
 let wall=await page();
 assert.equal(wall.gifts[0].id,last.id);
 assert.equal(wall.gifts[0].wish,'Новое пожелание');
 assert.equal(wall.gifts[0].sender,'@nickname');
 assert.equal(wall.gifts[0].priceRank,null);
 assert.equal(wall.gifts[1].id,top.id);
 assert.equal(wall.gifts[1].priceRank,1);
 assert.ok(!Object.hasOwn(wall.gifts[0],'anonymous'));

 assert.equal((await moderate(last.id,{kind:'move',position:16})).status,200);
 const p2=(await request(admin,'/api/admin/gifts?page=2',undefined,authorization)).body;
 assert.equal(p2.gifts[0].id,last.id);
 assert.equal(p2.gifts[0].position,16);
 assert.equal(p2.gifts[0].manual,true);
 await moderate(wall.gifts[2].id,{kind:'move',position:1});
 const latest=await pay(crown);
 wall=await page();
 assert.equal(wall.gifts[1].id,top.id);
 assert.equal(wall.gifts[2].id,latest.id);
 assert.equal((await moderate(last.id,{kind:'reset'})).status,200);
 assert.equal((await page(2)).gifts.at(-1).id,last.id);
 assert.equal((await moderate(last.id,{kind:'remove'})).status,200);
 assert.equal((await update(last.successful)).status,200);
 const payment=(await request(api,'/api/gifts/status',{id:last.id,initData:sign(spender)})).body;
 assert.equal(payment.status,'paid');
 assert.equal((await page(2)).gifts.some(gift=>gift.id===last.id),false);
});

test('applies the same ranking in PostgreSQL', {skip:!process.env.GIFTS_TEST_DATABASE_URL},async t => {
 // Use an empty database dedicated to the test. The rows remain available for inspection.
 await checkRanking(() => createGiftStore(':memory:',process.env.GIFTS_TEST_DATABASE_URL),t);
});
