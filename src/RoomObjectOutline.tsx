import type {CSSProperties} from 'react';

// The paths follow the room artwork in preview coordinates. The bounds also
// position the buttons, so the contours scale with the room on every screen.
const outlines = {
 bed: {
  scene: [640, 585], bounds: [0, 213, 180, 229],
  path: 'M0 222 L67 214 Q73 214 73 220 L72 255 Q87 266 93 281 L102 286 L163 288 Q178 289 178 302 L179 332 L175 339 L176 363 L169 382 L139 432 L133 439 L0 439 Z',
 },
 computer: {
  scene: [640, 585], bounds: [447, 132, 193, 321],
  path: 'M640 191 L607 164 L597 141 L591 135 Q578 132 570 145 L554 151 L542 160 Q538 165 546 170 L594 188 Q600 185 603 172 L629 194 L618 265 L612 296 L596 297 L582 291 L584 284 L610 287 L620 213 L533 211 L525 276 L551 280 L551 286 L494 291 Q492 264 480 263 L460 260 Q448 262 449 277 L460 321 L473 350 L490 357 L488 397 L475 400 L465 413 Q461 425 472 424 L481 420 L509 416 Q511 434 521 431 Q530 430 528 420 L519 410 L543 417 L552 413 L549 407 L523 398 L521 364 Q542 362 552 352 L556 344 L556 426 L595 451 L640 445 Z',
 },
 bath: {
  scene: [320, 480], bounds: [213, 191, 107, 170],
  path: 'M214 228 Q234 225 272 225 L271 205 Q272 191 286 192 Q293 194 294 201 L295 221 L303 227 L308 238 L320 246 L320 360 L270 360 L214 287 Z M276 225 L291 225 L290 204 Q288 197 284 199 Q277 199 276 205 Z',
 },
 toilet: {
  scene: [320, 480], bounds: [5, 203, 78, 109],
  path: 'M6 211 L29 204 L40 207 L39 243 L67 246 Q81 247 82 254 Q81 272 68 278 L70 298 Q75 307 65 310 L22 310 L19 306 L25 298 L28 279 L20 269 L18 263 L8 262 Z',
 },
} as const;

export type RoomObject = keyof typeof outlines;

export function objectBounds(object: RoomObject): CSSProperties {
 const {scene: [sceneWidth, sceneHeight], bounds: [x, y, width, height]} = outlines[object];
 return {
  left: `${x / sceneWidth * 100}%`, top: `${y / sceneHeight * 100}%`,
  width: `${width / sceneWidth * 100}%`, height: `${height / sceneHeight * 100}%`,
 };
}

export function RoomObjectOutline({object}: {object: RoomObject}) {
 const {bounds, path} = outlines[object];
 return <svg className="room-object-outline" viewBox={bounds.join(' ')} preserveAspectRatio="none" aria-hidden="true">
  <path d={path} fillRule="evenodd" vectorEffect="non-scaling-stroke"/>
 </svg>;
}
