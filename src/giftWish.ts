export const maxGiftWishLength = 200;

export function parseGiftWish(input:unknown):string|null {
 if(typeof input!=='string')return null;
 const wish=input.trim();
 return wish.length<=maxGiftWishLength&&!wish.includes('\0')?wish:null;
}
