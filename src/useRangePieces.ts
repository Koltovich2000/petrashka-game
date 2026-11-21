import {useEffect,useRef,useState} from 'react';
import type {RangePart} from './rangeDamage';
export type Piece={id:number;part:RangePart;x:number;y:number;w:number;h:number;vx:number;vy:number;angle:number;spin:number;viewBox:string;landed?:boolean};
export function useRangePieces(onLand:(p:Piece,all:boolean)=>void){
 const landed=useRef(onLand);landed.current=onLand;
 const pieces=useRef<Piece[]>([]),frame=useRef(0),size=useRef({w:1,h:1});
 const [shown,setShown]=useState<Piece[]>([]);
 function run(){
  if(frame.current)return;
  let last=performance.now();
  const step=(now:number)=>{
   frame.current=0;
   const dt=Math.min(.032,(now-last)/1000);last=now;
   let moving=false;const landedNow:Piece[]=[];
   for(const p of pieces.current){
    p.vy+=1500*dt;let dx=p.vx*dt,dy=p.vy*dt;const {w,h}=size.current;
    p.x+=dx;p.y+=dy;
    if(p.x<0){p.x=0;p.vx=Math.abs(p.vx)*.4;}
    if(p.x+p.w>w){p.x=w-p.w;p.vx=-Math.abs(p.vx)*.4;}
    if(p.y<0){p.y=0;p.vy=Math.abs(p.vy)*.4;}
    if(p.y+p.h>h*.91){if(!p.landed){p.landed=true;landedNow.push(p);}p.y=h*.91-p.h;p.vy=Math.abs(p.vy)<65?0:-p.vy*.28;p.vx*=.86;p.spin*=.82;}
    p.angle+=p.spin*dt;
    if(Math.abs(p.vx)>1||Math.abs(p.vy)>1)moving=true;
   }
   // Detached pieces also push one another instead of overlapping forever.
   for(let i=0;i<pieces.current.length;i++)for(let j=i+1;j<pieces.current.length;j++){
    const a=pieces.current[i],b=pieces.current[j],dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2;
    const r=Math.min(a.w,a.h)*.36+Math.min(b.w,b.h)*.36,d=Math.hypot(dx,dy);
    if(d<r){const nx=d?dx/d:1,ny=d?dy/d:0,overlap=(r-d)/2;a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;const v=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(v>0){a.vx-=nx*v*.65;a.vy-=ny*v*.65;b.vx+=nx*v*.65;b.vy+=ny*v*.65;}}
   }
   landedNow.forEach(p=>landed.current(p,pieces.current.every(p=>p.landed)));
   setShown(pieces.current.map(p=>({...p})));
   if(moving)frame.current=requestAnimationFrame(step);
  };
  frame.current=requestAnimationFrame(step);
 }
 function add(next:Piece[],w:number,h:number){if(!next.length)return;size.current={w,h};pieces.current.push(...next);run();}
 function nudge(id:number){if(pieces.current.find(p=>p.id===id)){const p=pieces.current.find(p=>p.id===id)!;p.vx+=180;p.vy=-240;run();}}
 function reset(){cancelAnimationFrame(frame.current);frame.current=0;pieces.current=[];setShown([]);}
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 function remove(id:number){pieces.current=pieces.current.filter(p=>p.id!==id);setShown(pieces.current.map(p=>({...p})));}
 return {remove,shown,add,nudge,reset};
}
