import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openGiftsPostgres} from './gifts-postgres.mjs';

export const giftCatalog = Object.freeze([
 {id:'crown', name:'Корона', icon:'crown', price:5000},
 {id:'cup', name:'Кубок', icon:'cup', price:2500},
 {id:'console', name:'Приставка', icon:'play', price:1000},
 {id:'headphones', name:'Наушники', icon:'headphones', price:500},
 {id:'pizza', name:'Пицца', icon:'pizza', price:250},
 {id:'burger', name:'Бургер', icon:'food', price:100},
 {id:'duck', name:'Уточка', icon:'duck', price:75},
 {id:'heart', name:'Сердечко', icon:'health', price:50},
 {id:'mug', name:'Кружка', icon:'mug', price:25},
].map(item => Object.freeze({...item, currency:'XTR'})));

const pageSize = 15;
const invoiceLifetime = 60 * 60 * 1000;

function openSqlite(path) {
 if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true});
 const db = new DatabaseSync(path);
 db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS gifts (
   id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL,
   anonymous INTEGER NOT NULL CHECK(anonymous IN (0, 1)),
   gift_id TEXT NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL,
   price INTEGER NOT NULL CHECK(price > 0), currency TEXT NOT NULL CHECK(currency = 'XTR'),
   created_at INTEGER NOT NULL, paid_at INTEGER, paid_order INTEGER UNIQUE,
   status TEXT NOT NULL CHECK(status IN ('pending', 'checkout', 'paid', 'refunded')),
   checkout_id TEXT UNIQUE, charge_id TEXT UNIQUE
  );
  CREATE INDEX IF NOT EXISTS gift_ranking ON gifts(price DESC, paid_at ASC, paid_order ASC) WHERE status = 'paid';
 `);
 return db;
}

export async function createGiftStore(path, databaseUrl) {
 const db = databaseUrl ? await openGiftsPostgres(databaseUrl) : openSqlite(path);
 const table = databaseUrl ? 'petrashka_gifts' : 'gifts';
 const order = databaseUrl ? "nextval('petrashka_gift_order')" : '(SELECT COALESCE(MAX(paid_order), 0) + 1 FROM gifts)';
 const insert = db.prepare(`
  INSERT INTO ${table}(id, sender_id, sender_name, anonymous, gift_id, name, icon, price, currency, created_at, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
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
 const list = db.prepare(`
  WITH totals AS (
   SELECT CAST(COUNT(*) AS INTEGER) AS total, CAST(COUNT(DISTINCT sender_id) AS INTEGER) AS senders
   FROM ${table} WHERE status = 'paid'
  ), page_info AS (
   SELECT total, senders, MAX_PAGES AS pages FROM totals
  ), selected_page AS (
   SELECT total, senders, pages, MIN_PAGE AS page FROM page_info
  ), page_gifts AS (
   SELECT id, name, icon, price, currency, paid_at, paid_order,
    CASE WHEN anonymous = 1 THEN 'Аноним' ELSE sender_name END AS sender
   FROM ${table} WHERE status = 'paid' ORDER BY price DESC, paid_at ASC, paid_order ASC
   LIMIT ${pageSize} OFFSET ((SELECT page FROM selected_page) - 1) * ${pageSize}
  )
  SELECT * FROM selected_page LEFT JOIN page_gifts ON TRUE
  ORDER BY price DESC, paid_at ASC, paid_order ASC
 `.replace('MAX_PAGES', (databaseUrl ? 'GREATEST' : 'MAX') + `(1, (total + ${pageSize - 1}) / ${pageSize})`)
  .replace('MIN_PAGE', (databaseUrl ? 'LEAST' : 'MIN') + '(CAST(? AS BIGINT), pages)'));
 const matches = (row, payer, price, currency) => row?.sender_id === payer && row.price === price && row.currency === currency;

 return {
  async create(item, sender, anonymous, now = Date.now()) {
   const id = 'gift:' + randomUUID();
   await insert.run(id, sender.id, sender.displayName, anonymous ? 1 : 0, item.id, item.name, item.icon, item.price, item.currency, now);
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
  async page(requested) {
   const rows = await list.all(requested);
   const {total, senders, page, pages} = rows[0];
   const gifts = rows.filter(row => row.id).map(({id,name,icon,price,currency,sender,paid_at}) => ({
    id,name,icon,price,currency,sender,receivedAt:Number(paid_at),
   }));
   return {gifts,total,senders,page:Number(page),pages:Number(pages)};
  },
  close() {return db.close();},
 };
}
