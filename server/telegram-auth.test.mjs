import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyTelegramInitData} from './telegram-auth.mjs';

const token = 'test-bot-token';
const issued = 1700000000;
// Signed once with the Telegram HMAC algorithm. Includes escaped characters,
// a 52-bit user ID, and the optional signature field alongside the HMAC hash.
const signed = 'user=%7B%22id%22%3A4503599627370495%2C%22first_name%22%3A%22%D0%9F%D0%B5%D1%82%D1%80%D0%B0%D1%88%D0%BA%D0%B0+%26+Co%22%7D&hash=e3734aed0a841c7282e1ba475d35dba5705f63d59c66d7879919de535118fdd5&query_id=test%2Bquery&signature=test_signature&auth_date=1700000000';

test('accepts a valid Telegram payload and returns only the verified identity', () => {
 assert.deepEqual(verifyTelegramInitData(signed,token,issued),{id:'4503599627370495'});
});

test('rejects tampered data, a wrong bot token and duplicate fields', () => {
 assert.equal(verifyTelegramInitData(signed.replace('4503599627370495','4503599627370494'),token,issued),null);
 assert.equal(verifyTelegramInitData(signed,'different-token',issued),null);
 assert.equal(verifyTelegramInitData(signed+'&auth_date=1700000000',token,issued),null);
 assert.equal(verifyTelegramInitData(signed.replace(/&hash=[^&]+/,''),token,issued),null);
});

test('rejects expired initData and timestamps too far in the future', () => {
 assert.equal(verifyTelegramInitData(signed,token,issued+3601),null);
 assert.equal(verifyTelegramInitData(signed,token,issued-61),null);
});
