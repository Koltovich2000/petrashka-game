export const decorCatalog=[
 {id:'hallSpeaker',art:'speaker',name:'Музыкальная колонка',location:'hall',price:2200,level:3,x:.84,y:.78,width:16,bounds:[.68,.9,.67,.88],floor:true},
 {id:'roomPlant',art:'plant',name:'Растение в горшке',location:'room',price:850,level:2,x:.36,y:.73,width:14,bounds:[.31,.45,.69,.79],floor:true},
 {id:'roomRug',art:'rug',name:'Ковёр для комнаты',location:'room',price:1250,level:2,x:.52,y:.90,width:45,bounds:[.4,.62,.86,.92],floor:false},
 {id:'entryPrint',art:'picture',name:'Картина с городом',location:'hallway',price:550,level:2,x:.23,y:.39,width:17,bounds:[.14,.36,.33,.46],floor:false},
 {id:'entryShelf',art:'bookshelf',name:'Полка с книгами для прихожей',location:'hallway',price:1000,level:2,x:.22,y:.22,width:18,bounds:[.16,.27,.19,.25],floor:false},
 {id:'entryPlant',art:'plant',name:'Растение для прихожей',location:'hallway',price:850,level:2,x:.71,y:.62,width:13,bounds:[.65,.76,.58,.68],floor:true},
 {id:'entrySofa',art:'sofa',name:'Диван для прихожей',location:'hallway',price:2400,level:2,x:.19,y:.69,width:34,bounds:[.18,.27,.65,.76],floor:true},
 {id:'entryKitchen',art:'kitchen',name:'Кухонный гарнитур с холодильником',location:'hallway',price:3500,level:2,x:.56,y:.55,width:47,bounds:[.49,.6,.51,.58],floor:true},
 {id:'hallLamp',art:'lamp',name:'Торшер для зала',location:'hall',price:1150,level:2,x:.14,y:.61,width:13,bounds:[.11,.22,.52,.65],floor:true},
 {id:'hallSofa',art:'sofa',name:'Диван для зала',location:'hall',price:2600,level:2,x:.18,y:.71,width:33,bounds:[.17,.23,.69,.76],floor:true},
 {id:'hallBookcase',art:'bookshelf',name:'Стеллаж с книгами',location:'hall',price:1750,level:2,x:.85,y:.57,width:21,bounds:[.79,.88,.53,.62],floor:true},
 {id:'hallPlant',art:'plant',name:'Монстера для зала',location:'hall',price:950,level:2,x:.84,y:.42,width:16,bounds:[.77,.89,.38,.48],floor:false},
 {id:'hallCurtains',art:'curtains',name:'Шторы на окно в зале',location:'hall',price:1500,level:2,x:.50,y:.36,width:73,bounds:[.48,.52,.34,.38],floor:false},
 {id:'bathVanity',art:'vanity',name:'Тумба с раковиной и зеркалом',location:'bathroom',price:2100,level:2,x:.46,y:.56,width:30,bounds:[.43,.5,.53,.59],floor:false},
 {id:'bathShelf',art:'towels',name:'Полка с полотенцами',location:'bathroom',price:650,level:2,x:.21,y:.36,width:19,bounds:[.14,.31,.32,.43],floor:false},
 {id:'bathSconces',art:'sconces',name:'Парные бра для ванной',location:'bathroom',price:1100,level:2,x:.46,y:.36,width:39,bounds:[.43,.5,.32,.39],floor:false},
] as const;
export type DecorItem=typeof decorCatalog[number];
export type DecorArtName=DecorItem['art'];
