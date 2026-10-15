import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import '../../styles/people-graph-lens.css';
import { distanceMap, shortestPath } from '../../lib/peopleGraphModel';

/**
 * A strictly synthetic interaction lens for the PRIMARY MASA Brain Graph.
 * Never read CRM, production identities, followers, or relationships here.
 * A future canonical adapter requires schema, consent and RLS review.
 */
type Channel = 'ace' | 'x' | 'instagram' | 'tiktok' | 'offline';
type Layout = 'flow' | 'levels' | 'groups';
type Person = { id: string; name: string; channel: Channel; group: string; tags: string[] };
type Link = { a: string; b: string; type: 'meet' | 'intro' | 'quest' | 'social'; confirmed: boolean };
type Group = { id: string; label: string; color: string };
type Point = { x: number; y: number; vx: number; vy: number; pinned: boolean };
type GraphNode = { id: string; label: string; channel: Channel; group: string; summary?: boolean; count?: number };
type DisplayEdge = { a: string; b: string; confirmed: boolean; type: Link['type'] };
const WIDTH = 1000;
const HEIGHT = 610;
const PALETTE: Record<Channel, string> = { ace:'#17a98c', x:'#558bcd', instagram:'#ac7dda', tiktok:'#c57e9b', offline:'#d7ab57' };
const GROUPS: Group[] = [
  { id:'athlete', label:'アスリート', color:'#3c9fb4' },
  { id:'ace', label:'ACE', color:'#20ae83' },
  { id:'work', label:'協働・地域', color:'#cb8b49' },
];
const PEOPLE: Person[] = [
  {id:'p0',name:'自分（サンプル）',channel:'ace',group:'ace',tags:['運営']},
  {id:'p1',name:'人物 A',channel:'ace',group:'ace',tags:['教育','コーチ']},
  {id:'p2',name:'人物 B',channel:'offline',group:'athlete',tags:['選手']},
  {id:'p3',name:'人物 C',channel:'x',group:'work',tags:['発信']},
  {id:'p4',name:'人物 D',channel:'instagram',group:'athlete',tags:['選手','発信']},
  {id:'p5',name:'人物 E',channel:'tiktok',group:'work',tags:['映像']},
  {id:'p6',name:'人物 F',channel:'ace',group:'ace',tags:['教育']},
  {id:'p7',name:'人物 G',channel:'offline',group:'work',tags:['地域']},
  {id:'p8',name:'人物 H',channel:'x',group:'athlete',tags:['選手']},
  {id:'p9',name:'人物 I',channel:'ace',group:'athlete',tags:['コーチ']},
  {id:'p10',name:'人物 J',channel:'offline',group:'ace',tags:['保護者']},
  {id:'p11',name:'人物 K',channel:'instagram',group:'work',tags:['デザイン']},
  {id:'p12',name:'人物 L',channel:'ace',group:'ace',tags:['運営']},
  {id:'p13',name:'人物 M',channel:'offline',group:'work',tags:['地域']},
  {id:'p14',name:'人物 N',channel:'tiktok',group:'athlete',tags:['映像']},
  {id:'p15',name:'人物 O',channel:'x',group:'work',tags:['発信']},
  {id:'p16',name:'人物 P',channel:'offline',group:'athlete',tags:['指導者']},
  {id:'p17',name:'人物 Q',channel:'ace',group:'ace',tags:['教育']},
];
const LINKS: Link[] = [
  ['p0','p1','quest'],['p0','p2','meet'],['p0','p3','social'],['p0','p4','intro'],
  ['p0','p6','quest'],['p1','p5','intro'],['p1','p6','quest'],['p1','p7','meet'],
  ['p2','p4','meet'],['p2','p8','social'],['p2','p9','quest'],['p3','p5','social'],
  ['p3','p11','intro'],['p4','p9','meet'],['p5','p10','intro'],['p6','p12','quest'],
  ['p7','p13','meet'],['p8','p14','social'],['p9','p16','quest'],['p10','p17','meet'],
  ['p11','p15','intro'],['p12','p17','quest'],['p13','p15','meet'],['p14','p16','social'],
].map(([a,b,type],i)=>({a,b,type:type as Link['type'],confirmed:i%6!==0}));

