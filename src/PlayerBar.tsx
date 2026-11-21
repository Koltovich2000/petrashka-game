import {rubles} from './economy';
import {xpProgress} from './balance';
import {PixelIcon} from './PixelIcon';
import {AvatarHeadArt} from './AvatarHeadArt';
import type {HairWetness} from './hair';

export function PlayerBar({level,xp,balance,wetness,onHelp}:{level:number;xp:number;balance:number;wetness:HairWetness;onHelp:()=>void}){
 const {progress,required,max}=xpProgress(xp);
 return <header className="player-bar">
  <AvatarHeadArt className="player-portrait" wetness={wetness} aria-hidden="true"/>
  <div className="player-identity">
   <strong>Петрашка</strong>
   <div className="player-xp"><span>Ур. {level}</span><div className="xp-track">
    <progress aria-label="Опыт до следующего уровня" value={progress} max={required}/>
    <span>{max?'Макс. уровень':`${progress} / ${required} XP`}</span>
   </div></div>
  </div>
  <div className="player-wallet"><PixelIcon kind="money"/><strong>{rubles(balance)}</strong></div>
  <button className="player-help" aria-label="Как играть" onClick={onHelp}>?</button>
 </header>;
}
