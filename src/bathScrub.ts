type Point={x:number;y:number};
export type BathStroke={start:Point;direction:Point|null;peak:number};
export type BathSwipe={edge:Point;direction:Point|null};

export function advanceBathSwipe(swipe:BathSwipe,point:Point,minTravel:number){
 const dx=point.x-swipe.edge.x,dy=point.y-swipe.edge.y;
 if(swipe.direction&&dx*swipe.direction.x+dy*swipe.direction.y>0){
  swipe.edge=point;
  return false;
 }
 const distance=Math.hypot(dx,dy);
 if(distance<minTravel)return false;
 swipe.edge=point;
 swipe.direction={x:dx/distance,y:dy/distance};
 return true;
}

export function advanceBathStroke(stroke:BathStroke,point:Point,minTravel:number):boolean{
 const dx=point.x-stroke.start.x,dy=point.y-stroke.start.y;
 if(!stroke.direction){
  const distance=Math.hypot(dx,dy);
  if(distance>=minTravel){
   stroke.direction={x:dx/distance,y:dy/distance};
   stroke.peak=distance;
  }
  return false;
 }
 const travel=dx*stroke.direction.x+dy*stroke.direction.y;
 stroke.peak=Math.max(stroke.peak,travel);
 if(stroke.peak-travel<minTravel)return false;

 stroke.start=point;
 stroke.direction=null;
 stroke.peak=0;
 return true;
}