function startPoint(i:number,total:number):Point {
  const angle=(i/Math.max(1,total))*Math.PI*2-Math.PI/2;
  return {x:WIDTH/2+Math.cos(angle)*(170+i%3*22),y:HEIGHT/2+Math.sin(angle)*(125+i%4*19),vx:0,vy:0,pinned:false};
}
function clamp(n:number,min:number,max:number){return Math.min(max,Math.max(min,n))}
function sameEdge(a:string,b:string,c:string,d:string){return a===c&&b===d||a===d&&b===c}

export default function PeopleGraphLens(){
  const [people,setPeople]=useState<Person[]>(PEOPLE);
  const [links,setLinks]=useState<Link[]>(LINKS);
  const [groups,setGroups]=useState<Group[]>(GROUPS);
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const [layout,setLayout]=useState<Layout>('flow');
  const [hops,setHops]=useState(3);
  const [focus,setFocus]=useState('p0');
  const [selected,setSelected]=useState('p0');
  const [paused,setPaused]=useState(false);
  const [query,setQuery]=useState('');
  const [channel,setChannel]=useState<Channel|'all'>('all');
  const [newPerson,setNewPerson]=useState('');
  const [newGroup,setNewGroup]=useState('');
  const [pathEnd,setPathEnd]=useState('');
  const [route,setRoute]=useState<string[]>([]);
  const [counter,setCounter]=useState(0);
  const [camera,setCamera]=useState({x:0,y:0,w:WIDTH,h:HEIGHT});
  const svg=useRef<SVGSVGElement|null>(null);
  const points=useRef<Record<string,Point>>(Object.fromEntries(PEOPLE.map((p,i)=>[p.id,startPoint(i,PEOPLE.length)])));
  const pointer=useRef<{id:number;kind:'node'|'pan';nodeId?:string;x:number;y:number;originX:number;originY:number;oldCamera?:typeof camera}|null>(null);
  const groupDrag=useRef<{id:number;group:string;x:number;y:number;initial:Record<string,{x:number;y:number}>}|null>(null);
  const [info,setInfo]=useState('人物を選ぶと関係を確認できます');
  const byId=useMemo(()=>new Map(people.map(p=>[p.id,p])),[people]);
  const visibleDepth=useMemo(()=>distanceMap(focus,links,hops),[focus,links,hops]);

  const projection=useMemo(()=>{
    const inRadius=people.filter(p=>visibleDepth.has(p.id));
    const mapId=(id:string)=>{const p=byId.get(id);return p&&collapsed.includes(p.group)?'group:'+p.group:id};
    const nodes:GraphNode[]=inRadius.filter(p=>!collapsed.includes(p.group)).map(p=>({id:p.id,label:p.name,channel:p.channel,group:p.group}));
    for(const groupId of collapsed){const members=inRadius.filter(p=>p.group===groupId);if(members.length){
      const g=groups.find(g=>g.id===groupId);nodes.push({id:'group:'+groupId,label:g?.label||groupId,channel:'ace',group:groupId,summary:true,count:members.length});
    }}
    const edges:DisplayEdge[]=[];const seen=new Set<string>();
    for(const e of links){if(!visibleDepth.has(e.a)||!visibleDepth.has(e.b))continue;
      const a=mapId(e.a),b=mapId(e.b);if(a===b)continue;
      const key=[a,b].sort().join('|')+'|'+e.type;if(seen.has(key))continue;
      seen.add(key);edges.push({...e,a,b});
    }
    return {nodes,edges};
  },[people,links,groups,collapsed,visibleDepth,byId]);
  const graphNodes=projection.nodes;
  const graphEdges=projection.edges;
  const current=byId.get(selected);
  const routeEdges=useMemo(()=>new Set(route.slice(1).map((id,i)=>[route[i],id].sort().join('|'))),[route]);

  useEffect(()=>{
    const pref=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(pref?.matches)setPaused(true);
  },[]);
  useEffect(()=>{
    for(const n of graphNodes){
      if(!points.current[n.id]){
        if(n.summary){const members=people.filter(p=>p.group===n.group && visibleDepth.has(p.id));const coords=members.map(p=>points.current[p.id]).filter(Boolean);
          points.current[n.id]={x:coords.reduce((s,p)=>s+p.x,0)/Math.max(1,coords.length),y:coords.reduce((s,p)=>s+p.y,0)/Math.max(1,coords.length),vx:0,vy:0,pinned:false};
        }else points.current[n.id]=startPoint(people.findIndex(p=>p.id===n.id),people.length);
      }
    }
  },[graphNodes,people,visibleDepth]);

  useEffect(()=>{
    let frame=0,raf=0,active=true;
    const depth=visibleDepth;
    const paint=()=>{
      const canvas=svg.current;if(!canvas)return;
      for(const n of graphNodes){
        const p=points.current[n.id],g=canvas.querySelector<SVGGElement>('[data-people-node="'+n.id+'"]');
        if(p&&g)g.setAttribute('transform','translate('+p.x.toFixed(2)+','+p.y.toFixed(2)+')');
      }
      for(let i=0;i<graphEdges.length;i++){
        const e=graphEdges[i],a=points.current[e.a],b=points.current[e.b];
        const l=canvas.querySelector<SVGLineElement>('[data-people-edge="'+i+'"]');
        if(a&&b&&l){l.setAttribute('x1',String(a.x));l.setAttribute('y1',String(a.y));l.setAttribute('x2',String(b.x));l.setAttribute('y2',String(b.y))}
      }
      if(layout==='groups'){
        for(const g of groups){const visible=graphNodes.filter(n=>n.group===g.id).map(n=>points.current[n.id]).filter(Boolean);
          const rect=canvas.querySelector<SVGRectElement>('[data-people-group="'+g.id+'"]');
          if(!rect)continue;
          if(!visible.length){rect.setAttribute('visibility','hidden');continue}
          const xs=visible.map(p=>p.x),ys=visible.map(p=>p.y);
          rect.setAttribute('visibility','visible');rect.setAttribute('x',String(Math.min(...xs)-42));rect.setAttribute('y',String(Math.min(...ys)-42));
          rect.setAttribute('width',String(Math.max(115,Math.max(...xs)-Math.min(...xs)+84)));
          rect.setAttribute('height',String(Math.max(95,Math.max(...ys)-Math.min(...ys)+84)));
          const header=canvas.querySelector<SVGTextElement>('[data-group-caption="'+g.id+'"]');
          if(header){header.setAttribute('x',String(Math.min(...xs)-29));header.setAttribute('y',String(Math.min(...ys)-51));}
        }
      }
    };
    const tick=()=>{
      if(!active)return;
      frame++;
      const visible=graphNodes.map(n=>points.current[n.id]).filter(Boolean);
      if(!paused){
        graphNodes.forEach((n,i)=>{
          const p=points.current[n.id];if(!p||p.pinned) return;
          let tx=WIDTH/2,ty=HEIGHT/2;
          if(layout==='levels'){
            const d=n.summary?Math.min(...people.filter(v=>v.group===n.group).map(v=>depth.get(v.id)??hops)):depth.get(n.id)??hops;
            const layer=graphNodes.filter(v=>(depth.get(v.id)??hops)===d);
            const order=Math.max(0,layer.findIndex(v=>v.id===n.id));
            tx=110+Math.min(4,d)*185;ty=HEIGHT/2+(order-(layer.length-1)/2)*Math.min(82,460/Math.max(1,layer.length));
          }else if(layout==='groups'){
            const gi=groups.findIndex(g=>g.id===n.group);
            const angle=gi/Math.max(1,groups.length)*Math.PI*2-Math.PI/2;
            tx=WIDTH/2+Math.cos(angle)*265;ty=HEIGHT/2+Math.sin(angle)*180;
          }else{
            const angle=i/Math.max(1,graphNodes.length)*Math.PI*2-Math.PI/2;
            tx=WIDTH/2+Math.cos(angle)*(135+(i%3)*48);ty=HEIGHT/2+Math.sin(angle)*(125+(i%4)*33);
            if(n.id===focus){tx=WIDTH/2;ty=HEIGHT/2}
          }
          p.vx+=(tx-p.x)*.008;p.vy+=(ty-p.y)*.008;
        });
        for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
          const a=visible[i],b=visible[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(1,Math.hypot(dx,dy));
          const force=Math.min(6,1700/(dist*dist)+(dist<43?(43-dist)*.09:0)),fx=dx/dist*force,fy=dy/dist*force;
          if(!a.pinned){a.vx-=fx;a.vy-=fy}if(!b.pinned){b.vx+=fx;b.vy+=fy}
        }
        for(const edge of graphEdges){
          const a=points.current[edge.a],b=points.current[edge.b];if(!a||!b)continue;
          const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),pull=(d-135)*.0016;
          if(!a.pinned){a.vx+=dx/d*pull;a.vy+=dy/d*pull}if(!b.pinned){b.vx-=dx/d*pull;b.vy-=dy/d*pull}
        }
        for(const p of visible){if(p.pinned)continue;p.vx*=.88;p.vy*=.88;p.x=clamp(p.x+p.vx,30,WIDTH-30);p.y=clamp(p.y+p.vy,30,HEIGHT-30)}
      }
      paint();
      if(!paused&&frame<2400)raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>{active=false;cancelAnimationFrame(raf)};
  },[graphNodes,graphEdges,groups,layout,hops,paused,people,focus,visibleDepth,counter]);

  const screenPoint=(e:{clientX:number;clientY:number})=>{
    const rect=svg.current?.getBoundingClientRect();if(!rect)return{x:0,y:0};
    return {x:camera.x+(e.clientX-rect.left)/Math.max(1,rect.width)*camera.w,y:camera.y+(e.clientY-rect.top)/Math.max(1,rect.height)*camera.h};
  };
  function onNodeDown(e:ReactPointerEvent<SVGGElement>,id:string){
    e.stopPropagation();if(id.startsWith('group:')){setCollapsed(x=>x.filter(v=>v!==id.slice(6)));return}
    const pt=screenPoint(e),p=points.current[id];if(!p)return;
    pointer.current={id:e.pointerId,kind:'node',nodeId:id,x:pt.x,y:pt.y,originX:p.x,originY:p.y};
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
  }
  function onNodeMove(e:ReactPointerEvent<SVGGElement>){
    if(pointer.current?.kind!=='node'||pointer.current.id!==e.pointerId)return;
    const target=pointer.current.nodeId;if(!target)return;
    const p=points.current[target],pt=screenPoint(e);
    if(Math.hypot(pt.x-pointer.current.x,pt.y-pointer.current.y)<5&&!p.pinned)return;
    p.x=pointer.current.originX+pt.x-pointer.current.x;p.y=pointer.current.originY+pt.y-pointer.current.y;
    p.vx=p.vy=0;p.pinned=true;
    e.stopPropagation();
  }
  function onNodeUp(e:ReactPointerEvent<SVGGElement>,id:string){
    e.stopPropagation();const wasMoved=!!points.current[id]?.pinned;pointer.current=null;setSelected(id);if(wasMoved)setInfo('人物を選択しました。ドラッグで移動・固定できます。');setCounter(v=>v+1);
  }
  function onGroupDown(e:ReactPointerEvent<SVGGElement>,id:string){
    e.stopPropagation();const pt=screenPoint(e);
    const initial:Record<string,{x:number;y:number}>={};
    for(const n of graphNodes.filter(n=>n.group===id)){const p=points.current[n.id];if(p)initial[n.id]={x:p.x,y:p.y}}
    groupDrag.current={id:e.pointerId,group:id,x:pt.x,y:pt.y,initial};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onGroupMove(e:ReactPointerEvent<SVGGElement>){
    const drag=groupDrag.current;if(!drag||drag.id!==e.pointerId)return;
    e.stopPropagation();const pt=screenPoint(e),dx=pt.x-drag.x,dy=pt.y-drag.y;
    if(Math.hypot(dx,dy)<4)return;
    for(const [id,original] of Object.entries(drag.initial)){const p=points.current[id];if(!p)continue;
      p.x=original.x+dx;p.y=original.y+dy;p.vx=p.vy=0;p.pinned=true;
    }
  }
  function onGroupUp(e:ReactPointerEvent<SVGGElement>){
    e.stopPropagation();groupDrag.current=null;setCounter(v=>v+1);setInfo('グループの位置をまとめて固定しました');
  }
  function onBackgroundDown(e:ReactPointerEvent<SVGSVGElement>){
    if((e.target as Element).closest?.('[data-people-node]'))return;
    pointer.current={id:e.pointerId,kind:'pan',x:e.clientX,y:e.clientY,originX:0,originY:0,oldCamera:{...camera}};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onBackgroundMove(e:ReactPointerEvent<SVGSVGElement>){
    if(pointer.current?.kind!=='pan'||pointer.current.id!==e.pointerId)return;
    const p=pointer.current,rect=svg.current!.getBoundingClientRect(),old=p.oldCamera!;
    setCamera({...old,x:old.x-(e.clientX-p.x)/Math.max(1,rect.width)*old.w,y:old.y-(e.clientY-p.y)/Math.max(1,rect.height)*old.h});
  }
  function zoom(scale:number,at?:{x:number;y:number}){
    setCamera(prev=>{const cx=at?.x??prev.x+prev.w/2,cy=at?.y??prev.y+prev.h/2;
      const w=clamp(prev.w*scale,300,2200),h=prev.h*w/prev.w;return{x:cx-(cx-prev.x)*w/prev.w,y:cy-(cy-prev.y)*h/prev.h,w,h}});
  }
  function onWheel(e:ReactWheelEvent<SVGSVGElement>){e.preventDefault();const pt=screenPoint(e);zoom(e.deltaY>0?1.1:.9,pt)}
  function addMock(e:FormEvent){e.preventDefault();const name=newPerson.trim().slice(0,32);if(!name)return;
    const id='demo'+people.length;points.current[id]={x:WIDTH/2+45,y:HEIGHT/2+55,vx:0,vy:0,pinned:false};
    setPeople(old=>[...old,{id,name,channel:'offline',group:current?.group||groups[0].id,tags:[]}]);
    setLinks(old=>[...old,{a:focus,b:id,type:'meet',confirmed:false}]);setNewPerson('');setSelected(id);setInfo('デモ人物を追加（ブラウザ上の一時データのみ）');
  }
  function reset(){
    points.current=Object.fromEntries(PEOPLE.map((p,i)=>[p.id,startPoint(i,PEOPLE.length)]));
    setPeople(PEOPLE);setLinks(LINKS);setGroups(GROUPS);setCollapsed([]);setSelected('p0');setFocus('p0');setRoute([]);setQuery('');setPathEnd('');setCounter(v=>v+1);
    setInfo('サンプルを初期化しました');
  }
  function groupPerson(id:string,group:string){
    setPeople(prev=>prev.map(p=>p.id===id?{...p,group}:p));
    setCounter(v=>v+1);
  }
  function addGroup(e:FormEvent){e.preventDefault();const label=newGroup.trim().slice(0,30);if(!label)return;
    const id='custom'+groups.length;setGroups(old=>[...old,{id,label,color:'#a887d0'}]);setNewGroup('');setLayout('groups');
  }
  function pinSelected(){const p=points.current[selected];if(!p)return;p.pinned=!p.pinned;setInfo(p.pinned?'この人物を固定しました':'固定解除しました');setCounter(v=>v+1)}
  function pinAll(){for(const n of graphNodes){if(points.current[n.id])points.current[n.id].pinned=true}setCounter(v=>v+1);setInfo('表示中の位置を固定しました')}
  function selectRoute(){if(!pathEnd)return;const r=shortestPath(selected,pathEnd,links);setRoute(r);setInfo(r.length?r.map(id=>byId.get(id)?.name??id).join(' → '):'経路が見つかりません')}
  const peopleCount=graphNodes.filter(n=>!n.summary).length;
  const label=(type:Channel)=>({ace:'ACE',x:'X',instagram:'Instagram',tiktok:'TikTok',offline:'SNSなし・リアル'}[type]);
  return (
    <section className="people-lens" aria-label="People Graph fictional demonstration">
      <div className="people-lens-head">
        <div><p className="people-lens-kicker">HUMAN GRAPH · PEOPLE LENS</p><h2>人と人のつながりを、見える形に。</h2><p>架空データ専用の統合プレビュー。SNSの接点と実際の交流は別の関係として表示します。</p></div>
        <span className="people-lens-demo">架空データ・本番未接続</span>
      </div>
      <div className="people-lens-bar">
        <label>表示<select value={layout} onChange={e=>setLayout(e.target.value as Layout)}>
          <option value="flow">自由配置</option><option value="levels">1〜4階層</option><option value="groups">グループ</option>
        </select></label>
        <label>距離<select value={hops} onChange={e=>setHops(Number(e.target.value))}>
          {[1,2,3,4].map(n=><option key={n} value={n}>{n}階層</option>)}
        </select></label>
        <label>接点<select value={channel} onChange={e=>setChannel(e.target.value as Channel|'all')}>
          <option value="all">すべて</option><option value="ace">ACE</option><option value="x">X</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="offline">SNSなし</option>
        </select></label>
        <input aria-label="人物検索" placeholder="人物名・カテゴリー検索" value={query} onChange={e=>setQuery(e.target.value)} />
        <button type="button" onClick={()=>setPaused(v=>!v)}>{paused?'▶ 動かす':'⏸ 停止'}</button>
        <button type="button" onClick={pinAll}>現在位置を固定</button>
        <button type="button" onClick={reset}>初期化</button>
      </div>
      <div className="people-lens-workspace">
        <div className="people-lens-map">
          <div className="people-lens-stats"><span>{people.length} 人登録（デモ）</span><span>{peopleCount} ノード表示</span><span>{graphEdges.length} 関係線</span></div>
          <svg ref={svg} viewBox={camera.x+' '+camera.y+' '+camera.w+' '+camera.h}
            role="img" aria-label="架空の人脈ネットワーク。点をドラッグして位置を固定できます"
            onPointerDown={onBackgroundDown} onPointerMove={onBackgroundMove} onPointerUp={()=>{if(pointer.current?.kind==='pan')pointer.current=null}}
            onPointerCancel={()=>{pointer.current=null}} onWheel={onWheel}>
            {layout==='groups'&&groups.map(g=><g key={g.id} onPointerDown={e=>onGroupDown(e,g.id)}
              onPointerMove={onGroupMove} onPointerUp={onGroupUp}
              style={{cursor:'move',touchAction:'none'}}>
              <rect data-people-group={g.id} fill={g.color} fillOpacity=".07" stroke={g.color} strokeDasharray="8 7" rx="25" strokeWidth="1.5"/>
              <text data-group-caption={g.id} fontSize="13" fill={g.color} fontWeight="700">{g.label} · ドラッグで移動</text>
            </g>)}
            {graphEdges.map((e,i)=><line key={e.a+'|'+e.b+'|'+e.type} data-people-edge={i} stroke={routeEdges.has([e.a,e.b].sort().join('|'))?'#ee7800':e.confirmed?'#718091':'#a6a1a0'} strokeWidth={routeEdges.has([e.a,e.b].sort().join('|'))?4:1.8} strokeDasharray={e.confirmed?undefined:'5 6'} opacity=".73"/>)}
            {graphNodes.map(n=>{
              const p=points.current[n.id]||{x:WIDTH/2,y:HEIGHT/2,pinned:false},person=byId.get(n.id);
              const match=!query||n.label.toLowerCase().includes(query.toLowerCase())||person?.tags.some(t=>t.includes(query));
              const muted=(channel!=='all'&&n.channel!==channel&&!n.summary)||!match;
              const color=n.summary?groups.find(g=>g.id===n.group)?.color??'#ee7800':PALETTE[n.channel];
              return <g key={n.id} data-people-node={n.id} transform={'translate('+p.x+','+p.y+')'} tabIndex={0} role="button"
                aria-label={n.label+(n.summary?' グループを開く':' を選択')}
                onKeyDown={e=>{if(e.key==='Enter'){n.summary?setCollapsed(v=>v.filter(g=>g!==n.group)):setSelected(n.id)}}}
                onPointerDown={e=>onNodeDown(e,n.id)} onPointerMove={onNodeMove} onPointerUp={e=>onNodeUp(e,n.id)}
                style={{opacity:muted?.23:1,cursor:'grab',touchAction:'none'}}>
                <circle r={n.summary?24:n.id===focus?17:12} fill={color} stroke={selected===n.id?'#ffffff':n.id===focus?'#f4a65b':'#122031'} strokeWidth={selected===n.id?4:2}/>
                {n.summary&&<text textAnchor="middle" y="4" fill="#122031" fontSize="13" fontWeight="800">{n.count}</text>}
                {(n.id===focus||n.summary||n.id===selected||match&&query||graphNodes.length<30)&&<text textAnchor="middle" y={n.summary?45:32} fill="#edf1f4" paintOrder="stroke" stroke="#111b25" strokeWidth="4" fontSize="13" fontWeight="600">{n.label}</text>}
                {p.pinned&&<circle cx="12" cy="-12" r="4" fill="#f2d8a7" stroke="#1b2530" strokeWidth="1.5"/>}
              </g>
            })}
          </svg>
          <div className="people-lens-zoom"><button type="button" onClick={()=>zoom(.8)}>＋</button><button type="button" onClick={()=>zoom(1.25)}>−</button><button type="button" onClick={()=>setCamera({x:0,y:0,w:WIDTH,h:HEIGHT})}>全体</button></div>
          <div className="people-lens-legend">{Object.entries(PALETTE).map(([kind,color])=><span key={kind}><i style={{backgroundColor:color}}/>{label(kind as Channel)}</span>)}</div>
        </div>
        <aside className="people-lens-panel">
          <h3>選択中の人物</h3>
          {current?<><strong className="people-lens-name">{current.name}</strong><p className="people-lens-muted">{label(current.channel)} · {current.tags.length?current.tags.join(' / '):'カテゴリー未設定'}</p>
            <div className="people-lens-actions"><button type="button" onClick={()=>setFocus(selected)}>この人を中心に</button><button type="button" onClick={pinSelected}>{points.current[selected]?.pinned?'固定解除':'人物を固定'}</button></div>
            <label>グループ<select value={current.group} onChange={e=>groupPerson(selected,e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
            <label>カテゴリー（カンマ区切り）<input value={current.tags.join(', ')} onChange={e=>setPeople(v=>v.map(p=>p.id===selected?{...p,tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,8)}:p))} placeholder="例：選手, 教育"/></label>
            <label>つながりを探す<select value={pathEnd} onChange={e=>setPathEnd(e.target.value)}><option value="">相手を選択</option>{people.filter(p=>p.id!==selected).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <button type="button" onClick={selectRoute} disabled={!pathEnd}>最短経路を表示</button>
          </>:<p>グラフから人物を選択してください。</p>}
          <p className="people-lens-info" aria-live="polite">{info}</p>
          <div className="people-lens-divider"/>
          <h3>グループの管理</h3>
          {groups.map(g=><div key={g.id} className="people-lens-group-row"><span><i style={{backgroundColor:g.color}}/>{g.label}</span><button type="button" onClick={()=>{setCollapsed(v=>v.includes(g.id)?v.filter(x=>x!==g.id):[...v,g.id]);setLayout('groups')}}>{collapsed.includes(g.id)?'展開':'まとめる'}</button></div>)}
          <form onSubmit={addGroup} className="people-lens-inline"><input value={newGroup} onChange={e=>setNewGroup(e.target.value)} maxLength={30} placeholder="新しいグループ名" aria-label="新しいグループ名"/><button type="submit">＋</button></form>
          <div className="people-lens-divider"/>
          <h3>デモ人物を追加</h3>
          <form onSubmit={addMock} className="people-lens-inline"><input value={newPerson} onChange={e=>setNewPerson(e.target.value)} maxLength={32} placeholder="架空の人物名" aria-label="架空の人物名"/><button type="submit">＋</button></form>
          <p className="people-lens-muted">入力はこの画面だけ。再読み込みで消去され、実際の人脈管理には保存しません。</p>
          <a className="people-lens-related" href="/dashboard/relationships">既存Relationship OSを見る →</a>
        </aside>
      </div>
    </section>
  );
}
