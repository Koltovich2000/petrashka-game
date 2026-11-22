export const statKeys=['health','food','mood','energy','hygiene'] as const;
export type PlayerStat=typeof statKeys[number];
export const adminLabels={
 health:'Здоровье',food:'Сытость',mood:'Настроение',energy:'Энергия',hygiene:'Гигиена',
 balance:'Баланс',xp:'Опыт',
} as const;
export type AdminField=keyof typeof adminLabels;
export type AdminValues=Partial<Record<AdminField,number>>;
export type PlayerSummary={id:string;name:string;lastSeen:number;level:number;balance:number};
export type PlayerDetails=PlayerSummary&{
 values:Record<AdminField,number>;introCompleted:boolean;hospitalized:boolean;
};
export type AdminGift={id:string;name:string;icon:string;price:number;sender:string;wish:string;anonymous:boolean;position:number;manual:boolean};
export type AdminJournalEntry={
 id:string;adminId:string;playerId:string;name:string;at:number;
 changes:Partial<Record<AdminField,{before:number;after:number}>>;
} & ({kind:'edit'}|{kind:'credit';amount:number}|{kind:'adjust';fields:PlayerStat[];delta:number;affected:number;total:number});
