import pg from 'pg';

function postgresParams(sql){
 let index=0;
 return sql.replace(/\?/g,()=>`$${++index}`);
}

// The App Platform container is disposable. All live sessions use the same database.
export async function openGiftsPostgres(connectionString) {
 const pool = new pg.Pool({connectionString,max:4,connectionTimeoutMillis:4000,statement_timeout:4000});
 pool.on('error', () => console.error('Gift database connection interrupted'));
 try {
  const client = await pool.connect();
  try {
   await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(641150388)');
   await client.query(`
    CREATE SEQUENCE IF NOT EXISTS petrashka_gift_order;
    CREATE TABLE IF NOT EXISTS petrashka_gifts (
     id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL,
     anonymous INTEGER NOT NULL CHECK(anonymous IN (0, 1)),
     gift_id TEXT NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL,
     price INTEGER NOT NULL CHECK(price > 0), currency TEXT NOT NULL CHECK(currency = 'XTR'),
     created_at BIGINT NOT NULL, paid_at BIGINT, paid_order BIGINT UNIQUE,
     status TEXT NOT NULL CHECK(status IN ('pending', 'checkout', 'paid', 'refunded')),
     checkout_id TEXT UNIQUE, charge_id TEXT UNIQUE
    );
    ALTER TABLE petrashka_gifts ADD COLUMN IF NOT EXISTS wish TEXT NOT NULL DEFAULT '';
    ALTER TABLE petrashka_gifts ADD COLUMN IF NOT EXISTS removed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE petrashka_gifts ADD COLUMN IF NOT EXISTS stand_position BIGINT;
    CREATE INDEX IF NOT EXISTS petrashka_gift_ranking
    ON petrashka_gifts(price DESC, paid_at ASC, paid_order ASC) WHERE status = 'paid';
   `);
   await client.query('COMMIT');
  } catch (error) {
   await client.query('ROLLBACK').catch(() => {});
   throw error;
  } finally {
   client.release();
  }
 } catch (error) {
  await pool.end();
  throw error;
 }
 return {
  prepare(sql) {
   const query = postgresParams(sql);
   return {
    async get(...args) {return (await pool.query(query,args)).rows[0];},
    async all(...args) {return (await pool.query(query,args)).rows;},
    async run(...args) {return {changes:(await pool.query(query,args)).rowCount};},
   };
  },
  async reorder(sql,...args){
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    await client.query('LOCK TABLE petrashka_gifts IN SHARE ROW EXCLUSIVE MODE');
    const result=await client.query(postgresParams(sql),args);
    await client.query('COMMIT');
    return {changes:result.rowCount};
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
  close() {return pool.end();},
 };
}
