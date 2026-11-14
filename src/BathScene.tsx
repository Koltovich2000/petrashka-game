export type BathPhase = 'approach' | 'fill' | 'soak';

export function BathScene({phase}: {phase: BathPhase}) {
 if (phase === 'approach') return null;
 return <svg className="bath-scene-art" viewBox="0 0 320 480" preserveAspectRatio="none" aria-hidden="true">
  <path className="bath-water-surface" d="M226 236L275 236 310 257 320 260V277H276Z" fill="#78d9eb" opacity=".87"/>
  {phase === 'fill' && <path className="bath-stream" d="M276 211V241" fill="none" stroke="#c9f6ff" strokeWidth="2" strokeDasharray="5 3"/>}
  {phase === 'soak' && <>
   <path d="M243 236Q250 228 266 234L294 256 282 269 252 250Z" fill="#efaa79" stroke="#5f354d" strokeWidth="2"/>
   <g className="bath-feet">
    <path d="M279 254L296 259 303 247Q308 244 310 249L308 265Q304 269 299 267L282 263Z" fill="#ffc291" stroke="#5f354d" strokeWidth="2"/>
    <path d="M285 249L304 255 309 244Q313 241 316 246L314 260Q313 264 307 264L286 258Z" fill="#ffcf9e" stroke="#5f354d" strokeWidth="2"/>
   </g>
   <svg x="218" y="207" width="44" height="42" viewBox="0 0 627 627" overflow="hidden">
    <image href="/assets/pixel-heads.png" width="1254" height="1254"/>
   </svg>
   <g fill="#f2fcff" stroke="#9addf3" strokeWidth=".8">
    <path d="M238 248Q239 242 245 244Q250 238 256 244Q262 240 266 246Q273 241 279 250Q286 247 289 254Q297 252 299 261L280 272Z"/>
    <circle className="bath-bubble" cx="258" cy="238" r="2.5"/>
    <circle className="bath-bubble bath-bubble-late" cx="286" cy="248" r="3.4"/>
   </g>
   <g className="bath-scrub">
    <path d="M252 250Q257 242 264 249L271 251" fill="none" stroke="#f4aa7f" strokeWidth="5" strokeLinecap="round"/>
    <path d="M264 246L273 247 276 251 273 255 264 253Z" fill="#ffd36e" stroke="#a46d4d" strokeWidth="1"/>
    <path d="M267 248H270M270 251H273" stroke="#fff0ab" strokeWidth="1"/>
   </g>
  </>}
  <path d="M214 229L270 277H320" fill="none" stroke="#ffe0d7" strokeWidth="2.4" strokeLinejoin="round"/>
 </svg>;
}
