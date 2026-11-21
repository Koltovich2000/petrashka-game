import type {Location} from './activities';

export type GroundPoint={x:number;y:number};
export type GroundRect={left:number;top:number;right:number;bottom:number};

// Floor footprints of the furniture painted into each background.
const ground:Record<Location,{back:number;fixtures:GroundRect[]}>= {
 room:{back:.64,fixtures:[{left:0,top:.64,right:.28,bottom:.76},{left:.72,top:.64,right:1,bottom:.78}]},
 bathroom:{back:.60,fixtures:[{left:0,top:.60,right:.25,bottom:.65},{left:.66,top:.60,right:1,bottom:.755}]},
 hallway:{back:.565,fixtures:[{left:0,top:.565,right:.335,bottom:.71},{left:.91,top:.565,right:1,bottom:.68}]},
 hall:{back:.51,fixtures:[{left:0,top:.51,right:.165,bottom:.55},{left:.78,top:.51,right:1,bottom:.55}]},
};

const columns=23,rows=13;
export function dogRoute(location:Location,objects:GroundRect[],width:number,height:number,footRadius:number,reverse:boolean,start?:GroundPoint){
 const {back,fixtures}=ground[location];
 const trimX=Math.min(.18,Math.max(.09,footRadius*2/width));
 const stepsX=(1-2*trimX)/(columns-1),stepsY=(.91-back)/(rows-1);
 const paddingX=footRadius/width,paddingY=7/height;
 const blocks=[...fixtures,...objects].map(rect=>({left:rect.left-paddingX,right:rect.right+paddingX,top:rect.top-paddingY,bottom:rect.bottom+paddingY}));
 const cells=Array.from({length:rows*columns},(_,index)=>({x:trimX+index%columns*stepsX,y:back+Math.floor(index/columns)*stepsY}));
 const overlaps=(a:GroundPoint,b:GroundPoint)=>blocks.some(rect=>
  Math.max(a.x,b.x)>=rect.left&&Math.min(a.x,b.x)<=rect.right&&Math.max(a.y,b.y)>=rect.top&&Math.min(a.y,b.y)<=rect.bottom);
 const allowed=cells.map(point=>!overlaps(point,point));
 const distance=(a:GroundPoint,b:GroundPoint)=>Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);
 function nearest(target:GroundPoint){
  let best=-1,shortest=Infinity;
  for(let i=0;i<cells.length;i++)if(allowed[i]){
   const gap=distance(cells[i],target);
   if(gap<shortest){best=i;shortest=gap;}
  }
  return best;
 }
 const side=reverse?.82:.18,other=1-side;
 let current=nearest(start??{x:side,y:.88});
 if(current<0)return [];
 const path=[cells[current]];
 const waypoints=[{x:other,y:back+.05},{x:side,y:back+.04},{x:other,y:.89}];
 for(const waypoint of waypoints){
  const end=nearest(waypoint);
  if(end===current)continue;
  const parents=new Int16Array(cells.length).fill(-1);
  parents[current]=current;
  const queue=[current];
  for(let head=0;head<queue.length&&parents[end]<0;head++){
   const index=queue[head],x=index%columns,y=Math.floor(index/columns);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const column=x+dx,row=y+dy,neighbor=row*columns+column;
    if(column<0||column>=columns||row<0||row>=rows||!allowed[neighbor]||parents[neighbor]>=0)continue;
    if(overlaps(cells[index],cells[neighbor]))continue;
    parents[neighbor]=index;
    queue.push(neighbor);
   }
  }
  if(parents[end]<0)continue;
  const segment:GroundPoint[]=[];
  for(let node=end;node!==current;node=parents[node])segment.push(cells[node]);
  path.push(...segment.reverse());
  current=end;
 }
 return path;
}

export function measureDogRoute(points:GroundPoint[],width:number,height:number){
 let length=0;
 const distances=points.map((point,index)=>{
  const previous=points[index-1];
  if(previous)length+=Math.hypot((point.x-previous.x)*width,(point.y-previous.y)*height);
  return length;
 });
 return {points,distances,length};
}

export function dogPointAt(route:ReturnType<typeof measureDogRoute>,progress:number){
 const {points,distances,length}=route;
 const target=length*Math.min(1,Math.max(0,progress));
 const index=distances.findIndex(distance=>distance>=target);
 if(index<=0)return points[0];
 const a=points[index-1],b=points[index];
 const t=(target-distances[index-1])/(distances[index]-distances[index-1]);
 return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
