import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import test from 'node:test';
import {createGiftsApi} from './gifts-api.mjs';
import {createGiftStore, giftCatalog} from './gifts-store.mjs';

const botToken = 'gift-test-bot';
const webhookSecret = 'test_secret_123456789012345678901234567890';
const webhook = '/api/telegram/gifts-webhook';
const spender = {id:105, first_name:'Имя', username:'nickname'};
const secondPlayer = {id:106, first_name:'Зритель'};
const burger = giftCatalog.find(item => item.id === 'burger');
const crown = giftCatalog.find(item => item.id === 'crown');

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
 const invoice = (user, anonymous) => request(api,'/api/gifts/invoice',{
  initData:sign(user),giftId:burger.id,anonymous,price:1,sender:'Подмена',
 });
 const checkout = (id,queryId,fields = {}) => ({
  pre_checkout_query:{id:queryId,from:spender,invoice_payload:id,total_amount:burger.price,currency:'XTR',...fields},
 });
 const successful = (id,chargeId) => ({message:{
  from:spender,date:1700000000,successful_payment:{
   invoice_payload:id,total_amount:burger.price,currency:'XTR',telegram_payment_charge_id:chargeId,
  },
 }});
 const denied = await request(api,'/api/gifts/invoice',{initData:sign(spender).replace('nickname','fake'),giftId:burger.id});
 assert.equal(denied.status,401);
 assert.equal(calls.length,0);
 const created = await invoice(spender,true);
 assert.equal(created.status,200);
 const {id} = created.body;
 assert.deepEqual(calls[0].data.prices,[{label:burger.name,amount:burger.price}]);
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
  id,name:burger.name,icon:burger.icon,price:burger.price,currency:'XTR',sender:'Аноним',receivedAt:1700000000000,
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
});

async function checkRanking(open, t) {
 let store = await open();
 t.after(() => store?.close());
 const sender = {id:String(spender.id),displayName:'@nickname'};
 const start = 1700000000000;
 const paid = async (item,index,moment) => {
  const id = await store.create(item,sender,false,start);
  assert.equal(await store.checkout(id,sender.id,item.price,'XTR','query-' + index,start + 10),true);
  assert.equal(await store.complete(id,sender.id,item.price,'XTR','charge-' + index,moment),true);
  return id;
 };
 assert.deepEqual(await store.page(1),{gifts:[],total:0,senders:0,page:1,pages:1});
 const ids = [];
 for (let index = 0; index < 16; index++) {
  ids.push(await paid(burger,index,start + (index < 2 ? 3 - index : index + 2)));
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

test('applies the same ranking in PostgreSQL', {skip:!process.env.GIFTS_TEST_DATABASE_URL},async t => {
 // Use an empty database dedicated to the test. The rows remain available for inspection.
 await checkRanking(() => createGiftStore(':memory:',process.env.GIFTS_TEST_DATABASE_URL),t);
});
