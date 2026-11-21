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
