export const BALANCE={tick:600_000,offlineCap:43_200_000,exhaustionGrace:7_200_000,damagePerHour:2,freeFoodCooldown:3_600_000,maxLevel:20};
export const TUTORIAL={sandwich:0,noodles:1,bath:2,sleep:3,done:4,noodlePrice:100} as const;
export const tutorialRewards=[{xp:45,money:250},{xp:15,money:0},{xp:15,money:0},{xp:25,money:100}] as const;
export const FOOD=[
 {id:'bread',name:'Хлеб',description:'Самый дешёвый способ утолить голод',icon:'🍞',price:30,food:10,mood:0,health:0},
 {id:'noodles',name:'Доширак',description:'Бюджетная еда на каждый день',icon:'🍜',price:80,food:25,mood:0,health:0},
 {id:'burger',name:'Бургер',description:'Сытно и немного поднимает настроение',icon:'🍔',price:150,food:40,mood:3,health:0},
 {id:'lunch',name:'Комплексный обед',description:'Полноценное питание с бонусом к здоровью',icon:'🍲',price:250,food:60,mood:0,health:2},
 {id:'restaurant',name:'Стейк',description:'Дорогое удовольствие с сильным бонусом к настроению',icon:'🍽️',price:700,food:80,mood:12,health:0},
 {id:'free',name:'Помощь: бутерброд',description:'Бесплатная помощь',icon:'🥪',price:0,food:25,mood:0,health:0},
] as const;
export type FoodId=typeof FOOD[number]['id'];
export function levelRequirement(level:number){return 100+25*(level-1)+3*(level-1)**2;}
export function xpProgress(xp:number){let level=1,progress=xp;while(level<BALANCE.maxLevel&&progress>=levelRequirement(level)){progress-=levelRequirement(level);level++;}return {level,progress:level===BALANCE.maxLevel?0:progress,required:levelRequirement(level),max:level===BALANCE.maxLevel};}
export function legacyXP(xp:number){const level=Math.floor(xp/100)+1;let total=0;for(let l=1;l<Math.min(level,BALANCE.maxLevel);l++)total+=levelRequirement(l);return total+xp%100;}
