import {rubles} from './economy';
import {xpProgress} from './balance';
import {GameIcon} from './GameIcon';
import {PixelIcon} from './PixelIcon';
import {AvatarHeadArt} from './AvatarHeadArt';
import type {HairWetness} from './hair';

export function PlayerBar({name,level,xp,balance,wetness,onHelp,onTasks,taskReward}:{name:string;level:number;xp:number;balance:number;wetness:HairWetness;onHelp:()=>void;onTasks?:()=>void;taskReward?:boolean}){
 const {progress,required,max}=xpProgress(xp);
 return <header className="player-bar">
  <AvatarHeadArt className="player-portrait" wetness={wetness} aria-hidden="true"/>
  <div className="player-identity">
   <strong dir="auto" title={name}>{name}</strong>
   <div className="player-xp"><span>Ур. {level}</span><div className="xp-track">
    <progress aria-label="Опыт до следующего уровня" value={progress} max={required}/>
    <span>{max?'Макс. уровень':`${progress} / ${required} XP`}</span>
   </div></div>
  </div>
  <div className="player-wallet"><PixelIcon kind="money"/><strong>{rubles(balance)}</strong></div>
  {onTasks&&<button type="button" className="player-help player-tasks" aria-label={taskReward?'Ежедневные задания, есть награда':'Ежедневные задания'} onClick={onTasks}><GameIcon name="tasks"/>{taskReward&&<span className="task-reward-mark" aria-hidden="true">✓</span>}</button>}
  <button className="player-help" aria-label="Как играть" onClick={onHelp}>?</button>
 </header>;
}
