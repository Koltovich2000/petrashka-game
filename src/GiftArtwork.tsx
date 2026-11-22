import type {CSSProperties} from 'react';
import {GameIcon} from './GameIcon';

const tiles:Record<string,[column:number,row:number]>={
 'hype-crown':[0,0],'cash-case':[1,0],'gold-toilet':[2,0],
 'diamond-mic':[0,1],'cash-launcher':[1,1],shawarma:[2,1],
 'gold-duck':[0,2],'stinky-sock':[1,2],'mom-slipper':[2,2],
};

// All art is in one atlas, with each window framing a single transparent icon.
const atlasSize=1254,cellWidth=384,cellHeight=350;
const left=[34,428,821],top=[56,435,790];

const extendedTiles=[
 'dog','heart','energy-drink','burger','gamepad','dumbbells','video-editing','filming',
 'headphones','pizza','travel','surprise','bali','gelik','skydiving','million-subscribers',
 'phone','laptop','roller-skates','jump-rope','cake','ring','cocktail','noodles',
 'concert-ticket','selfie-stick','camera','supercar','brilliant','crypto','island','cat',
 'panda','fireworks','playlist','challenge-box','vip-pass','trophy','rubber-chicken',
];
const extendedColumns=8,extendedRows=5;
export const premiumGiftPrice=2500;

export function GiftArtwork({icon,price=0}:{icon:string;price?:number}){
 const tile=Object.hasOwn(tiles,icon)?tiles[icon]:null;
 if(!tile){
  const index=extendedTiles.indexOf(icon);
  if(index===-1)return <GameIcon name={icon}/>;
  const column=index%extendedColumns,row=Math.floor(index/extendedColumns);
  const style:CSSProperties={
   backgroundSize:`${extendedColumns*100}% ${extendedRows*100}%`,
   backgroundPosition:`${column/(extendedColumns-1)*100}% ${row/(extendedRows-1)*100}%`,
  };
  return <span className="gift-art gift-art-extended" data-gift-art={icon} data-premium={price>=premiumGiftPrice||undefined} aria-hidden="true">
   <span className="gift-sprite" style={style}/>
  </span>;
 }
 const [column,row]=tile;
 const style={
  backgroundSize:`${atlasSize/cellWidth*100}% ${atlasSize/cellHeight*100}%`,
  backgroundPosition:`${left[column]/(atlasSize-cellWidth)*100}% ${top[row]/(atlasSize-cellHeight)*100}%`,
 } satisfies CSSProperties;
 return <span className="gift-art" data-gift-art={icon} aria-hidden="true">
  <span className="gift-sprite" style={style}/>
 </span>;
}
