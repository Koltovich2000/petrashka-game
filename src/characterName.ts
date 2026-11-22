export const defaultCharacterName='Петрашка';
export const maxCharacterNameLength=24;

export function characterNameKey(name:string){
 return name.normalize('NFKC').replace(/\p{Default_Ignorable_Code_Point}/gu,'').toLowerCase()
  .replace(/\s+/gu,' ').trim().normalize('NFKC');
}

export function parseCharacterName(value:unknown){
 if(typeof value!=='string')return null;
 const name=value.trim().normalize('NFC');
 if(name.length>maxCharacterNameLength||/[\p{Cc}\p{Bidi_Control}]/u.test(name)||!characterNameKey(name))return null;
 return name;
}
