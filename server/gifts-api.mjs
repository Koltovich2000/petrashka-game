import {timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {verifyTelegramProfile} from './telegram-auth.mjs';
import {createGiftStore, giftCatalog} from './gifts-store.mjs';
import {parseGiftWish} from '../src/giftWish.ts';
import {isHospitalInvoice} from './hospital-payments.mjs';

const giftPrefix = 'gift:';
const maxBody = 32_768;

async function readJson(req) {
 let length = 0;
 const chunks = [];
 for await (const chunk of req.iterator({destroyOnReturn:false})) {
  length += chunk.length;
  if (length > maxBody) {
   req.resume();
   throw Object.assign(new Error('Request too large'), {status:413, code:'body_too_large'});
  }
  chunks.push(chunk);
 }
 try {
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 } catch {
  throw Object.assign(new Error('Invalid JSON'), {status:400, code:'invalid_json'});
 }
}

function checkSecret(actual, expected) {
 if (typeof actual !== 'string') return false;
 const a = Buffer.from(actual);
 const b = Buffer.from(expected);
 return a.length === b.length && timingSafeEqual(a, b);
}

function reply(res, status, data) {
 res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}

function createBotApi(botToken) {
 return async (method, parameters) => {
  const response = await fetch('https://api.telegram.org/bot' + botToken + '/' + method, {
   method:'POST', headers:{'Content-Type':'application/json'},
   body:JSON.stringify(parameters), signal:AbortSignal.timeout(7000),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) {
   const error = new Error('Telegram Bot API failed: ' + method);
   if (method === 'refundStarPayment' && typeof data.description === 'string') {
    error.alreadyRefunded = /charge_already_refunded|already (?:been )?refunded/i.test(data.description);
   }
   throw error;
  }
  return data.result;
 };
}

export function createGiftsApi({
 botToken = process.env.TELEGRAM_BOT_TOKEN,
 webhookSecret = process.env.TELEGRAM_GIFTS_WEBHOOK_SECRET ?? '',
 support = process.env.TELEGRAM_PAYMENT_SUPPORT,
 databaseUrl = process.env.GIFTS_DATABASE_URL,
 databasePath = process.env.GIFTS_DB_PATH,
 botApi = createBotApi(botToken),
 hospital,
 notifications,
} = {}) {
 const webhookEnabled = Boolean(botToken && /^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret));
 const paymentsEnabled = Boolean(webhookEnabled && (databaseUrl || databasePath));
 const hospitalPaymentsEnabled = Boolean(webhookEnabled && hospital);
 let db;
 const store = () => db ??= createGiftStore(databasePath || resolve('data/gifts.sqlite'),databaseUrl).catch(error => {
  db = undefined;
  throw error;
 });

 async function telegramUpdate(update) {
  if(notifications)await notifications.telegramUpdate(update);
  const checkout = update?.pre_checkout_query;
  if (hospitalPaymentsEnabled && isHospitalInvoice(checkout?.invoice_payload)) {
   const valid = await hospital.checkout(checkout);
   return valid ? {method:'answerPreCheckoutQuery', pre_checkout_query_id:checkout.id, ok:true}
    : {method:'answerPreCheckoutQuery', pre_checkout_query_id:checkout.id, ok:false, error_message:'Счёт за выписку недействителен. Откройте больницу в игре и проверьте состояние оплаты.'};
  }
  if (paymentsEnabled && typeof checkout?.invoice_payload === 'string' && checkout.invoice_payload.startsWith(giftPrefix)) {
   const valid = await (await store()).checkout(checkout.invoice_payload, String(checkout.from?.id), checkout.total_amount, checkout.currency, checkout.id);
   // Returning a Bot API call from the webhook answers within Telegram's deadline.
   return valid ? {method:'answerPreCheckoutQuery', pre_checkout_query_id:checkout.id, ok:true}
    : {method:'answerPreCheckoutQuery', pre_checkout_query_id:checkout.id, ok:false, error_message:'Счёт недействителен. Откройте «Подарки» и оформите новый.'};
  }
  const message = update?.message;
  const payment = message?.successful_payment;
  if (hospitalPaymentsEnabled && isHospitalInvoice(payment?.invoice_payload)) {
   const sender = message.from?.id;
   if (await hospital.complete(payment,sender) === 'refund') {
    try {
     const refunded = await botApi('refundStarPayment',{user_id:Number(sender),telegram_payment_charge_id:payment.telegram_payment_charge_id});
     if (refunded !== true) throw new Error('Telegram did not confirm the refund');
    } catch (error) {
     if (!error.alreadyRefunded) throw error;
    }
    await hospital.recordRefund(payment,sender);
   }
  }
  if (paymentsEnabled && typeof payment?.invoice_payload === 'string' && payment.invoice_payload.startsWith(giftPrefix)) {
   const date = Number.isSafeInteger(message.date) && message.date > 0 ? message.date * 1000 : Date.now();
   if (!await (await store()).complete(payment.invoice_payload, String(message.from?.id), payment.total_amount, payment.currency, payment.telegram_payment_charge_id, date)) {
    // Keep the update retryable and log neither the profile nor the charge.
    throw new Error('Could not reconcile a successful gift payment');
   }
  }
  const refund = message?.refunded_payment;
  if (hospitalPaymentsEnabled && isHospitalInvoice(refund?.invoice_payload)) {
   await hospital.recordRefund(refund,message.chat?.type==='private'?message.chat.id:message.from?.id);
  }
  if (paymentsEnabled && typeof refund?.invoice_payload === 'string' && refund.invoice_payload.startsWith(giftPrefix)) {
   await (await store()).refund(refund.invoice_payload, refund.total_amount, refund.currency, refund.telegram_payment_charge_id);
  }
  if (message?.chat?.type === 'private' && /^\/paysupport(?:@\w+)?(?:\s|$)/.test(message.text ?? '')) {
   const instructions = support ? 'Поддержка по оплате в игре: ' + support
    : 'Для помощи с оплатой обратитесь к владельцу игры и укажите дату и сумму платежа.';
   return {method:'sendMessage', chat_id:message.chat.id, text:instructions};
  }
  return {ok:true};
 }

 async function route(req, res, path, params) {
  if (path === '/api/telegram/gifts-webhook') {
   if (req.method !== 'POST') return reply(res,405,{error:'method_not_allowed'});
   if (!webhookEnabled || !checkSecret(req.headers['x-telegram-bot-api-secret-token'], webhookSecret)) return reply(res,403,{error:'forbidden'});
   return reply(res,200,await telegramUpdate(await readJson(req)));
  }
  if (path === '/api/gifts' && req.method === 'GET') {
   const raw = Number(params.get('page'));
   const page = Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
   return reply(res,200,await (await store()).page(page));
  }
  if (path === '/api/gifts/catalog' && req.method === 'GET') {
   return reply(res,200,{catalog:giftCatalog,paymentsEnabled});
  }
  if ((path === '/api/gifts/invoice' || path === '/api/gifts/status') && req.method === 'POST') {
   if (!paymentsEnabled) return reply(res,503,{error:'payments_unavailable'});
   const body = await readJson(req);
   const sender = verifyTelegramProfile(body?.initData, botToken);
   if (!sender) return reply(res,401,{error:'telegram_auth_required'});
   if (path === '/api/gifts/status') {
    const status = typeof body.id === 'string' ? await (await store()).paymentStatus(body.id, sender.id) : null;
    return status ? reply(res,200,{status}) : reply(res,404,{error:'gift_not_found'});
   }
   const item = giftCatalog.find(gift => gift.id === body.giftId);
   if (!item) return reply(res,400,{error:'unknown_gift'});
   const wish = body.wish === undefined ? '' : parseGiftWish(body.wish);
   if (wish === null) {
    return reply(res,400,{error:'invalid_gift_wish'});
   }
   const id = await (await store()).create(item,sender,{anonymous:body.anonymous === true,wish});
   const url = await botApi('createInvoiceLink',{
    title:item.name, description:'Подарок на общий стенд игры «Тамагочи Петрашка»',
    payload:id, currency:item.currency, provider_token:'',
    prices:[{label:item.name,amount:item.price}],
   });
   if (typeof url !== 'string' || !url.startsWith('https://t.me/')) throw new Error('Invalid gift invoice link');
   return reply(res,200,{id,url});
  }
  return reply(res,405,{error:'method_not_allowed'});
 }

 return {
  async adminPage(page){return (await store()).page(page,true);},
  async moderate(id,command){return (await store()).moderate(id,command);},
  handle(req,res,path,params) {
   if (!['/api/gifts','/api/gifts/catalog','/api/gifts/invoice','/api/gifts/status','/api/telegram/gifts-webhook'].includes(path)) return false;
   return route(req,res,path,params).catch(error => {
    if (!error.status) console.error('Gift API request failed:',path,error.code ?? error.name);
    if (res.destroyed || res.headersSent) return;
    reply(res,error.status ?? 503,{error:error.code ?? 'gifts_unavailable'});
   });
  },
  async close() {if (db) await (await db).close();},
 };
}
