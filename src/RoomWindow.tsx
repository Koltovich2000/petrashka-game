import {useId} from 'react';

function WindowView(){
 const sky=useId();
 return <>
  <defs><linearGradient id={sky} x2="0" y2="1">
   <stop stopColor="var(--sky-top)"/><stop offset="1" stopColor="var(--sky-bottom)"/>
  </linearGradient></defs>
  <path d="M8 8H152V123H8Z" fill={`url(#${sky})`}/>
  <path className="window-sun" d="M100 15H113V18H118V23H121V35H118V40H113V43H100V40H95V35H92V23H95V18H100Z" fill="var(--sun-color)"/>
  <path className="window-moon" d="M107 14H115V17H119V21H121V31H117V35H110V32H104V28H101V22H104V18H107Z" fill="#fff0c7"/>
  <path className="window-stars" d="M33 19h2v2h-2zm24 19h2v2h-2zm28-22h2v2h-2zm40 28h2v2h-2zm14-22h2v2h-2zM22 44h2v2h-2z" fill="#efe6ff"/>
  <path className="window-clouds" d="M12 44H23V39H34V35H44V39H58V43H72V48H12ZM90 61H104V57H114V52H124V55H135V59H146V64H90Z" fill="var(--cloud-color)"/>
  <path d="M9 97H20V85H29V94H35V76H47V93H57V81H68V99H76V69H82V57H85V69H90V80H99V90H106V76H120V94H130V82H144V99H152V124H9Z" fill="var(--city-far)"/>
  <path d="M10 106H29V98H43V114H49V92H64V104H73V117H84V94H99V111H112V104H124V94H141V108H151V124H10Z" fill="var(--city-near)"/>
  <path className="window-stars" d="M53 99h2v3h-2zm6 7h2v3h-2zm31-6h2v3h-2zm8 12h2v3h-2zm32-12h2v3h-2zm5 8h2v3h-2zm-105-4h2v3h-2z" fill="#ffe08b"/>
 </>;
}

export function RoomWindow(){
 return <><svg className="bedroom-window" viewBox="0 0 160 132" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
  <WindowView/>
  <path d="M3 3H157V128H3ZM10 10V120H150V10Z" fill="#4c2b49" fillRule="evenodd" stroke="#22182f" strokeWidth="3"/>
  <path d="M9 9H151M11 12V120M150 12V119" fill="none" stroke="#efaf78" strokeWidth="2"/>
  <path d="M77 9H83V121H77Z M9 63H151V68H9Z" fill="#704358" stroke="#37213a" strokeWidth="1.3"/>
  <path d="M1 120H159V129H1Z" fill="#9f5a55" stroke="#26182d" strokeWidth="2"/>
  <path d="M2 121H158" stroke="#efae77" strokeWidth="2"/>
 </svg>
 <svg className="room-lamp-off" viewBox="0 0 640 585" preserveAspectRatio="none" aria-hidden="true">
  <path d="M541 164Q547 160 559 165Q580 171 593 186Q595 191 583 189Q559 185 542 169Z" fill="#57425d" stroke="#211b37" strokeWidth="1.5"/>
  <path d="M558 170Q569 171 574 180L565 181Q558 177 558 170Z" fill="#a8a1b0"/>
 </svg></>;
}

export function HallWindow(){
 const panes=useId();
 return <svg className="hall-window" viewBox="0 0 440 660" preserveAspectRatio="none" aria-hidden="true">
  <defs>
   <clipPath id={panes}>
    <path d="M88 40H166V77H88Z M176 40H266V77H176Z M276 40H351V77H276Z M88 86H166V234H88Z M176 86H266V234H176Z M276 86H351V234H276Z"/>
   </clipPath>
  </defs>
  <g clipPath={`url(#${panes})`}>
   <svg x="88" y="40" width="263" height="194" viewBox="9 10 142 110" preserveAspectRatio="none">
    <WindowView/>
   </svg>
  </g>
 </svg>;
}

export function CeilingLampOff(){
 return <svg className="ceiling-lamp-off" viewBox="0 0 592 887" preserveAspectRatio="none" aria-hidden="true">
  <g stroke="#302c42" strokeWidth="2">
   <path d="M290 18V10Q297 5 305 10V18" fill="#86767b"/>
   <path d="M240 35Q246 16 299 17Q349 18 358 35V65H240Z" fill="#796879"/>
   <path d="M242 35Q296 20 356 35L356 57Q298 43 242 57Z" fill="#aa9092"/>
   <path d="M258 30V53M281 26V50M307 26V50M333 30V53" fill="none" stroke="#c0adb1"/>
   <ellipse cx="299" cy="64" rx="59" ry="20" fill="#81727d"/>
   <ellipse cx="299" cy="64" rx="49" ry="13" fill="#c0bdcb"/>
   <ellipse cx="299" cy="64" rx="28" ry="8" fill="#dedce7" stroke="none"/>
  </g>
 </svg>;
}
