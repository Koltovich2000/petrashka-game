import {TUTORIAL,xpProgress} from './balance';
import {advance, type Game} from './game';

export const beds = {
 standard: {name: 'Обычная кровать', energy: 16, price: 0, level: 1},
 comfort: {name: 'Удобная кровать', energy: 20, price: 15_000, level: 6},
 premium: {name: 'Премиальная кровать', energy: 25, price: 35_000, level: 10},
} as const;

type Bed = keyof typeof beds;
export type BedUpgrade = Exclude<Bed, 'standard'>;
const bedUpgrades = ['comfort', 'premium'] as const;
export const availableBeds = bedUpgrades;

export function bedReason(g: Game, bed: BedUpgrade): string {
 const item = beds[bed];
 if (g.health <= 0 || g.tutorial < TUTORIAL.done) return 'Доступно после вводных заданий';
 if (g.bed === bed || g.bed === 'premium') return 'Уже установлена эта кровать или лучше';
 if (xpProgress(g.economy.xp).level < item.level) return `Доступно с уровня ${item.level}`;
 if (g.economy.balance < item.price) return 'Не хватает денег';
 return '';
}

export function buyBed(game: Game, bed: BedUpgrade, now = Date.now()): Game {
 const g = advance(game, now);
 if (bedReason(g, bed)) return g;
 return {...g, bed, bedPurchasePrice:beds[bed].price, economy: {...g.economy, balance: g.economy.balance - beds[bed].price}};
}

export function parseBed(value: unknown): Bed {
 return value === 'comfort' || value === 'premium' ? value : 'standard';
}

export const businesses = {
 lemonade: {name: 'Лимонад', price: 5_000, profit: 100},
 coffee: {name: 'Кофейный киоск', price: 25_000, profit: 350},
 clothing: {name: 'Магазин одежды', price: 100_000, profit: 1100},
} as const;

export type Business = keyof typeof businesses;
export type Businesses = Partial<Record<Business, number>>;
export const businessKeys = Object.keys(businesses) as Business[];
export const businessLevel = 15;
export const businessHours = 8;
const hour = 3_600_000;

export function businessReason(g: Game, id: Business): string {
 if (Object.hasOwn(g.businesses, id)) return 'Уже открыт';
 if (g.health <= 0 || g.tutorial < TUTORIAL.done) return 'Доступно после вводных заданий';
 if (xpProgress(g.economy.xp).level < businessLevel) return `Доступно с уровня ${businessLevel}`;
 if (g.economy.balance < businesses[id].price) return 'Не хватает денег';
 return '';
}

export function openBusiness(game: Game, id: Business, now = Date.now()): Game {
 const g = advance(game, now);
 if (businessReason(g, id)) return g;
 return {
  ...g, businesses: {...g.businesses, [id]: g.updated},
  economy: {...g.economy, balance: g.economy.balance - businesses[id].price},
 };
}

export function businessIncome(g: Game, id: Business): number {
 const since = g.businesses[id];
 if (since === undefined) return 0;
 const hours = Math.min(businessHours, Math.max(0, g.updated - since) / hour);
 return Math.floor(hours * businesses[id].profit);
}

export function collectBusiness(game: Game, id: Business, now = Date.now()): Game {
 const g = advance(game, now);
 const income = businessIncome(g, id);
 if (income <= 0 || g.health <= 0) return g;
 const since = g.businesses[id]!;
 const capReached = g.updated - since >= businessHours * hour;
 // Keep fractions below one ruble until the next collection.
 const nextSince = capReached ? g.updated : since + income * hour / businesses[id].profit;
 return {
  ...g, businesses: {...g.businesses, [id]: nextSince},
  economy: {...g.economy, balance: g.economy.balance + income},
 };
}

export function parseBusinesses(value: unknown, updated: number): Businesses {
 const result: Businesses = {};
 if (!value || typeof value !== 'object') return result;
 for (const id of businessKeys) {
  const since = (value as Businesses)[id];
  if (typeof since === 'number' && Number.isFinite(since) && since >= 0 && since <= updated) result[id] = since;
 }
 return result;
}
