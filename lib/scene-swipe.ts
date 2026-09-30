export type SwipePoint = {x:number;y:number;at:number};
export function sceneSwipe(start:SwipePoint,end:SwipePoint): -1|0|1 {
 const dx=end.x-start.x,dy=end.y-start.y,elapsed=end.at-start.at;
 if(elapsed<0||elapsed>800||Math.abs(dx)<64||Math.abs(dy)>30||Math.abs(dx)<Math.abs(dy)*2)return 0;
 return dx<0?1:-1;
}
