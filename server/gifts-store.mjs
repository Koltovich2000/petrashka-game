import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openGiftsPostgres} from './gifts-postgres.mjs';

export const giftCatalog = Object.freeze([
 {id:'hype-crown', name:'Корона хайпа', icon:'hype-crown', price:5000},
 {id:'cash-case', name:'Чемодан денег', icon:'cash-case', price:2500},
 {id:'gold-toilet', name:'Золотой унитаз', icon:'gold-toilet', price:1000},
 {id:'diamond-mic', name:'Алмазный микрофон', icon:'diamond-mic', price:500},
 {id:'cash-launcher', name:'Денежная пушка', icon:'cash-launcher', price:250},
 {id:'shawarma', name:'Шаурма XXL', icon:'shawarma', price:100},
 {id:'gold-duck', name:'Золотая уточка', icon:'gold-duck', price:75},
 {id:'stinky-sock', name:'Вонючий носок', icon:'stinky-sock', price:50},
 {id:'mom-slipper', name:'Тапок мамы', icon:'mom-slipper', price:25},
 {id:'dog', name:'Собака', icon:'dog', price:805},
 {id:'heart', name:'Сердечко', icon:'heart', price:100},
 {id:'energy-drink', name:'Энергетик', icon:'energy-drink', price:60},
 {id:'burger', name:'Бургер', icon:'burger', price:135},
 {id:'gamepad', name:'Геймпад', icon:'gamepad', price:310},
 {id:'dumbbells', name:'Гантели', icon:'dumbbells', price:705},
 {id:'video-editing', name:'Монтаж', icon:'video-editing', price:500},
 {id:'filming', name:'Съёмки', icon:'filming', price:555},
 {id:'headphones', name:'Наушники', icon:'headphones', price:685},
 {id:'pizza', name:'Пицца', icon:'pizza', price:90},
 {id:'travel', name:'Путешествие', icon:'travel', price:2080},
 {id:'surprise', name:'Сюрприз', icon:'surprise', price:635},
 {id:'bali', name:'Отпуск на Бали', icon:'bali', price:2050},
 {id:'gelik', name:'Гелик', icon:'gelik', price:3700},
 {id:'skydiving', name:'Прыжок с парашютом', icon:'skydiving', price:1580},
 {id:'million-subscribers', name:'Миллион подписчиков', icon:'million-subscribers', price:4475},
 {id:'phone', name:'Айфон', icon:'phone', price:1930},
 {id:'laptop', name:'Ноутбук', icon:'laptop', price:1115},
 {id:'roller-skates', name:'Ролики', icon:'roller-skates', price:700},
 {id:'jump-rope', name:'Скакалка', icon:'jump-rope', price:95},
 {id:'cake', name:'Торт', icon:'cake', price:695},
 {id:'ring', name:'Кольцо', icon:'ring', price:1885},
 {id:'cocktail', name:'Коктейль', icon:'cocktail', price:145},
 {id:'noodles', name:'Лапша', icon:'noodles', price:125},
 {id:'concert-ticket', name:'Билет на концерт', icon:'concert-ticket', price:705},
 {id:'selfie-stick', name:'Селфи-палка', icon:'selfie-stick', price:870},
 {id:'camera', name:'Камера', icon:'camera', price:1905},
 {id:'supercar', name:'Суперкар', icon:'supercar', price:3090},
 {id:'brilliant', name:'Бриллиант', icon:'brilliant', price:3905},
 {id:'crypto', name:'Крипта', icon:'crypto', price:1055},
 {id:'island', name:'Остров', icon:'island', price:3150},
 {id:'cat', name:'Котик', icon:'cat', price:270},
 {id:'panda', name:'Панда', icon:'panda', price:630},
 {id:'fireworks', name:'Фейерверк', icon:'fireworks', price:1890},
 {id:'playlist', name:'Плейлист', icon:'playlist', price:65},
 {id:'challenge-box', name:'Челлендж-бокс', icon:'challenge-box', price:730},
 {id:'vip-pass', name:'VIP-пропуск', icon:'vip-pass', price:3915},
 {id:'trophy', name:'Кубок', icon:'trophy', price:1475},
 {id:'rubber-chicken', name:'Резиновая курица', icon:'rubber-chicken', price:50},
].sort((a,b) => b.price-a.price).map(item => Object.freeze({...item, currency:'XTR'})));

const pageSize = 15;
const invoiceLifetime = 60 * 60 * 1000;

