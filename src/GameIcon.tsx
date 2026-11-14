import {PixelIcon} from './PixelIcon';

const shapes:Record<string,[string,string,string?]>={
 study:['M2 4H10L12 7L14 4H22V20H14L12 22L10 20H2Z','#c4a7f5','M12 7V21M5 9H9M15 9H19'],
 shop:['M3 8H21V22H3ZM7 8V5L9 2H15L17 5V8','#a5d477','M7 12V10M17 12V10'],
 courier:['M2 3H12V13H8L11 16H16L17 9H14V6H19L22 16V20H19L17 22H14L12 20H8L6 22H3L1 20V17L4 14H2Z','#f5a043','M3 8H10M11 17H20'],
 leaflets:['M5 2H15L21 8V22H5Z','#e3d5a8','M15 2V8H21M8 12H18M8 16H18'],
 loader:['M2 5H22V21H2Z','#d49555','M2 9H22M9 5V13H15V5'],
 seller:['M2 9H22V22H2ZM4 3H20L23 9H1Z','#d98b84','M7 11V21M13 13H20V17H13Z'],
 editor:['M2 3H22V16H2ZM2 17H22L24 22H0Z','#a2b5e1','M10 6L16 10 10 13Z'],
 blogger:['M3 6H18V19H3ZM18 10L23 7V18L18 15Z','#df7e8c','M8 9L13 12 8 15Z'],
 room:['M2 12 12 3 22 12 19 12 19 22 14 22 14 15 10 15 10 22 5 22 5 12Z','#ffbf58'],
 wardrobe:['M8 3H10L12 6 14 3H16L23 7 20 13 17 11 17 22H7V11L4 13 1 7Z','#ffd589'],
 work:['M2 8H7V3H17V8H22V22H2Z','#ffbf58','M2 13H22M10 13V16H14V13M9 8V5H15V8'],
 pet:['M7 13V5H9V11H10V2H12V11H13V3H15V11H16V6H18V14L20 11 22 13 18 21H8L3 15 4 12Z','#ffc276'],
 play:['M5 6H19L23 17 20 21 15 17H9L4 21 1 17Z','#a8b6df','M5 12H11M8 9V15M15 11H17M18 14H20'],
 wash:['M4 10V6L9 2H17V5H10L7 8 11 11 5 17 1 13Z','#96cfff','M13 13L11 17M17 15L15 19M21 17L19 21'],
 sleep:['M15 2H10L4 6 2 12 4 19 10 22H16L22 17H16L11 13 10 8Z','#f7cc72'],
 heal:['M8 2H16V8H22V16H16V22H8V16H2V8H8Z','#84e3aa'],
 pants:['M5 2H19L21 22H14L12 10 10 22H3Z','#b9c3e6'],
 shoes:['M2 15 7 11 10 5H14L16 12 22 15V21H2Z','#b9c3e6','M3 18H21'],
 hat:['M6 14V9L10 4H17L21 9V15H15L9 19H1V16Z','#c8c9ef'],
 accessory:['M2 8H10V16H2ZM14 8H22V16H14ZM10 10H14','#bfc9ef'],
};
export function GameIcon({name}:{name:string}){
 const icon=shapes[name];
 if(!icon)return <PixelIcon kind={name==='feed'?'food':name}/>;
 const [path,color,detail]=icon;
 return <svg className="game-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={path} fill={color} stroke="#15152b" strokeWidth="1.4"/>{detail&&<path d={detail} fill="none" stroke="#494060" strokeWidth="1.5"/>}</svg>;
}
