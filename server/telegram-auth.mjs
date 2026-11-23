import {createHmac, timingSafeEqual} from 'node:crypto';

export function verifyTelegramProfile(raw, botToken, now = Math.floor(Date.now() / 1000)) {
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
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
  const username = typeof user.username === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(user.username) ? `@${user.username}` : '';
  const name = typeof user.first_name === 'string' ? user.first_name.trim().slice(0, 80) : '';
  return {id:String(user.id), displayName:username || name || 'Зритель',allowsWrite:user.allows_write_to_pm===true,authDate:issued};
 } catch {
  return null;
 }
}

export function verifyTelegramInitData(raw, botToken, now) {
 const profile = verifyTelegramProfile(raw, botToken, now);
 return profile ? {id:profile.id} : null;
}
