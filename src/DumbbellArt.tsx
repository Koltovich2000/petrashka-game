export function DumbbellArt({x,y,width,angle=0}:{x:number;y:number;width:number;angle?:number}){
 const height=width*.45;
 return <svg x={x-width/2} y={y-height/2} width={width} height={height} viewBox="0 0 40 18" transform={`rotate(${angle} ${x} ${y})`} overflow="visible" shapeRendering="crispEdges">
  <path d="M7 7H33V11H7Z" fill="#b2bdd7" stroke="#252438" strokeWidth="2"/>
  <path d="M4 4H8V2H13V16H8V14H4Z M36 4H32V2H27V16H32V14H36Z" fill="#596686" stroke="#252438" strokeWidth="2"/>
  <path d="M6 6H8M10 4H12M28 4H30M33 6H35" stroke="#becae4" strokeWidth="1.5"/>
 </svg>;
}
