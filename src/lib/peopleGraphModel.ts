/**
 * Pure traversal helpers for the synthetic People lens.
 * No identity lookup, API calls or private relationship inference.
 */
export type GraphLink = { a: string; b: string };

export function distanceMap(root: string, links: GraphLink[], max: number): Map<string,number> {
  const depth = new Map<string,number>([[root,0]]);
  const queue = [root];
  for(let i=0;i<queue.length;i++){
    const id=queue[i],d=depth.get(id)!;
    if(d>=max)continue;
    for(const e of links){
      const other=e.a===id?e.b:e.b===id?e.a:null;
      if(other&&!depth.has(other)){depth.set(other,d+1);queue.push(other)}
    }
  }
  return depth;
}

export function shortestPath(start:string,end:string,links:GraphLink[]):string[]{
  const seen=new Map<string,string|null>([[start,null]]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const id=queue[i];if(id===end)break;
    for(const e of links){
      const next=e.a===id?e.b:e.b===id?e.a:null;
      if(next&&!seen.has(next)){seen.set(next,id);queue.push(next)}
    }
  }
  if(!seen.has(end))return [];
  const path:string[]=[];
  for(let id:string|null=end;id;id=seen.get(id)??null)path.unshift(id);
  return path;
}