function openSqlite(path) {
 if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true});
 const db = new DatabaseSync(path);
 try {
  db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  BEGIN IMMEDIATE;
  CREATE TABLE IF NOT EXISTS gifts (
   id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL,
   anonymous INTEGER NOT NULL CHECK(anonymous IN (0, 1)),
   wish TEXT NOT NULL DEFAULT '',
   removed INTEGER NOT NULL DEFAULT 0, stand_position BIGINT,
   gift_id TEXT NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL,
   price INTEGER NOT NULL CHECK(price > 0), currency TEXT NOT NULL CHECK(currency = 'XTR'),
   created_at INTEGER NOT NULL, paid_at INTEGER, paid_order INTEGER UNIQUE,
   status TEXT NOT NULL CHECK(status IN ('pending', 'checkout', 'paid', 'refunded')),
   checkout_id TEXT UNIQUE, charge_id TEXT UNIQUE
  );
  CREATE INDEX IF NOT EXISTS gift_ranking ON gifts(price DESC, paid_at ASC, paid_order ASC) WHERE status = 'paid';
  `);
  const columns = db.prepare('PRAGMA table_info(gifts)').all();
  for (const [column,definition] of Object.entries({wish:"TEXT NOT NULL DEFAULT ''",removed:'INTEGER NOT NULL DEFAULT 0',stand_position:'BIGINT'})) {
   if (!columns.some(field => field.name === column)) db.exec(`ALTER TABLE gifts ADD COLUMN ${column} ${definition}`);
  }
  db.exec('COMMIT');
  return db;
 } catch (error) {
  db.close();
  throw error;
 }
}

export async function createGiftStore(path, databaseUrl) {
 const db = databaseUrl ? await openGiftsPostgres(databaseUrl) : openSqlite(path);
 const table = databaseUrl ? 'petrashka_gifts' : 'gifts';
 const order = databaseUrl ? "nextval('petrashka_gift_order')" : '(SELECT COALESCE(MAX(paid_order), 0) + 1 FROM gifts)';
 const insert = db.prepare(`
  INSERT INTO ${table}(id, sender_id, sender_name, anonymous, gift_id, name, icon, price, currency, created_at, wish, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
 `);
 const lookup = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
 const reserve = db.prepare(`
  UPDATE ${table} SET status = 'checkout', checkout_id = ?
  WHERE id = ? AND status = 'pending' AND sender_id = ? AND price = ? AND currency = ?
    AND created_at > ?
 `);
 const pay = db.prepare(`
  UPDATE ${table} SET status = 'paid', charge_id = ?, paid_at = ?,
    paid_order = ${order}
  WHERE id = ? AND status = 'checkout' AND sender_id = ? AND price = ? AND currency = ?
 `);
 const refund = db.prepare(`
  UPDATE ${table} SET status = 'refunded', charge_id = ?
  WHERE id = ? AND price = ? AND currency = ?
    AND (status = 'checkout' OR (status = 'paid' AND charge_id = ?))
 `);
 const visible = "status = 'paid' AND removed = 0";
 const byPrice = 'price DESC, paid_at ASC, paid_order ASC';
 const byStand = 'sort_slot, stand_position, paid_order';
 const rank = `
  ranked AS (
   SELECT id, name, icon, price, currency, paid_at, paid_order, wish, anonymous, stand_position,
    CASE WHEN anonymous = 1 THEN 'Аноним' ELSE sender_name END AS sender,
    ROW_NUMBER() OVER(ORDER BY ${byPrice}) AS price_rank,
    ROW_NUMBER() OVER(PARTITION BY (stand_position IS NULL) ORDER BY stand_position, ${byPrice}) AS group_position
   FROM ${table} WHERE ${visible}
  ), stand AS (
   SELECT *, CASE WHEN stand_position IS NULL THEN group_position * 2
                 ELSE (stand_position - group_position) * 2 + 1 END AS sort_slot FROM ranked
  )`;
 const list = db.prepare(`
  WITH totals AS (
   SELECT CAST(COUNT(*) AS INTEGER) AS total, CAST(COUNT(DISTINCT sender_id) AS INTEGER) AS senders
   FROM ${table} WHERE ${visible}
  ), page_info AS (
   SELECT total, senders, MAX_PAGES AS pages FROM totals
  ), selected_page AS (
   SELECT total, senders, pages, MIN_PAGE AS page FROM page_info
  ), ${rank}, page_gifts AS (
   SELECT * FROM stand ORDER BY ${byStand}
   LIMIT ${pageSize} OFFSET ((SELECT page FROM selected_page) - 1) * ${pageSize}
  )
  SELECT * FROM selected_page LEFT JOIN page_gifts ON TRUE
  ORDER BY ${byStand}
 `.replace('MAX_PAGES', (databaseUrl ? 'GREATEST' : 'MAX') + `(1, (total + ${pageSize - 1}) / ${pageSize})`)
  .replace('MIN_PAGE', (databaseUrl ? 'LEAST' : 'MIN') + '(CAST(? AS BIGINT), pages)'));
 const edit = db.prepare(`UPDATE ${table} SET anonymous=COALESCE(?,anonymous),wish=COALESCE(?,wish) WHERE id=? AND ${visible}`);
 const remove = db.prepare(`UPDATE ${table} SET removed=1,stand_position=NULL WHERE id=? AND ${visible}`);
 const reset = db.prepare(`UPDATE ${table} SET stand_position=NULL WHERE id=? AND ${visible}`);
 // Pinned positions occupy slots. Unpinned gifts continue to fill the other slots by price.
 const moveSql = `WITH ${rank}, slots AS (
   SELECT id,stand_position,ROW_NUMBER() OVER(ORDER BY ${byStand}) AS slot FROM stand
  ), move AS (
   SELECT id,slot AS old_slot,${databaseUrl?'LEAST':'MIN'}(CAST(? AS BIGINT),(SELECT COUNT(*) FROM slots)) AS new_slot
   FROM slots WHERE id=?
  ), positions AS (
   SELECT slots.id, CASE
     WHEN slots.id=move.id THEN new_slot
     WHEN old_slot<slot AND slot<=new_slot THEN slot-1
     WHEN new_slot<=slot AND slot<old_slot THEN slot+1
     ELSE slot END AS position
   FROM slots CROSS JOIN move WHERE slots.id=move.id OR stand_position IS NOT NULL
  )
  UPDATE ${table} SET stand_position=(SELECT position FROM positions WHERE positions.id=${table}.id)
  WHERE id IN (SELECT id FROM positions)`;
 const move = databaseUrl ? (...args)=>db.reorder(moveSql,...args) : (...args)=>db.prepare(moveSql).run(...args);
 const matches = (row, payer, price, currency) => row?.sender_id === payer && row.price === price && row.currency === currency;

 return {
  async create(item, sender, {anonymous = false, wish = '', now = Date.now()} = {}) {
   const id = 'gift:' + randomUUID();
   await insert.run(id, sender.id, sender.displayName, anonymous ? 1 : 0, item.id, item.name, item.icon, item.price, item.currency, now, wish);
   return id;
  },
  async checkout(id, payer, price, currency, queryId, now = Date.now()) {
   if (typeof queryId !== 'string' || !queryId) return false;
   const row = await lookup.get(id);
   if (!matches(row, payer, price, currency)) return false;
   if (row.status === 'checkout') return row.checkout_id === queryId;
   const result = await reserve.run(queryId, id, payer, price, currency, now - invoiceLifetime);
   if (result.changes === 1) return true;
   const latest = await lookup.get(id);
   return latest?.status === 'checkout' && latest.checkout_id === queryId;
  },
  async complete(id, payer, price, currency, chargeId, receivedAt) {
   if (typeof chargeId !== 'string' || !chargeId) return false;
   const row = await lookup.get(id);
   if (!matches(row, payer, price, currency)) return false;
   if (row.status === 'paid' || row.status === 'refunded') return row.charge_id === chargeId;
   try {
    const result = await pay.run(chargeId, receivedAt, id, payer, price, currency);
    if (result.changes === 1) return true;
   } catch (error) {
    if (error.code !== '23505' && !/UNIQUE constraint failed/.test(error.message)) throw error;
   }
   const latest = await lookup.get(id);
   return latest?.charge_id === chargeId && (latest.status === 'paid' || latest.status === 'refunded');
  },
  async refund(id, price, currency, chargeId) {
   if (typeof chargeId !== 'string' || !chargeId) return;
   await refund.run(chargeId, id, price, currency, chargeId);
  },
  async paymentStatus(id, payer) {
   const row = await lookup.get(id);
   return row?.sender_id === payer ? (row.status === 'checkout' ? 'pending' : row.status) : null;
  },
  async moderate(id,command) {
   let result;
   switch(command.kind){
   case 'edit':result=await edit.run(command.anonymous===undefined?null:Number(command.anonymous),command.wish??null,id);break;
   case 'remove':result=await remove.run(id);break;
   case 'reset':result=await reset.run(id);break;
   case 'move':result=await move(command.position,id);break;
   }
   return Boolean(result?.changes);
  },
  async page(requested,admin=false) {
   const rows = await list.all(requested);
   const {total, senders, page, pages} = rows[0];
   const gifts = rows.filter(row => row.id).map(({id,name,icon,price,currency,sender,paid_at,wish,anonymous,stand_position,price_rank},index) => ({
    id,name,icon,price,currency,sender,receivedAt:Number(paid_at),wish,
    priceRank:Number(price_rank)<=3?Number(price_rank):null,
    ...(admin?{anonymous:anonymous===1,manual:stand_position!==null,position:(Number(page)-1)*pageSize+index+1}:{}),
   }));
   return {gifts,total,senders,page:Number(page),pages:Number(pages)};
  },
  close() {return db.close();},
 };
}
