import {createHmac, timingSafeEqual} from 'node:crypto';

export function verifyTelegramInitData(raw, botToken, now = Math.floor(Date.now() / 1000)) {
 if (typeof raw !== 'string' || !raw || !botToken) return null;
 const data = new URLSearchParams(raw);
 if (new Set(data.keys()).size !== [...data.keys()].length) return null;

 const hash = data.get('hash');
 if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
 data.delete('hash');
 data.sort();
 const check = [...data].map(([key, value]) => `${key}=${value}`).join('\n');
 const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
 const expected = createHmac('sha256', secret).update(check).digest();
 if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

 const date = data.get('auth_date');
 const issued = Number(date);
 if (!date || !/^\d+$/.test(date) || !Number.isSafeInteger(issued) || issued > now + 60 || now - issued > 3600) return null;
 try {
  const user = JSON.parse(data.get('user') ?? 'null');
  return user && Number.isSafeInteger(user.id) && user.id > 0 ? {id:String(user.id)} : null;
 } catch {
  return null;
 }
}
