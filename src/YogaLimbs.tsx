import type {YogaPose} from './yoga';

export function YogaLegs({pose,pants,shoe}:{pose:YogaPose;pants:string;shoe:string}){
 if(pose==='tree')return <>
  <path d="M48 71H61L69 74L71 80L65 86L56 89L52 82L60 77L48 81Z" fill={pants}/>
  <path d="M55 82L60 87L54 94L49 91L48 87Z" fill={shoe}/>
  <path d="M50 88L54 91" stroke="#f9eddd"/>
  <path d="M37 71H51V95H37Z" fill={pants}/>
  <path d="M36 92H51V101H31V97Z" fill={shoe}/>
  <path d="M33 99H49M38 94H46" stroke="#f9eddd"/>
 </>;
 if(pose==='warrior')return <>
  <path d="M39 69L55 74L50 83L25 96L15 93L17 86Z" fill={pants}/>
  <path d="M49 71L63 68H74L81 74V95H67V83H52Z" fill={pants}/>
  <path d="M16 91H28V101H7V97H12Z M66 93H81L90 98V101H66Z" fill={shoe}/>
  <path d="M9 99H26M68 99H88M17 94H24M71 94H79" stroke="#f9eddd"/>
 </>;
 return <>
  <path d="M34 76Q49 74 54 82L58 90Q56 96 47 96H25L21 91L27 85Z" fill={pants}/>
  <path d="M25 79Q39 77 47 86Q54 89 53 94Q51 99 43 100H21Q17 98 19 91Z" fill={pants}/>
  <path d="M19 91H26L31 96L28 100H12L10 97L14 93Z" fill={shoe}/>
  <path d="M12 98H28M16 94H22" stroke="#f9eddd"/>
  <path d="M27 86Q38 86 44 92L37 95H31" fill="none" stroke="#ffffff35"/>
 </>;
}

export function YogaArms({pose,top}:{pose:YogaPose;top:string}){
 const skin='#ffc08c';
 if(pose==='child')return <g className="yoga-reaching-arms">
  <path d="M54 81Q59 79 65 84L77 90L90 92L95 95L93 98L80 97L68 93L57 90Z" fill={skin}/>
  <path d="M53 86L59 86L72 94L87 96L91 99L88 101H70L63 98L49 91Z" fill={skin}/>
  <path d="M44 80L50 77Q55 78 59 83L53 92L47 90L43 85Z" fill={top}/>
  <path d="M70 96L82 98M79 92L88 94" fill="none" stroke="#ffdfae" strokeWidth="1"/>
 </g>;
 if(pose==='warrior')return <g className="yoga-reaching-arms">
  <path d="M24 51L5 49L2 52L5 56L24 59H38V51Z M76 51L95 49L98 52L95 56L76 59H62V51Z" fill={skin}/>
  <path d="M25 48H39V62H25Z M61 48H75V62H61Z" fill={top}/>
  <path d="M7 52H21M79 52H93" stroke="#ffdfae"/>
 </g>;
 const uplift=<>
  <path d="M32 51L26 42L24 30L27 18L34 6L43 -2L45 -10L49 -14L50 -11V-3L46 5L39 13L34 26L35 38L42 48Z" fill={skin}/>
  <path d="M27 42L36 39L44 48L39 58L32 55Z" fill={top}/>
  <path d="M28 30L31 20L37 11" fill="none" stroke="#ffdfae"/>
 </>;
 return <><g transform="translate(100 0) scale(-1 1)">{uplift}</g>{uplift}</>;
}
