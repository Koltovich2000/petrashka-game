import type {DecorArtName} from './decor';

const sizes:Record<DecorArtName,string>={
 speaker:'0 0 64 96',plant:'0 0 46 64',rug:'0 0 100 35',picture:'0 0 54 62',sofa:'0 0 102 63',
 kitchen:'0 0 116 100',lamp:'0 0 45 80',bookshelf:'0 0 60 65',vanity:'0 0 70 84',towels:'0 0 78 35',
 curtains:'0 0 144 128',sconces:'0 0 108 30',
};

export function DecorArt({kind}:{kind:DecorArtName}){
 return <svg viewBox={sizes[kind]} shapeRendering="crispEdges" aria-hidden="true" className="furniture-art"
  data-decor-art={kind} preserveAspectRatio={kind==='curtains'?'none':undefined}>
  <g stroke="#2b1d35" strokeWidth="2" strokeLinejoin="miter">
   {kind==='speaker'&&<>
    <path d="M11 10 17 5H49L54 11V89L49 93H11Z" fill="#151a2e" strokeWidth="3"/>
    <path d="M12 12H49V87H12Z" fill="#313756"/>
    <path d="M17 17H44V22H17Z" fill="#a27be9"/>
    <path d="M19 28H42L47 33V48L42 53H19L14 48V33Z" fill="#14192c"/>
    <path d="M24 32H37L42 37V44L37 49H24L19 44V37Z" fill="#75649d"/>
    <path d="M27 36H34L37 39V43L34 46H27L24 43V39Z" fill="#c3a5ea"/>
    <path className="speaker-woofer" d="M20 57H41L48 64V78L41 85H20L13 78V64Z" fill="#14192c"/>
    <path d="M24 62H37L43 68V74L37 80H24L18 74V68Z" fill="#76649f"/>
    <path d="M27 67H34L38 71 34 76H27L23 71Z" fill="#c5aceb"/>
    <path d="M51 13V85M16 89H23M38 89H46" stroke="#080d1e"/>
    <path className="speaker-led" d="M39 18H43V21H39Z" fill="#ffc969" stroke="none"/>
   </>}
   {kind==='plant'&&<>
    <path d="M22 51V17M22 26L11 14M23 32L35 17M21 39L10 32M23 43L35 36" stroke="#326344" strokeWidth="3" fill="none"/>
    <path d="M22 25L16 18 17 10 24 3 28 7 28 16ZM16 28L7 25 3 18 4 12 12 13 18 18ZM27 32L28 21 34 14 43 14 42 21 34 28ZM18 42L7 41 2 34 4 29 12 31 16 35ZM27 43L31 35 40 31 45 34 42 40 36 44Z" fill="#74a542"/>
    <path d="M9 17l5 4m9-14v9m12 4l5-3m-31 16l5 5m21 0l6-3" stroke="#b6ce64" fill="none"/>
    <path d="M9 45H37L34 58 30 62H16L12 58Z" fill="#ac685d"/>
    <path d="M9 45H37V50H9Z" fill="#edaa87"/>
    <path d="M16 53H20V59H17Z" fill="#dd9077" stroke="none"/>
   </>}
   {kind==='rug'&&<>
    <path d="M13 3H87L98 30 93 33H7L2 30Z" fill="#63449a"/>
    <path d="M16 7H84L91 27H9Z" fill="#9d6ccd"/>
    <path d="M23 11H77L81 23H19Z" fill="#7549b1"/>
    <path d="M46 12H54L60 17 53 22H47L40 17Z" fill="#e1a3d8"/>
   </>}
   {kind==='picture'&&<>
    <path d="M4 3H50V58H4Z" fill="#a96c5a" strokeWidth="4"/>
    <path d="M9 8H45V53H9Z" fill="#ffc28b"/>
    <path d="M13 13H41V49H13Z" fill="#9966bc" stroke="none"/>
    <path d="M13 38H19V29H26V37H29V23H34V34H41V49H13Z" fill="#483866" stroke="none"/>
    <path d="M22 33h2v3h-2zm10-6h2v4h-2zm2 10h3v2h-3z" fill="#ffda91" stroke="none"/>
   </>}
   {kind==='sofa'&&<>
    <path d="M12 47H21V59H14ZM83 47H92V59H85Z" fill="#965a48"/>
    <path d="M13 15L20 8H81L89 14 92 44H10Z" fill="#704e9f"/>
    <path d="M23 12H49V31H17V20ZM52 12H78L85 21V31H52Z" fill="#9971c9"/>
    <path d="M9 32H93L99 41V53L94 57H8L3 52V41Z" fill="#563982"/>
    <path d="M14 34H89L95 45H9Z" fill="#ad80d2"/>
    <path d="M3 32H13L17 37V53L12 57H7L3 52ZM89 33H97L101 38V52L96 57H87V37Z" fill="#7955ab"/>
    <path d="M64 19L77 17 82 32 68 33Z" fill="#ffb965"/>
   </>}
   {kind==='kitchen'&&<>
    <path d="M4 10H81V43H4ZM5 57H81V94H5Z" fill="#84516f"/>
    <path d="M8 14H40V39H8ZM44 14H77V39H44Z" fill="#a87592"/>
    <path d="M5 43H81V58H5Z" fill="#555a89"/>
    <path d="M3 55H82V61H3Z" fill="#da916c"/>
    <path d="M9 63H36V90H9ZM64 63H77V90H64Z" fill="#a87592"/>
    <path d="M40 64H61V90H40Z" fill="#241f3d"/>
    <path d="M44 70H57V84H44Z" fill="#50406d"/>
    <path d="M85 22H109L113 27V94H85Z" fill="#bdaac6"/>
    <path d="M88 25H109V55H88ZM88 58H109V91H88Z" fill="#d9c4d5"/>
    <path d="M92 37V49M92 63V73M21 67H29M39 29V35M47 29V35" stroke="#593d52" fill="none"/>
    <path d="M18 53V47L21 44H26V48H23V53Z" fill="#edb45f"/>
   </>}
   {kind==='lamp'&&<>
    <path d="M20 24H24V72H20ZM8 70H37V77H8Z" fill="#a96d56"/>
    <path d="M9 9L14 3H31L37 10 43 28H2Z" fill="#f3ae63"/>
    <path d="M14 8H17L13 24H8ZM22 7H26L28 24H18Z" fill="#ffd992" stroke="none"/>
    <path d="M2 25H43V29H2Z" fill="#d98749"/>
   </>}
   {kind==='bookshelf'&&<>
    <path d="M4 3H56V57H4Z" fill="#9b5b4b"/>
    <path d="M8 10H52V29H8ZM8 34H52V53H8Z" fill="#3c2a43"/>
    <path d="M11 13H18V28H11ZM21 16H27V28H21ZM31 12H39V28H31ZM14 38H29V52H14ZM34 41H48V52H34Z" fill="#ba79a2"/>
    <path d="M4 28H56V34H4ZM5 56H55V63H5Z" fill="#c47d56"/>
    <path d="M6 4H54" stroke="#efb079"/>
   </>}
   {kind==='vanity'&&<>
    <path d="M13 4H55L61 10V39L55 43H13L8 38V10Z" fill="#f7b76b"/>
    <path d="M15 8H54L57 11V37L53 39H15L12 36V12Z" fill="#8784b1"/>
    <path d="M13 32L49 9H55L20 38H14Z" fill="#afafd5" stroke="none"/>
    <path d="M35 52V46L38 44H44V47H40V52Z" fill="#d99c57"/>
    <path d="M4 52H66V60H4Z" fill="#ffc1bc"/>
    <path d="M8 60H62V81H8Z" fill="#975456"/>
    <path d="M12 64H32V77H12ZM36 64H58V77H36Z" fill="#be6b59"/>
    <path d="M20 67H26M43 67H51" stroke="#7a433c"/>
   </>}
   {kind==='towels'&&<>
    <path d="M11 7H56L64 11V17H11L6 13Z" fill="#ad93e7"/>
    <path d="M20 16H64L71 21V26H20L14 22Z" fill="#7669c7"/>
    <path d="M48 9L52 15M57 18L60 24" stroke="#d4b8f5"/>
    <path d="M3 25H75V32H3Z" fill="#a56450"/>
    <path d="M4 26H74" stroke="#e0a268"/>
   </>}
   {kind==='curtains'&&<>
    <path d="M3 4H141V8H3Z" fill="#b88762"/>
    <path d="M10 8H39L27 64 34 119 23 125H11L5 120 13 68 9 40ZM105 8H134L135 40 131 68 139 120 133 125H121L110 119 117 64Z" fill="#884781"/>
    <path d="M16 9H24L19 67 21 117H12L16 72ZM119 9H128L124 67 133 119H123L124 70Z" fill="#bc6fa7" stroke="none"/>
    <path d="M11 63H28V69H11ZM116 63H133V69H116Z" fill="#e1a45e"/>
   </>}
   {kind==='sconces'&&<>
    <path d="M7 3H20V27H7ZM88 3H101V27H88Z" fill="#ad6b58"/>
    <path d="M9 5H18L21 23H6ZM90 5H99L102 23H87Z" fill="#ffc177"/>
    <path d="M11 7H15V20H10ZM92 7H96V20H91Z" fill="#fff1b1" stroke="none"/>
   </>}
  </g>
 </svg>;
}
