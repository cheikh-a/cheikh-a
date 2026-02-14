import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine,
  ComposedChart
} from "recharts";

/* FT PALETTE */
const C={bg:"#FFF1E5",bg2:"#F2DFCE",bg3:"#EBD2BC",ink:"#33302E",ink2:"#66605C",ink3:"#99918B",
  coral:"#FF6B4A",crim:"#CC0033",teal:"#0D7680",tl:"#0A5E66",gold:"#C4920A",amber:"#F2A93B",
  vio:"#7B3F9E",rose:"#D94687",blue:"#2E6C9F",green:"#427762",
  grid:"rgba(51,48,46,0.06)",brd:"rgba(51,48,46,0.12)",
  fd:"'Playfair Display',Georgia,serif",fb:"'Source Serif 4',Georgia,serif",
  fm:"'JetBrains Mono','Courier New',monospace",fl:"'Libre Franklin','Helvetica Neue',sans-serif"};
const DARK_T={bg:"#1a1714",bg2:"#252019",bg3:"#302a22",card:"#1f1c17",
  ink:"#E8E0D8",ink2:"#B8AFA6",ink3:"#887F76",
  coral:"#FF8266",crim:"#FF4466",teal:"#2AACB8",tl:"#2AACB8",gold:"#E8B84A",amber:"#F2B960",
  vio:"#A872C8",rose:"#E868A0",blue:"#5A9CD4",green:"#6AAA8E",
  grid:"rgba(232,224,216,0.06)",brd:"rgba(232,224,216,0.12)",
  fd:C.fd,fb:C.fb,fm:C.fm,fl:C.fl};
const LIGHT_T={...C,card:"#FFF8F0"};

const ttS={background:"#fff",border:`1px solid ${C.brd}`,borderRadius:2,fontSize:10,fontFamily:C.fm,color:C.ink};
const yrFmt=v=>{const y=Math.floor(v);return v-y<0.08?`${y}`:""};

/* ENGINE */
/* ═══ PRNG ═══ */
class RNG{constructor(s){this.s=s||1}f(){this.s=(this.s*48271)%2147483647;return(this.s-1)/2147483646}
  poisson(l){if(l>20)return Math.max(0,Math.round(l+Math.sqrt(l)*this.norm()));let L=Math.exp(-l),p=1,k=0;do{k++;p*=this.f()}while(p>L);return k-1}
  norm(m=0,s=1){const u=this.f(),v=this.f();return m+s*Math.sqrt(-2*Math.log(u+1e-12))*Math.cos(6.2832*v)}
  choice(a){return a[Math.floor(this.f()*a.length)]}}

/* ═══ ENGINE ═══ */
function genNet(N,nD,rng){
  const m0=5,mE=2,pR=.12,nC=Math.floor(N*.15);const nodes=[];
  for(let i=0;i<N;i++){const isD=i<nD,isSS=!isD&&i<nD+2,isC=!isD&&!isSS&&i<nD+2+nC;
    const act=isD?8+rng.f()*4:isSS?5+rng.f()*3:isC?2.5+rng.f()*2:.5+rng.f()*1.5;
    nodes.push({id:i,inf:false,month:-1,gen:-1,by:-1,activity:act,isD,isSS,isC,
      hasFemP:rng.f()<(isD?.50:.88),femInf:false,childInf:false,onART:false,artS:-1,
      hasSTI:false,stiS:-1,rolePref:rng.f()<.35?0:rng.f()<.55?1:2})}
  nodes[0].inf=true;nodes[0].month=0;nodes[0].gen=0;
  const adj=Array.from({length:N},()=>new Set());
  for(let i=0;i<Math.min(m0,N);i++)for(let j=i+1;j<Math.min(m0,N);j++){adj[i].add(j);adj[j].add(i)}
  for(let i=m0;i<N;i++){const tgt=new Set();let at=0;
    while(tgt.size<Math.min(mE,i)&&at<300){at++;let tw=0;const w=new Float64Array(i);
      for(let j=0;j<i;j++){if(tgt.has(j)){w[j]=0;continue}
        const s=1/(1+Math.abs(nodes[i].activity-nodes[j].activity)/Math.max(nodes[i].activity,nodes[j].activity,.01));
        w[j]=(adj[j].size+1)*s;tw+=w[j]}
      let r=rng.f()*tw,c=0;for(let j=0;j<i;j++){c+=w[j];if(c>=r){tgt.add(j);break}}}
    for(const t of tgt){adj[i].add(t);adj[t].add(i)}}
  for(let i=0;i<N;i++){const nb=[...adj[i]];for(const j of nb){if(j<=i)continue;
    if(rng.f()<pR){let k,tr=0;do{k=Math.floor(rng.f()*N);tr++}while((k===i||adj[i].has(k))&&tr<50);
      if(tr<50){adj[i].delete(j);adj[j].delete(i);adj[i].add(k);adj[k].add(i)}}}}
  return{nodes,adj}}

const E={bAR:.0138,bAI:.0011,bMF:.0008,cP:.92,cE:.60,mtN:.30,mtA:.015,prY:.14,aPM:3.2,aPD:5,aCM:8,cdU:.25,cdE:.80,pT:6,
  vl(m){if(m<=1)return 18;if(m<=2)return 12;if(m<=3)return 6;if(m<=5)return 2;if(m<=48)return 1;if(m<=72)return 1+(m-48)*.04;return 2.5+(m-72)*.06},
  roles(a,b,r){const iA=a===0?.5:a===1?.8:.2,iB=b===0?.5:b===1?.8:.2;return r.f()<iA/(iA+iB+1e-10)?["I","R"]:["R","I"]},
  stiI(a){return 1-Math.pow(1-.015,a/3)}};

function simulate(cfg,rng){
  const{months=108,nD=2,nSize=180,artCov=0,concF=1}=cfg;
  const net=genNet(nSize,nD,rng);const{nodes,adj}=net;
  const edges=[];const tl=[];let cM=1,cF=0,cT=0;let P=[];
  const maxC=nd=>{if(nd.isD)return 6;return Math.round((nd.isSS?4:nd.isC?3:2)*concF)};
  const curP=id=>P.filter(p=>p.a===id||p.b===id).length;
  for(let m=1;m<=months;m++){
    if(m===24&&nD>=2&&!nodes[1].inf){nodes[1].inf=true;nodes[1].month=24;nodes[1].gen=0;nodes[1].by=-1;cM++}
    for(const n of nodes){if(n.hasSTI){if(m-n.stiS>=6){n.hasSTI=false;n.stiS=-1}}
      else if(rng.f()<E.stiI(n.activity)){n.hasSTI=true;n.stiS=m}}
    P=P.filter(p=>rng.f()>1-Math.exp(-1/E.pT));
    for(const nd of nodes){if(!nd.inf||nd.month>m)continue;
      if(!nd.isD&&nd.onART&&rng.f()<.85)continue;
      const cr=curP(nd.id),cp=maxC(nd);if(cr>=cp)continue;
      const nN=rng.poisson(nd.activity/12);
      for(let c=0;c<Math.min(nN,cp-cr);c++){
        let nb=[...adj[nd.id]].filter(j=>curP(j)<maxC(nodes[j]));if(!nb.length)break;
        if(nd.isD){const sus=nb.filter(j=>!nodes[j].inf);if(sus.length>0)nb=sus}
        const pr=rng.choice(nb);if(!P.some(p=>(p.a===nd.id&&p.b===pr)||(p.a===pr&&p.b===nd.id)))P.push({a:nd.id,b:pr,start:m})}}
    for(const p of P){const nA=nodes[p.a],nB=nodes[p.b];let src,tgt;
      if(nA.inf&&nA.month<=m&&!nB.inf){src=nA;tgt=nB}else if(nB.inf&&nB.month<=m&&!nA.inf){src=nB;tgt=nA}else continue;
      const aS=!src.isD&&src.onART&&(m-src.artS>6);if(aS&&rng.f()<.96)continue;
      const vl=aS?.04:E.vl(m-src.month);const sti=(src.hasSTI||tgt.hasSTI)?2.8:1;
      const nA2=Math.max(1,Math.round((src.isD?E.aPD:E.aPM)*(.7+rng.f()*.6)));let tx=false;
      for(let a=0;a<nA2&&!tx;a++){const[rS]=E.roles(src.rolePref,tgt.rolePref,rng);
        const cdR=src.isD?0:E.cdU;const uc=rng.f()<cdR;const cm=uc?(1-E.cdE):1;
        let b;if(rS==="I"){b=E.bAR}else{b=E.bAI;if(rng.f()<E.cP)b*=(1-E.cE)}
        const bA=Math.min(b*vl*sti*cm,.45);if(rng.f()<bA)tx=true}
      if(tx){tgt.inf=true;tgt.month=m;tgt.gen=src.gen+1;tgt.by=src.id;
        if(artCov>0&&rng.f()<artCov&&!tgt.isD){tgt.onART=true;tgt.artS=m+Math.round(rng.f()*12)}
        edges.push({s:src.id,t:tgt.id,m,type:"msm"});cM++}}
    for(const nd of nodes){if(!nd.inf||nd.month>m||!nd.hasFemP||nd.femInf)continue;
      const aS=!nd.isD&&nd.onART&&(m-nd.artS>6);if(aS&&rng.f()<.96)continue;
      const vl=aS?.04:E.vl(m-nd.month);const sti=nd.hasSTI?2.8:1;
      const nA2=Math.max(1,Math.round(E.aCM*(.7+rng.f()*.6)));let tx=false;
      for(let a=0;a<nA2&&!tx;a++){const uc=rng.f()<.10;const cm=uc?.20:1;
        const bA=Math.min(E.bMF*vl*sti*cm,.12);if(rng.f()<bA)tx=true}
      if(tx){nd.femInf=true;cF++;edges.push({s:nd.id,t:-1,m,type:"bridge"})}}
    for(const nd of nodes){if(!nd.femInf||nd.childInf)continue;
      if(rng.f()<E.prY/12){const r=(nd.onART&&m-nd.artS>6)?E.mtA:E.mtN;
        if(rng.f()<r){nd.childInf=true;cT++;edges.push({s:nd.id,t:-2,m:Math.min(m+9,months),type:"mtct"})}}}
    const dD=nodes.filter(n=>n.inf&&n.by>=0&&n.by<nD).length;
    tl.push({month:m,yr:+(2017+m/12).toFixed(2),msm:cM,fem:cF,mtct:cT,total:cM+cF+cT,
      newInf:edges.filter(e=>e.m===m).length,pships:P.length,dD})}
  const dirD=nodes.filter(n=>n.inf&&n.by>=0&&n.by<nD).length;
  const casD=nodes.filter(n=>{if(!n.inf||n.id<nD)return false;let c=n;while(c.by>=0){if(c.by<nD)return true;c=nodes[c.by]}return false}).length;
  return{nodes,edges,tl,totals:{msm:cM,fem:cF,mtct:cT,total:cM+cF+cT,dirD,casD}}}

function mc(N=800){
  const sc=[
    {key:"d1",l:"1 transmetteur (P₀ seul)",nD:1,color:C.teal,art:0,conc:1},
    {key:"d2",l:"2 transmetteurs (P₀+P₁)",nD:2,color:C.coral,art:0,conc:1},
    {key:"d2c",l:"2T + concurrence ×1.5",nD:2,color:C.crim,art:0,conc:1.5},
    {key:"d2art",l:"2T + 30% sous ARV",nD:2,color:C.teal,art:.30,conc:1},
    {key:"crim",l:"Pénalisation → 2% ARV",nD:2,color:C.vio,art:.02,conc:1},
  ];const out={};
  for(const s of sc){const aT=[],aO=[];let sN=null;
    for(let i=0;i<N;i++){const r=new RNG(i*251+s.nD*13337+(s.art*1e5|0)+((s.conc*100|0))*997+7);
      const res=simulate({months:108,nD:s.nD,nSize:180,artCov:s.art,concF:s.conc},r);
      aT.push(res.tl);aO.push(res.totals);if(i===0)sN=res}
    const agg=[];for(let m=0;m<108;m++){
      const v=aT.map(t=>t[m]?.total||0).sort((a,b)=>a-b);
      const ms=aT.map(t=>t[m]?.msm||0).sort((a,b)=>a-b);
      const fe=aT.map(t=>t[m]?.fem||0).sort((a,b)=>a-b);
      const mt=aT.map(t=>t[m]?.mtct||0).sort((a,b)=>a-b);
      const p=(a,q)=>a[Math.min(Math.floor(q*a.length),a.length-1)]||0;
      agg.push({month:m+1,yr:+(2017+(m+1)/12).toFixed(2),med:p(v,.5),p5:p(v,.05),p25:p(v,.25),p75:p(v,.75),p95:p(v,.95),
        msmM:p(ms,.5),femM:p(fe,.5),mtctM:p(mt,.5)})}
    const fi=aO.map(t=>t.total).sort((a,b)=>a-b);const pF=q=>fi[Math.min(Math.floor(q*fi.length),fi.length-1)];
    const mF=aO.map(t=>t.msm).sort((a,b)=>a-b);const fF=aO.map(t=>t.fem).sort((a,b)=>a-b);
    const tF=aO.map(t=>t.mtct).sort((a,b)=>a-b);
    const diF=aO.map(t=>t.dirD).sort((a,b)=>a-b);const caF=aO.map(t=>t.casD).sort((a,b)=>a-b);
    out[s.key]={...s,agg,sN,stats:{med:pF(.5),p5:pF(.05),p95:pF(.95),mean:Math.round(fi.reduce((a,b)=>a+b,0)/N),
      msmM:mF[N/2|0],femM:fF[N/2|0],mtctM:tF[N/2|0],dirM:diF[N/2|0],casM:caF[N/2|0]},
      hist:(()=>{const st=6,b={};fi.forEach(v=>{const k=Math.floor(v/st)*st;b[k]=(b[k]||0)+1});
        return Object.entries(b).map(([k,v])=>({x:+k,count:v})).sort((a,b)=>a.x-b.x)})()}}
  return out}

/* VISUALS */
/* ═══ ANIMATED NETWORK ═══ */
function AnimatedNet({sim,month=108,width=620,height=420}){
  const ref=useRef(null);
  const positions=useMemo(()=>{if(!sim)return[];
    const nodes=sim.nodes;
    const pos=nodes.map((n,i)=>{
      const angle=((n.gen>=0?n.gen:4)*2.4+i*0.618)*Math.PI*2/nodes.length*2;
      const radius=n.isD?30:(n.gen>=0?50+n.gen*42:170);
      return{...n,x:width/2+Math.cos(angle+i*.3)*radius*(0.6+Math.random()*0.5),
        y:height/2+Math.sin(angle+i*.3)*radius*(0.5+Math.random()*0.5)}});
    for(let iter=0;iter<200;iter++){
      for(let i=0;i<pos.length;i++){
        if(!pos[i].inf)continue;
        for(let j=i+1;j<pos.length;j++){
          if(!pos[j].inf)continue;
          const dx=pos[j].x-pos[i].x,dy=pos[j].y-pos[i].y;
          const d=Math.sqrt(dx*dx+dy*dy)+.1;
          const minD=pos[i].isD||pos[j].isD?50:pos[i].isSS||pos[j].isSS?35:22;
          if(d<minD*2){const f=(minD-d/2)/d*0.15;
            pos[i].x-=dx*f;pos[i].y-=dy*f;pos[j].x+=dx*f;pos[j].y+=dy*f}}
        pos[i].x+=(width/2-pos[i].x)*.003;pos[i].y+=(height/2-pos[i].y)*.003;
        pos[i].x=Math.max(20,Math.min(width-20,pos[i].x));
        pos[i].y=Math.max(20,Math.min(height-40,pos[i].y))}}
    return pos},[sim,width,height]);
  const visible=useMemo(()=>positions.filter(n=>n.inf&&n.month<=month),[positions,month]);
  const visEdges=useMemo(()=>sim?sim.edges.filter(e=>e.m<=month):[],[sim,month]);
  return(
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} style={{width:"100%",maxHeight:height,background:"#fff",borderRadius:6,border:`1px solid ${C.brd}`}}>
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill={C.crim} opacity={.4}/></marker>
        <radialGradient id="gD"><stop offset="0%" stopColor={C.gold} stopOpacity={.25}/><stop offset="100%" stopColor={C.gold} stopOpacity={0}/></radialGradient>
      </defs>
      {visEdges.filter(e=>e.t>=0).map((e,i)=>{
        const s=positions[e.s>=0?e.s:0],t=positions[e.t];if(!s||!t||!s.inf||s.month>month)return null;
        const age=Math.max(.05,1-(month-e.m)/60);
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={C.crim} strokeWidth={e.s<2?.8:.4} opacity={age*.4} markerEnd="url(#ah)">
          <animate attributeName="opacity" from={age*.8} to={age*.15} dur="3s" repeatCount="indefinite"/></line>})}
      {visEdges.filter(e=>e.type==="bridge").map((e,i)=>{
        const s=positions[e.s];if(!s)return null;
        const bx=Math.min(width-30,s.x+25+i*3),by=Math.min(height-30,s.y+20);
        return <g key={`b${i}`}>
          <line x1={s.x} y1={s.y} x2={bx} y2={by} stroke={C.amber} strokeWidth={.8} strokeDasharray="3 2" opacity={.5}/>
          <circle cx={bx} cy={by} r={4} fill={C.amber} opacity={.7}><animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/></circle>
          <text x={bx} y={by+3} textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">♀</text></g>})}
      {visEdges.filter(e=>e.type==="mtct"&&e.m<=month).map((e,i)=>{
        const s=positions[e.s];if(!s)return null;
        const cx=Math.min(width-30,s.x+35+i*4),cy=Math.min(height-20,s.y+32);
        return <g key={`t${i}`}><circle cx={cx} cy={cy} r={3} fill={C.vio} opacity={.7}><animate attributeName="r" values="2;4;2" dur="2.5s" repeatCount="indefinite"/></circle></g>})}
      {visible.filter(n=>n.isD).map(n=>
        <circle key={`g${n.id}`} cx={n.x} cy={n.y} r={35} fill="url(#gD)"><animate attributeName="r" values="30;40;30" dur="3s" repeatCount="indefinite"/></circle>)}
      {visible.map(n=>{
        const r=n.isD?10:n.isSS?7:3+Math.min(n.gen*0.5,3);
        const col=n.isD?C.gold:n.isSS?C.coral:n.gen<=1?C.crim:`hsl(${350-n.gen*15},70%,${45+n.gen*3}%)`;
        const isNew=month-n.month<3;
        return <g key={n.id}>
          {isNew&&<circle cx={n.x} cy={n.y} r={r+8} fill="none" stroke={col} strokeWidth={.5} opacity={.6}>
            <animate attributeName="r" from={r+3} to={r+15} dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from={.6} to={0} dur="1.5s" repeatCount="indefinite"/></circle>}
          <circle cx={n.x} cy={n.y} r={r} fill={col} opacity={.85} stroke={n.isD?"#8B6914":"none"} strokeWidth={n.isD?2:0}/>
          {n.isD&&<text x={n.x} y={n.y-r-5} textAnchor="middle" fontSize="8" fontFamily={C.fm} fill={C.gold} fontWeight="700">{n.id===0?"P₀":"P₁"}</text>}
        </g>})}
      <g transform={`translate(12,${height-22})`}>
        {[{c:C.gold,l:"Transmetteur délibéré",r:6},{c:C.crim,l:"HSH infecté",r:3.5},{c:C.amber,l:"Conjointe ♀",r:3.5},{c:C.vio,l:"Enfant (TME)",r:2.5}].map(({c,l,r},i)=>(
          <g key={i} transform={`translate(${i*150},0)`}><circle cx={0} cy={0} r={r} fill={c}/><text x={r+5} y={3.5} fontSize="8" fontFamily={C.fm} fill={C.ink3}>{l}</text></g>))}
      </g>
      <text x={width-8} y={14} textAnchor="end" fontSize="9" fontFamily={C.fm} fill={C.ink3}>
        Mois {month} · {visible.length} infectés · {visEdges.filter(e=>e.type==="bridge"&&e.m<=month).length} ponts ♀
      </text>
    </svg>);
}

/* ═══ STICK FIGURES ═══ */
function Stick({x,y,color="#33302E",r=4,label,gender}){
  return(<g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={r} fill={color}/>
    <line x1={0} y1={r} x2={0} y2={r+16} stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <line x1={-9} y1={r+6} x2={9} y2={r+6} stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
    <line x1={0} y1={r+16} x2={-7} y2={r+26} stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
    <line x1={0} y1={r+16} x2={7} y2={r+26} stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
    {gender==="f"&&<path d={`M-5,${r+8} L0,${r+18} L5,${r+8}`} fill={color} opacity={.15}/>}
    {label&&<text x={0} y={-r-4} textAnchor="middle" fontSize="7.5" fontFamily={C.fm} fill={color} fontWeight="600">{label}</text>}
  </g>)}
function VP({x1,y1,x2,y2,color=C.crim,delay=0,dur=2}){
  return(<circle r={2.5} fill={color} opacity={0}>
    <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={`M${x1},${y1} Q${(x1+x2)/2},${Math.min(y1,y2)-14} ${x2},${y2}`}/>
    <animate attributeName="opacity" values="0;.85;.85;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite"/>
  </circle>)}
function StickScene({id,width=640,height=165}){
  if(id==="recruit"){
    const px=55,py=72;
    const tg=[{x:155,y:42,d:.3},{x:225,y:80,d:.9},{x:300,y:38,d:1.6},{x:375,y:75,d:2.3},{x:445,y:48,d:3},{x:520,y:70,d:3.6}];
    return(<svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%",maxHeight:height,borderRadius:6}}>
      <rect width={width} height={height} fill="#fff" rx={6}/>
      <rect x={px+16} y={py-20} width={14} height={22} rx={2} fill="none" stroke={C.gold} strokeWidth={.8} opacity={.4}/>
      <Stick x={px} y={py} color={C.gold} r={5} label="P₀"/>
      {tg.map((t,i)=>{const inf=i<5;return(<g key={i}>
        <Stick x={t.x} y={t.y} color={inf?C.crim:"#C0B3A5"} r={3.5} label={inf&&i<3?`V${i+1}`:undefined}/>
        {inf&&<VP x1={px} y1={py} x2={t.x} y2={t.y} delay={t.d} dur={2.5}/>}
        {inf&&<circle cx={t.x} cy={t.y} r={10} fill="none" stroke={C.crim} strokeWidth={.3} opacity={0}>
          <animate attributeName="r" from="5" to="16" dur="2s" begin={`${t.d+2}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" from=".4" to="0" dur="2s" begin={`${t.d+2}s`} repeatCount="indefinite"/></circle>}
      </g>)})}
      <text x={width-10} y={height-6} textAnchor="end" fontSize="7" fontFamily={C.fm} fill={C.ink3}>Recrutement WhatsApp · transmission séquentielle · P₀ cible les séronégatifs</text>
    </svg>)}
  if(id==="bridge"){
    const st=[{x:55,y:65,c:C.crim,l:"HSH infecté",g:"m"},{x:185,y:65,c:C.amber,l:"Conjointe",g:"f"},{x:340,y:50,c:C.amber,l:"Grossesse",g:"f"},{x:340,y:100,c:C.vio,l:"",g:null},{x:500,y:65,c:C.vio,l:"Enfant VIH+",g:null}];
    return(<svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%",maxHeight:height,borderRadius:6}}>
      <rect width={width} height={height} fill="#fff" rx={6}/>
      <path d={`M120,42 L130,30 L140,42 L140,56 L120,56 Z`} fill="none" stroke={C.ink3} strokeWidth={.6} opacity={.25}/>
      <text x={130} y={52} textAnchor="middle" fontSize="5" fill={C.ink3} opacity={.4}>foyer</text>
      <Stick x={st[0].x} y={st[0].y} color={st[0].c} r={4.5} gender="m"/>
      <text x={st[0].x} y={st[0].y+38} textAnchor="middle" fontSize="7" fontFamily={C.fm} fill={st[0].c}>{st[0].l}</text>
      <Stick x={st[1].x} y={st[1].y} color={st[1].c} r={3.5} gender="f"/>
      <text x={st[1].x} y={st[1].y+38} textAnchor="middle" fontSize="7" fontFamily={C.fm} fill={st[1].c}>{st[1].l}</text>
      <text x={st[1].x} y={st[1].y-22} textAnchor="middle" fontSize="16" fill={C.amber} opacity={.4} fontFamily={C.fd} fontWeight="700">?</text>
      <line x1={st[0].x+16} y1={st[0].y+4} x2={st[1].x-16} y2={st[1].y+4} stroke={C.crim} strokeWidth={.7} strokeDasharray="3 2" opacity={.3}/>
      <VP x1={st[0].x+16} y1={st[0].y+4} x2={st[1].x-16} y2={st[1].y+4} delay={0} dur={2.5}/>
      <Stick x={st[2].x} y={st[2].y} color={st[2].c} r={3.5} gender="f"/>
      <text x={st[2].x} y={st[2].y-16} textAnchor="middle" fontSize="7" fontFamily={C.fm} fill={C.amber}>30 % TME</text>
      <line x1={st[1].x+16} y1={st[1].y} x2={st[2].x-16} y2={st[2].y} stroke={C.amber} strokeWidth={.7} strokeDasharray="3 2" opacity={.3}/>
      <VP x1={st[1].x+16} y1={st[1].y} x2={st[2].x-16} y2={st[2].y} color={C.amber} delay={2.5} dur={2.2}/>
      <circle cx={st[4].x} cy={st[4].y} r={4} fill={C.vio}/>
      <text x={st[4].x} y={st[4].y+18} textAnchor="middle" fontSize="7" fontFamily={C.fm} fill={C.vio}>{st[4].l}</text>
      <line x1={st[2].x+16} y1={st[2].y+8} x2={st[4].x-16} y2={st[4].y} stroke={C.vio} strokeWidth={.7} strokeDasharray="3 2" opacity={.3}/>
      <VP x1={st[2].x+16} y1={st[2].y+8} x2={st[4].x-16} y2={st[4].y} color={C.vio} delay={5} dur={2.2}/>
      <text x={width-10} y={height-6} textAnchor="end" fontSize="7" fontFamily={C.fm} fill={C.ink3}>Le pont bisexuel · la conjointe ne sait pas · sans PTME, 30 % de TME</text>
    </svg>)}
  if(id==="cascade"){
    const g0={x:45,y:78};const g1=[{x:130,y:30},{x:130,y:78},{x:130,y:126}];
    const g2=[{x:225,y:14},{x:225,y:44},{x:225,y:72},{x:225,y:96},{x:225,y:122},{x:225,y:148}];
    const g3=[{x:320,y:22},{x:320,y:52},{x:320,y:80},{x:320,y:108},{x:320,y:138}];
    const w=[{x:415,y:22,f:0},{x:415,y:80,f:2},{x:415,y:138,f:4}];
    const k=[{x:510,y:22,f:0},{x:510,y:138,f:2}];
    return(<svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%",maxHeight:height,borderRadius:6}}>
      <rect width={width} height={height} fill="#fff" rx={6}/>
      <Stick x={g0.x} y={g0.y} color={C.gold} r={5} label="P₀"/>
      {g1.map((p,i)=>(<g key={`a${i}`}><Stick x={p.x} y={p.y} color={C.crim} r={3.5}/>
        <VP x1={g0.x} y1={g0.y} x2={p.x} y2={p.y} delay={i*.35} dur={2.8}/></g>))}
      {g2.map((p,i)=>(<g key={`b${i}`}><Stick x={p.x} y={p.y} color={`hsl(350,65%,${47+i*3}%)`} r={3}/>
        <VP x1={g1[Math.floor(i/2)].x} y1={g1[Math.floor(i/2)].y} x2={p.x} y2={p.y} delay={1.2+i*.25} dur={2.8}/></g>))}
      {g3.map((p,i)=>(<g key={`c${i}`}><Stick x={p.x} y={p.y} color={`hsl(345,55%,${54+i*3}%)`} r={2.5}/></g>))}
      {w.map((wf,i)=>(<g key={`w${i}`}><Stick x={wf.x} y={wf.y} color={C.amber} r={3} gender="f"/>
        <VP x1={g3[wf.f].x} y1={g3[wf.f].y} x2={wf.x} y2={wf.y} color={C.amber} delay={3+i*.8} dur={2.5}/></g>))}
      {k.map((kk,i)=>(<g key={`k${i}`}><circle cx={kk.x} cy={kk.y} r={3} fill={C.vio}/>
        <circle cx={kk.x} cy={kk.y} r={8} fill="none" stroke={C.vio} strokeWidth={.3} opacity={0}>
          <animate attributeName="r" from="4" to="14" dur="2.5s" begin={`${4.5+i}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" from=".4" to="0" dur="2.5s" begin={`${4.5+i}s`} repeatCount="indefinite"/></circle></g>))}
      {[{x:45,l:"Gén. 0"},{x:130,l:"Gén. 1"},{x:225,l:"Gén. 2"},{x:320,l:"Gén. 3"},{x:415,l:"Conjointes ♀"},{x:510,l:"TME"}].map((g,i)=>(
        <text key={i} x={g.x} y={height-3} textAnchor="middle" fontSize="6.5" fontFamily={C.fm} fill={C.ink3}>{g.l}</text>))}
    </svg>)}
  if(id==="robert"){
    const rb={x:72,y:58};const tr=[{x:200,y:32},{x:200,y:72},{x:200,y:112}];
    const mn=[{x:330,y:18},{x:330,y:46},{x:330,y:72},{x:330,y:98},{x:330,y:126}];
    return(<svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%",maxHeight:height,borderRadius:6}}>
      <rect width={width} height={height} fill="#fff" rx={6}/>
      <line x1={138} y1={5} x2={138} y2={height-5} stroke={C.brd} strokeWidth={.8} strokeDasharray="4 3"/>
      <text x={68} y={14} textAnchor="middle" fontSize="7" fontFamily={C.fm} fill={C.ink3} opacity={.5}>France</text>
      <text x={270} y={14} textAnchor="middle" fontSize="7" fontFamily={C.fm} fill={C.ink3} opacity={.5}>Sénégal</text>
      <Stick x={rb.x} y={rb.y} color={C.crim} r={5} label="Robert, 73"/>
      {tr.map((t,i)=>(<g key={`t${i}`}><Stick x={t.x} y={t.y} color="#8B4513" r={3.5} label={i===0?"formateur":""}/>
        <VP x1={rb.x} y1={rb.y} x2={t.x} y2={t.y} color="#8B4513" delay={i*.7} dur={3}/></g>))}
      {mn.map((m,i)=>(<g key={`m${i}`}>
        <g transform={`translate(${m.x},${m.y})`}>
          <circle r={2.8} fill={C.vio}/><line x1={0} y1={3} x2={0} y2={12} stroke={C.vio} strokeWidth={1.3} strokeLinecap="round"/>
          <line x1={-5} y1={7} x2={5} y2={7} stroke={C.vio} strokeWidth={1} strokeLinecap="round"/>
          <line x1={0} y1={12} x2={-4} y2={19} stroke={C.vio} strokeWidth={1} strokeLinecap="round"/>
          <line x1={0} y1={12} x2={4} y2={19} stroke={C.vio} strokeWidth={1} strokeLinecap="round"/></g>
        <VP x1={tr[Math.min(i,2)].x} y1={tr[Math.min(i,2)].y} x2={m.x} y2={m.y} color={C.vio} delay={2+i*.5} dur={2.5}/></g>))}
      <rect x={430} y={48} width={18} height={13} rx={2} fill="none" stroke={C.ink3} strokeWidth={.7} opacity={.3}/>
      <circle cx={439} cy={54.5} r={3.5} fill="none" stroke={C.ink3} strokeWidth={.6} opacity={.3}/>
      <text x={439} y={76} textAnchor="middle" fontSize="6" fontFamily={C.fm} fill={C.ink3} opacity={.4}>filmé</text>
      <text x={width-10} y={height-6} textAnchor="end" fontSize="7" fontFamily={C.fm} fill={C.ink3}>Réseau transnational · 2017-2025 · exploitation de mineurs · transmission délibérée</text>
    </svg>)}
  if(id==="paradox"){
    // Two parallel scenarios: penalization vs. community testing
    const w2=width,h2=height;
    return(<svg viewBox={`0 0 ${w2} ${h2}`} style={{width:"100%",maxHeight:h2,borderRadius:6}}>
      <rect width={w2} height={h2} fill="#fff" rx={6}/>
      <line x1={w2/2} y1={8} x2={w2/2} y2={h2-8} stroke={C.brd} strokeWidth={.8} strokeDasharray="4 3"/>
      <text x={w2/4} y={16} textAnchor="middle" fontSize="8" fontFamily={C.fm} fill={C.vio} fontWeight="600">Art. 319 · pénalisation</text>
      <text x={3*w2/4} y={16} textAnchor="middle" fontSize="8" fontFamily={C.fm} fill={C.teal} fontWeight="600">Dépistage communautaire confidentiel</text>
      {/* Left: hidden, no testing, bridges */}
      <Stick x={60} y={55} color={C.crim} r={4} label="HSH+"/>
      <Stick x={130} y={55} color={C.crim} r={3}/>
      <Stick x={200} y={55} color={C.crim} r={3}/>
      <text x={130} y={92} textAnchor="middle" fontSize="6.5" fontFamily={C.fm} fill={C.vio}>0 % dépistés</text>
      <Stick x={95} y={115} color={C.amber} r={3} gender="f"/>
      <Stick x={165} y={115} color={C.amber} r={3} gender="f"/>
      <VP x1={60} y1={68} x2={95} y2={105} color={C.amber} delay={0} dur={2.5}/>
      <VP x1={130} y1={68} x2={165} y2={105} color={C.amber} delay={.8} dur={2.5}/>
      <circle cx={240} cy={115} r={3} fill={C.vio}/><text x={240} y={130} textAnchor="middle" fontSize="5.5" fontFamily={C.fm} fill={C.vio}>TME</text>
      <VP x1={165} y1={125} x2={230} y2={115} color={C.vio} delay={2} dur={2}/>
      {/* Right: tested, on ART, U=U */}
      <Stick x={w2/2+60} y={55} color={C.teal} r={4} label="HSH+"/>
      <Stick x={w2/2+130} y={55} color={C.teal} r={3}/>
      <Stick x={w2/2+200} y={55} color={C.green} r={3}/>
      <text x={w2/2+130} y={92} textAnchor="middle" fontSize="6.5" fontFamily={C.fm} fill={C.teal}>30 % sous ARV</text>
      <rect x={w2/2+55} y={42} width={22} height={10} rx={2} fill={C.teal} opacity={.15}/>
      <text x={w2/2+66} y={50} textAnchor="middle" fontSize="5" fill={C.teal}>U=U</text>
      <Stick x={w2/2+95} y={115} color={C.green} r={3} gender="f"/>
      <text x={w2/2+95} y={140} textAnchor="middle" fontSize="6" fontFamily={C.fm} fill={C.green}>protégée</text>
      <text x={w2-10} y={h2-6} textAnchor="end" fontSize="7" fontFamily={C.fm} fill={C.ink3}>Le paradoxe de la pénalisation · Beyrer 2012, Shannon 2015, Poteat 2011</text>
    </svg>)}
  return null}

/* UI COMPONENTS */
const Hed=({children,sub,color})=>(<div style={{marginBottom:sub?6:16,marginTop:sub?18:28}}><div style={{fontFamily:C.fd,fontSize:sub?20:28,fontWeight:sub?700:900,color:color||C.ink,lineHeight:1.2}}>{children}</div></div>);
const Body=({children})=>(<div style={{fontSize:15.5,lineHeight:1.95,color:C.ink2,fontFamily:C.fb,maxWidth:680,marginBottom:20,textAlign:"justify",hyphens:"auto"}}>{children}</div>);
const Pullquote=({children,source})=>(<div style={{borderLeft:`3px solid ${C.coral}`,paddingLeft:20,margin:"26px 0",maxWidth:600}}><div style={{fontSize:17,fontFamily:C.fd,fontStyle:"italic",color:C.ink,lineHeight:1.55}}>{children}</div>{source&&<div style={{fontSize:10.5,fontFamily:C.fm,color:C.ink3,marginTop:8}}>{source}</div>}</div>);
const Stat=({v,l,sub,c=C.coral})=>(<div style={{textAlign:"center",padding:"12px 8px"}}><div style={{fontSize:32,fontWeight:900,fontFamily:C.fd,color:c}}>{v}</div><div style={{fontSize:8.5,fontFamily:C.fm,color:C.ink3,letterSpacing:1.5,textTransform:"uppercase",marginTop:4}}>{l}</div>{sub&&<div style={{fontSize:10,fontFamily:C.fm,color:C.ink3,marginTop:2}}>{sub}</div>}</div>);
const Divider=()=>(<div style={{width:40,height:1,background:C.brd,margin:"36px 0"}}/>);
const Drop=({letter})=>(<span style={{float:"left",fontSize:52,fontFamily:C.fd,fontWeight:900,lineHeight:.85,marginRight:6,marginTop:4,color:C.ink}}>{letter}</span>);
const MathB=({children,label})=>(<div style={{marginBottom:14}}>{label&&<div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:C.teal,fontFamily:C.fm,marginBottom:6,fontWeight:600}}>{label}</div>}<div style={{background:"#F7EDE0",border:`1px solid ${C.brd}`,borderRadius:4,padding:"14px 18px",fontFamily:C.fm,fontSize:11,color:C.tl,lineHeight:1.85,overflowX:"auto",whiteSpace:"pre-wrap"}}>{children}</div></div>);
const Proof=({children})=>(<div style={{borderLeft:`2px solid ${C.teal}33`,paddingLeft:16,margin:"4px 0 18px"}}><div style={{fontSize:9,fontFamily:C.fm,color:C.teal,letterSpacing:2,marginBottom:6}}>DÉMONSTRATION</div><div style={{fontSize:12.5,fontFamily:C.fb,color:C.ink2,lineHeight:1.75,textAlign:"justify"}}>{children}</div><div style={{fontSize:11,fontFamily:C.fm,color:C.teal,textAlign:"right",marginTop:4}}>■</div></div>);
const Thm=({type="Proposition",num,title,children})=>(<div style={{background:"#F7EDE0",border:`1px solid ${C.teal}33`,borderLeft:`4px solid ${C.teal}`,borderRadius:4,padding:"14px 18px",margin:"14px 0"}}><div style={{fontSize:10,fontFamily:C.fm,color:C.teal,fontWeight:700,marginBottom:6,letterSpacing:1}}>{type} {num}{title?` — ${title}`:""}</div><div style={{fontSize:13,fontFamily:C.fb,color:C.ink,lineHeight:1.7,textAlign:"justify"}}>{children}</div></div>);
const CB=({color=C.amber,children,title})=>(<div style={{background:`${color}0C`,border:`1px solid ${color}33`,borderRadius:6,padding:"16px 18px",marginBottom:26}}>{title&&<div style={{fontSize:14,fontFamily:C.fd,fontWeight:700,color}}>{title}</div>}<div style={{fontSize:13,fontFamily:C.fb,color:C.ink2,lineHeight:1.75,marginTop:title?6:0,textAlign:"justify"}}>{children}</div></div>);
const FB=({color=C.crim,label,children})=>(<div style={{background:"#fff",border:`1px solid ${C.brd}`,borderRadius:6,padding:"18px 20px",marginBottom:26}}><div style={{fontSize:9,fontFamily:C.fm,color,letterSpacing:2,marginBottom:10}}>{label}</div><div style={{fontSize:12.5,fontFamily:C.fb,color:C.ink2,lineHeight:1.85,textAlign:"justify"}}>{children}</div></div>);

/* ============================================================
   KaTeX loader + Tex components
   ============================================================ */
const _katexPromise=(()=>{
  if(typeof window!=="undefined"&&!window.katex){
    return new Promise((resolve)=>{
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
      s.onload=()=>resolve(window.katex);
      s.onerror=()=>resolve(null);
      document.head.appendChild(s);
    });
  }
  return Promise.resolve(typeof window!=="undefined"?window.katex:null);
})();

function useKaTeX(){
  const[k,setK]=useState(null);
  useEffect(()=>{_katexPromise.then(v=>setK(v))},[]);
  return k;
}

/* Inline math */
function Tex({tex,style}){
  const katex=useKaTeX();
  if(!katex)return <code style={{fontFamily:C.fm,fontSize:"0.9em",...style}}>{tex}</code>;
  try{
    const html=katex.renderToString(tex,{throwOnError:false,displayMode:false});
    return <span style={style} dangerouslySetInnerHTML={{__html:html}}/>;
  }catch{return <code style={{fontFamily:C.fm,fontSize:"0.9em",...style}}>{tex}</code>}
}

/* Display math (block) */
function TexBlock({tex,TC:_TC}){
  const TC2=_TC||C;
  const katex=useKaTeX();
  const containerStyle={background:TC2.bg2||"#F2DFCE",border:"1px solid "+(TC2.brd||"rgba(51,48,46,0.12)"),borderRadius:4,padding:"14px 20px",margin:"18px 0",overflowX:"auto",textAlign:"center"};
  if(!katex)return <div style={containerStyle}><code style={{fontFamily:C.fm,fontSize:13}}>{tex}</code></div>;
  try{
    const html=katex.renderToString(tex,{throwOnError:false,displayMode:true});
    return <div style={containerStyle} dangerouslySetInnerHTML={{__html:html}}/>;
  }catch{return <div style={containerStyle}><code style={{fontFamily:C.fm,fontSize:13}}>{tex}</code></div>}
}

/* ============================================================
   Interactive visuals for IntraPartyArticle
   ============================================================ */

/* ---- Seeded PRNG (Mulberry32) ---- */
function mulberry32(seed){let t=seed+0x6D2B79F5;return()=>{t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

/* ---- Normal distribution helpers ---- */
function boxMuller(rng){const u1=rng(),u2=rng();return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)}
function normPdf(x,mu,sig){return Math.exp(-0.5*((x-mu)/sig)**2)/(sig*Math.sqrt(2*Math.PI))}
function normCdf(x,mu,sig){const z=(x-mu)/(sig*Math.sqrt(2));return 0.5*(1+erf(z))}
function erf(x){const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;const s=x<0?-1:1;const t=1/(1+p*Math.abs(x));const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);return s*y}

/* ---- Posterior function ---- */
function posteriorFn(x,pi,sigma){
  const ratio=(1-pi)/pi*Math.exp((2*x-1)/(2*sigma*sigma));
  return 1/(1+ratio);
}

/* ---- Cutoff function ---- */
function cutoffFn(pi,muStar,sigma){
  if(muStar<=0||muStar>=1||pi<=0||pi>=1)return 0.5;
  return 0.5+sigma*sigma*Math.log(pi*(1-muStar)/((1-pi)*muStar));
}

/* ============================================================
   GameTreeViz: Animated extensive-form game tree
   ============================================================ */
function GameTreeViz({TC:_TC}){
  const TC=_TC||C;
  const[step,setStep]=useState(0);
  const[playing,setPlaying]=useState(false);
  const iv=useRef(null);

  useEffect(()=>{
    if(playing){iv.current=setInterval(()=>setStep(s=>{if(s>=5){setPlaying(false);return 5}return s+1}),1200)}
    else clearInterval(iv.current);
    return()=>clearInterval(iv.current);
  },[playing]);

  const W=560,H=400;
  const nodes=[
    {id:"nature",x:280,y:36,label:"Nature",sub:"draws type"},
    {id:"loyal",x:140,y:120,label:"Loyal",sub:"prob \u03c0"},
    {id:"auton",x:420,y:120,label:"Autonomist",sub:"prob 1\u2212\u03c0"},
    {id:"fL",x:60,y:210,label:"F: choose m",sub:"H or N"},
    {id:"fA",x:340,y:210,label:"F: choose m",sub:"H or N"},
    {id:"sL",x:60,y:300,label:"S: choose a",sub:"a=0 (loyal)"},
    {id:"sA",x:340,y:300,label:"S: choose a",sub:"a=1 (drift)"},
    {id:"mL",x:60,y:380,label:"M: observe x",sub:"support iff x < x*"},
    {id:"mA",x:340,y:380,label:"M: observe x",sub:"withdraw if x > x*"},
  ];
  const edges=[
    {from:"nature",to:"loyal",step:1},{from:"nature",to:"auton",step:1},
    {from:"loyal",to:"fL",step:2},{from:"auton",to:"fA",step:2},
    {from:"fL",to:"sL",step:3},{from:"fA",to:"sA",step:3},
    {from:"sL",to:"mL",step:4},{from:"sA",to:"mA",step:4},
  ];

  const nodeMap={};nodes.forEach(n=>nodeMap[n.id]=n);

  return(
  <div style={{background:TC.bg2,border:"1px solid "+TC.brd,borderRadius:6,padding:"16px",marginBottom:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <span style={{fontFamily:C.fm,fontSize:9,letterSpacing:2,fontWeight:700,color:TC.coral}}>EXTENSIVE-FORM GAME</span>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{setStep(0);setPlaying(true)}} style={{background:TC.coral,color:"#fff",border:"none",borderRadius:3,padding:"4px 12px",fontSize:10,fontFamily:C.fm,cursor:"pointer"}}>
          {playing?"Playing...":"Play"}</button>
        <button onClick={()=>{setPlaying(false);setStep(0)}} style={{background:"transparent",color:TC.ink3,border:"1px solid "+TC.brd,borderRadius:3,padding:"4px 10px",fontSize:10,fontFamily:C.fm,cursor:"pointer"}}>Reset</button>
      </div>
    </div>
    <svg viewBox={`0 0 ${W} ${H+10}`} style={{width:"100%",maxWidth:W}}>
      {edges.filter(e=>e.step<=step).map((e,i)=>{
        const f=nodeMap[e.from],t=nodeMap[e.to];
        return <line key={i} x1={f.x} y1={f.y+10} x2={t.x} y2={t.y-10}
          stroke={TC.coral} strokeWidth={1.5} strokeDasharray={step===e.step?"4,4":"none"}
          opacity={step===e.step?0.7:0.35}/>;
      })}
      {nodes.map((n,i)=>{
        const visible=i===0||edges.some(e=>e.to===n.id&&e.step<=step);
        if(!visible)return null;
        const active=edges.some(e=>e.to===n.id&&e.step===step)||
          (n.id==="nature"&&step>=1);
        return <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={12}
            fill={active?TC.coral:TC.bg} stroke={active?TC.coral:TC.brd} strokeWidth={1.5}/>
          <text x={n.x} y={n.y+3} textAnchor="middle" fontSize={7} fontFamily={C.fm}
            fill={active?"#fff":TC.ink} fontWeight={600}>{n.label.split(":")[0]}</text>
          <text x={n.x} y={n.y+22} textAnchor="middle" fontSize={7} fontFamily={C.fm}
            fill={TC.ink3}>{n.sub}</text>
        </g>;
      })}
      <text x={W-10} y={H} textAnchor="end" fontSize={9} fontFamily={C.fm} fill={TC.ink3}>
        {step===0?"Press Play":step<=4?`Stage ${step} of 4`:"Complete"}</text>
    </svg>
  </div>);
}

/* ============================================================
   PosteriorPlot: Interactive posterior curve with sliders
   ============================================================ */
function PosteriorPlot({TC:_TC}){
  const TC=_TC||C;
  const[pi,setPi]=useState(0.6);
  const[sigma,setSigma]=useState(0.5);
  const[muB,setMuB]=useState(0.65);
  const[muE,setMuE]=useState(0.45);
  const[hover,setHover]=useState(null);
  const svgRef=useRef(null);

  const W=560,HH=280,pad={l:50,r:20,t:20,b:40};
  const pw=W-pad.l-pad.r,ph=HH-pad.t-pad.b;

  const xMin=-1.5,xMax=2.5;
  const toSvgX=x=>pad.l+(x-xMin)/(xMax-xMin)*pw;
  const toSvgY=y=>pad.t+(1-y)*ph;
  const fromSvgX=sx=>(sx-pad.l)/pw*(xMax-xMin)+xMin;

  const xBstar=cutoffFn(pi,muB,sigma);
  const xEstar=cutoffFn(pi,muE,sigma);

  const pts=[];
  for(let i=0;i<=200;i++){
    const x=xMin+(xMax-xMin)*i/200;
    const mu=posteriorFn(x,pi,sigma);
    pts.push({x,mu});
  }
  const pathD="M"+pts.map(p=>toSvgX(p.x)+","+toSvgY(p.mu)).join("L");

  const handleMouse=(e)=>{
    const rect=svgRef.current.getBoundingClientRect();
    const sx=e.clientX-rect.left;
    const x=fromSvgX(sx*(W/rect.width));
    if(x>=xMin&&x<=xMax)setHover({x,mu:posteriorFn(x,pi,sigma),sx:toSvgX(x),sy:toSvgY(posteriorFn(x,pi,sigma))});
    else setHover(null);
  };

  const sliderStyle={width:"100%",accentColor:TC.coral,cursor:"pointer"};

  return(
  <div style={{background:TC.bg2,border:"1px solid "+TC.brd,borderRadius:6,padding:"16px",marginBottom:20}}>
    <span style={{fontFamily:C.fm,fontSize:9,letterSpacing:2,fontWeight:700,color:TC.coral}}>POSTERIOR <Tex tex="\mu(x)"/> AND FACTION CUTOFFS</span>

    <svg ref={svgRef} viewBox={`0 0 ${W} ${HH}`} style={{width:"100%",maxWidth:W,marginTop:8}}
      onMouseMove={handleMouse} onMouseLeave={()=>setHover(null)}>
      {[0,.25,.5,.75,1].map(y=>(
        <g key={y}>
          <line x1={pad.l} y1={toSvgY(y)} x2={W-pad.r} y2={toSvgY(y)} stroke={TC.brd} strokeDasharray="2,3"/>
          <text x={pad.l-6} y={toSvgY(y)+3} textAnchor="end" fontSize={8} fontFamily={C.fm} fill={TC.ink3}>{y.toFixed(2)}</text>
        </g>
      ))}
      {[-1,0,0.5,1,1.5,2].map(x=>(
        <g key={x}>
          <line x1={toSvgX(x)} y1={pad.t} x2={toSvgX(x)} y2={HH-pad.b} stroke={TC.brd} strokeDasharray="2,3"/>
          <text x={toSvgX(x)} y={HH-pad.b+14} textAnchor="middle" fontSize={8} fontFamily={C.fm} fill={TC.ink3}>{x}</text>
        </g>
      ))}
      <line x1={pad.l} y1={toSvgY(muB)} x2={W-pad.r} y2={toSvgY(muB)} stroke={TC.blue} strokeDasharray="4,4" strokeWidth={1}/>
      <text x={W-pad.r+2} y={toSvgY(muB)+3} fontSize={8} fontFamily={C.fm} fill={TC.blue}>{"\u03bc*_B"}</text>
      <line x1={pad.l} y1={toSvgY(muE)} x2={W-pad.r} y2={toSvgY(muE)} stroke={TC.green} strokeDasharray="4,4" strokeWidth={1}/>
      <text x={W-pad.r+2} y={toSvgY(muE)+3} fontSize={8} fontFamily={C.fm} fill={TC.green}>{"\u03bc*_E"}</text>
      <path d={pathD} fill="none" stroke={TC.coral} strokeWidth={2}/>
      {isFinite(xBstar)&&xBstar>=xMin&&xBstar<=xMax&&<>
        <line x1={toSvgX(xBstar)} y1={pad.t} x2={toSvgX(xBstar)} y2={HH-pad.b} stroke={TC.blue} strokeWidth={1.5}/>
        <text x={toSvgX(xBstar)} y={pad.t-4} textAnchor="middle" fontSize={8} fontFamily={C.fm} fill={TC.blue} fontWeight={600}>{"x*_B="+xBstar.toFixed(2)}</text>
      </>}
      {isFinite(xEstar)&&xEstar>=xMin&&xEstar<=xMax&&<>
        <line x1={toSvgX(xEstar)} y1={pad.t} x2={toSvgX(xEstar)} y2={HH-pad.b} stroke={TC.green} strokeWidth={1.5}/>
        <text x={toSvgX(xEstar)} y={pad.t-4} textAnchor="middle" fontSize={8} fontFamily={C.fm} fill={TC.green} fontWeight={600}>{"x*_E="+xEstar.toFixed(2)}</text>
      </>}
      {isFinite(xBstar)&&isFinite(xEstar)&&xBstar<xEstar&&
        <rect x={toSvgX(xBstar)} y={pad.t} width={toSvgX(xEstar)-toSvgX(xBstar)} height={ph}
          fill={TC.gold} opacity={0.08}/>
      }
      {hover&&<>
        <circle cx={hover.sx} cy={hover.sy} r={4} fill={TC.coral}/>
        <rect x={hover.sx+8} y={hover.sy-24} width={120} height={20} rx={3} fill={TC.bg} stroke={TC.brd}/>
        <text x={hover.sx+12} y={hover.sy-11} fontSize={9} fontFamily={C.fm} fill={TC.ink}>
          x={hover.x.toFixed(2)}, {"\u03bc"}={hover.mu.toFixed(3)}</text>
      </>}
      <text x={W/2} y={HH-4} textAnchor="middle" fontSize={9} fontFamily={C.fm} fill={TC.ink3}>Signal x</text>
      <text x={12} y={HH/2} textAnchor="middle" fontSize={9} fontFamily={C.fm} fill={TC.ink3} transform={`rotate(-90,12,${HH/2})`}>{"\u03bc(x)"}</text>
    </svg>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
      <div>
        <div style={{fontFamily:C.fm,fontSize:9,color:TC.ink3,marginBottom:2}}>Prior <Tex tex="\pi"/> = {pi.toFixed(2)}</div>
        <input type="range" min={0.05} max={0.95} step={0.01} value={pi} onChange={e=>setPi(+e.target.value)} style={sliderStyle}/>
      </div>
      <div>
        <div style={{fontFamily:C.fm,fontSize:9,color:TC.ink3,marginBottom:2}}>Noise <Tex tex="\sigma"/> = {sigma.toFixed(2)}</div>
        <input type="range" min={0.1} max={1.5} step={0.01} value={sigma} onChange={e=>setSigma(+e.target.value)} style={sliderStyle}/>
      </div>
      <div>
        <div style={{fontFamily:C.fm,fontSize:9,color:TC.blue,marginBottom:2}}>Base threshold <Tex tex="\mu_B^*"/> = {muB.toFixed(2)}</div>
        <input type="range" min={0.05} max={0.95} step={0.01} value={muB} onChange={e=>setMuB(+e.target.value)} style={sliderStyle}/>
      </div>
      <div>
        <div style={{fontFamily:C.fm,fontSize:9,color:TC.green,marginBottom:2}}>Cadres threshold <Tex tex="\mu_E^*"/> = {muE.toFixed(2)}</div>
        <input type="range" min={0.05} max={0.95} step={0.01} value={muE} onChange={e=>setMuE(+e.target.value)} style={sliderStyle}/>
      </div>
    </div>

    <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
      <span style={{fontSize:9,fontFamily:C.fm,color:TC.coral}}>--- Posterior <Tex tex="\mu(x)"/></span>
      <span style={{fontSize:9,fontFamily:C.fm,color:TC.blue}}>| <Tex tex="x_B^*"/> (base cutoff)</span>
      <span style={{fontSize:9,fontFamily:C.fm,color:TC.green}}>| <Tex tex="x_E^*"/> (cadres cutoff)</span>
      <span style={{fontSize:9,fontFamily:C.fm,color:TC.gold}}>Shaded: only cadres support</span>
    </div>
  </div>);
}

/* ============================================================
   MonteCarloPanel: 1000-run simulation
   ============================================================ */
function MonteCarloPanel({TC:_TC}){
  const TC=_TC||C;
  const[pi,setPi]=useState(0.6);
  const[sigma,setSigma]=useState(0.5);
  const[muB,setMuB]=useState(0.65);
  const[muE,setMuE]=useState(0.45);
  const[seed,setSeed]=useState(42);
  const[useSeeded,setUseSeeded]=useState(true);
  const[results,setResults]=useState(null);

  const run=()=>{
    const rng=useSeeded?mulberry32(seed):Math.random.bind(Math);
    const N=1000;
    const xBstar=cutoffFn(pi,muB,sigma);
    const xEstar=cutoffFn(pi,muE,sigma);
    const signals=[];
    let bothSupport=0,onlyCadres=0,neither=0;
    let baseSupRate=0,cadreSupRate=0;

    for(let i=0;i<N;i++){
      const isLoyal=rng()<pi;
      const alpha=isLoyal?0:1;
      const noise=boxMuller(rng)*sigma;
      const x=alpha+noise;
      signals.push({x,isLoyal});
      const yB=x<xBstar?1:0;
      const yE=x<xEstar?1:0;
      if(yB&&yE)bothSupport++;
      else if(!yB&&yE)onlyCadres++;
      else neither++;
      baseSupRate+=yB;
      cadreSupRate+=yE;
    }

    const bins=40;const lo=-2,hi=3;const bw=(hi-lo)/bins;
    const hist=Array(bins).fill(0);
    signals.forEach(s=>{const b=Math.floor((s.x-lo)/bw);if(b>=0&&b<bins)hist[b]++});
    const histData=hist.map((c,i)=>({x:lo+i*bw+bw/2,count:c}));

    setResults({
      histData,xBstar,xEstar,
      bothSupport:bothSupport/N,onlyCadres:onlyCadres/N,neither:neither/N,
      baseSup:baseSupRate/N,cadreSup:cadreSupRate/N,
      N,signals
    });
    if(useSeeded)setSeed(s=>s+1);
  };

  const W=560,HH=180,pad={l:40,r:20,t:10,b:30};

  return(
  <div style={{background:TC.bg2,border:"1px solid "+TC.brd,borderRadius:6,padding:"16px",marginBottom:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <span style={{fontFamily:C.fm,fontSize:9,letterSpacing:2,fontWeight:700,color:TC.coral}}>MONTE CARLO (1000 RUNS)</span>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <label style={{fontFamily:C.fm,fontSize:9,color:TC.ink3,display:"flex",alignItems:"center",gap:4}}>
          <input type="checkbox" checked={useSeeded} onChange={e=>setUseSeeded(e.target.checked)}/> Seeded RNG
        </label>
        <button onClick={run} style={{background:TC.coral,color:"#fff",border:"none",borderRadius:3,padding:"5px 16px",fontSize:10,fontFamily:C.fm,cursor:"pointer",fontWeight:600}}>
          Run 1000</button>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
      <div><div style={{fontFamily:C.fm,fontSize:8,color:TC.ink3}}><Tex tex="\pi"/>={pi.toFixed(2)}</div>
        <input type="range" min={0.1} max={0.9} step={0.05} value={pi} onChange={e=>setPi(+e.target.value)} style={{width:"100%",accentColor:TC.coral}}/></div>
      <div><div style={{fontFamily:C.fm,fontSize:8,color:TC.ink3}}><Tex tex="\sigma"/>={sigma.toFixed(2)}</div>
        <input type="range" min={0.1} max={1.5} step={0.05} value={sigma} onChange={e=>setSigma(+e.target.value)} style={{width:"100%",accentColor:TC.coral}}/></div>
      <div><div style={{fontFamily:C.fm,fontSize:8,color:TC.blue}}><Tex tex="\mu_B^*"/>={muB.toFixed(2)}</div>
        <input type="range" min={0.1} max={0.9} step={0.05} value={muB} onChange={e=>setMuB(+e.target.value)} style={{width:"100%",accentColor:TC.blue}}/></div>
      <div><div style={{fontFamily:C.fm,fontSize:8,color:TC.green}}><Tex tex="\mu_E^*"/>={muE.toFixed(2)}</div>
        <input type="range" min={0.1} max={0.9} step={0.05} value={muE} onChange={e=>setMuE(+e.target.value)} style={{width:"100%",accentColor:TC.green}}/></div>
    </div>

    {results?(<>
      <svg viewBox={`0 0 ${W} ${HH}`} style={{width:"100%",maxWidth:W}}>
        {results.histData.map((d,i)=>{
          const bw2=(W-pad.l-pad.r)/results.histData.length;
          const maxC=Math.max(...results.histData.map(d=>d.count),1);
          const h=d.count/maxC*(HH-pad.t-pad.b);
          return <rect key={i} x={pad.l+i*bw2} y={HH-pad.b-h} width={bw2-1} height={h}
            fill={d.x<results.xBstar?TC.teal:d.x<results.xEstar?TC.gold:TC.crim} opacity={0.7}/>;
        })}
        {[{v:results.xBstar,c:TC.blue,l:"x*_B"},{v:results.xEstar,c:TC.green,l:"x*_E"}].map(({v,c,l})=>{
          const sx=pad.l+(v-(-2))/(3-(-2))*(W-pad.l-pad.r);
          return isFinite(sx)&&sx>pad.l&&sx<W-pad.r?
            <g key={l}><line x1={sx} y1={pad.t} x2={sx} y2={HH-pad.b} stroke={c} strokeWidth={1.5} strokeDasharray="3,3"/>
            <text x={sx} y={pad.t-2} textAnchor="middle" fontSize={8} fontFamily={C.fm} fill={c}>{l}</text></g>:null;
        })}
        <text x={W/2} y={HH-4} textAnchor="middle" fontSize={8} fontFamily={C.fm} fill={TC.ink3}>Signal x (teal=both support, gold=only cadres, red=neither)</text>
      </svg>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
        {[{label:"Both support",val:results.bothSupport,color:TC.teal},
          {label:"Only cadres",val:results.onlyCadres,color:TC.gold},
          {label:"Neither supports",val:results.neither,color:TC.crim}].map(o=>(
          <div key={o.label} style={{background:TC.bg,border:"1px solid "+TC.brd,borderRadius:4,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontFamily:C.fm,fontSize:20,fontWeight:700,color:o.color}}>{(o.val*100).toFixed(1)}%</div>
            <div style={{fontFamily:C.fm,fontSize:9,color:TC.ink3}}>{o.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
        <div style={{background:TC.bg,border:"1px solid "+TC.brd,borderRadius:4,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontFamily:C.fm,fontSize:16,fontWeight:700,color:TC.blue}}>{(results.baseSup*100).toFixed(1)}%</div>
          <div style={{fontFamily:C.fm,fontSize:9,color:TC.ink3}}>Base support rate</div>
        </div>
        <div style={{background:TC.bg,border:"1px solid "+TC.brd,borderRadius:4,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontFamily:C.fm,fontSize:16,fontWeight:700,color:TC.green}}>{(results.cadreSup*100).toFixed(1)}%</div>
          <div style={{fontFamily:C.fm,fontSize:9,color:TC.ink3}}>Cadres support rate</div>
        </div>
      </div>
    </>):(<div style={{textAlign:"center",padding:"40px 0",fontFamily:C.fm,fontSize:11,color:TC.ink3}}>
      Press "Run 1000" to simulate</div>)}
  </div>);
}

/* ============================================================
   ScenarioExplorer: 2027 and 2029 conditional scenarios
   ============================================================ */
function ScenarioExplorer({TC:_TC}){
  const TC=_TC||C;
  const[openScenario,setOpenScenario]=useState(null);

  const scenarios=[
    {id:"2027_low",year:2027,title:"Low-drift scenario",
     signal:"If by 2027, presidential appointments remain within the founding coalition and no major alliance with pre-2024 opposition figures is observed, the model implies that the signal x would cluster near 0.",
     implication:"Under this condition, both factions' posteriors remain above their thresholds. The model predicts continued support from both base and cadres.",
     params:"\\alpha \\approx 0,\\; \\sigma = 0.5,\\; x \\sim \\mathcal{N}(0,\\, 0.25)"},
    {id:"2027_mid",year:2027,title:"Moderate-drift scenario",
     signal:"If by 2027, some appointments draw from outside the founding coalition but core ministerial positions remain with PASTEF figures, the model implies a signal x in the intermediate range between x*_B and x*_E.",
     implication:"Under this condition, the base posterior would fall below the base threshold while the cadres posterior remains above the cadres threshold. The model predicts that the base withdraws support while cadres continue to support.",
     params:"\\alpha \\approx 0.4\\text{--}0.6,\\; \\sigma = 0.5,\\; x \\sim \\mathcal{N}(0.5,\\, 0.25)"},
    {id:"2027_high",year:2027,title:"High-drift scenario",
     signal:"If by 2027, the presidency has formed alliances with former opposition leaders and cadres from the Benno Bokk Yakaar coalition (hypothesis, for scenario analysis), the signal x would cluster near 1 or above.",
     implication:"Under this condition, both factions' posteriors fall below their thresholds. The model predicts withdrawal by both base and cadres.",
     params:"\\alpha \\approx 1,\\; \\sigma = 0.5,\\; x \\sim \\mathcal{N}(1,\\, 0.25)"},
    {id:"2029_clar",year:2029,title:"Repeated clarification before 2029 elections",
     signal:"If the founder activates additional clarification protocols before the 2029 elections, the model implies a reduction in noise (more informative signals). Observable: public framing events, institutional accountability moments.",
     implication:"Under reduced noise, the cutoffs move closer to 1/2, and the posterior curve steepens. The gap between base and cadres cutoffs narrows. The model implies that even moderate drift becomes more detectable and more costly for the successor.",
     params:"\\sigma_H < \\sigma_N,\\; \\text{tighter cutoffs}"},
    {id:"2029_exit",year:2029,title:"Founder exit scenario",
     signal:"If the founder were to exit government (hypothesis, currently contradicted by stated intent [4]), the model loses the accountability mechanism. Observable: resignation or removal from office.",
     implication:"Without the accountability penalty, the successor's cost of drift decreases. The model predicts that the separating equilibrium may break down, with autonomist types facing lower costs for choosing high alliance intensity.",
     params:"\\kappa_m \\to 0,\\; \\text{weaker separation}"},
  ];

  return(
  <div style={{marginBottom:20}}>
    {[2027,2029].map(yr=>(
    <div key={yr} style={{marginBottom:20}}>
      <div style={{fontFamily:C.fm,fontSize:10,letterSpacing:2,fontWeight:700,color:TC.coral,marginBottom:10}}>{yr} SCENARIOS</div>
      {scenarios.filter(s=>s.year===yr).map(s=>(
        <div key={s.id} style={{background:TC.card||TC.bg2,border:"1px solid "+TC.brd,borderRadius:6,marginBottom:8,overflow:"hidden"}}>
          <div onClick={()=>setOpenScenario(openScenario===s.id?null:s.id)}
            style={{padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontFamily:C.fd,fontSize:14,fontWeight:700,color:TC.ink}}>{s.title}</span>
            <span style={{fontFamily:C.fm,fontSize:12,color:TC.coral}}>{openScenario===s.id?"\u2212":"+"}</span>
          </div>
          {openScenario===s.id&&(
          <div style={{padding:"0 16px 14px",borderTop:"1px solid "+TC.brd}}>
            <div style={{marginTop:10}}>
              <div style={{fontFamily:C.fm,fontSize:9,color:TC.teal,fontWeight:600,letterSpacing:1,marginBottom:4}}>OBSERVABLE SIGNAL</div>
              <p style={{fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.7,marginBottom:10}}>{s.signal}</p>
            </div>
            <div>
              <div style={{fontFamily:C.fm,fontSize:9,color:TC.coral,fontWeight:600,letterSpacing:1,marginBottom:4}}>MODEL IMPLICATION</div>
              <p style={{fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.7,marginBottom:10}}>{s.implication}</p>
            </div>
            <div style={{fontFamily:C.fm,fontSize:10,color:TC.ink3,background:TC.bg2,padding:"6px 10px",borderRadius:3}}>
              Parameters: <Tex tex={s.params}/></div>
          </div>)}
        </div>
      ))}
    </div>))}
  </div>);
}

/* ============================================================
   IntraPartyArticle: Full article with KaTeX math
   ============================================================ */
class IPGErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:false}}
  static getDerivedStateFromError(){return{err:true}}
  render(){return this.state.err?React.createElement("div",{style:{padding:40,textAlign:"center",fontFamily:"monospace",color:"#999"}},
    "Article could not load. Try on desktop or refresh."):this.props.children}
}

function IntraPartyArticle({TC:_TC}){
  const TC=_TC||C;
  const[mode,setMode]=useState("general");
  const[activeSection,setActiveSection]=useState("intro");
  const sectionRefs=useRef({});

  useEffect(()=>{
    try{
      const obs=new IntersectionObserver((entries)=>{
        entries.forEach(e=>{if(e.isIntersecting)setActiveSection(e.target.id)});
      },{rootMargin:"-20% 0px -60% 0px",threshold:0});
      Object.values(sectionRefs.current).forEach(el=>{if(el)obs.observe(el)});
      return()=>obs.disconnect();
    }catch(e){}
  },[]);

  const regRef=(id)=>(el)=>{sectionRefs.current[id]=el};
  const scrollTo=(id)=>{
    const el=sectionRefs.current[id];
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
  };

  const sections=[
    {id:"intro",label:"Introduction"},
    {id:"baseline",label:"Baseline Game"},
    {id:"posteriors",label:"Posteriors and Cutoffs"},
    {id:"equilibrium",label:"Equilibrium"},
    {id:"factions",label:"Factions Extension"},
    {id:"interactive",label:"Interactive: Posterior Curve"},
    {id:"montecarlo",label:"Monte Carlo Simulation"},
    {id:"senegal",label:"Senegal Motivation"},
    {id:"scenarios",label:"Scenario Explorer"},
    {id:"conclusion",label:"Conclusion"},
    {id:"references",label:"References"},
  ];

  const isTech=mode==="technical";

  const sty={
    h2:{fontFamily:C.fd,fontSize:22,fontWeight:900,color:TC.ink,margin:"36px 0 14px",lineHeight:1.25},
    h3:{fontFamily:C.fd,fontSize:17,fontWeight:700,color:TC.ink,margin:"28px 0 10px",lineHeight:1.3},
    p:{fontFamily:C.fb,fontSize:14.5,color:TC.ink2,lineHeight:1.9,marginBottom:14,textAlign:"justify"},
    fn:{fontFamily:C.fm,fontSize:10,color:TC.ink3,lineHeight:1.6},
    label:{fontFamily:C.fm,fontSize:9,letterSpacing:2,fontWeight:700,color:TC.coral,marginBottom:6},
    card:{background:TC.card||TC.bg2,border:"1px solid "+TC.brd,borderRadius:6,padding:"18px 22px",marginBottom:16},
  };

  const cites=[
    {id:1,short:"Pressafrik 2025",full:"Pressafrik, \"Ousmane Sonko annonce un Tera meeting le 8 novembre au Stade Leopold Sedar Senghor,\" November 2025. https://www.pressafrik.com/Ousmane-Sonko-annonce-un-%E2%80%AFTera-meeting%E2%80%AF-le-8-novembre-au-Stade-Leopold-Sedar-Senghor_a296695.html"},
    {id:2,short:"Primature.sn 2025",full:"Primature du Senegal, \"Questions d'actualite au gouvernement, 28 novembre 2025.\" https://primature.sn/publications/actualites/questions-dactualite-au-gouvernement-28-novembre-2025"},
    {id:3,short:"Assemblee Nationale 2025",full:"Assemblee Nationale du Senegal, \"Questions d'actualite du 28 novembre 2025.\" https://www.assemblee.sn/fr/actualite/questions-dactualite-du-28-novembre-2025"},
    {id:4,short:"Jeune Afrique 2025",full:"Jeune Afrique, \"Ousmane Sonko: je ne travaille pas pour Bassirou Diomaye Faye, mais pour le Senegal,\" November 2025. https://www.jeuneafrique.com/1744531/politique/ousmane-sonko-je-ne-travaille-pas-pour-bassirou-diomaye-faye-mais-pour-le-senegal/"},
  ];
  const Cite=({ids})=>{
    const arr=Array.isArray(ids)?ids:[ids];
    return <sup style={{color:TC.coral,cursor:"pointer",fontSize:10,fontWeight:600}}>[{arr.join(",")}]</sup>;
  };

  const Tech=({children,label})=>{
    if(!isTech)return <div style={{...sty.card,borderLeft:"3px solid "+TC.teal,cursor:"pointer",padding:"10px 16px"}} onClick={()=>setMode("technical")}>
      <span style={{fontFamily:C.fm,fontSize:10,color:TC.teal}}>Technical detail: {label||"expand"} [click or switch to technical mode]</span></div>;
    return <div style={{...sty.card,borderLeft:"3px solid "+TC.teal}}>{children}</div>;
  };

  const Formal=({type,label,id:fid,children})=>{
    const colors={assumption:TC.gold,lemma:TC.blue,proposition:TC.coral};
    const cl=colors[type]||TC.ink;
    return <div style={{...sty.card,borderLeft:"3px solid "+cl,margin:"20px 0"}}>
      <div style={{fontFamily:C.fm,fontSize:10,fontWeight:700,color:cl,letterSpacing:1.5,marginBottom:6}}>{type.toUpperCase()} {fid?`(${fid})`:""}</div>
      {label&&<div style={{fontFamily:C.fd,fontSize:14,fontWeight:700,color:TC.ink,marginBottom:8}}>{label}</div>}
      <div style={{fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.7}}>{children}</div>
    </div>;
  };

  return(
  <div style={{position:"relative",overflowX:"hidden"}}>
    {/* LEFT TOC */}
    <div className="ipg-toc-sidebar" style={{position:"fixed",top:200,left:"max(16px, calc(50% - 380px))",width:150,zIndex:10}}>
      <nav style={{borderRight:"1px solid "+TC.brd,paddingRight:16}}>
        <div style={sty.label}>CONTENTS</div>
        {sections.map(s=>(
          <div key={s.id} onClick={()=>scrollTo(s.id)} style={{
            fontFamily:C.fm,fontSize:10,color:activeSection===s.id?TC.coral:TC.ink3,
            padding:"4px 0",cursor:"pointer",borderRight:activeSection===s.id?"2px solid "+TC.coral:"2px solid transparent",
            paddingRight:8,transition:"all .2s",fontWeight:activeSection===s.id?600:400
          }}>{s.label}</div>
        ))}
      </nav>
    </div>

    {/* MAIN CONTENT */}
    <div style={{maxWidth:680,width:"100%",marginLeft:"auto"}}>

      {/* MODE TOGGLE */}
      <div style={{display:"flex",gap:4,marginBottom:28}}>
        {["general","technical"].map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{
            background:mode===m?TC.coral:"transparent",color:mode===m?"#fff":TC.ink3,
            border:"1px solid "+(mode===m?TC.coral:TC.brd),borderRadius:3,
            padding:"5px 14px",fontSize:10,fontFamily:C.fm,cursor:"pointer",fontWeight:600,letterSpacing:.5
          }}>{m==="general"?"General":"Technical"}</button>
        ))}
        <span style={{fontFamily:C.fm,fontSize:9,color:TC.ink3,alignSelf:"center",marginLeft:8}}>
          {mode==="general"?"Derivations collapsed":"All proofs and equations shown"}</span>
      </div>

      {/* ===== INTRODUCTION ===== */}
      <section id="intro" ref={regRef("intro")}>
        <h2 style={sty.h2}>Introduction</h2>
        <p style={sty.p}>Many political movements that achieve power through mass mobilization face a specific structural problem after the transition: the separation between the leader who built the movement and the successor who holds formal office. The successor may continue the original program, or may use the accumulated symbolic capital to build an independent political machine. The founder typically has superior private information about the successor's trajectory, but faces a credibility problem: direct accusations appear self-interested, and exit from government risks ceding state capacity to the successor.</p>
        <p style={sty.p}>This paper proposes a formal framework for studying that problem. The central mechanism is a <em>clarification protocol</em>: a public action by the founder that does not simply "send a message" but instead changes the informational environment. Specifically, it increases the diagnostic content of subsequent observable actions (appointments, alliances, legislative choices) and raises the attribution cost of deviation from the founding program.</p>
        <p style={sty.p}>The motivating episode is Senegal in late 2025. On November 8, 2025, Prime Minister Ousmane Sonko held a large public rally that was publicly framed as creating a "before and after" moment.<Cite ids={[1]}/> On November 28, 2025, he appeared before the National Assembly during questions to the government, making statements that can be interpreted as reinforcing the accountability framework established on November 8.<Cite ids={[2,3]}/> In a widely reported statement, Sonko said: "I do not work for Bassirou Diomaye Faye, but for Senegal, under Diomaye."<Cite ids={[4]}/></p>
        <p style={sty.p}>This paper does not claim to observe anyone's private intentions. It uses the Senegalese episode as motivation for a generic strategic problem in intra-party politics. Every political claim about Senegal in this text is either directly sourced or explicitly labeled as model interpretation.</p>
      </section>

      {/* ===== BASELINE GAME ===== */}
      <section id="baseline" ref={regRef("baseline")}>
        <h2 style={sty.h2}>The Baseline Game</h2>
        <p style={sty.p}>The game involves three types of players: a founder (<Tex tex="F"/>), a successor (<Tex tex="S"/>), and a mass of militants (<Tex tex="M"/>). The successor has a private type <Tex tex="\theta \in \{L, A\}"/> that is either Loyal or Autonomist. The prior probability that the successor is loyal is denoted <Tex tex="\pi \in (0,1)"/>.</p>
        <p style={sty.p}>The timeline proceeds in three stages. First, the founder chooses a clarification regime <Tex tex="m \in \{H, N\}"/>: either high salience or normal. Second, the successor chooses an alliance posture <Tex tex="a \in \{0, 1\}"/>, where <Tex tex="a = 0"/> represents loyalty to the program and <Tex tex="a = 1"/> represents autonomist drift. Third, militants observe a noisy public signal:</p>
        <TexBlock tex="x = a + \varepsilon_m, \quad \varepsilon_m \sim \mathcal{N}(0, \sigma_m^2)" TC={TC}/>
        <p style={sty.p}>where <Tex tex="\sigma_H \lt  \sigma_N"/>, meaning the signal is more informative under the high-salience regime <Tex tex="H"/>.</p>

        <GameTreeViz TC={TC}/>

        <h3 style={sty.h3}>Payoffs</h3>
        <p style={sty.p}>Militants receive a positive payoff <Tex tex="R_M"/> when they support a loyal successor, a negative payoff <Tex tex="-S_M"/> when they support an autonomist, a negative payoff <Tex tex="-C_M"/> when they withdraw support from a loyal successor, and a normalized payoff of 0 when they correctly withdraw from an autonomist. The parameters <Tex tex="R_M, S_M, C_M \gt  0"/>.</p>

        <Tech label="Militant expected utility">
          <TexBlock tex="\mathbb{E}U_M(\text{support}) = \mu \cdot R_M - (1 - \mu) \cdot S_M" TC={TC}/>
          <TexBlock tex="\mathbb{E}U_M(\text{withdraw}) = -\mu \cdot C_M" TC={TC}/>
          <p style={{...sty.p,fontSize:13}}>where <Tex tex="\mu = \Pr(\theta = L \mid \text{information})"/> is the posterior belief.</p>
        </Tech>

        <Formal type="lemma" id="1" label="Militant threshold rule">
          Militants prefer to support if and only if their posterior belief <Tex tex="\mu"/> exceeds the threshold <TexBlock tex="\mu^* = \frac{S_M}{R_M + S_M + C_M} \in (0,1)." TC={TC}/>
        </Formal>

        <p style={sty.p}>The successor's utility includes a baseline value of holding office, a term capturing the value of militant legitimacy (weighted by <Tex tex="v"/>), a type-dependent preference over alliance posture, and an accountability penalty <Tex tex="\kappa_m"/> whose magnitude depends on the clarification regime. Under <Tex tex="H"/>, the accountability penalty is larger (<Tex tex="\kappa_H \gt  \kappa_N"/>), making autonomist drift more costly even conditional on the successor's preferences.</p>

        <Tech label="Successor utility">
          <TexBlock tex="U_S(\theta, a, y; m) = V_\theta + \beta \cdot y + \gamma_\theta \cdot a - \kappa_m \cdot \mathbf{1}_{a=1}" TC={TC}/>
          <p style={{...sty.p,fontSize:13}}>where <Tex tex="\gamma_L = -c"/> with <Tex tex="c \gt  0"/> (loyal types dislike drift), <Tex tex="\gamma_A = b"/> with <Tex tex="b \gt  0"/> (autonomists benefit), and <Tex tex="\kappa_H \gt  \kappa_N \geq 0"/>.</p>
        </Tech>
      </section>

      {/* ===== POSTERIORS AND CUTOFFS ===== */}
      <section id="posteriors" ref={regRef("posteriors")}>
        <h2 style={sty.h2}>Posteriors and Cutoff Strategies</h2>
        <p style={sty.p}>Given the clarification regime <Tex tex="m"/> and the observed signal <Tex tex="x"/>, militants compute a posterior belief about the successor's type using Bayes' rule. Under the separating profile (<Tex tex="\theta = L \Rightarrow a = 0"/>, <Tex tex="\theta = A \Rightarrow a = 1"/>), the signal <Tex tex="x"/> is drawn from <Tex tex="\mathcal{N}(0, \sigma_m^2)"/> if the type is loyal, and <Tex tex="\mathcal{N}(1, \sigma_m^2)"/> if the type is autonomist.</p>

        <Tech label="Closed-form posterior">
          <TexBlock tex="\mu(m,x) = \frac{\pi}{\pi + (1-\pi)\exp\!\left(\dfrac{2x - 1}{2\sigma_m^2}\right)}" TC={TC}/>
          <p style={{...sty.p,fontSize:13}}>This is a logistic function of <Tex tex="x"/> with negative slope: as <Tex tex="x"/> increases (more signal of autonomist drift), the posterior probability of loyalty decreases.</p>
        </Tech>

        <Formal type="lemma" id="2" label="Monotone posterior">
          For each regime <Tex tex="m \in \{N, H\}"/>, the posterior <Tex tex="\mu(m, x)"/> is continuous and strictly decreasing in <Tex tex="x"/>, with <Tex tex="\lim_{x \to -\infty} \mu(m,x) = 1"/> and <Tex tex="\lim_{x \to +\infty} \mu(m,x) = 0"/>.
        </Formal>

        <p style={sty.p}>Combining the threshold rule (Lemma 1) with the monotone posterior (Lemma 2), there exists a unique signal cutoff <Tex tex="x_m^*"/> such that militants support if and only if <Tex tex="x \lt  x_m^*"/>. The closed form for the cutoff is:</p>
        <TexBlock tex="x_m^* = \frac{1}{2} + \sigma_m^2 \ln\!\left(\frac{\pi\,(1 - \mu^*)}{(1 - \pi)\,\mu^*}\right)" TC={TC}/>
        <p style={sty.p}>This cutoff shifts to the right when the prior <Tex tex="\pi"/> increases (factions tolerate more ambiguous signals when they start more optimistic), and shifts to the left when <Tex tex="\sigma_m"/> decreases (under more precise observation, factions become more demanding).</p>
      </section>

      {/* ===== EQUILIBRIUM ===== */}
      <section id="equilibrium" ref={regRef("equilibrium")}>
        <h2 style={sty.h2}>Equilibrium and the Clarification Effect</h2>

        <Formal type="assumption" id="1" label="Type-monotone alliance incentives">
          Parameters satisfy <Tex tex="c \gt  0"/>, <Tex tex="b \gt  0"/>, <Tex tex="\kappa_H \gt  \kappa_N"/>, <Tex tex="\gamma_A \geq 0"/>. The condition <Tex tex="b - \kappa_N \gt  0"/> ensures autonomists still tend to drift under normal conditions, while <Tex tex="b - \kappa_H \leq 0"/> means accountability bites more under the clarification protocol. Loyal types choose <Tex tex="a = 0"/> whenever <Tex tex="c + \kappa_m \gt  0"/>.
        </Formal>

        <Formal type="proposition" id="1" label="Clarification increases effective screening">
          Under Assumption 1, there exists a Perfect Bayesian Equilibrium with: (i) loyal successors choose <Tex tex="a = 0"/>; autonomist successors choose <Tex tex="a = 1"/>; (ii) militants use a cutoff rule for each <Tex tex="m"/>; (iii) the clarification protocol makes <Tex tex="x"/> more informative, so the probability of militant withdrawal when <Tex tex="\theta = A"/> is weakly higher under <Tex tex="H"/> than under <Tex tex="N"/>; (iv) the founder strictly prefers <Tex tex="H"/> when <Tex tex="\theta = A"/>, provided the induced increase in withdrawal probability is large enough relative to <Tex tex="K"/>.
        </Formal>

        <Tech label="Proof sketch">
          <p style={{...sty.p,fontSize:13}}>Given separation, the signal distributions and posterior apply directly. A decrease in <Tex tex="\sigma_m"/> increases the likelihood ratio steepness, making posteriors more responsive to <Tex tex="x"/>. Thus the event <Tex tex="\mu(m,x) \lt  \mu^*"/> occurs with higher probability when <Tex tex="\theta = A"/> under smaller <Tex tex="\sigma_m"/>. For the founder, the expected payoff difference between <Tex tex="H"/> and <Tex tex="N"/> trades off the increased chance of <Tex tex="y = 0"/> (moving from <Tex tex="-X"/> toward <Tex tex="-Z"/>) against cost <Tex tex="K"/>.</p>
        </Tech>

        <p style={sty.p}>The mechanism works through two channels. The <em>learning channel</em>: smaller <Tex tex="\sigma_m"/> makes <Tex tex="x"/> more diagnostic of the alliance posture <Tex tex="a"/>, and therefore of <Tex tex="\theta"/> under separation. The <em>incentive channel</em>: higher <Tex tex="\kappa_H"/> increases the effective cost of choosing <Tex tex="a = 1"/> under the clarification protocol. The protocol does not function as a bare accusation. It changes the diagnostic content of future observable choices and increases the attribution cost of drift.</p>
      </section>

      {/* ===== FACTIONS EXTENSION ===== */}
      <section id="factions" ref={regRef("factions")}>
        <h2 style={sty.h2}>Extension: Factions, Noisy Alliances, and Thresholds</h2>
        <p style={sty.p}>The baseline model treated militants as a single mass. The extension introduces two factions: a base (<Tex tex="B"/>) and cadres (<Tex tex="E"/>). Each faction has its own payoff parameters and therefore its own belief threshold.</p>

        <Formal type="assumption" id="2" label="Base stricter than cadres">
          The base has a higher belief threshold than cadres: <Tex tex="\mu_B^* \gt  \mu_E^*"/>. This reflects the assumption that the base (rank-and-file militants who marched, went to prison, and built the movement) is more attached to the founding project and less tolerant of drift than cadres (who now hold ministerial positions and benefit more from continuity in office).
        </Formal>

        <p style={sty.p}>In the extension, the successor chooses a continuous alliance intensity <Tex tex="\alpha \in [0,1]"/>, and the public signal is <Tex tex="x = \alpha + \varepsilon"/> with <Tex tex="\varepsilon \sim \mathcal{N}(0, \sigma^2)"/>. Under the separating profile where loyal types choose <Tex tex="\alpha = 0"/> and autonomist types choose <Tex tex="\alpha = 1"/>, each faction <Tex tex="j"/> uses a signal cutoff <Tex tex="x_j^*"/>:</p>

        <TexBlock tex="x_j^* = \frac{1}{2} + \sigma^2 \ln\!\left(\frac{\pi\,(1 - \mu_j^*)}{(1 - \pi)\,\mu_j^*}\right)" TC={TC}/>

        <Formal type="lemma" id="3" label="Signal cutoff strategies">
          Under separation, each faction uses a unique signal cutoff: faction <Tex tex="j"/> supports if and only if <Tex tex="x \lt  x_j^*"/>. Under the assumption that the base is stricter, <Tex tex="x_B^* \lt  x_E^*"/>. The base withdraws support at a lower signal threshold than cadres.
        </Formal>

        <Formal type="proposition" id="2" label="Separating equilibrium with factions">
          Suppose Assumption 2 holds and the action set is <Tex tex="\{0, 1\}"/>. If <Tex tex="c \gt  0"/> and <TexBlock tex="b \gt  v_A \bigl[\bigl(p_B(0, A) - p_B(1, A)\bigr) + \bigl(p_E(0, A) - p_E(1, A)\bigr)\bigr]" TC={TC}/> then there exists a PBE in which loyal types choose <Tex tex="\alpha = 0"/>, autonomist types choose <Tex tex="\alpha = 1"/>, and each faction uses its signal cutoff with <Tex tex="x_B^* \lt  x_E^*"/>.
        </Formal>

        <p style={sty.p}>The comparative statics are direct. Higher noise <Tex tex="\sigma^2"/> flattens inference and moves cutoffs in a prior-dependent way (learning slows). Higher prior <Tex tex="\pi"/> raises cutoffs (factions tolerate higher observed <Tex tex="x"/> before withdrawing). A stricter faction (higher <Tex tex="\mu_j^*"/>) has a lower cutoff <Tex tex="x_j^*"/> and exits sooner. These results generate the central prediction: when a signal of autonomist drift is observed, the base exits first, cadres exit later or not at all.</p>
      </section>

      {/* ===== INTERACTIVE POSTERIOR CURVE ===== */}
      <section id="interactive" ref={regRef("interactive")}>
        <h2 style={sty.h2}>Interactive: Posterior Curve and Faction Cutoffs</h2>
        <p style={sty.p}>The plot below shows the posterior belief <Tex tex="\mu(x)"/> as a function of the observed signal <Tex tex="x"/>, along with the faction cutoffs <Tex tex="x_B^*"/> and <Tex tex="x_E^*"/>. Use the sliders to adjust the prior probability <Tex tex="\pi"/> and the noise parameter <Tex tex="\sigma"/>. Observe how the cutoffs shift and how the gap between base and cadre thresholds widens or narrows.</p>
        <PosteriorPlot TC={TC}/>
      </section>

      {/* ===== MONTE CARLO ===== */}
      <section id="montecarlo" ref={regRef("montecarlo")}>
        <h2 style={sty.h2}>Monte Carlo Simulation</h2>
        <p style={sty.p}>The panel below runs 1000 simulated draws of the game per click. Each run draws a type (<Tex tex="L"/> or <Tex tex="A"/> with probability <Tex tex="\pi"/>), draws a signal <Tex tex="x"/> conditional on the separating profile, and computes each faction's support decision. The histogram shows the distribution of observed signals. The bar chart shows the frequency of each support outcome (both support, only cadres support, neither supports).</p>
        <MonteCarloPanel TC={TC}/>
      </section>

      {/* ===== SENEGAL MOTIVATION ===== */}
      <section id="senegal" ref={regRef("senegal")}>
        <h2 style={sty.h2}>Connection to the Senegal Motivation (Late 2025)</h2>
        <p style={{...sty.p,fontStyle:"italic",color:TC.ink3}}>This section is interpretive. The model concerns strategic logic, not a claim about any individual's private intentions. All political facts are sourced; interpretations through the model are explicitly labeled.</p>

        <p style={sty.p}>In the model's framework, map <Tex tex="F"/> (founder) to the leader who built the movement and <Tex tex="S"/> (successor) to the individual who holds the presidency. The public framing of the November 8, 2025 rally as a "before and after" moment<Cite ids={[1]}/> can be read as the activation of a high-salience regime <Tex tex="H"/>. In the model, this activation works by reducing the noise in how militants observe subsequent presidential choices (lower <Tex tex="\sigma_H"/>) and by increasing the attribution cost of choices that diverge from the founding program (higher <Tex tex="\kappa_H"/>).</p>

        <p style={sty.p}>The November 28, 2025 appearance at the National Assembly<Cite ids={[2,3]}/> can be interpreted as reinforcing the attribution mechanism: it frames the post-November 8 period as one in which presidential alliances and appointments will be scrutinized through the clarification lens. The reported statement, "I do not work for Bassirou Diomaye Faye, but for Senegal, under Diomaye,"<Cite ids={[4]}/> is consistent with the model implication that the founder remains within government (no credible exit) while separating institutional obedience from political accountability.</p>

        <p style={sty.p}>[Model interpretation] The factional prediction of the extension matches a commonly reported pattern in Senegalese political commentary: the PASTEF base (rank-and-file militants, online activists, grassroots organizers) appears stricter in its tolerance for alliance signals than cadres (ministers, directors, parliamentary appointees). In the model, this corresponds to <Tex tex="x_B^* \lt  x_E^*"/>, predicting that the base would be the first to express discomfort if alliance signals drift toward autonomist patterns.</p>
      </section>

      {/* ===== SCENARIO EXPLORER ===== */}
      <section id="scenarios" ref={regRef("scenarios")}>
        <h2 style={sty.h2}>Scenario Explorer: 2027 and 2029</h2>
        <p style={{...sty.p,fontStyle:"italic",color:TC.ink3}}>The following scenarios are conditional model implications, not predictions. They describe what the model would imply if specific observable conditions were to obtain. The parameters used in the simulator above can be adjusted to explore each scenario numerically.</p>
        <ScenarioExplorer TC={TC}/>
      </section>

      {/* ===== CONCLUSION ===== */}
      <section id="conclusion" ref={regRef("conclusion")}>
        <h2 style={sty.h2}>Conclusion</h2>
        <p style={sty.p}>This paper proposed a framework for clarification in intra-party leadership games. When an informed founder cannot credibly exit and cannot directly accuse a successor without appearing self-interested, the founder may still be able to activate a public protocol that changes the informational environment and accountability structure. The protocol makes subsequent alliance and appointment choices more diagnostic and deviations more publicly attributable.</p>
        <p style={sty.p}>The baseline model yields posterior-threshold behavior and identifies the conditions under which triggering a clarification protocol is attractive for the founder. The extension with heterogeneous factions delivers cutoff strategies with the base stricter than cadres, implying earlier support loss among the base when the successor pursues an autonomist line.</p>
        <p style={sty.p}>Natural extensions include a continuous type space for the successor, endogenous timing of the clarification protocol as information accumulates, and repeated clarification protocols over longer leadership conflicts.</p>
      </section>

      {/* ===== REFERENCES ===== */}
      <section id="references" ref={regRef("references")}>
        <h2 style={sty.h2}>References</h2>
        <div style={{borderTop:"1px solid "+TC.brd,paddingTop:16}}>
          {cites.map(c=>(
            <div key={c.id} style={{display:"flex",gap:8,marginBottom:10}}>
              <span style={{fontFamily:C.fm,fontSize:11,color:TC.coral,fontWeight:700,minWidth:20}}>[{c.id}]</span>
              <span style={{fontFamily:C.fb,fontSize:12,color:TC.ink2,lineHeight:1.6,wordBreak:"break-all"}}>{c.full}</span>
            </div>
          ))}
        </div>
      </section>

    </div>{/* end main content */}
  </div>);
}



/* VIH ARTICLE */
/* ═══ MAIN ═══ */
function VIHArticle(){
  const[data,setData]=useState(null);
  const[tab,setTab]=useState("recit");
  const[netMonth,setNetMonth]=useState(108);
  const[playing,setPlaying]=useState(false);
  const intv=useRef(null);
  const[progress,setProgress]=useState(0);
  useEffect(()=>{setProgress(5);setTimeout(()=>{setData(mc(800));setProgress(100)},80)},[]);
  useEffect(()=>{if(playing)intv.current=setInterval(()=>setNetMonth(m=>{if(m>=108){setPlaying(false);return 108}return m+1}),100);return()=>clearInterval(intv.current)},[playing]);

  if(!data)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,fontFamily:C.fl}}><div style={{textAlign:"center",width:360}}>
    <div style={{fontFamily:C.fd,fontSize:24,color:C.ink,marginBottom:20}}>Simulation en cours…</div>
    <div style={{height:3,background:C.bg2,borderRadius:2,overflow:"hidden",marginBottom:12}}><div style={{height:"100%",background:C.coral,width:`${progress}%`,transition:"width .5s"}}/></div>
    <div style={{fontSize:11,fontFamily:C.fm,color:C.ink3}}>800 runs × 5 scénarios · 2017 → 2026</div></div></div>);

  const s=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.stats]));
  const comp=data.d1.agg.map((d,i)=>({month:d.month,yr:d.yr,d1:d.med,d2:data.d2.agg[i]?.med,d2c:data.d2c.agg[i]?.med,d2a:data.d2art.agg[i]?.med,crim:data.crim.agg[i]?.med,d2_5:data.d2.agg[i]?.p5,d2_95:data.d2.agg[i]?.p95}));
  const bkdn=data.d2.agg.filter((_,i)=>i%3===0).map(d=>({month:d.month,yr:d.yr,HSH:d.msmM,Conjointes:d.femM,Enfants:d.mtctM}));
  const ref1=data.d2.sN;
  const tabs=[{id:"recit",l:"Le Récit"},{id:"sim",l:"Simulateur"},{id:"dakar",l:"Dakar"},{id:"methodo",l:"Méthodologie"}];

  return(
    <div style={{background:C.bg,color:C.ink,minHeight:"100vh",fontFamily:C.fl}}>
      <style>{`@import url('https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css');
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&family=Libre+Franklin:wght@400;600&display=swap');`}</style>
      <div style={{borderBottom:`1px solid ${C.brd}`,padding:"12px 0"}}><div style={{maxWidth:740,margin:"0 auto",padding:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:9,letterSpacing:4,textTransform:"uppercase",color:C.coral,fontFamily:C.fm,fontWeight:700}}>Données & Enquête</div><div style={{fontSize:9,color:C.ink3,fontFamily:C.fm}}>9 février 2026</div></div></div>
      <div style={{maxWidth:740,margin:"0 auto",padding:"0 24px"}}>
        <div style={{display:"flex",gap:0,marginTop:12,marginBottom:20,borderBottom:`1px solid ${C.brd}`,overflowX:"auto"}}>
          {tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:tab===t.id?`2px solid ${C.ink}`:"2px solid transparent",color:tab===t.id?C.ink:C.ink3,padding:"8px 14px",fontSize:11,fontFamily:C.fm,letterSpacing:1,cursor:"pointer",fontWeight:tab===t.id?700:400}}>{t.l}</button>))}
        </div>

{/* ═══════════════════ LE RÉCIT ═══ */}
{tab==="recit"&&(
<div style={{maxWidth:680,paddingBottom:60}}>

  <div style={{fontSize:11,fontFamily:C.fm,color:C.coral,letterSpacing:2,marginBottom:8}}>ENQUÊTE</div>
  <h1 style={{fontFamily:C.fd,fontSize:34,fontWeight:900,color:C.ink,lineHeight:1.12,margin:"0 0 16px"}}>Un virus propagé dans l'ombre : modéliser neuf ans de transmission délibérée du VIH au Sénégal</h1>
  <p style={{fontSize:15.5,fontFamily:C.fb,color:C.ink2,lineHeight:1.85,fontStyle:"italic",marginBottom:8,maxWidth:640,textAlign:"justify"}}>
    Vingt-six personnes interpellées en trois jours à Dakar. Deux affaires distinctes mais contemporaines. Un réseau transnational actif depuis 2017, des mineurs parmi les victimes, des conjointes contaminées à leur insu, des enfants exposés in utero. Ce que la justice sénégalaise a mis au jour en février 2026, c'est la partie émergée d'une dynamique épidémique dont l'ampleur réelle échappe par nature au cadre judiciaire. Le droit pénal identifie des individus et leur attribue une responsabilité. L'épidémiologie de réseau, elle, suit les chaînes de transmission à travers des univers sociaux qui ne se parlent pas : le réseau clandestin, le foyer conjugal, la maternité. Pour tenter de mesurer l'écart entre ce que les tribunaux voient et ce que le virus accomplit, nous avons construit un modèle stochastique individu-centré, calibré sur la littérature épidémiologique disponible pour l'Afrique de l'Ouest, et simulé 800 fois chacun des cinq scénarios sur la période 2017-2026.
  </p>
  <div style={{fontSize:11,fontFamily:C.fl,color:C.ink3,marginBottom:28}}>Par l'équipe Données · 9 février 2026</div>
  <Divider/>

  <Hed>I. Les faits</Hed>

  <Body><Drop letter="L"/>e mardi 4 février 2026, la Brigade de Recherches de la compagnie de gendarmerie de Keur Massar, en banlieue de Dakar, interpelle un jeune homme de 21 ans, Pape Salif Rall Thiam, électricien de profession. Un renseignement transmis aux enquêteurs indique qu'il entretient, en pleine connaissance de sa séropositivité, des rapports sexuels non protégés avec des hommes recrutés sur des groupes WhatsApp fermés. Le test de dépistage ordonné par réquisition judiciaire confirme son statut. Placé en garde à vue, il avoue avoir « exposé une dizaine d'hommes au sida ».</Body>

  <Body>L'exploitation de son iPhone 11 révèle l'existence de plusieurs groupes WhatsApp et de sites spécialisés de rencontres entre hommes. Les contacts permettent aux gendarmes d'identifier d'autres membres du réseau. En trois jours, du 4 au 6 février, onze autres individus sont placés en garde à vue, portant le total à douze interpellations. L'un des aspects remarquables de cette affaire tient à la diversité sociologique du groupe : on y trouve un électricien de 20 ans, un commerçant de 37 ans, un tailleur de 40, un agent administratif de 28, deux étudiants (20 et 25 ans), deux boutiquiers (22 et 30 ans), un brancardier de 29, un employé de banque de 38 ans, le chanteur Djiby Dramé (43 ans) et le présentateur de télévision Pape Cheikh Diallo (43 ans, marié deux fois). Le profil du réseau traverse donc les générations, les niveaux d'éducation et les strates socioéconomiques, ce qui correspond à la structure décrite par Larmarange et al. (2009) dans leur cartographie des réseaux HSH au Sénégal.</Body>

  <div style={{marginBottom:24}}><StickScene id="recruit"/></div>

  <Body>Huit personnes sur douze sont déclarées séropositives lors des tests pratiqués en garde à vue. Deux attendent une confirmation. Seules deux sont testées négatives. Le procureur Saliou Dicko (Pikine-Guédiawaye) retient quatre chefs : association de malfaiteurs, actes contre nature (article 319 du Code pénal), transmission volontaire du VIH, mise en danger de la vie d'autrui. Le taux de séropositivité observé dans le groupe (67 à 83 % selon que l'on exclut ou inclut les résultats en attente) est cohérent avec les taux documentés dans les réseaux à haut risque en Afrique de l'Ouest : Wade et al. (2005) rapportaient déjà une prévalence de 21,5 % chez les HSH de Dakar, et les travaux ultérieurs (Larmarange 2009, Aho et al. 2014) montrent que la prévalence peut dépasser 40 % dans les clusters à forte connectivité.</Body>

  <FB color={C.crim} label="AFFAIRE 1 · KEUR MASSAR · 4-6 FÉVRIER 2026">
    <strong>12 interpellations</strong> par la Brigade de Recherches. <strong>8 séropositifs confirmés</strong>, 2 en attente, 2 négatifs. Profils : électricien, commerçant, tailleur, agent administratif, étudiants, boutiquiers, brancardier, employé de banque, chanteur, présentateur TV. Charges : association de malfaiteurs, actes contre nature, transmission volontaire du VIH, mise en danger de la vie d'autrui. Procureur Saliou Dicko (Pikine-Guédiawaye).<br/><br/>
    <strong>Détail épidémiologique clé :</strong> parmi les douze, <span style={{color:C.amber,fontWeight:600}}>« plusieurs sont mariés et pères de famille, d'autres divorcés avec enfants, le reste célibataires »</span> (Libération / Kewoulo, 8 février 2026).
  </FB>

  <Body>Quelques éléments supplémentaires méritent d'être relevés sur le plan épidémiologique. Le taux de séropositivité de 67 à 83 % dans ce groupe ne doit pas être interprété comme la prévalence dans la population HSH sénégalaise (estimée à 18-25 % par le CNLS en 2019), mais comme le résultat d'un échantillonnage biaisé par construction : ce sont les contacts d'un transmetteur délibéré qui ont été testés. Le phénomène de clustering viral est bien documenté : dans les réseaux à haut risque, la prévalence locale peut dépasser 50 % même lorsque la prévalence générale reste modérée (Beyrer et al., Lancet, 2012). Le mode de recrutement via WhatsApp est également significatif : les plateformes numériques ont profondément modifié la topologie des réseaux sexuels HSH en Afrique de l'Ouest depuis 2015, en permettant des connexions entre individus géographiquement éloignés et socialement déconnectés, ce qui augmente la taille effective du réseau d'opportunités sexuelles (Stahlman et al., Social Science & Medicine, 2017).</Body>

  <Body>Mais le détail le plus lourd de conséquences se trouve dans une phrase enfouie dans les comptes rendus de presse. Libération et le site Kewoulo rapportent, le 8 février, que « plusieurs [des suspects] sont mariés et pères de famille, d'autres divorcés avec enfants, le reste célibataires ». Cette information a l'air anecdotique dans un récit judiciaire. Elle conditionne pourtant l'ensemble de la dynamique épidémique : si des hommes infectés au sein d'un réseau masculin vivent simultanément en couple hétérosexuel, le virus dispose d'un chemin vers la population générale. C'est ce qu'on appelle le « pont bisexuel » en épidémiologie, et c'est le mécanisme central de notre modèle (voir section III).</Body>

  <Divider/>
  <Hed>II. L'affaire Pierre Robert : le réseau France-Sénégal</Hed>

  <Body>Le 6 février 2026, la Division des Investigations Criminelles (DIC) défère quatorze individus supplémentaires devant le parquet du Tribunal de grande instance de Dakar. Cette seconde affaire, distincte de celle de Keur Massar, concerne un réseau transnational d'exploitation sexuelle de mineurs. Au centre du dossier se trouve Pierre Robert, entrepreneur français de 73 ans, interpellé en avril 2025 à Beauvais dans le cadre d'une opération conjointe de l'Office central de la répression de la traite des êtres humains (OCRTEH) et de l'Office central de lutte contre les violences aux personnes (OCRVP). L'enquête sénégalaise s'inscrit dans le cadre d'une commission rogatoire internationale.</Body>

  <div style={{marginBottom:24}}><StickScene id="robert"/></div>

  <Body>Robert possédait plusieurs biens immobiliers au Sénégal, à Dakar et à Kaolack. Le réseau, actif depuis 2017, fonctionnait selon un modèle à plusieurs niveaux : des intermédiaires locaux, qualifiés de « formateurs sexuels » dans le dossier, recrutaient des mineurs, les mettaient en contact avec des adultes, filmaient les abus et transmettaient les enregistrements contre rémunération. Quatre de ces intermédiaires ont été identifiés et déférés. Des stupéfiants ont été saisis lors des perquisitions.</Body>

  <Body>L'élément qui relie cette affaire à la première sur le plan épidémiologique est la volonté explicite, documentée par l'enquête, de transmettre le VIH aux victimes. Les éléments du dossier mentionnent une « obsession particulièrement grave : la transmission volontaire du VIH à des mineurs dans le cadre d'abus sexuels » (Libération, 7 février 2026). Les charges retenues combinent le droit pénal sénégalais et français : pédophilie en bande organisée, proxénétisme aggravé, viols sur mineurs de moins de 15 ans, actes contre nature, et transmission volontaire du VIH.</Body>

  <FB color={C.vio} label="AFFAIRE 2 · RÉSEAU PIERRE ROBERT · FRANCE-SÉNÉGAL · 2017-2025">
    <strong>14 déferrements</strong> par la DIC. Réseau transfrontalier actif depuis 2017. Pierre Robert, 73 ans, entrepreneur français, cerveau présumé. <strong>4 « formateurs sexuels »</strong> identifiés. Arrestations à Dakar et Kaolack. Charges : pédophilie en bande organisée, proxénétisme aggravé, viols sur mineurs {'<'}15 ans, actes contre nature, transmission volontaire du VIH. Stupéfiants saisis. Commission rogatoire internationale OCRTEH/OCRVP.
  </FB>

  <Body>La dimension transfrontalière du réseau, son ancienneté documentée (huit années d'activité) et le nombre de mineurs impliqués posent une question épidémiologique distincte de celle soulevée par l'affaire de Keur Massar. Ici, les chaînes de transmission ont pu s'étendre sur une durée plus longue, dans des conditions où les victimes (mineures, souvent issues de milieux défavorisés) avaient un accès au dépistage et au traitement probablement nul. L'absence de données individuelles sur le statut sérologique des victimes de ce réseau empêche toute estimation directe.</Body>

  <Body>Il faut souligner que le profil épidémiologique de ce réseau diffère du premier sur un point crucial : les victimes sont des mineurs. La dynamique de charge virale chez l'enfant et l'adolescent diffère de celle de l'adulte (Luzuriaga et al., NEJM, 2006), avec des charges virales plus élevées et plus prolongées, ce qui implique une infectiosité potentiellement supérieure si ces mineurs, devenus adultes, entrent à leur tour dans des réseaux sexuels sans avoir été dépistés ni traités. Par ailleurs, la littérature sur l'exploitation sexuelle des mineurs dans le contexte VIH (Silverman et al., 2008) montre que les victimes de violences sexuelles précoces ont une probabilité significativement plus élevée de développer des comportements sexuels à risque à l'âge adulte, ce qui prolonge les chaînes de transmission bien au-delà de la période d'activité du réseau lui-même. Notre modèle se concentre sur la dynamique de type Keur Massar (réseau HSH adulte avec pont bisexuel), en gardant à l'esprit que l'affaire Robert représente une source de transmission supplémentaire dont l'ampleur reste à établir par des enquêtes épidémiologiques spécifiques.</Body>

  <Divider/>
  <Hed>III. Le pont bisexuel</Hed>

  <Body>Revenons aux données de Keur Massar. Parmi les douze interpellés, trois sont mariés au moment de l'arrestation et deux sont divorcés : cinq personnes sur douze, soit 42 %, avec une vie conjugale hétérosexuelle documentée. Ce chiffre sous-estime vraisemblablement la réalité, puisqu'il exclut les relations non officialisées. Or la littérature épidémiologique montre que ce phénomène constitue un trait structurel des réseaux HSH en Afrique de l'Ouest, et non une particularité de cette affaire.</Body>

  <Body>Larmarange et al. (Population, 2009) ont conduit l'une des premières études de grande envergure sur les trajectoires sexuelles des HSH au Sénégal. Leurs résultats indiquent que 65 à 80 % des HSH sénégalais déclarent des comportements bisexuels sur l'année écoulée, un taux significativement plus élevé que dans les autres pays africains inclus dans l'étude. La proportion d'homosexuels exclusifs oscillait entre 6 % (2004) et 13 % (2007). Les auteurs rapportent que le mariage hétérosexuel fonctionne, dans le contexte sénégalais, comme une stratégie de gestion du risque social : il permet de répondre aux attentes familiales et religieuses tout en maintenant une vie sexuelle clandestine avec des hommes. L'étude identifie un lexique wolof propre à la communauté (<em>ubbi</em> pour le partenaire passif, <em>yoos</em> pour le partenaire actif, <em>branché</em> comme terme générique), ce qui témoigne d'une structuration sociale ancienne et élaborée de ces pratiques.</Body>

  <div style={{marginBottom:24}}><StickScene id="bridge"/></div>

  <Pullquote source="Homme HSH, 25 ans, Sénégal (Nkoum et al., cité par Roux et al., AIDS and Behavior, 2025)">
    « Ma femme, c'est une chose obligatoire. C'est écrit par Dieu. Tout ce qui est en dehors de ça n'a pas d'importance. Si je suis avec ma femme dans la rue, je peux l'embrasser, porter ses affaires. Je n'oserais jamais faire ça avec l'autre personne. »
  </Pullquote>

  <Body>Ce témoignage illustre la double contrainte vécue par les HSH dans un environnement où l'article 319 du Code pénal punit les « actes contre nature avec une personne de même sexe » de un à cinq ans d'emprisonnement. Notons que le droit sénégalais pénalise l'acte sexuel et non l'orientation : un homme peut se déclarer homosexuel sans risque pénal, mais tout rapport sexuel entre personnes de même sexe constitue une infraction. Cette distinction juridique est importante, parce qu'elle structure directement les stratégies comportementales : l'enjeu pour les HSH consiste à rendre l'acte invisible, et le moyen le plus efficace d'y parvenir est de maintenir une vie conjugale hétérosexuelle visible.</Body>

  <Body>Roux et al. (AIDS and Behavior, 2025) confirment l'ampleur continentale du phénomène dans une méta-analyse portant sur 124 études menées dans 24 pays d'Afrique subsaharienne. En Afrique de l'Ouest, 16 % des HSH sont actuellement mariés à une femme et 40 % entretiennent une relation stable avec une partenaire féminine. Les motivations identifiées sont multiples : pression familiale au mariage, obligation religieuse perçue, nécessité économique de fonder un foyer, et dissimulation de l'homosexualité dans un contexte de criminalisation. L'étude montre également que les HSH bisexuels actifs ont tendance à utiliser moins le préservatif avec leurs partenaires féminines qu'avec leurs partenaires masculins (OR = 0,6 à 0,7 selon les études incluses), un résultat cohérent avec l'idée que la relation hétérosexuelle est perçue comme « sûre » par définition.</Body>

  <Body>En épidémiologie, ce phénomène porte un nom : le « pont bisexuel » (<em>bisexual bridge</em>). Le concept a été formalisé par Goodreau et Golden (2007, Sexually Transmitted Diseases) et son importance pour l'épidémie africaine a été établie par Beyrer et al. (Lancet, 2012). Le mécanisme est le suivant. Un homme infecté dans le réseau HSH rentre chez lui retrouver sa conjointe. En l'absence de traitement, il maintient une charge virale chronique qui, selon les estimations de Hollingsworth et al. (2008), correspond à un multiplicateur φ = 1 en phase chronique, mais qui remonte jusqu'à φ = 2,5 après cinq ans sans traitement. Sa conjointe n'a aucune raison de se faire dépister. Si elle contracte le VIH et tombe enceinte, l'enfant à naître est exposé à un risque de transmission mère-enfant (TME) estimé à 30 % en l'absence de PTME (De Cock et al., JAMA, 2000). Avec une PTME correcte incluant ARV, ce risque descend à 1,5 % (Townsend et al., AIDS, 2014), mais l'accès à la PTME suppose un dépistage préalable de la mère, qui suppose que le risque ait été identifié en amont.</Body>

  <Body>Coombs et al. (AIDS, 2009) ont modélisé ce pont dans le contexte est-africain et montré qu'il pouvait expliquer entre 6 et 20 % des nouvelles infections féminines dans les pays à épidémie concentrée. Smith et al. (AIDS and Behavior, 2009) ont documenté un résultat convergent au Sénégal : la proportion de nouvelles infections féminines attribuables au pont bisexuel est d'autant plus élevée que la bisexualité est fréquente dans les réseaux HSH et que l'utilisation du préservatif avec les partenaires féminines est faible. Or ces deux conditions sont réunies au Sénégal, où la bisexualité active dépasse 65 % (Larmarange 2009) et où l'utilisation du préservatif avec les conjointes est estimée à moins de 10 % (Wade et al., 2005). La chaîne causale traverse ainsi trois univers sociaux entièrement cloisonnés : le réseau HSH invisible, le foyer conjugal apparemment ordinaire, et la maternité.</Body>

  <CB color={C.amber} title="Révision du paramètre clé : π_fem = 88 %">
    La version précédente du modèle retenait <Tex tex="\pi_{\text{fem}}"/> = 70 %. Les données de Keur Massar (5 mariés ou divorcés sur 12, proportion nécessairement sous-estimée), conjuguées à Larmarange 2009 (65-80 % de bisexualité active), Roux 2025 (40 % en couple stable avec une femme) et Beyrer 2012 (sous-estimation systématique du pont bisexuel dans les modèles africains), nous conduisent à relever ce paramètre à <strong>88 %</strong>. Cette révision augmente mécaniquement le nombre de femmes et d'enfants atteints dans nos simulations.
  </CB>

  <Divider/>
  <Hed>IV. Le paradoxe de la pénalisation</Hed>

  <Body>Il existe dans la littérature épidémiologique un résultat solidement établi, qui prend la forme d'un paradoxe apparent : plus un État pénalise les rapports entre personnes de même sexe, plus la transmission du VIH vers la population générale tend à augmenter. Ce résultat contre-intuitif a été documenté à plusieurs reprises depuis le début des années 2010, et il repose sur des mécanismes identifiables.</Body>

  <Body>Beyrer et al. (Lancet, 2012), dans une revue systématique couvrant 133 pays à revenus faibles et intermédiaires, montrent que la prévalence du VIH chez les HSH est en moyenne 13 fois supérieure à celle de la population générale adulte masculine. Surtout, les auteurs établissent que cette disparité est significativement plus marquée dans les pays où les rapports homosexuels sont criminalisés. Le mécanisme est le suivant : la criminalisation pousse les HSH à éviter les services de santé (dépistage, traitement, prévention), ce qui maintient des charges virales élevées dans la communauté et favorise la transmission. Shannon et al. (Lancet, 2015) parviennent à une conclusion convergente en modélisant l'impact des lois punitives sur la couverture en antirétroviraux : dans les pays dotés de lois criminalisant l'homosexualité, la couverture ARV chez les HSH est en moyenne inférieure de 15 à 25 points de pourcentage par rapport aux pays sans criminalisation, toutes choses égales par ailleurs.</Body>

  <div style={{marginBottom:24}}><StickScene id="paradox"/></div>

  <Body>Le Sénégal illustre ce paradoxe de manière particulièrement nette. En janvier 2008, la publication de photographies d'un supposé mariage entre deux hommes dans le magazine Icône a déclenché une vague de répression sans précédent. Neuf militants HSH travaillant dans des programmes de prévention du VIH financés par le Fonds mondial ont été arrêtés et condamnés. Les locaux de l'association Aides Sénégal ont été saccagés. L'événement a provoqué un effondrement des programmes de santé communautaire ciblant les HSH. Poteat et al. (PLoS Medicine, 2011) ont documenté les conséquences en détail, à partir d'entretiens approfondis menés auprès de 67 HSH à Dakar : disparition des points de distribution de préservatifs, interruption des dépistages communautaires, abandon des consultations IST par crainte d'être identifié, dissolution des réseaux d'entraide et d'information. Les HSH, « convaincus qu'ils ne sont pas protégés malgré leur engagement » dans les programmes de santé, se sont enfoncés dans la clandestinité. Les programmes qui commençaient à produire des résultats mesurables (augmentation du dépistage de 12 % entre 2005 et 2007 dans les zones pilotes) se sont effondrés en quelques semaines. Dix-huit ans plus tard, en 2026, les conditions structurelles n'ont pas fondamentalement changé : l'article 319 est toujours en vigueur, la couverture ARV chez les HSH reste estimée à moins de 5 % (CNLS, 2023), et les réseaux de prévention communautaire fonctionnent dans la semi-clandestinité.</Body>

  <Pullquote source="Participant HSH, Dakar (Poteat et al., PLoS Medicine, 2011)">
    « Les jeunes avaient peur et se cachent à cause des médias qui montent la population contre les HSH. Si jamais tu te fais prendre, tu risques la lapidation ou la mort. »
  </Pullquote>

  <Body>Millett et al. (PLoS Medicine, 2012) ont quantifié ce phénomène à l'échelle mondiale : dans les pays criminalisant l'homosexualité, les HSH ont 7,3 fois moins de chances d'avoir accès à des services de prévention du VIH que dans les pays sans criminalisation. Baral et al. (Lancet, 2013) montrent que l'exclusion des HSH des systèmes de santé accroît le risque de transmission vers la population générale via le pont bisexuel, un résultat confirmé par les modélisations de Gupta et al. (2019, Nature Communications) qui estiment que la décriminalisation combinée à un accès au dépistage réduirait de 25 à 40 % la transmission du VIH dans les réseaux HSH d'Afrique de l'Ouest.</Body>

  <Body>Le paradoxe se décompose en cinq maillons causaux, chacun documenté indépendamment. Premier maillon : la criminalisation pousse les HSH vers la clandestinité et les éloigne du système de santé (Poteat 2011, Millett 2012). Deuxième maillon : la clandestinité renforce le recours au mariage hétérosexuel de couverture (Larmarange 2009, Roux 2025). Troisième maillon : le mariage de couverture crée le pont bisexuel vers la population générale. Quatrième maillon : l'absence de dépistage maintient des charges virales élevées qui maximisent la probabilité de transmission à chaque rapport sexuel (Hollingsworth et al., 2008 ; Cohen et al., NEJM, 2011). Cinquième maillon : l'absence de traitement empêche l'effet U=U (Indétectable = Intransmissible), validé par l'essai HPTN 052, de jouer son rôle protecteur. Chacun de ces maillons est indépendamment vérifié ; leur enchaînement produit un mécanisme d'amplification épidémique dont notre modèle permet d'estimer la magnitude.</Body>

  <Body>Hatzenbuehler et al. (Social Science & Medicine, 2015) ont par ailleurs montré, dans une analyse multi-pays, que les lois criminalisantes ont un impact mesurable sur la santé mentale des HSH (prévalence accrue de dépression, anxiété, comportements à risque), ce qui se traduit en aval par une moindre adhérence aux comportements de prévention et une plus grande exposition aux IST cofacteurs de transmission du VIH (Fleming et Wasserheit, 1999). Au Sénégal spécifiquement, Baral et al. (Lancet, 2013) ont documenté que l'exclusion des HSH des systèmes de santé accroît non seulement le risque au sein de la communauté HSH, mais aussi le risque pour la population générale via le pont bisexuel. Gupta et al. (Nature Communications, 2019) estiment par modélisation que la décriminalisation combinée à un accès au dépistage réduirait de 25 à 40 % la transmission du VIH dans les réseaux HSH d'Afrique de l'Ouest. L'appareil juridique conçu pour contenir un phénomène social contribue ainsi, par un enchaînement causal documenté à chaque étape, à amplifier le risque sanitaire pour l'ensemble de la société. Notre modèle permet précisément de quantifier cet effet.</Body>

  <Divider/>
  <Hed>V. Ce que dit le modèle</Hed>

  <Body>Notre modèle simule un réseau clandestin de 180 individus, structuré selon un graphe de Barabási-Albert assortatif avec réécriture de Watts-Strogatz. Deux transmetteurs délibérés y opèrent : P₀, actif dès janvier 2017, et P₁, entré en 2019. Le réseau est calibré sur la littérature épidémiologique disponible pour l'Afrique de l'Ouest : Baggaley 2010 pour les taux de transmission par acte, Hollingsworth 2008 pour la dynamique de charge virale, Goodreau 2012 pour la structure des partenariats. Chaque simulation couvre 108 mois (janvier 2017 à janvier 2026). Huit cents réplications Monte Carlo ont été effectuées pour chacun des cinq scénarios testés (voir l'onglet Méthodologie pour la spécification formelle et les démonstrations).</Body>

  <div style={{background:"#fff",border:`2px solid ${C.crim}`,borderRadius:8,padding:"24px",margin:"28px 0",textAlign:"center"}}>
    <div style={{fontSize:11,fontFamily:C.fm,color:C.crim,letterSpacing:3,marginBottom:8}}>ESTIMATION CENTRALE · 2 TRANSMETTEURS DÉLIBÉRÉS · 800 MC</div>
    <div style={{fontSize:72,fontFamily:C.fd,fontWeight:900,color:C.crim,lineHeight:1}}>{s.d2.med}</div>
    <div style={{fontSize:15,fontFamily:C.fb,color:C.ink2,marginTop:8}}>infections totales estimées, janvier 2017 à janvier 2026</div>
    <div style={{fontSize:13,fontFamily:C.fm,color:C.ink3,marginTop:4}}>IC₉₀ : [{s.d2.p5} – {s.d2.p95}]</div>
    <div style={{display:"flex",justifyContent:"center",gap:32,marginTop:16}}>
      <Stat v={s.d2.msmM} l="HSH" c={C.crim}/><Stat v={s.d2.femM} l="Conjointes" c={C.amber}/><Stat v={s.d2.mtctM} l="Enfants" c={C.vio}/>
    </div>
  </div>

  <Body>Ce chiffre demande une mise en perspective. La justice sénégalaise a identifié huit personnes séropositives dans le groupe de Keur Massar. Le modèle suggère que le nombre réel de personnes infectées dans un réseau de cette taille, par les chaînes initiées par deux transmetteurs délibérés sur neuf ans, se situe entre {s.d2.p5} et {s.d2.p95} (intervalle à 90 %). L'écart tient à trois phénomènes que le système judiciaire ne peut capturer : les cascades de transmission involontaires (les victimes directes transmettent à leurs propres partenaires sans connaître leur statut), le pont bisexuel vers les conjointes, et la transmission mère-enfant. Ces trois mécanismes représentent ensemble la majorité des infections estimées.</Body>

  <Body>Le premier suspect revendique avoir exposé « une dizaine » de personnes. Le modèle estime le nombre de victimes directes de P₀ et P₁ combinés à {s.d2.dirM} (médiane). Mais ces victimes directes transmettent à leur tour : les cascades involontaires ajoutent {s.d2.casM} infections HSH supplémentaires. Puis le pont bisexuel ajoute {s.d2.femM} conjointes et {s.d2.mtctM} enfants. L'amplification par les cascades repose sur une propriété fondamentale des réseaux scale-free : Pastor-Satorras et Vespignani (Physical Review Letters, 2001) ont démontré que le seuil épidémique tend vers zéro lorsque la distribution des degrés suit une loi de puissance avec <Tex tex="\gamma \leq 3"/>, ce qui signifie qu'un seul individu placé dans un hub du réseau peut engendrer une épidémie soutenue même avec une probabilité de transmission par acte très faible. Dans notre réseau (Barabási-Albert, γ ≈ 3), les transmetteurs délibérés occupent par construction les positions les plus connectées, ce qui maximise leur capacité de diffusion.</Body>

  <Body>Un point technique mérite d'être souligné. Le modèle ne simule pas un réseau statique : les partenariats se forment et se dissolvent dynamiquement (durée moyenne τ = 6 mois, calibrée sur Goodreau 2012), tandis que le réseau d'opportunités <Tex tex="G_{\text{opp}}"/> reste fixe. Cette distinction entre réseau d'opportunités et partenariats réalisés est essentielle : un individu ne peut transmettre le virus qu'à un partenaire actuel, mais il peut accumuler de nombreux partenaires successifs au fil du temps. Les transmetteurs délibérés, avec un taux d'activité <Tex tex="\lambda \sim U(8,12)"/> partenaires/an et un nombre maximal de partenariats simultanés de 6, génèrent un flux continu de nouvelles connexions dans le réseau, chacune constituant une opportunité de transmission. L'absence de préservatif (hypothèse H2) et le sérotriage inversé (ciblage préférentiel des séronégatifs) amplifient considérablement la probabilité de transmission à chaque contact.</Body>

  <Divider/>
  <Hed>VI. Anatomie d'une cascade</Hed>

  <Body>Le croquis ci-dessous décompose le processus de propagation en générations successives. Un transmetteur délibéré (P₀, génération 0) infecte ses victimes directes (génération 1). Celles-ci, ignorant leur statut dans un contexte où le dépistage expose à des poursuites pénales, transmettent involontairement à leurs partenaires (génération 2), qui transmettent à leur tour (génération 3). À chaque génération, les hommes mariés ou en couple avec une femme créent des ponts vers les conjointes (en ambre), et chaque conjointe enceinte expose l'enfant à naître (en violet). La structure arborescente de la cascade explique pourquoi un nombre initial modeste de victimes directes peut engendrer un total de {s.d2.med} infections en neuf ans.</Body>

  <Body>Il faut insister sur un point que la visualisation rend immédiatement perceptible : l'essentiel des dégâts ne provient pas du transmetteur délibéré lui-même, mais des cascades involontaires qu'il déclenche. Si P₀ infecte directement dix personnes (chiffre qu'il revendique), et que chacune de ces personnes infecte en moyenne deux partenaires supplémentaires sur une période de neuf ans (estimation conservatrice pour un réseau à cette connectivité), on obtient déjà trente infections supplémentaires à la génération 2. À la génération 3, le nombre d'infections nouvelles dépend de la structure du réseau : sur un réseau scale-free, les individus les plus connectés sont atteints en premier (par construction, puisque le transmetteur délibéré cible les hubs), ce qui signifie que les cascades suivantes se propagent dans des sous-réseaux de moins en moins connectés. C'est ce phénomène de saturation progressive qui donne à la courbe de transmission sa forme caractéristique de sigmoïde, visible dans les graphiques de l'onglet Simulateur.</Body>

  <div style={{marginBottom:24}}><StickScene id="cascade"/></div>

  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
    {[{n:"VAGUE 1",l:"Victimes directes",v:s.d2.dirM,c:C.gold,d:`Infectées directement par P₀ ou P₁. Le premier suspect en revendique « une dizaine ». Seules ces victimes sont identifiables par le système judiciaire comme relevant de la transmission délibérée.`},
      {n:"VAGUE 2",l:"Cascades involontaires",v:s.d2.casM,c:C.crim,d:`Les victimes directes transmettent involontairement à leurs propres partenaires masculins. Dans un contexte où le dépistage expose à la prison (Poteat 2011), la majorité ignore son statut sérologique pendant des années.`},
      {n:"VAGUE 3",l:"Conjointes et enfants",v:s.d2.femM+s.d2.mtctM,c:C.amber,d:`Le pont bisexuel : ${s.d2.femM} conjointes contaminées par des maris qui ignorent leur séropositivité, ${s.d2.mtctM} enfants exposés par TME. Aucune de ces personnes n'a de lien avec le réseau MSH.`},
    ].map(({n,l,v,c,d},i)=>(
      <div key={i} style={{background:"#fff",borderTop:`4px solid ${c}`,borderRadius:4,padding:"16px 14px",border:`1px solid ${C.brd}`}}>
        <div style={{fontSize:9,fontFamily:C.fm,color:c,letterSpacing:2,marginBottom:4}}>{n}</div>
        <div style={{fontSize:32,fontFamily:C.fd,fontWeight:900,color:c}}>{v}</div>
        <div style={{fontSize:12,fontFamily:C.fd,fontWeight:700,color:C.ink,marginTop:2,marginBottom:8}}>{l}</div>
        <div style={{fontSize:11.5,fontFamily:C.fb,color:C.ink3,lineHeight:1.65,textAlign:"justify"}}>{d}</div>
      </div>))}
  </div>

  <Hed sub>Simulation interactive : la propagation mois par mois</Hed>
  <Body>Le graphe ci-dessous restitue la simulation de référence (réplication nᵒ 0, scénario central). Les transmetteurs délibérés (P₀, P₁) apparaissent en or. Les arêtes rouges matérialisent les transmissions entre HSH. Les cercles ambrés pulsants signalent les conjointes atteintes. Les points violets marquent les TME.</Body>

  <div style={{marginBottom:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 12px",background:"#fff",borderRadius:4,border:`1px solid ${C.brd}`}}>
      <button onClick={()=>{setNetMonth(1);setPlaying(true)}} style={{background:`${C.coral}12`,border:`1px solid ${C.coral}44`,color:C.coral,padding:"5px 14px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:C.fm}}>▶ Animer</button>
      <button onClick={()=>{setPlaying(false);setNetMonth(108)}} style={{background:`${C.ink}08`,border:`1px solid ${C.brd}`,color:C.ink3,padding:"5px 10px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:C.fm}}>■ Fin</button>
      <input type="range" min={1} max={108} value={netMonth} onChange={e=>{setNetMonth(+e.target.value);setPlaying(false)}} style={{flex:1,accentColor:C.coral}}/>
      <span style={{fontSize:12,fontFamily:C.fm,color:C.ink,minWidth:80,fontWeight:600}}>{Math.floor(2017+netMonth/12)}</span>
    </div>
    <AnimatedNet sim={ref1} month={netMonth} width={680} height={440}/>
  </div>

  <ResponsiveContainer width="100%" height={280}>
    <AreaChart data={bkdn}><defs>
      <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.crim} stopOpacity={.35}/><stop offset="100%" stopColor={C.crim} stopOpacity={.03}/></linearGradient>
      <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity={.4}/><stop offset="100%" stopColor={C.amber} stopOpacity={.03}/></linearGradient>
      <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.vio} stopOpacity={.4}/><stop offset="100%" stopColor={C.vio} stopOpacity={.03}/></linearGradient>
    </defs><CartesianGrid stroke={C.grid}/><XAxis dataKey="yr" tickFormatter={yrFmt} tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><YAxis tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><Tooltip contentStyle={ttS} labelFormatter={v=>`${Math.floor(v)}`}/>
      <Area type="monotone" dataKey="HSH" stackId="1" stroke={C.crim} fill="url(#gM)" strokeWidth={1.5}/>
      <Area type="monotone" dataKey="Conjointes" stackId="1" stroke={C.amber} fill="url(#gF)" strokeWidth={1.5}/>
      <Area type="monotone" dataKey="Enfants" stackId="1" stroke={C.vio} fill="url(#gC2)" strokeWidth={1.5}/>
      <Legend wrapperStyle={{fontSize:10,fontFamily:C.fm}}/></AreaChart>
  </ResponsiveContainer>

  <Divider/>
  <Hed>VII. Le coût épidémique de l'article 319</Hed>

  <Body>Notre modèle permet de quantifier l'impact de la couverture ARV sur la transmission en comparant deux scénarios. Le scénario « pénalisation » fixe la couverture ARV à environ 2 %, un niveau cohérent avec les estimations disponibles pour les HSH sénégalais (Poteat 2011, Shannon 2015). Le scénario contrefactuel suppose une couverture de 30 %, un niveau atteignable avec un dépistage communautaire confidentiel (tel que les programmes pilotes conduits au Burkina Faso, en Côte d'Ivoire et au Togo, documentés par Orne-Gliemann et al., 2017). La différence entre les deux scénarios mesure le surcoût en infections attribuable à l'absence d'accès au traitement.</Body>

  <Body>La comparaison met en jeu un mécanisme biologique précis. L'essai HPTN 052, dont les résultats ont été publiés par Cohen et al. dans le New England Journal of Medicine en 2011, a démontré que les personnes vivant avec le VIH sous traitement antirétroviral efficace, avec une charge virale supprimée (indétectable), ne transmettent pas le virus par voie sexuelle. Ce résultat, résumé par le slogan U = U (Undetectable = Untransmittable), a été confirmé par les études PARTNER 1 et 2 (Rodger et al., JAMA, 2016 et Lancet, 2019) portant spécifiquement sur les couples sérodifférents masculins. Dans notre modèle, une personne sous ARV depuis plus de 6 mois voit sa charge virale réduite d'un facteur 25 (φ passe de 1 à 0,04), ce qui réduit la probabilité de transmission par acte de plus de 96 %. L'effet est d'autant plus marqué que la personne infectée a de nombreux partenaires, puisque chaque acte sexuel est rendu quasi non transmissif.</Body>

  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
    <div style={{background:"#fff",borderTop:`4px solid ${C.vio}`,borderRadius:4,padding:"18px 16px",border:`1px solid ${C.brd}`}}>
      <div style={{fontSize:10,fontFamily:C.fm,color:C.vio,letterSpacing:1.5}}>PÉNALISATION (RÉALITÉ)</div>
      <div style={{fontSize:10,fontFamily:C.fm,color:C.ink3,marginTop:2}}>~2 % sous ARV</div>
      <div style={{fontSize:44,fontFamily:C.fd,fontWeight:900,color:C.vio,marginTop:10}}>{s.crim.med}</div>
      <div style={{fontSize:12,fontFamily:C.fb,color:C.ink2}}>infections · [{s.crim.p5}–{s.crim.p95}]</div>
    </div>
    <div style={{background:"#fff",borderTop:`4px solid ${C.teal}`,borderRadius:4,padding:"18px 16px",border:`1px solid ${C.brd}`}}>
      <div style={{fontSize:10,fontFamily:C.fm,color:C.teal,letterSpacing:1.5}}>CONTREFACTUEL 30 % ARV</div>
      <div style={{fontSize:10,fontFamily:C.fm,color:C.ink3,marginTop:2}}>Dépistage communautaire confidentiel · U=U</div>
      <div style={{fontSize:44,fontFamily:C.fd,fontWeight:900,color:C.teal,marginTop:10}}>{s.d2art.med}</div>
      <div style={{fontSize:12,fontFamily:C.fb,color:C.ink2}}>infections · [{s.d2art.p5}–{s.d2art.p95}]</div>
    </div>
  </div>

  <CB color={C.vio} title={`Écart estimé : ${s.crim.med - s.d2art.med} infections supplémentaires`}>
    L'absence d'accès au dépistage et au traitement transforme chaque infection en source de transmission active pendant des années. L'effet U=U (Cohen et al., NEJM, 2011) réduit la transmission de 96 % chez les personnes sous ARV avec charge virale supprimée. Avec une couverture de 30 %, cet effet suffirait à freiner considérablement la dynamique épidémique, y compris via le pont bisexuel.
  </CB>

  <ResponsiveContainer width="100%" height={260}>
    <ComposedChart data={comp}><CartesianGrid stroke={C.grid}/><XAxis dataKey="yr" tickFormatter={yrFmt} tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><YAxis tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><Tooltip contentStyle={ttS} labelFormatter={v=>`${Math.floor(v)}`}/>
      <Area type="monotone" dataKey="d2_95" stroke="none" fill={C.coral} fillOpacity={.05}/>
      <Area type="monotone" dataKey="d2_5" stroke="none" fill={C.bg} fillOpacity={1}/>
      <ReferenceLine x={2019} stroke={C.gold} strokeDasharray="4 3" strokeOpacity={.4}/>
      <Line type="monotone" dataKey="crim" stroke={C.vio} strokeWidth={2.5} dot={false} name="Pénalisation (2 % ARV)"/>
      <Line type="monotone" dataKey="d2" stroke={C.coral} strokeWidth={2} dot={false} name="Scénario central"/>
      <Line type="monotone" dataKey="d2a" stroke={C.teal} strokeWidth={2} dot={false} strokeDasharray="6 3" name="Contrefactuel 30 % ARV"/>
      <Legend wrapperStyle={{fontSize:10,fontFamily:C.fm}}/></ComposedChart>
  </ResponsiveContainer>

  <Divider/>
  <Hed>VIII. Ce que la justice ne peut voir</Hed>

  <Body>Le système judiciaire sénégalais dispose, avec les deux affaires de février 2026, d'éléments matériels solides : des aveux, des tests sérologiques, des preuves numériques extraites d'un iPhone 11. Le procureur Saliou Dicko pourra vraisemblablement établir la responsabilité pénale de Pape Salif Rall Thiam pour les infections directes documentées par les examens médicaux et les témoignages. Mais la portée véritable de ses actes échappe par nature au cadre juridique.</Body>

  <Body>Un tribunal peut condamner un individu pour avoir transmis le VIH à dix personnes identifiées. Il ne peut appréhender les dizaines d'infections involontaires déclenchées par ces dix victimes, les conjointes atteintes par le pont bisexuel, ni les enfants nés séropositifs d'une mère qui ignorait tout de son exposition. La phylogénétique virale (analyse des séquences du VIH pour reconstituer les chaînes de transmission) pourrait en théorie documenter certaines de ces cascades, mais elle n'a pas été employée dans cette affaire et requiert des moyens techniques rarement disponibles en Afrique de l'Ouest (Abecasis et al., 2018). La modélisation stochastique constitue donc, en l'état actuel des moyens d'investigation, le seul instrument capable de fournir une estimation, même imparfaite, de l'étendue réelle des dommages.</Body>

  <Body>Les chiffres que nous produisons ici comportent des limites importantes, détaillées dans l'onglet Méthodologie : un seul cluster de 180 nœuds, un réseau d'opportunités statique, l'absence de PrEP et de mortalité VIH dans le modèle, et des paramètres calibrés sur la littérature régionale plutôt que sur des données individuelles. Mais même en prenant la borne inférieure de l'intervalle de confiance à 90 % (soit {s.d2.p5} infections pour le scénario central), le nombre total d'infections dépasse très largement les huit cas identifiés par la justice.</Body>

  <Body>L'enseignement principal de ce travail est que les dommages causés par la transmission délibérée du VIH dans un réseau clandestin ne se réduisent pas aux victimes directes identifiables par le système judiciaire. Ils incluent les cascades de transmission involontaires, le pont bisexuel vers les conjointes, et la transmission mère-enfant. Ces trois mécanismes sont amplifiés par les conditions structurelles qui entourent la clandestinité HSH au Sénégal : absence de dépistage, absence de traitement, charges virales élevées, maintien forcé de relations hétérosexuelles de couverture. Modifier n'importe lequel de ces facteurs structurels, comme le montre notre scénario contrefactuel à 30 % d'ARV, réduit significativement le bilan total. Le modèle ne prescrit rien. Il mesure des trajectoires sous différentes hypothèses, et les chiffres parlent. L'onglet « Dakar » étend cette analyse à l'échelle de la métropole, et l'onglet « Simulateur » permet d'explorer la sensibilité des résultats aux hypothèses du modèle.</Body>

  <Divider/>
  <div style={{fontSize:11.5,fontFamily:C.fb,color:C.ink3,lineHeight:1.85,textAlign:"justify"}}>
    <strong>Note.</strong> Ces estimations proviennent d'un modèle stochastique individu-centré calibré sur la littérature publiée. L'onglet <em>Simulateur</em> présente les cinq scénarios et les distributions complètes. L'onglet <em>Dakar</em> extrapole à l'échelle de la population HSH de la région. L'onglet <em>Méthodologie</em> contient les hypothèses, les propositions démontrées, les paramètres et le pseudo-code.
  </div>
</div>)}

{/* ═══════════════════ SIMULATEUR ═══ */}
{tab==="sim"&&(
<div style={{maxWidth:680,paddingBottom:60}}>
  <Hed>Simulateur : cinq scénarios, 800 réplications</Hed>

  <Body>Le modèle est exécuté sous cinq configurations distinctes, chacune correspondant à une hypothèse différente sur le nombre de transmetteurs délibérés, la couverture en antirétroviraux et le niveau de concurrence sexuelle. Chaque scénario est répliqué 800 fois avec des graines pseudo-aléatoires distinctes (Lehmer, a = 48271, m = 2³¹ − 1). Les résultats sont présentés sous forme de distributions empiriques et de trajectoires médianes avec bandes d'incertitude.</Body>

  <Hed sub>Trajectoires comparées</Hed>
  <Body>Le graphique ci-dessous superpose les trajectoires médianes des cinq scénarios sur la période 2017-2026. La bande rosée représente l'intervalle P₅-P₉₅ du scénario central (2 transmetteurs délibérés, 0 % ARV). La ligne verticale dorée marque l'entrée de P₁ dans le réseau (janvier 2019). On observe que l'accélération de la transmission est nette après cette date, avec un changement de pente visible dans tous les scénarios à 2 transmetteurs. Le scénario de pénalisation (violet) diverge du scénario central à partir de 2020 environ, lorsque les effets cumulés de l'absence presque totale de traitement se font sentir sur les charges virales chroniques.</Body>

  <ResponsiveContainer width="100%" height={340}>
    <ComposedChart data={comp}><CartesianGrid stroke={C.grid}/><XAxis dataKey="yr" tickFormatter={yrFmt} tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><YAxis tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}} label={{value:"Infections cumulées",angle:-90,position:"insideLeft",style:{fontSize:9,fill:C.ink3,fontFamily:C.fm}}}/><Tooltip contentStyle={ttS} labelFormatter={v=>`${Math.floor(v)}`}/>
      <Area type="monotone" dataKey="d2_95" stroke="none" fill={C.coral} fillOpacity={.08}/>
      <Area type="monotone" dataKey="d2_5" stroke="none" fill={C.bg} fillOpacity={1}/>
      <ReferenceLine x={2019} stroke={C.gold} strokeDasharray="4 3" strokeOpacity={.4} label={{value:"P₁",fill:C.gold,fontSize:9,fontFamily:C.fm}}/>
      <Line type="monotone" dataKey="d1" stroke={C.teal} strokeWidth={2} dot={false} name="1 transmetteur"/>
      <Line type="monotone" dataKey="d2" stroke={C.coral} strokeWidth={3} dot={false} name="2 transmetteurs"/>
      <Line type="monotone" dataKey="d2c" stroke={C.crim} strokeWidth={2} dot={false} name="2T + concurrence ×1.5"/>
      <Line type="monotone" dataKey="d2a" stroke={C.teal} strokeWidth={1.5} dot={false} strokeDasharray="6 3" name="30 % ARV"/>
      <Line type="monotone" dataKey="crim" stroke={C.vio} strokeWidth={2} dot={false} name="Pénalisation"/>
      <Legend wrapperStyle={{fontSize:10,fontFamily:C.fm}}/></ComposedChart>
  </ResponsiveContainer>

  <Hed sub>Distributions finales (mois 108)</Hed>
  <Body>Les histogrammes ci-dessous montrent la distribution du nombre total d'infections à la fin de la simulation (janvier 2026) pour quatre des cinq scénarios. La dispersion reflète l'incertitude stochastique : deux réseaux identiques en structure peuvent produire des résultats très différents selon la séquence exacte des événements de transmission. Cette variabilité est inhérente à tout processus de branchement sur réseau hétérogène (Bartlett, 1960) et justifie le recours à un grand nombre de réplications.</Body>

  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
    {[{key:"d2",l:"2 transmetteurs",c:C.coral},{key:"crim",l:"Pénalisation",c:C.vio},{key:"d2art",l:"30 % ARV",c:C.teal},{key:"d2c",l:"2T + conc. ×1.5",c:C.crim}].map(({key,l,c})=>(
      <div key={key} style={{background:"#fff",border:`1px solid ${C.brd}`,borderTop:`3px solid ${c}`,borderRadius:4,padding:14}}>
        <div style={{fontSize:12,fontFamily:C.fd,fontWeight:700,color:c,marginBottom:2}}>{l}</div>
        <div style={{fontSize:9,fontFamily:C.fm,color:C.ink3,marginBottom:8}}>Méd. {data[key].stats.med} · [{data[key].stats.p5}–{data[key].stats.p95}] · ♀ {data[key].stats.femM} · TME {data[key].stats.mtctM}</div>
        <ResponsiveContainer width="100%" height={100}><BarChart data={data[key].hist}><XAxis dataKey="x" tick={{fontSize:7,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><YAxis tick={{fontSize:7,fill:C.ink3}} tickLine={false} axisLine={false}/><Bar dataKey="count" fill={c} opacity={.5} radius={[2,2,0,0]}/></BarChart></ResponsiveContainer></div>))}
  </div>

  <Hed sub>Décomposition par population</Hed>
  <Body>Le graphique empilé ci-dessous décompose les infections du scénario central (2 transmetteurs) en trois populations : HSH (rouge), conjointes (ambre) et enfants (violet). La contribution des conjointes croît régulièrement à partir de 2019, ce qui reflète le délai entre l'infection d'un homme dans le réseau, la transmission à sa partenaire féminine, et la période où la grossesse pourrait survenir. La composante TME apparaît plus tardivement, généralement 12 à 18 mois après l'infection de la conjointe.</Body>

  <ResponsiveContainer width="100%" height={240}>
    <AreaChart data={bkdn}><CartesianGrid stroke={C.grid}/><XAxis dataKey="yr" tickFormatter={yrFmt} tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><YAxis tick={{fontSize:9,fill:C.ink3}} tickLine={false} axisLine={{stroke:C.brd}}/><Tooltip contentStyle={ttS} labelFormatter={v=>`${Math.floor(v)}`}/>
      <Area type="monotone" dataKey="HSH" stackId="1" stroke={C.crim} fill={C.crim} fillOpacity={.2} strokeWidth={1.5}/>
      <Area type="monotone" dataKey="Conjointes" stackId="1" stroke={C.amber} fill={C.amber} fillOpacity={.25} strokeWidth={1.5}/>
      <Area type="monotone" dataKey="Enfants" stackId="1" stroke={C.vio} fill={C.vio} fillOpacity={.25} strokeWidth={1.5}/>
      <Legend wrapperStyle={{fontSize:10,fontFamily:C.fm}}/></AreaChart>
  </ResponsiveContainer>

  <Hed sub>Tableau récapitulatif</Hed>
  <div style={{background:"#fff",border:`1px solid ${C.brd}`,borderRadius:5,overflow:"hidden",marginBottom:24}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:C.fm,fontSize:11}}>
      <thead><tr style={{borderBottom:`2px solid ${C.ink}`}}>{["Scénario","Méd.","IC₉₀","HSH","♀","TME","Direct.","Cascade"].map(h=><th key={h} style={{padding:"7px 8px",textAlign:"left",fontSize:8.5,letterSpacing:1,textTransform:"uppercase",color:C.ink3}}>{h}</th>)}</tr></thead>
      <tbody>{[{n:"1 transmetteur",s:s.d1,c:C.teal},{n:"2 transmetteurs",s:s.d2,c:C.coral},{n:"2T + conc. ×1.5",s:s.d2c,c:C.crim},{n:"30 % ARV",s:s.d2art,c:C.teal},{n:"Pénalisation",s:s.crim,c:C.vio}].map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.brd}`}}>
        <td style={{padding:"6px 8px",color:r.c,fontWeight:600}}>{r.n}</td><td style={{padding:"6px 8px",fontWeight:700,fontSize:14}}>{r.s.med}</td>
        <td style={{padding:"6px 8px",fontSize:10}}>[{r.s.p5}–{r.s.p95}]</td><td style={{color:C.crim}}>{r.s.msmM}</td>
        <td style={{color:C.amber}}>{r.s.femM}</td><td style={{color:C.vio}}>{r.s.mtctM}</td><td style={{color:C.gold}}>{r.s.dirM}</td><td style={{color:C.coral}}>{r.s.casM}</td></tr>)}</tbody>
    </table>
  </div>

  <Body>La sensibilité au nombre de transmetteurs délibérés est forte : le passage de 1 à 2 transmetteurs augmente l'estimation médiane de {s.d1.med} à {s.d2.med} infections, soit un facteur de {(s.d2.med/Math.max(s.d1.med,1)).toFixed(1)}. La couverture ARV a un effet protecteur marqué : le scénario à 30 % de couverture réduit le nombre d'infections à {s.d2art.med}, principalement via la suppression de la charge virale chez les personnes traitées (effet U=U). Le scénario de concurrence accrue (×1.5) simule un réseau où les individus du noyau central ont un nombre plus élevé de partenariats simultanés : le résultat ({s.d2c.med} infections) montre la sensibilité du modèle à la structure des partenariats.</Body>
</div>)}

{/* ═══════════════════ DAKAR ═══ */}
{tab==="dakar"&&(
<div style={{maxWidth:680,paddingBottom:60}}>
  <Hed>Extrapolation à l'échelle de Dakar</Hed>

  <Body>Le modèle simule un cluster isolé de 180 individus. La population HSH de la région de Dakar est estimée entre 15 000 et 25 000 personnes par le Conseil National de Lutte contre le Sida (CNLS, Plan stratégique 2019-2023) et ONUSIDA (estimations 2023). Ces estimations comportent une marge d'incertitude considérable, compte tenu des difficultés méthodologiques propres au dénombrement d'une population clandestine (Larmarange et al., 2009 ; Johnston et al., 2013). La méthode capture-recapture utilisée par le CNLS produit une fourchette de 18 000 à 22 000 pour Dakar ; les estimations par réseau multiplicateur (network scale-up method) de l'ANSD sont légèrement inférieures (12 000-18 000).</Body>

  <Body>La question de l'extrapolation est la suivante : si notre modèle simule un seul cluster contenant un ou deux transmetteurs délibérés, combien de clusters similaires coexistent dans la métropole de Dakar ? L'existence simultanée de deux affaires impliquant des réseaux distincts (Keur Massar et Pierre Robert) suggère qu'un seul réseau ne suffit pas à décrire la réalité. Nous proposons trois scénarios d'extrapolation, selon le nombre de réseaux similaires supposés coexister.</Body>

  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
    {[{l:"Conservateur",v:s.d2.med,sub:"1 cluster isolé",c:C.teal,d:`Hypothèse basse : le réseau identifié à Keur Massar est le seul de cette taille dans la région de Dakar. Le nombre total d'infections estimées est ${s.d2.med}.`},
      {l:"Intermédiaire",v:s.d2.med*3,sub:"3 clusters indépendants",c:C.coral,d:`Hypothèse plausible : au moins 3 réseaux de taille comparable opèrent simultanément. Les 2 affaires de février 2026 en révèlent au minimum 2. Estimation : ${s.d2.med*3} infections.`},
      {l:"Interconnecté",v:s.d2.p95*5,sub:"5+ clusters avec ponts",c:C.crim,d:`Hypothèse haute : 5 clusters ou plus, avec des individus « ponts » (superspreaders) reliant différents réseaux. Ce scénario utilise le P₉₅ du modèle : ${s.d2.p95*5} infections.`}
    ].map(({l,v,sub,c,d},i)=>(
      <div key={i} style={{background:"#fff",borderTop:`4px solid ${c}`,borderRadius:4,padding:"16px 14px",border:`1px solid ${C.brd}`}}>
        <div style={{fontSize:9,fontFamily:C.fm,color:c,letterSpacing:1.5}}>{l}</div>
        <div style={{fontSize:36,fontFamily:C.fd,fontWeight:900,color:c,marginTop:6}}>{v}</div>
        <div style={{fontSize:10,fontFamily:C.fm,color:C.ink3,marginTop:4,marginBottom:8}}>{sub}</div>
        <div style={{fontSize:11,fontFamily:C.fb,color:C.ink3,lineHeight:1.65,textAlign:"justify"}}>{d}</div>
      </div>))}
  </div>

  <Body>L'hypothèse d'indépendance entre les clusters est conservatrice. Si des individus appartiennent à plusieurs réseaux simultanément (ce qui est probable pour les superspreaders), la dynamique épidémique est amplifiée par les effets de réseau croisés. Liljeros et al. (Nature, 2001) ont montré que les réseaux sexuels réels présentent des distributions de degrés à queue lourde, ce qui implique l'existence d'individus très connectés reliant différentes composantes du réseau. Dans un tel scénario, le nombre total d'infections pourrait dépasser la simple somme linéaire des clusters.</Body>

  <Hed sub>Mise en perspective</Hed>
  <Body>Même le scénario conservateur ({s.d2.med} infections) dépasse largement les 8 cas identifiés par la justice à Keur Massar. L'écart tient à la nature même de l'épidémiologie de réseau : les cascades de transmission involontaires, le pont bisexuel et la TME sont par définition invisibles au système judiciaire. Les seules infections qui peuvent être attribuées à un acte criminel sont celles résultant d'un contact direct avec un transmetteur délibéré identifié. Tout le reste relève de la dynamique épidémique ordinaire, amplifiée par les conditions structurelles du contexte sénégalais.</Body>

  <Body>La réponse de santé publique adaptée serait, selon la littérature, un programme de dépistage ciblé, confidentiel et dissocié du cadre pénal. Les modèles de dépistage communautaire développés en Côte d'Ivoire (CoDisen, Orne-Gliemann 2017), au Kenya (Muraguri 2015) et en Thaïlande (van Griensven 2015) montrent qu'une couverture de 30 % est atteignable en 18 à 24 mois avec un investissement modeste. Avec le scénario de 30 % ARV dans notre modèle, le nombre total d'infections tombe à {s.d2art.med} par cluster, soit une réduction de {Math.round((1-s.d2art.med/s.d2.med)*100)} %.</Body>
</div>)}

{/* ═══════════════════ MÉTHODOLOGIE ═══ */}
{tab==="methodo"&&(
<div style={{maxWidth:680,paddingBottom:60}}>
  <Hed>Méthodologie</Hed>
  <Body>Cette section présente la spécification formelle du modèle, les hypothèses, les propositions mathématiques avec démonstrations, la table des paramètres, le pseudo-code et les références. Le code source complet est disponible dans le fichier JSX de cette page.</Body>

  <Hed sub color={C.teal}>Hypothèses</Hed>
  <div style={{background:"#fff",border:`1px solid ${C.brd}`,borderRadius:5,padding:"16px 18px",marginBottom:24}}>
    <div style={{fontSize:12.5,fontFamily:C.fb,color:C.ink2,lineHeight:1.85,textAlign:"justify"}}>
      <strong>H1.</strong> Le réseau d'opportunités <Tex tex="G_{\text{opp}}"/> est statique (BA + WS). Les partenariats P(t) ⊆ <Tex tex="E_{\text{opp}}"/> sont dynamiques.<br/>
      <strong>H2.</strong> Transmetteurs délibérés : <Tex tex="\lambda \sim U(8,12)"/>, 0 % préservatif, <Tex tex="C_{\max}"/> = 6, sérotriage inversé (ciblage des séronégatifs), pas de suppression ARV.<br/>
      <strong>H3.</strong> Transmission par acte avec rôles sexuels probabilistes (insertif / réceptif / versatile, Goodreau 2012).<br/>
      <strong>H4.</strong> Charge virale : Hollingsworth 2008. Pic aigu φ = 18, chronique φ = 1, remontée tardive progressive.<br/>
      <strong>H5.</strong> VL et CD4 découplés (pas de feedback circulaire).<br/>
      <strong>H6.</strong> IST corrélées à l'activité sexuelle : incidence <Tex tex="\propto \lambda"/> (Fleming et Wasserheit, 1999).<br/>
      <strong>H7.</strong> Pont bisexuel : <Tex tex="\pi_{\text{fem}}"/> = 88 %. Mariage comme stratégie de dissimulation (Larmarange 2009, Roux 2025, Beyrer 2012).<br/>
      <strong>H8.</strong> TME : 30 % sans PTME, 1,5 % sous ARV (De Cock 2000, Townsend 2014).<br/>
      <strong>H9.</strong> Pénalisation : couverture ARV ~ 2 % (Poteat 2011, Shannon 2015, Millett 2012).
    </div>
  </div>

  <Hed sub color={C.teal}>Architecture du réseau</Hed>
  <MathB label="G_opp et P(t)">{`G_opp = (V, E_opp)  — réseau d'opportunités, STATIQUE
P(t) ⊆ E_opp       — partenariats réalisés au mois t, DYNAMIQUE

BA assortatif : Pr(i→j) ∝ (k_j+1) · w(i,j)
  w(i,j) = 1/(1 + |λ_i−λ_j|/max(λ_i,λ_j))  ∈ (0.5, 1]

Réécriture WS (p=0.12) :
  ∀(i,j) ∈ E_opp, i<j : avec Pr=p, supprimer (i,j) ;
    tirer k ~ Uniform(V∖{i}), k ∉ N(i) ; ajouter (i,k).
  Effet : ↑ coefficient de clustering, ≈ distribution des degrés.
  Multi-arêtes et boucles rejetées (max 50 tentatives).`}</MathB>

  <Hed sub color={C.teal}>Propositions et preuves</Hed>
  <Thm num="1" title="Distribution des degrés (Barabási-Albert 1999)">
    Le modèle BA standard produit P(k) ~ <Tex tex="k^{-3}"/>. Avec le noyau d'assortativité w(i,j), l'exposant <Tex tex="\gamma \in [2.5, 3.5]"/>.
  </Thm>
  <Proof>
    Π<sub>i</sub> = <Tex tex="k_i"/>/2mt ⟹ d<Tex tex="k_i"/>/dt = <Tex tex="k_i"/>/(2t) ⟹ <Tex tex="k_i"/>(t) = m(t/<Tex tex="t_i"/>)<sup>½</sup>. P(k{'<'}K) = 1 − m²/K² ⟹ p(k) = 2m²/k³. Le noyau w modifie Π mais préserve la queue (Caldarelli 2002).
  </Proof>

  <Thm type="Théorème" num="1" title="Seuil épidémique nul (Pastor-Satorras et Vespignani 2001)">
    Si <Tex tex="\gamma \leq 3"/>, le seuil épidémique <Tex tex="\lambda_c"/> <Tex tex="\to 0"/> dans la limite <Tex tex="N \to \infty"/> : toute introduction a une probabilité non nulle de provoquer une épidémie. En taille finie (N = 180), un seuil effectif petit mais non nul subsiste.
  </Thm>
  <Proof>
    Champ moyen hétérogène : condition endémique β/μ {'>'} <Tex tex="\langle k \rangle / \langle k^2 \rangle"/>. Pour <Tex tex="\gamma \leq 3"/>, <Tex tex="\langle k^2 \rangle"/> diverge (<Tex tex="k_{\max}"/> ~ <Tex tex="N^{1/(\gamma-1)}"/>), donc <Tex tex="\langle k \rangle / \langle k^2 \rangle"/> <Tex tex="\to 0"/> quand <Tex tex="N \to \infty"/>. En taille finie, <Tex tex="k_{\max}"/> ~ 180<sup>1/2</sup> ≈ 13 impose un cutoff : <Tex tex="\langle k^2 \rangle"/> est grand mais borné, d'où un seuil effectif <Tex tex="\lambda_c"/> {'>'} 0 petit. En pratique, les transmetteurs délibérés (λ ~ 10/an) se situent très au-dessus de ce seuil.
  </Proof>

  <Thm num="2" title="Transmission par partenariat-mois">
    <Tex tex="P_{\text{mois}}"/> = 1 − <Tex tex="(1-\tilde{\beta})^n"/>, avec β̃ = min(<Tex tex="\beta_{\text{role}}"/> × φ(d) × ψ × η, 0.45), où <Tex tex="\eta \in [0,1]"/> est le modificateur de préservatif (η = 1 − efficacité × usage).
  </Thm>
  <MathB label="Applications numériques">{`Phase chronique : β̃ = 0.0138, n = 3.2 → P ≈ 4.3 %/mois
Phase aiguë (m=1) : β̃ = 0.248, n = 3.2 → P ≈ 58 %/mois
Délibéré, phase aiguë : β̃ = 0.248, n = 5, 0 condom → P ≈ 76 %/mois`}</MathB>

  <Thm num="3" title="R₀ sur réseau hétérogène (Pastor-Satorras et Vespignani 2001)">
    Sous les hypothèses du champ moyen hétérogène (réseau annealed, dynamique SIS, configuration model) : <Tex tex="R_0"/> = <Tex tex="\beta_{\text{eff}}"/> · ⟨k²⟩ / (μ · ⟨k⟩). Pour SIR sur configuration model (Newman 2002), le facteur est (⟨k²⟩ − ⟨k⟩)/⟨k⟩, mais la différence est négligeable ici (⟨k²⟩ ≫ ⟨k⟩).
  </Thm>
  <Proof>
    Champ moyen hétérogène (PSV 2001) : on partitionne les nœuds par degré k. La matrice de prochaine génération (Diekmann et al. 1990) s'écrit K<sub>kk'</sub> = k · <Tex tex="\beta_{\text{eff}}"/>/μ · k'P(k')/⟨k⟩. Le rayon spectral ρ(K) = <Tex tex="\beta_{\text{eff}}"/> · ⟨k²⟩/(μ · ⟨k⟩). Sur un réseau scale-free, ⟨k²⟩/⟨k⟩ ≫ ⟨k⟩ : le <Tex tex="R_0"/> est amplifié par la variance des degrés. Note : l'hypothèse de réseau annealed (reconfiguration à chaque pas) surestime le <Tex tex="R_0"/> par rapport à un réseau statique.
  </Proof>

  <Hed sub color={C.teal}>Paramètres</Hed>
  <div style={{background:"#fff",border:`1px solid ${C.brd}`,borderRadius:5,padding:14,overflowX:"auto",marginBottom:24}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:C.fm,fontSize:10}}>
      <thead><tr style={{borderBottom:`2px solid ${C.ink}`}}>{["Paramètre","Valeur","Source"].map(h=><th key={h} style={{padding:"5px 8px",textAlign:"left",fontSize:8,letterSpacing:1,textTransform:"uppercase",color:C.ink3}}>{h}</th>)}</tr></thead>
      <tbody>{[
        ["β_AR (réceptif anal)","0.0138/acte","Baggaley 2010"],["β_AI (insertif anal)","0.0011/acte","Baggaley 2010"],["β_MF (vaginal M→F)","0.0008/acte","Boily 2009"],
        ["φ (aigu, mois 1)","18","Hollingsworth 2008"],["ψ (cofacteur IST)","2.8","Fleming 1999"],
        ["Circoncision (prév. / effic.)","92 % / 60 %","DHS Sénégal / Auvert 2005"],["η (modif. préservatif)","1 − ε×u","ε=0.80, u=0.25 (MSH) / u=0 (délib.)"],["Condom MSH (usage régulier u)","25 %","Wade 2005"],["Condom délibéré","0 %","Hypothèse H2"],
        ["λ délibéré","U(8, 12) / an","Hypothèse H2"],["λ noyau / périph.","U(2.5, 4.5) / U(0.5, 2)","Estimation"],
        ["C_max délib. / noyau / pér.","6 / 3 / 2","Hypothèse H2 / Goodreau 2012"],["τ (durée moyenne part.)","6 mois","Goodreau 2012"],
        ["n actes / mois (MSH / délib.)","3.2 / 5.0","Goodreau 2012"],["n actes couple M-F","8 / mois","Boily 2009"],
        ["π_fem","88 %","Larmarange 2009 + Keur Massar + Roux 2025"],["TME (sans PTME / sous ARV)","30 % / 1.5 %","De Cock 2000 / Townsend 2014"],
        ["Grossesse / an","14 %","DHS Sénégal"],["ARV pénalisation","2 %","Poteat 2011"],["N (taille réseau)","180 nœuds","—"],
        ["N_MC","800 réplications","—"],["Durée","108 mois (2017-2026)","—"],
      ].map(([p,v,src],i)=><tr key={i} style={{borderBottom:`1px solid ${C.brd}`}}>
        <td style={{padding:"4px 8px",color:C.ink2}}>{p}</td><td style={{padding:"4px 8px",fontWeight:600}}>{v}</td>
        <td style={{padding:"4px 8px",fontStyle:"italic",color:C.ink3,fontSize:9}}>{src}</td></tr>)}</tbody>
    </table>
  </div>

  <Hed sub color={C.teal}>Pseudo-code</Hed>
  <div style={{background:"#F7EDE0",border:`1px solid ${C.brd}`,borderLeft:`3px solid ${C.teal}`,borderRadius:4,padding:"14px 16px",fontFamily:C.fm,fontSize:10,color:C.tl,lineHeight:2,overflowX:"auto",whiteSpace:"pre",marginBottom:24}}>{`ALGORITHME SimulateEpidemic(N=180, nD=2, T=108, π_ART, κ, seed)
1.  rng ← Lehmer(seed)
2.  G_opp ← BA(m₀=5, m=2) + WS(p=0.12)
3.  Assign types: D(0..nD-1), SS, Core, Periphery
4.  Assign λ, role, femPartner(88%), CD4₀
5.  nodes[0].infected ← TRUE, month=0, gen=0
6.  P ← ∅  (active partnerships)
7.  FOR t = 1 TO T:
8.    IF t=24 AND nD≥2: INFECT(nodes[1])
9.    UPDATE STI (incidence ∝ λ, duration=6)
10.   DISSOLVE P: Pr(dissolution) = 1−exp(−1/τ)
11.   FORM P (infected only — optimisation*):
12.     FOR each infected i with |P_i| < C_max:
13.       n ← Poisson(λ_i / 12)
14.       A(i) ← {j ∈ N_opp(i) : |P_j| < C_max(j)}
15.       IF isDelib(i): A(i) ← {j ∈ A(i) : ¬infected(j)}
16.       j ← Uniform(A(i)); ADD (i,j) to P
17.   TRANSMIT MSM: per-act, roles
18.     β̃ ← min(β_rôle × φ(d) × ψ × η, 0.45)
19.     Pr(tx | partnership-month) = 1−(1−β̃)^n
20.   BRIDGE: β̃ ← min(β_MF × φ(d) × ψ × η, 0.12), 8 acts
21.   TME: pregnancy 14%/yr, π=30% (sans ARV) / 1.5% (ARV)
22.   RECORD timeline[t]
23. RETURN totals, edges, timeline

* Optimisation : seuls les infectés initient des P(t), car
  les paires susceptible-susceptible ne produisent aucune
  transmission. Biais : surestimation légère (slots des
  susceptibles toujours disponibles ; cf. Limites §9).`}</div>

  <Hed sub color={C.teal}>Références</Hed>
  <div style={{fontSize:10,fontFamily:C.fb,color:C.ink3,lineHeight:2.1,columnCount:2,columnGap:24,textAlign:"justify"}}>
    Aho et al. 2014 <em>Sex Transm Infect</em> · Auvert et al. 2005 <em>PLoS Med</em> · Baggaley et al. 2010 <em>Int J Epidemiol</em> · Barabási & Albert 1999 <em>Science</em> · Baral et al. 2013 <em>Lancet</em> · Beyrer et al. 2012 <em>Lancet</em> · Boily et al. 2009 <em>Lancet Infect Dis</em> · Caldarelli et al. 2002 <em>PRL</em> · Cohen et al. 2011 <em>NEJM</em> (HPTN 052) · Coombs et al. 2009 <em>AIDS</em> · De Cock et al. 2000 <em>JAMA</em> · Diekmann et al. 1990 <em>J Math Biol</em> · Fleming & Wasserheit 1999 <em>Sex Transm Infect</em> · Goodreau & Golden 2007 <em>Sex Transm Dis</em> · Goodreau et al. 2012 <em>PLoS ONE</em> · Gupta et al. 2019 <em>Nat Commun</em> · Hatzenbuehler et al. 2015 <em>Soc Sci Med</em> · Hollingsworth et al. 2008 <em>Emerg Infect Dis</em> · Johnston et al. 2013 <em>Epidemiol Rev</em> · Larmarange et al. 2009 <em>Population</em> · Liljeros et al. 2001 <em>Nature</em> · Millett et al. 2012 <em>PLoS Med</em> · Morris & Kretzschmar 1997 <em>AIDS</em> · Newman 2002 <em>PRE</em> · Orne-Gliemann et al. 2017 <em>JIAS</em> · Pastor-Satorras & Vespignani 2001 <em>PRL</em> · Poteat et al. 2011 <em>PLoS Med</em> · Rodger et al. 2016 <em>JAMA</em> · Rodger et al. 2019 <em>Lancet</em> · Roux et al. 2025 <em>AIDS Behav</em> · Shannon et al. 2015 <em>Lancet</em> · Smith et al. 2009 <em>AIDS Behav</em> · Stahlman et al. 2017 <em>Soc Sci Med</em> · Townsend et al. 2014 <em>AIDS</em> · Wade et al. 2005 <em>AIDS</em> · Weller & Davis-Beaty 2002 <em>Cochrane</em>
  </div>
  <Divider/>
  <div style={{fontSize:10.5,fontFamily:C.fb,color:C.ink3,lineHeight:1.75,textAlign:"justify"}}>
    <strong>Limites.</strong> (1) <Tex tex="G_{\text{opp}}"/> statique sur 108 mois. (2) Pas de PrEP. (3) Pas de mortalité VIH. (4) IST modélisée comme binaire (présente/absente). (5) Un seul cluster de 180 nœuds (extrapolation linéaire pour Dakar). (6) Paramètres calibrés sur la littérature régionale, pas ajustés sur des données individuelles. (7) Pas de sérotriage chez les non-délibérés. (8) Dynamique de population fermée (pas d'entrées/sorties). (9) Seuls les infectés initient des partenariats (optimisation) : les slots des susceptibles restent disponibles en permanence, ce qui surestime légèrement la vitesse de transmission.
  </div>
</div>)}

        <div style={{borderTop:`1px solid ${C.brd}`,padding:"14px 0 30px",marginTop:16}}>
          <div style={{fontSize:8,color:C.ink3,fontFamily:C.fm,lineHeight:1.8,opacity:.5}}>
            MODÈLE STOCHASTIQUE · BA+WS · TRANSMETTEURS DÉLIBÉRÉS P₀(2017)+P₁(2019) · π_fem=88 % · 108 MOIS · 800 MC × 5 · Estimation théorique
          </div>
        </div>
      </div>
    </div>);
}

/* SITE HELPERS */
function FadeIn({children,delay=0}){
  const[v,setV]=useState(false);const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const rect=el.getBoundingClientRect();
    if(rect.top<window.innerHeight&&rect.bottom>0){setV(true);return}
    const o=new IntersectionObserver(([e])=>{if(e.isIntersecting){setV(true);o.disconnect()}},{threshold:.05});
    o.observe(el);return()=>o.disconnect();
  },[]);
  return(<div ref={ref} style={{opacity:v?1:0,transform:v?"translateY(0)":"translateY(20px)",
    transition:`opacity .6s ease ${delay}s, transform .6s ease ${delay}s`}}>{children}</div>)}

function FLogo({size=48,TC}){
  return(<svg width={size} height={size} viewBox="0 0 60 60">
    <defs><linearGradient id="flg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor={TC.coral}/><stop offset="100%" stopColor={TC.crim}/></linearGradient></defs>
    <rect width="60" height="60" rx="14" fill="url(#flg)"/>
    <text x="30" y="44" textAnchor="middle" fontSize="38" fontFamily={C.fd} fontWeight="900" fill="#fff" opacity=".95">F</text>
  </svg>)}

function SiteComments({TC}){
  const[comments,setComments]=useState([]);const[nm,setNm]=useState("");const[tx,setTx]=useState("");
  const add=()=>{if(!nm.trim()||!tx.trim())return;
    setComments(p=>[...p,{nm:nm.trim(),tx:tx.trim(),dt:new Date().toLocaleDateString("fr-FR"),id:Date.now()}]);
    setNm("");setTx("")};
  const iS={background:TC.bg2,border:"1px solid "+TC.brd,borderRadius:4,padding:"8px 12px",fontSize:13,fontFamily:C.fb,color:TC.ink,width:"100%",outline:"none",resize:"vertical"};
  return(<div style={{marginTop:40,paddingTop:24,borderTop:"1px solid "+TC.brd}}>
    <div style={{fontSize:10,fontFamily:C.fm,color:TC.ink3,letterSpacing:2,marginBottom:16}}>COMMENTAIRES ({comments.length})</div>
    {comments.map(c=>(<div key={c.id} style={{background:TC.bg2,borderRadius:6,padding:"14px 16px",marginBottom:10,border:"1px solid "+TC.brd}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontFamily:C.fm,fontSize:11,fontWeight:600,color:TC.coral}}>{c.nm}</span>
        <span style={{fontFamily:C.fm,fontSize:9,color:TC.ink3}}>{c.dt}</span></div>
      <p style={{fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.6,margin:0}}>{c.tx}</p></div>))}
    <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
      <input value={nm} onChange={e=>setNm(e.target.value)} placeholder="Votre nom" style={iS}/>
      <textarea value={tx} onChange={e=>setTx(e.target.value)} placeholder="Votre commentaire..." rows={3} style={iS}/>
      <button onClick={add} style={{alignSelf:"flex-start",background:TC.coral,color:"#fff",border:"none",borderRadius:4,padding:"8px 20px",fontSize:11,fontFamily:C.fm,fontWeight:600,cursor:"pointer"}}>Publier</button>
    </div></div>)}

function ShareButtons({article,TC}){
  const[copied,setCopied]=useState(false);
  const url=typeof window!=="undefined"?window.location.origin+window.location.pathname+"#/fulgurances/"+article.slug:"";
  const fullText=encodeURIComponent(article.title+(article.subtitle?" \u2014 "+article.subtitle:""));
  const encodedUrl=encodeURIComponent(url);
  const links=[
    {label:"\ud835\udd4f",href:"https://x.com/intent/tweet?text="+fullText+"&url="+encodedUrl,color:"#000",dk:"#E7E9EA"},
    {label:"Facebook",href:"https://www.facebook.com/sharer/sharer.php?u="+encodedUrl,color:"#1877F2",dk:"#4A9AF5"},
    {label:"LinkedIn",href:"https://www.linkedin.com/sharing/share-offsite/?url="+encodedUrl,color:"#0A66C2",dk:"#3B8DE0"},
    {label:"WhatsApp",href:"https://wa.me/?text="+fullText+"%20"+encodedUrl,color:"#25D366",dk:"#25D366"},
  ];
  const isDark=TC.bg.startsWith("#1");
  const btnS={background:"none",border:"1px solid "+TC.brd,borderRadius:6,padding:"8px 14px",cursor:"pointer",
    fontSize:10,fontFamily:C.fm,fontWeight:600,textDecoration:"none",transition:"all .2s",
    display:"inline-flex",alignItems:"center",gap:6};
  const copyLink=()=>{try{navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}catch(e){}};
  return(
  <div style={{marginTop:32,marginBottom:8,paddingTop:20,borderTop:"1px solid "+TC.brd}}>
    <div style={{fontSize:10,fontFamily:C.fm,color:TC.ink3,letterSpacing:2,marginBottom:12}}>PARTAGER</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {links.map(l=>(
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
          style={{...btnS,color:isDark?l.dk:l.color}}>{l.label}</a>
      ))}
      <button onClick={copyLink}
        style={{...btnS,color:copied?TC.teal:TC.ink2}}>
        {copied?"\u2713 Copied!":"Copy link"}</button>
    </div>
  </div>);
}

/* ARTICLES */
const ARTICLES=[
{id:1,slug:"ericson-laibson",title:"POTW: Ericson and Laibson (2018)",
 subtitle:"A review of intertemporal choices and present-focused preferences.",
 cat:"economics",lang:"en",date:"2024-03-15",rt:5,
 body:[
  "This paper (Ericson and Laibson, 2018) reviews most of the works done on intertemporal choices. It highlights the differences between present-biased (best illustrated by La Fontaine’s « Un tiens vaut mieux que deux tu l’auras » – A bird in hand is worth two in the bush) and present-focused preferences.",
  "The models of present-focused preferences are categorized by two properties: (no) commitment and dynamically (in)consistent preferences. They range from unitary-self temptations models to myopia. This alignment allowed the authors to show that present-focused preferences are a general case of present-biased preferences. They proceed by presenting the subtle mechanisms behind different models with stylized facts (which they call empirical regularities) with open questions to extrapolate on the potential research.",
  "Few examples of these models with empirical regularities and open questions: preferences over monetary receipt timing, preferences over consumption timing, procrastination, naïveté, etc. Moreover, they explore some puzzles without associated stylized facts, such as: the way value declines over time, the role of temptation, the malleability and self-management, etc.",
  "This paper is near exhaustive and lays the base for future research questions and the important distinctions to be done among various present-focused models. A must-read."]},
{id:2,slug:"chetty-2014",title:"POTW: Chetty et al. (2014)",
 subtitle:"Active vs passive decisions and crowd-out in retirement savings accounts.",
 cat:"economics",lang:"en",date:"2024-04-10",rt:6,
 body:[
  "This paper (Chetty et al., 2014) investigates the effects of retirement savings options on wealth accumulation. Whether it is active – individuals taking action to raise savings – or passive – retirement savings rise if no action – decisions, the magnitude of these effects vary substantially. The study finds that approximately 15% of individuals choose the active policy primarily after government (tax) subsidies, while 85% prefer the status quo at first but rely on automatic contributions.",
  "Chetty et al. shed light on the empirical impacts of price subsidies and automatic contributions, drawing comparisons on their effectiveness and suggesting that \"automatic contributions are more effective at increasing savings rates than subsidies.\" Three reasons are evoked: few responses to subsidies (less active than passive individuals), crowding out by account shifting, and the default effect of subsidies for passive individuals.",
  "Engaging the hot question regarding the effects of retirement savings policies on wealth accumulation by using high-quality data – 41 million observations – is the tour de force of this paper. The core contributions are as follows: analysis of the impacts of automatic contribution (employer pension option and government mandates), measurement of the effects of subsidies for retirement savings, the crowd-out effects induced by shifting between different accounts (different pension accounts and pension accounts to taxable savings accounts), and finally, a closer look at “the heterogeneity in responses across individuals” (passive vs active individuals).",
  "The clarity of the exposé, the quality of the data, and the conclusions drawn regarding the increase of total savings 1) by government subsidies (1%), and 2) by automatic contributions (substantial) are remarkable. However, it remains unclear whether individuals offset those increases by saving less elsewhere.",
  "A must-read for anyone interested in understanding the nuances of retirement savings policies and their practical implications on wealth accumulation."]},
{id:3,slug:"hanna-2014",title:"POTW: Hanna et al. (2014)",
 subtitle:"Learning by noticing: theory and experimental evidence in farmers.",
 cat:"economics",lang:"en",date:"2024-05-20",rt:7,
 body:[
  "This paper (Hanna et al., 2014) provides an alternative explanation on the mechanisms from which learning failures occur. The previous literature has focused on data availability and suggested only insufficient information led to learning failures. Hanna et al. show that, besides data limitations, learning failures stem from limited attention to the key features of the available data.",
  "Using Schwartzstein’s (2014) model of selective attention, the authors build a model of learning by attending and test its predictions with seaweed farmers. Their model shows that farmers failed to optimize the input dimensions they did not notice, but making them realize the underlying overlap of these dimensions helps them adjust their input choices.",
  "The contribution of this paper has important implications on the use of information to break down learning failures and experience. Getting used to a technology (experience) or learning a new one (more data) does not guarantee special attention to intrinsic aspects that might be important in the learning process. This has significant implications for policymakers and development practitioners who often rely on the dissemination of information to improve productivity and outcomes in various sectors.",
  "One of the key findings of the study is that simply providing more information is not always sufficient to overcome learning failures. Instead, it is crucial to ensure that the information is presented in a way that captures the attention of the target audience and highlights the most relevant aspects that need to be learned. This insight can be applied to various fields, including education, healthcare, and agriculture, where effective learning and adoption of new practices are essential for improving outcomes.",
  "Furthermore, the paper emphasizes the role of cognitive limitations in learning processes. It suggests that interventions aimed at improving learning should take into account the limited cognitive resources of individuals and design strategies that help them focus on the most critical information. This approach can lead to more effective learning and better decision-making.",
  "A must-read for those interested in the intersection of cognitive psychology and economic development."]},
{id:4,slug:"retour-recours-sources",title:"Retour ou recours aux sources ?",
 subtitle:"Féminisme et Islam : une mise en contexte nécessaire.",
 cat:"society",lang:"fr",date:"2024-06-15",rt:12,
 body:[
  "L'idée de poster sur ce blog ne me venait que lorsque j'avais quelque chose à dire sur l'économique, notamment sur les papiers que je lis ici et là, lors de mes activités de recherche. Dernièrement, cependant, un sujet cristallisant toute l'attention de la sphère virtuelle du Sénégal m'a poussé à sortir de ma zone de confort : féminisme et Islam. Je ne discuterai pas des détails concernant le rapport du féminisme à l'Islam et/ou vice versa, ni de l'attitude qu'il convient d'adopter en tant que musulman — puisque mes prétentions n'ont pas le moyen de leur objet — mais seulement, je tenterai de mettre brièvement dans son contexte ce débat et me permettrai de poser quelques questions auxquelles chacun est libre d'apporter sa réponse.",
  "###De la condition de la femme dans l'Arabie préislamique",
  "L'époque préislamique, que le Coran désigne comme jahiliya, c'est-à-dire ignorance — de la vérité, de LA religion —, reste équivoque pour qui se demande la place de la femme dans la société, tant mitigés sont les résultats des recherches effectuées jusque-là. En effet, pour certains auteurs, le fait que, dans la société mecquoise, les femmes aient pu jouir d'un statut meilleur que ne le soutient la tradition musulmane, plus tard, montre que l'Islam a été une régression (1). Il est évoqué la première épouse du Prophète, Khadija, la mère de Mus'ab Ibn Umayr Khunaas, et Hind bint 'Utba, qui ont pu devenir des négociantes, employant des hommes, et jouissant d'une liberté totale de choisir (époux, affaires, etc.) ; et le fait qu'il ait existé, en outre, un culte de déités féminines dans le paganisme d'à l'époque (Sheba ou Shaybah et Al Lat). D'autres auteurs, par contre, parlent d'un statut très peu reluisant de la femme dans l'Arabie préislamique : infanticides de filles, existence de la polygynie extrême et patrilinéarité. Il est donné en exemple des cas d'infanticides, de la part du paternel, résultant de la peur et de l'évitement de la honte de subir des razzias (courants à l'époque) et de se voir voler ses filles ; ou alors, en cas de famine, le sacrifice presque immédiat des enfants considérés du sexe faible.",
  "Les deux explications peuvent se rejoindre si l'on prend en compte l'aspect variable de la condition des femmes en fonction des tribus. Dans certaines d'entre elles, les femmes étaient plus libres, émancipées, même comparées à maintenant (2). Dans d'autres, par contre, les lois et normes culturelles les contraignaient à un statut inférieur (3). Ceci pose un contexte relativement hétérogène aux changements instaurés par la religion musulmane.",
  "###L'avènement de l'Islam",
  "Comme l'on vient de l'exposer, la condition des femmes avant l'avènement de l'Islam n'était pas homogène. Dans certaines contrées, elles étaient plus émancipées, mais dans d'autres, elles jouissaient d'un statut inférieur à cause, en principe, de leur incapacité à se défendre, donc placées sous la tutelle des hommes. Pour ces dernières tribus, et la majorité donc dans l'Arabie, la polygynie, leur non-droit à l'héritage et les infanticides étaient des faits de société.",
  "Vient alors l'esprit de l'Islam qui considère, sur la pratique religieuse, du rapport du musulman avec Dieu, l'homme et la femme sur un pied d'égalité. Dans Al-Imran (v. 195), il est dit :",
  ">>>Leur Seigneur les a alors exaucés (disant): «En vérité, Je ne laisse pas perdre le bien que quiconque parmi vous a fait, homme ou femme, car vous êtes les uns des autres...\"",
  "Également, la sourate An-Nisa est celle qui définit de manière exhaustive le cadre juridique de la femme dans la religion musulmane. Ses droits, entre autres, y sont définis, ainsi que le traitement à son égard. Il est admis que l'Islam a relativement amélioré sa condition, à l'époque (4), le mariage étant devenu un contrat, non plus un fait, l'héritage, quoiqu'actuellement sujet à polémique, incluait les femmes, et les infanticides de filles naturellement prohibés (An-Nahl, 58-59). William Montgomery Watt, une des sommités des études islamiques, disait ceci dans cette interview :",
  ">>>Même si dans certaines parties de l'Arabie, notamment à la Mecque, un système matrilinéaire était en train d'être remplacé par un système patrilinéaire à l'époque de Muhammad, au moment où l'Islam a commencé, les conditions des femmes étaient terribles dans l'Arabie, en général : elles n'avaient pas le droit à la propriété, étaient censées être la propriété de l'homme et si leur mari mourait, tout allait à ses fils. Muhammad améliora beaucoup les choses. En instaurant des droits de propriété, d'héritage, d'éducation et du divorce, il a donné aux femmes certaines garanties de base. Situé dans un tel contexte historique, le Prophète peut être vu comme une figure qui a témoigné en faveur des droits des femmes.",
  "(Je ne parlerai pas de la condition de la femme de l'Islam à nos jours. Je n'ai pas les moyens de cette prétention)",
  "###Et maintenant ?",
  "Cette mise en contexte nous donne une petite idée du débat à avoir à présent. Avec l'Islam, l'amélioration relative (puisqu'il ne faut pas omettre le fait que dans certaines tribus ce qui a été considéré comme avancées dans d'autres, ressemblaient plus à des pas en arrière) du statut de la femme fait voir une autre perspective. Le monde évoluant, et le féminisme gagnant du terrain (et à juste titre) dans les sociétés musulmanes, l'on note de plus en plus de résistance, venant d'hommes - et même de femmes - rappelant à la femme i) que l'Islam lui a déjà assigné sa place naturelle, avec des devoirs certes, mais plusieurs droits, ii) qu'il n'y a pas plus émancipateur que la religion musulmane et iii) qu'il faut retourner aux sources puisque les féministes musulmanes semblent égarées.",
  "Au-delà de l'aspect pratique des législations et recommandations de l'Islam, c'est-à-dire le fait qu'elles soient appliquées ou non dans la réalité, des questions m'interpellent : si l'on considère le Prophète comme une figure ayant coupé plusieurs attaches de la femme à son époque, et l'Islam une religion assignant une place noble au sexe fiable (oui!), devrions-nous tous être progressistes à notre époque ? J'imagine qu'une religion qui s'établit dans une société dont elle veut changer les normes n'a pas intérêt à s'y atteler de façon radicale. Si l'Islam est intemporel, ne serait-ce pas dû à son esprit qui se perpétue à travers les contextes et sociétés ? Le monde changeant, ne devrait-on penser que seul l'esprit de l'Islam, sur cette question précise, devrait être conservé, non le corps ? Je pense au Prophète Muhammad qui doit apporter ces retouches à une société qu'il pense ne pas donner assez de droits aux femmes, et me demandé-je : ne devrait-on pas avoir la même posture, en ce moment ? Conserver l'esprit de l'Islam en étant progressiste comme l'a été le Prophète Muhammad ? Ainsi, les revendications féministes sont-elles aux antipodes de l'Islam ? Retour ou recours aux sources ? J'ai ma propre idée de ces questions, qu'en pensez-vous ?"]},
{id:5,slug:"traversees-islam",title:"Traversées de l’Islam : Des Sables d’Arabie aux Confluences Culturelles",
 subtitle:"Une fresque de la diversité intrinsèque du monde musulman.",
 cat:"culture",lang:"fr",date:"2024-07-20",rt:8,
 body:[
  "Plonger dans la richesse de l'histoire islamique, c'est, pour le chercheur assoiffé de connaissance, embrasser le tragique de la condition humaine tout en discernant l'éclat de la guidance divine. Il est évident que l'Arabie pré-islamique, cette scène d'effervescence tribale et poétique, fut le lieu où le divin interpella l'humanité, l'exhortant à se soustraire des illusions du monde. Dans ce théâtre des passions, La Mecque, cité opulente et carrefour des âmes en quête, se révéla comme l'épicentre d'un bouleversement spirituel majeur. Face à ce kaléidoscope culturel, le Message vint, non pour imposer une pensée uniforme, mais pour élever les cœurs. Là où certains y virent une révolution, d'autres discernèrent une invitation à transcender les vaines querelles pour saisir l'essence d'une vérité universelle. Les poètes, ces âmes vagabondes du désert, furent les témoins privilégiés de cette effusion céleste, et si leurs vers chantaient les exploits des tribus et les drames des amants, le Coran les appela à une réflexion plus profonde, à une quête éternelle.",
  "Mais l'Islam ne resta pas enclavé dans ce berceau arabe. Comme un fleuve puissant et impétueux, il s'écoula, irriguant de nouvelles terres, rencontra des civilisations aussi anciennes qu'établies, et avec elles, il entama un dialogue. La Perse, cette contrée de philosophes et de mystiques, fut à la fois bouleversée et élevée par cette rencontre. De ces échanges naquirent des penseurs tels qu'Avicenne et Al-Fârâbî, incarnations d'une synthèse harmonieuse entre l'Orient et l'Islam. À la croisée des cultures, de profondes questions émergèrent : Comment s'habiller ? Quelles traditions adopter ou réformer ? Le monde musulman, loin de s'y perdre, y puisa sa richesse, prouvant sa capacité à cohabiter sans s'étioler.",
  "L'Andalousie, terre de lumière et d'ombre, devint le miroir de cette coexistence. Dans ses ruelles sinueuses et ses palais majestueux, musulmans, juifs et chrétiens façonnèrent un héritage inestimable. Des penseurs comme Ibn Rushd émergèrent, portant la bannière d'un savoir universel. De la lointaine Indonésie à l'effervescente Andalousie, l'Islam démontra sa capacité à être à la fois ancre et voile, enraciné dans ses principes tout en naviguant à travers la diversité des cultures.",
  "Mais ce voyage, loin d'être une simple promenade de santé, exigea des âmes éclairées une vigilance constante. La complexité de la grande fresque islamique offre une réflexion profonde sur le danger du manichéisme simpliste. Si l'histoire a parfois été racontée à travers le prisme de dichotomies – Bien contre Mal, Tradition contre Modernité, Orient contre Occident – l'Islam lui-même témoigne d'une réalité plus nuancée. Les grandes épopées des savants musulmans, des poètes et des mystiques, démontrent une quête constante d'équilibre entre ces polarités apparentes. Dans ce voyage, chaque individu et chaque communauté ont cherché à naviguer dans les complexités de leur époque, à déchiffrer les nuances dans l'interaction entre foi et culture, entre l'universel et le particulier. Le monde musulman, riche de ses pluralités, défie toute vision binaire et appelle plutôt à une appréciation profonde de sa diversité intrinsèque, soulignant l'importance d'une compréhension équilibrée et holistique.",
  ">>>Même si dans certaines parties de l'Arabie, notamment à la Mecque, un système matrilinéaire était en train d'être remplacé par un système patrilinéaire à l'époque de Muhammad, au moment où l'Islam a commencé, les conditions des femmes étaient terribles dans l'Arabie, en général : elles n'avaient pas le droit à la propriété, étaient censées être la propriété de l'homme et si leur mari mourait, tout allait à ses fils. Muhammad améliora beaucoup les choses. En instaurant des droits de propriété, d'héritage, d'éducation et du divorce, il a donné aux femmes certaines garanties de base. Situé dans un tel contexte historique, le Prophète peut être vu comme une figure qui a témoigné en faveur des droits des femmes."]},
{id:6,slug:"sonko-november-8",title:"Before November 8, After November 8: How Sonko Turned a Rally into a Political Mechanism",
 subtitle:"A game-theoretic reading of intra-coalition signalling in Senegal.",
 cat:"politics",lang:"en",date:"2025-01-05",rt:18,
 body:[
  "In most countries, a political rally is just that: a show of force, a speech, some slogans, and everyone goes home. What happened in Senegal on November 8 was something more subtle.",
  "When Ousmane Sonko announced, before the event, that there would be “a before November 8, a November 8, and an after November 8,” it sounded like pure rhetoric. In fact it was closer to a line from a contract. He was not only talking to the crowd. He was talking to the president, to the militants, and to history, and he was setting the rules of a game.",
  "To see that, you have to look at the sequence not as gossip about personalities, but as a problem in information and incentives. Once you do that, November 8 starts to look less like a spontaneous explosion and more like a carefully chosen mechanism.",
  "###The secret everyone suspects, but cannot observe",
  "The central uncertainty inside the camp is simple enough to state.",
  "Is President Bassirou Diomaye Faye what we can call a Loyal type, someone who sees his presidency as a mandate to implement the Project that brought PASTEF to power, with the implicit understanding that 2029 belongs to Sonko and the movement?",
  "Or is he an Autonomist type, someone who intends to build his own durable machine, under his own name, with his own alliances, including the old political class the Project had promised to sanction?",
  "Here is the asymmetry. Sonko has seen the private conversations in prison, the detailed negotiations, the early choices in office. It is very plausible that he already knows which type of president he has in front of him. Militants do not. They only see partial signals: who gets appointed, who appears on TV next to whom, which figures are rehabilitated.",
  "So the leader who actually knows the type faces a classic problem: if he simply announces, “trust me, he is not loyal to the Project,” it can always be read as ego or jealousy. The information may be true, but it is not credible.",
  "That is exactly the kind of situation mechanism design was invented for.",
  "###November 8 as a designed test",
  "In the language of game theory, Sonko faces a choice over mechanisms. He can let politics evolve quietly, or he can create a public event that changes how future actions will be interpreted.",
  "Call that second option a clarification mechanism. November 8 is precisely that.",
  "Once he stands in front of hundreds of thousands of people and says there will be a before, a November 8, and an after, he is not just promising drama. He is committing to a particular information structure. He is telling militants to treat anything that happens after that date as a test.",
  "From that point on, the president has a move. Roughly speaking, he can do one of two things.",
  "He can realign with the core of the Project and of PASTEF. In practice that means resisting the temptation to give central political roles to figures from the old regime and avoiding the construction of a separate label, separate party and separate network around the presidency.",
  "Or he can keep moving forward with what looks like the construction of an autonomous political machine. That means letting the “Diomaye Président” logic grow, accepting former BBY barons, giving weight to people whose names are tightly tied to the previous system, in exchange for their networks and clientelist capacity.",
  "A Loyal president does not like this second path. It dirties the Project and damages his standing in the eyes of the base. An Autonomist president likes it, because that is how you build your own force quickly.",
  "So the mechanics are simple. Once November 8 is in place as a focal point, Sonko does not need to accuse anyone directly. He only needs to say, effectively: “This is the date after which you should watch what he does.” If the president continues down the road of old regime alliances, militants themselves will update their beliefs about his type.",
  "For game theorists, this is a screening equilibrium. Sonko already knows the type. November 8 is not for him to learn. It is designed so that different types of president will choose different patterns of behavior afterward and so that militants will know how to interpret those patterns.",
  "###Two militant worlds, two thresholds",
  "Reality, of course, is never as clean as “pure” and “corrupt”. There is not a binary switch between PASTEF and BBY. There is a mix of technocrats, long time allies, recent converts, and veterans of the old regime who suddenly discover their love for the revolution.",
  "A useful way to think about this is to split the militant world into two groups.",
  "The base is the rank and file. They are the ones who marched, who went to prison, who believed in the Project as a moral break with the past. Their emotional allegiance is to Sonko and to the idea of a radical clean up of the state. For them, bringing in old regime actors is not a neutral move. It is felt as a betrayal of the original contract.",
  "The cadres are the people who now occupy ministries, directorates, advisory roles. They are closer to day to day power. Their incentives are more complex. Some are sincere idealists. Some are pure careerists. Many are simply cautious: they prefer not to clearly pick a side between the president and the historical leader until they know how the story ends.",
  "These two worlds do not react to the same signals in the same way.",
  "Imagine that the president chooses an alliance mix that we can summarise as a number between 0 and 1. At 0 you have almost purely technocratic and “clean” allies. At 1 you have a heavy dose of old regime political figures and actors who were clearly part of the previous system. In between you have all the shades of grey that journalists and rumor networks feed on.",
  "Nobody sees the true number. What they see is a noisy signal. One day a name appears in a decree. The next day a minister talks about “opening up” to other political forces. Then an ex BBY heavyweight joins the coalition. People form an impression, but it is imprecise.",
  "What our model says is that each faction has a belief threshold. Below that threshold, they still find it plausible that the president is Loyal to the Project. Above that threshold, they conclude he is not.",
  "Because the base is stricter, its threshold is lower. It needs a very clean environment to keep believing. The cadres have a higher tolerance for ambiguity, or for compromise, depending on how charitable you want to be. They may continue to accept the president as legitimate carrier of the Project even when the base has switched off.",
  "This fits the social reality almost too well. After November 8, as names like Aminata Touré and other historically contested figures circulate, you see exactly that split. A large part of the base feels something fundamental has been violated. Many cadres go quiet, hedge, or talk about strategy and long term vision.",
  "In the language of the model, the president’s choice of alliance mix sends a noisy signal. As that signal drifts upward, the probability that he is Loyal in the eyes of militants falls. The base reaches its cut off earlier. The cadres reach theirs later, if at all.",
  "###Why Sonko does not leave the government",
  "There is another puzzle that makes more sense in this light: why does Sonko insist that he will not leave the government, even as he criticises the direction of the presidency?",
  "From the outside, it would be easy to say: if you think the revolution is being stolen, just resign. But that misunderstands his stated objective.",
  "If his goal were to protect his personal brand, exit would be a natural threat. If his goal is to protect the Project, exit is the worst possible move. Leaving would give the president and his new allies full control of the machinery of the state, with no internal counterweight. It would be the opposite of what he promised militants when he said he would not let the revolution be stolen.",
  "In the model language, this simply means that Sonko has no credible outside option. He cannot threaten to walk away, because that would contradict his own narrative about working for Senegal and not for an individual. That is precisely why he needs mechanisms that operate inside the government, not outside it.",
  "The November 28 speech at the Assembly fits that logic perfectly.",
  "When he says that November 8 was about clarification, he is explaining the mechanism. When he insists that he and the president work together institutionally and that any divergences are political, he is sending a signal to militants: “I am not trying to destabilise the state, I am trying to protect the Project.”",
  "And when he adds that he does not work for Diomaye but for Senegal, under Diomaye’s authority, and that everything will be counted on Diomaye’s mandate, he is doing something quite cold. He is assigning accountability.",
  "Translated into the model: I will stay. I will implement policies in the name of Senegal. But if the alliances chosen around the presidency degrade the Project, history will record that as a property of this mandate and of this president, not as a betrayal from my side.",
  "He is separating institutional obedience from political responsibility.",
  "###Not just Senegal",
  "Viewed through this lens, the Sonko Diomaye sequence is not a local curiosity. It is a textbook instance of a more general problem that appears every time a movement transfers its symbolic capital to a successor.",
  "A leader builds a Project and a base over years. When blocked from running, he or she empowers someone else. That person gains access to the full infrastructure of the state and then faces a choice: remain a steward of the original Project or construct a personal empire out of it.",
  "In these moments, the original leader has only three real options.",
  "He can stay silent and watch the Project be diluted. He can openly attack the successor and be accused of sabotage. Or he can, if he is clever, design situations where the successor’s choices reveal themselves in ways that ordinary supporters can understand and use to update their judgments.",
  "November 8 was not only a rally. It was a public commitment to treat the future as a test. It is no coincidence that in his later explanation Sonko uses the word “clarification”. That is exactly what the mechanism was meant to produce.",
  "For political scientists, this is a rich case study in intra party mechanism design, belief updating and elite signalling. For militants, it is something more direct: an explanation of why they feel there really is a before November 8 and an after, and why the story is now being written less by what is said in speeches and more by who is invited to sit at the table."
]},
{id:7,slug:"transmission-deliberee-vih",title:"Un virus propagé dans l’ombre",
 subtitle:"Modéliser neuf ans de transmission délibérée du VIH au Sénégal.",
 cat:"health",lang:"fr",date:"2026-02-09",rt:22,featured:true,isVIH:true,body:[]},
{id:8,slug:"intra-party-leadership-games",title:"Clarification Mechanisms in Intra-Party Leadership Games",
 subtitle:"A game-theoretic framework for intra-party accountability when a founder cannot exit and cannot directly accuse a successor.",
 cat:"politics",lang:"en",date:"2026-02-12",rt:25,featured:true,isIPG:true,body:[]}
];
const catColor={economics:"teal",politics:"crim",society:"vio",culture:"amber",health:"rose"};
const BCATS=[{id:"economics",label:"Economics",ic:"📊"},{id:"politics",label:"Politique",ic:"🏛️"},
  {id:"society",label:"Société",ic:"👥"},{id:"culture",label:"Culture",ic:"🎭"},{id:"health",label:"Santé publique",ic:"🏥"}];
const WP=[
  {title:"The Measurement of Labor Market Expectations of Persons with Disabilities in Canada",
   coauthors:"with Charles Bellemare and Luc Bissonnette",hasPaper:true,paperUrl:"assets/papers/disabled-expectations.pdf",
   abstract:"Individuals with disabilities face multiple challenges to successfully integrate the labor market. We assess a supply-side explanation by contrasting their subjective beliefs about various labor market outcomes with those of persons without disabilities. We find that persons with disabilities are significantly more pessimistic about interview requests and believe being more likely to leave their jobs. We also find they round their probabilistic statements more, possibly reflecting greater uncertainty."},
  {title:"Subjective expectations: textual analysis using semi-structured interviews",
   coauthors:"",abstract:"Incoming."},
  {title:"From Social Security Reliance to Permanent Jobs: The CIT pathway for Persons with Disabilities",
   coauthors:"with Charles Bellemare and Luc Bissonnette",abstract:"Incoming..."}];
const WIPP=[
  {title:"Stereotype threat and gender difference in educational choices",abstract:"Incoming..."},
  {title:"The Role of Direct Taxation in Political Accountability – A Case Study on Senegal",abstract:"Incoming."},
  {title:"Barça or Barsakh: Examining the Role of Survival Expectations in Risky Migration Behaviors Among Senegalese Youth",abstract:"Incoming..."}];

/* MAIN APP */
export default function App(){
  const[dark,setDark]=useState(false);
  /* Hash routing: #/about, #/research, #/fulgurances, #/fulgurances/slug, #/dontgothere */
  const parseHash=()=>{
    try{
      const h=(window.location.hash||"#/about").replace(/^#\/?/,"");
      const parts=h.split("/").filter(Boolean);
      const pg=parts[0]||"about";
      const sl=pg==="fulgurances"&&parts[1]?parts[1]:null;
      return{pg,sl};
    }catch(e){return{pg:"about",sl:null}}
  };
  const[page,setPage]=useState(()=>parseHash().pg);
  const[articleSlug,setArticleSlug]=useState(()=>parseHash().sl);
  useEffect(()=>{
    try{
      const onHash=()=>{const{pg,sl}=parseHash();setPage(pg);setArticleSlug(sl);window.scrollTo(0,0)};
      window.addEventListener("hashchange",onHash);
      return()=>window.removeEventListener("hashchange",onHash);
    }catch(e){}
  },[]);
  const TC=dark?DARK_T:LIGHT_T;
  const nav=(p,s)=>{setPage(p);setArticleSlug(s||null);window.scrollTo(0,0);try{window.location.hash=s?`/${p}/${s}`:`/${p}`}catch(e){}};
  const article=articleSlug?ARTICLES.find(a=>a.slug===articleSlug):null;
  const[isMobile,setIsMobile]=useState(()=>typeof window!=="undefined"&&window.innerWidth<600);
  useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<600);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h)},[]);
  const navItems=[{id:"about",label:"About"},{id:"research",label:"Research"},{id:"fulgurances",label:"Fulgurances"},{id:"dontgothere",label:"Don’t go there...",short:"Vibes"}];
  const fmtDate=(d,lang)=>{const dt=new Date(d);const MF=["jan.","fév.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];const ME=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];const M=lang==="fr"?MF:ME;return dt.getDate()+" "+M[dt.getMonth()]+" "+dt.getFullYear()};
  const renderBody=(body,lang)=>body.map((p,i)=>{
    if(p.startsWith("###"))return <h3 key={i} style={{fontFamily:C.fd,fontSize:18,fontWeight:700,color:TC.ink,margin:"28px 0 12px",lineHeight:1.3}}>{p.slice(3)}</h3>;
    if(p.startsWith(">>>"))return <div key={i} style={{borderLeft:"3px solid "+TC.coral,paddingLeft:20,margin:"26px 0",maxWidth:600}}><div style={{fontSize:15,fontFamily:C.fd,fontStyle:"italic",color:TC.ink,lineHeight:1.6}}>{p.slice(3)}</div></div>;
    return <p key={i} style={{marginBottom:16}}>{p}</p>});

  return(
  <div style={{background:TC.bg,color:TC.ink,minHeight:"100vh",fontFamily:C.fl,transition:"background .4s, color .4s"}}>
    <style>{`@import url('https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css');
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&family=Libre+Franklin:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
::selection{background:${dark?"#FF826644":"#FF6B4A33"}}
button:hover{filter:brightness(1.08)}
.ipg-toc-sidebar{display:none}
@media(min-width:900px){.ipg-toc-sidebar{display:block!important}}`}</style>

    {/* NAV */}
    <nav style={{position:"sticky",top:0,zIndex:100,background:TC.bg+"F0",backdropFilter:"blur(12px)",borderBottom:"1px solid "+TC.brd,transition:"background .4s"}}>
      <div style={{maxWidth:880,margin:"0 auto",padding:"10px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>nav("about")}>
          <span style={{fontFamily:C.fd,fontSize:18,fontWeight:900,color:TC.ink}}>CAMN</span>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
          {navItems.map(n=>(<button key={n.id} onClick={()=>nav(n.id)} style={{
            background:page===n.id?(TC.coral+"15"):"transparent",
            border:"1px solid "+(page===n.id?TC.coral+"33":"transparent"),
            color:page===n.id?TC.coral:TC.ink3,padding:"5px 12px",borderRadius:4,
            fontSize:10.5,fontFamily:C.fm,cursor:"pointer",transition:"all .2s",
            fontWeight:page===n.id?600:400,letterSpacing:.5,whiteSpace:"nowrap"}}>{isMobile&&n.short?n.short:n.label}</button>))}
          <button onClick={()=>setDark(!dark)} style={{background:dark?"#fff2":"#0001",border:"1px solid "+TC.brd,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:14,marginLeft:6,lineHeight:1,transition:"all .3s"}} title={dark?"Mode jour":"Mode nuit"}>
            {dark?"☀️":"🌙"}</button>
        </div>
      </div>
    </nav>

    <div style={{maxWidth:880,margin:"0 auto",padding:"0 24px"}}>

    {/* ABOUT */}
    {page==="about"&&!articleSlug&&(
    <div style={{padding:"40px 0 60px"}}>
      <FadeIn><div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:120,height:120,borderRadius:"50%",background:TC.bg2,border:"3px solid "+TC.brd,
          margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:48,fontFamily:C.fd,fontWeight:900,color:TC.coral}}>C</div>
        <h1 style={{fontFamily:C.fd,fontSize:34,fontWeight:900,color:TC.ink,marginBottom:8}}>About</h1>
        <p style={{fontFamily:C.fb,fontSize:15,color:TC.ink2,maxWidth:560,margin:"0 auto",lineHeight:1.7}}>
          I’m Cheikh Ahmadou Mbacké Ndiaye.</p>
        <p style={{fontFamily:C.fb,fontSize:13,color:TC.ink3,marginTop:8}}>Contact: [candi12] at ulaval dot com</p>
      </div></FadeIn>
      <FadeIn delay={.1}><div style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:8,padding:"24px 28px",marginBottom:24}}>
        <h2 style={{fontFamily:C.fd,fontSize:22,fontWeight:900,color:TC.ink,marginBottom:14}}>Works</h2>
        <div style={{fontFamily:C.fb,fontSize:14,color:TC.ink2,lineHeight:1.8,textAlign:"justify"}}>
          <p style={{marginBottom:12}}>I specialize in partially identified models, applying them to economic issues such as labor market dynamics, including participation, transitions, and retirement. My approach often incorporates the analysis of subjective expectations data, both numerical and textual, focusing on identifying non-classical measurement errors such as rounding, bunching, and ambiguity.</p>
          <p style={{marginBottom:12}}>I’m also interested in examining how heightened scrutiny towards politicians is driven by economic factors, such as loss aversion related to direct taxation and the sense of ownership. In my future research, I intend to focus on this agenda within the context of high economic informality, particularly in Senegal and other West African countries.</p>
          <p>Other research interests include investigating how stereotype threats influence gender differences in educational choices and the timing of key events in women’s educational trajectories in African countries.</p>
        </div>
      </div></FadeIn>
      <FadeIn delay={.2}><div style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:8,padding:"24px 28px"}}>
        <h2 style={{fontFamily:C.fd,fontSize:22,fontWeight:900,color:TC.ink,marginBottom:14}}>Miscellaneous</h2>
        <p style={{fontFamily:C.fb,fontSize:14,color:TC.ink2,lineHeight:1.7}}>
          I try to only recommend things that I’ve watched/read at least twice. For more, check out my{" "}
          <span style={{color:TC.coral,cursor:"pointer",borderBottom:"1px solid "+TC.coral+"44"}} onClick={()=>nav("dontgothere")}>playlist and recommendations</span> page.
          For some opinions and other writings, visit the{" "}
          <span style={{color:TC.coral,cursor:"pointer",borderBottom:"1px solid "+TC.coral+"44"}} onClick={()=>nav("fulgurances")}>Fulgurances</span> section.</p>
      </div></FadeIn>
    </div>)}

    {/* RESEARCH */}
    {page==="research"&&!articleSlug&&(
    <div style={{padding:"40px 0 60px"}}>
      <FadeIn><h1 style={{fontFamily:C.fd,fontSize:34,fontWeight:900,color:TC.ink,marginBottom:8}}>Research</h1></FadeIn>
      <ResearchSec title="Working Papers" items={WP} TC={TC}/>
      <ResearchSec title="Work in Progress" items={WIPP} TC={TC}/>
    </div>)}

    {/* FULGURANCES */}
    {page==="fulgurances"&&!articleSlug&&(
    <div style={{padding:"40px 0 60px"}}>
      <FadeIn><div style={{padding:"20px 0 30px",marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <FLogo size={48} TC={TC}/><div>
            <h1 style={{fontFamily:C.fd,fontSize:34,fontWeight:900,color:TC.ink,lineHeight:1}}>Fulgurances</h1>
            <div style={{fontSize:8,fontFamily:C.fm,color:TC.ink3,letterSpacing:2.5,marginTop:2}}>DONNÉES & ANALYSE</div>
          </div>
        </div>
        <p style={{fontFamily:C.fb,fontSize:14,color:TC.ink2,lineHeight:1.8,textAlign:"justify",maxWidth:680}}>
          Fulgurances est un espace où je prends le temps de regarder l’actualité en face, en français et en anglais, puis de la disséquer avec mes outils et mes obsessions. J’y écris sur ce qui me travaille, dans le monde, et surtout au Sénégal : économie, technologie, santé publique, société, politique, culture, sport. Chaque billet part d’une intuition nette, d’un détail qui accroche, d’un chiffre qui ne colle pas, d’un récit trop commode. Ensuite je creuse : données, modèles simples quand il le faut, lectures, comparaisons, parfois un détour par l’histoire ou le terrain. Le ton est libre, parfois tranchant, toujours honnête. Ici, les fulgurances servent à éclairer, puis à poser le débat.</p>
      </div></FadeIn>
      <div style={{display:"flex",gap:8,marginBottom:28,flexWrap:"wrap"}}>
        {BCATS.map(c=>{const n=ARTICLES.filter(a=>a.cat===c.id).length;
          return n>0?(<span key={c.id} style={{background:TC[catColor[c.id]]+"18",color:TC[catColor[c.id]],
            padding:"4px 12px",borderRadius:3,fontSize:9,fontFamily:C.fm,fontWeight:600,letterSpacing:.5}}>
            {c.ic+" "+c.label+" ("+n+")"}</span>):null})}
      </div>
      {ARTICLES.filter(a=>a.featured).map(a=>(
        <FadeIn key={a.id} delay={.1}><div onClick={()=>nav("fulgurances",a.slug)} style={{
          background:TC.card,borderRadius:8,border:"1px solid "+TC.brd,marginBottom:24,cursor:"pointer",overflow:"hidden"}}>
          <div style={{background:`linear-gradient(135deg,${TC[catColor[a.cat]]}15,${TC[catColor[a.cat]]}05)`,padding:"32px 28px 24px"}}>
            <span style={{background:TC[catColor[a.cat]],color:"#fff",padding:"3px 10px",borderRadius:3,fontSize:9,fontFamily:C.fm,letterSpacing:1.2,fontWeight:600}}>
              {(BCATS.find(cc=>cc.id===a.cat)||{}).label||a.cat}</span>
            <h2 style={{fontFamily:C.fd,fontSize:24,fontWeight:900,color:TC.ink,lineHeight:1.2,margin:"12px 0 8px"}}>{a.title}</h2>
            <p style={{fontFamily:C.fb,fontSize:14,color:TC.ink2,lineHeight:1.6,margin:0}}>{a.subtitle}</p>
          </div>
          <div style={{padding:"12px 28px",display:"flex",justifyContent:"space-between",borderTop:"1px solid "+TC.brd}}>
            <span style={{fontSize:10,fontFamily:C.fm,color:TC.ink3}}>{fmtDate(a.date,a.lang)+" · "+a.rt+" min"}</span>
            <span style={{fontSize:10,fontFamily:C.fm,color:TC.coral,fontWeight:600}}>Lire →</span>
          </div>
        </div></FadeIn>))}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
        {ARTICLES.filter(a=>!a.featured).map((a,i)=>(
        <FadeIn key={a.id} delay={i*.08}><div onClick={()=>nav("fulgurances",a.slug)} style={{
          background:TC.card,borderRadius:6,border:"1px solid "+TC.brd,cursor:"pointer",display:"flex",flexDirection:"column",height:"100%"}}>
          <div style={{padding:"16px 18px",flex:1}}>
            <span style={{background:TC[catColor[a.cat]],color:"#fff",padding:"2px 8px",borderRadius:2,fontSize:8,fontFamily:C.fm,letterSpacing:1,fontWeight:600}}>
              {(BCATS.find(cc=>cc.id===a.cat)||{}).label||a.cat}</span>
            <h3 style={{fontFamily:C.fd,fontSize:15,fontWeight:700,color:TC.ink,lineHeight:1.25,margin:"10px 0 6px"}}>{a.title}</h3>
            <p style={{fontFamily:C.fb,fontSize:11.5,color:TC.ink3,lineHeight:1.5,margin:0}}>{a.subtitle}</p>
          </div>
          <div style={{padding:"10px 18px",display:"flex",justifyContent:"space-between",borderTop:"1px solid "+TC.brd}}>
            <span style={{fontSize:9,fontFamily:C.fm,color:TC.ink3}}>{fmtDate(a.date,a.lang)}</span>
            <span style={{fontSize:9,fontFamily:C.fm,color:TC[catColor[a.cat]]}}>{a.rt+" min →"}</span>
          </div>
        </div></FadeIn>))}
      </div>
    </div>)}

    {/* ARTICLE */}
    {articleSlug&&article&&(
    <div style={{padding:"40px 0 60px"}}>
      <button onClick={()=>nav("fulgurances")} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,fontFamily:C.fm,color:TC.coral,marginBottom:20,padding:0}}>← Fulgurances</button>
      {article.isIPG?(
        <FadeIn>
          <span style={{background:TC[catColor[article.cat]],color:"#fff",padding:"3px 10px",borderRadius:3,fontSize:9,fontFamily:C.fm,letterSpacing:1.2,fontWeight:600}}>
            {(BCATS.find(cc=>cc.id===article.cat)||{}).label}</span>
          <h1 style={{fontFamily:C.fd,fontSize:28,fontWeight:900,color:TC.ink,lineHeight:1.15,margin:"14px 0 10px"}}>{article.title}</h1>
          <p style={{fontFamily:C.fb,fontSize:15,color:TC.ink2,lineHeight:1.7,fontStyle:"italic",marginBottom:12}}>{article.subtitle}</p>
          <div style={{display:"flex",gap:16,fontSize:10,fontFamily:C.fm,color:TC.ink3,marginBottom:28}}>
            <span>{fmtDate(article.date,article.lang)}</span><span>{article.rt+" min"}</span>
            <span style={{color:TC[catColor[article.cat]]}}>English</span></div>
          <IPGErrorBoundary><IntraPartyArticle TC={TC}/></IPGErrorBoundary>
          <ShareButtons article={article} TC={TC}/>
          <SiteComments TC={TC}/>
        </FadeIn>
      ):article.isVIH?(
        <FadeIn>
          <span style={{background:TC[catColor[article.cat]],color:"#fff",padding:"3px 10px",borderRadius:3,fontSize:9,fontFamily:C.fm,letterSpacing:1.2,fontWeight:600}}>
            {(BCATS.find(cc=>cc.id===article.cat)||{}).label}</span>
          <h1 style={{fontFamily:C.fd,fontSize:28,fontWeight:900,color:TC.ink,lineHeight:1.15,margin:"14px 0 10px"}}>{article.title}</h1>
          <p style={{fontFamily:C.fb,fontSize:15,color:TC.ink2,lineHeight:1.7,fontStyle:"italic",marginBottom:12}}>{article.subtitle}</p>
          <div style={{display:"flex",gap:16,fontSize:10,fontFamily:C.fm,color:TC.ink3,marginBottom:28}}>
            <span>{fmtDate(article.date,article.lang)}</span><span>{article.rt+" min"}</span></div>
          <VIHArticle/>
          <ShareButtons article={article} TC={TC}/>
          <SiteComments TC={TC}/>
        </FadeIn>
      ):(
        <FadeIn><div style={{maxWidth:680,margin:"0 auto"}}>
          <span style={{background:TC[catColor[article.cat]],color:"#fff",padding:"3px 10px",borderRadius:3,fontSize:9,fontFamily:C.fm,letterSpacing:1.2,fontWeight:600}}>
            {(BCATS.find(cc=>cc.id===article.cat)||{}).label}</span>
          <h1 style={{fontFamily:C.fd,fontSize:28,fontWeight:900,color:TC.ink,lineHeight:1.15,margin:"14px 0 10px"}}>{article.title}</h1>
          <p style={{fontFamily:C.fb,fontSize:15,color:TC.ink2,lineHeight:1.7,fontStyle:"italic",marginBottom:12}}>{article.subtitle}</p>
          <div style={{display:"flex",gap:16,fontSize:10,fontFamily:C.fm,color:TC.ink3,marginBottom:28}}>
            <span>{fmtDate(article.date,article.lang)}</span><span>{article.rt+" min"}</span>
            <span style={{color:TC[catColor[article.cat]]}}>{article.lang==="fr"?"Français":"English"}</span></div>
          <div style={{width:40,height:1,background:TC.brd,marginBottom:28}}/>
          <div style={{fontFamily:C.fb,fontSize:15,color:TC.ink2,lineHeight:1.95,textAlign:"justify"}}>
            {renderBody(article.body,article.lang)}</div>
          <ShareButtons article={article} TC={TC}/>
          <SiteComments TC={TC}/>
        </div></FadeIn>
      )}
    </div>)}

    {/* DON'T GO THERE */}
    {page==="dontgothere"&&!articleSlug&&(
    <div style={{padding:"40px 0 60px"}}>
      <FadeIn><h1 style={{fontFamily:C.fd,fontSize:34,fontWeight:900,color:TC.ink,marginBottom:24}}>Don’t go there...</h1></FadeIn>
      <FadeIn delay={.1}><div style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:8,padding:"24px 28px",marginBottom:20}}>
        <h2 style={{fontFamily:C.fd,fontSize:20,fontWeight:700,color:TC.ink,marginBottom:12}}>Spotify Playlist</h2>
        <div style={{borderRadius:12,overflow:"hidden",marginBottom:12}}>
          <iframe src="https://open.spotify.com/embed/playlist/5h18W822qby8oWSwoBu8q3?utm_source=generator&theme=0"
            width="100%" height="352" frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy" style={{display:"block",border:"none"}}/>
        </div>
        <a href="https://open.spotify.com/playlist/5h18W822qby8oWSwoBu8q3" target="_blank" rel="noopener noreferrer"
          style={{display:"inline-block",background:"linear-gradient(135deg,#1DB954,#191414)",borderRadius:8,padding:"12px 20px",textDecoration:"none",marginBottom:8}}>
          <div style={{color:"#fff",fontSize:14,fontFamily:C.fd,fontWeight:700}}>Ethiopian Jazz – Curated Selection</div>
          <div style={{color:"#1DB954",fontSize:10,fontFamily:C.fm,marginTop:4}}>Ouvrir dans Spotify ↗</div>
        </a>
        <p style={{fontFamily:C.fb,fontSize:13,color:TC.ink3,lineHeight:1.6,marginTop:8}}>A curated selection of my favorite Ethiopian jazz tracks.</p>
      </div></FadeIn>
      <FadeIn delay={.2}><div style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:8,padding:"24px 28px",marginBottom:20}}>
        <h2 style={{fontFamily:C.fd,fontSize:20,fontWeight:700,color:TC.ink,marginBottom:12}}>Apple Music Playlist</h2>
        <div style={{borderRadius:10,overflow:"hidden",marginBottom:12}}>
          <iframe
            allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
            frameBorder="0" height="450"
            style={{width:"100%",overflow:"hidden",display:"block",border:"none"}}
            sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
            src="https://embed.music.apple.com/ca/playlist/bassit/pl.u-11zBMeasN7v6B4D"
            loading="lazy"/>
        </div>
        <a href="https://music.apple.com/ca/playlist/bassit/pl.u-11zBMeasN7v6B4D" target="_blank" rel="noopener noreferrer"
          style={{display:"inline-block",background:"linear-gradient(135deg,#FC3C44,#000)",borderRadius:8,padding:"12px 20px",textDecoration:"none",marginBottom:8}}>
          <div style={{color:"#fff",fontSize:14,fontFamily:C.fd,fontWeight:700}}>Bassit – Best Bass Lines</div>
          <div style={{color:"#FC3C44",fontSize:10,fontFamily:C.fm,marginTop:4}}>Ouvrir dans Apple Music ↗</div>
        </a>
        <p style={{fontFamily:C.fb,fontSize:13,color:TC.ink3,lineHeight:1.6,marginTop:8}}>A collection of songs with some of the best bass lines. Press play and enjoy the bass!</p>
      </div></FadeIn>
      <FadeIn delay={.3}><div style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:8,padding:"24px 28px",marginBottom:20}}>
        <h2 style={{fontFamily:C.fd,fontSize:20,fontWeight:700,color:TC.ink,marginBottom:12}}>Film Recommendations</h2>
        <div style={{fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.8}}>
          <p style={{marginBottom:6}}><strong style={{color:TC.ink}}>Inception</strong> – A mind-bending thriller by Christopher Nolan that explores the world of dreams.</p>
          <p style={{marginBottom:6}}><strong style={{color:TC.ink}}>The Grand Budapest Hotel</strong> – Wes Anderson’s visually stunning and humorous tale.</p>
          <p><strong style={{color:TC.ink}}>Parasite</strong> – A gripping social commentary from Bong Joon-ho.</p>
        </div>
      </div></FadeIn>
      <FadeIn delay={.4}><div style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:8,padding:"24px 28px"}}>
        <h2 style={{fontFamily:C.fd,fontSize:20,fontWeight:700,color:TC.ink,marginBottom:12}}>Book Recommendations</h2>
        <div style={{fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.8}}>
          <p style={{marginBottom:6}}><strong style={{color:TC.ink}}>The Brothers Karamazov</strong> by Dostoyevsky – Because it’s Feodor...</p>
          <p style={{marginBottom:6}}><strong style={{color:TC.ink}}>1984</strong> by George Orwell – A dystopian novel that explores the dangers of totalitarianism.</p>
          <p><strong style={{color:TC.ink}}>La Plaie</strong> by Malick Fall – A compelling, poetic novel about Magamou, an African vagabond’s quest for happiness.</p>
        </div>
      </div></FadeIn>
    </div>)}

    </div>{/* end maxWidth */}

    {/* FOOTER */}
    <footer style={{borderTop:"1px solid "+TC.brd,padding:"28px 24px",marginTop:32}}>
      <div style={{maxWidth:880,margin:"0 auto",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:24}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <FLogo size={22} TC={TC}/>
            <span style={{fontFamily:C.fd,fontSize:14,fontWeight:900,color:TC.ink}}>CAMN</span>
          </div>
          <p style={{fontSize:10,fontFamily:C.fb,color:TC.ink3}}>Cheikh Ahmadou Mbacké Ndiaye</p>
        </div>
        <div style={{display:"flex",gap:20}}>
          {navItems.map(n=>(<button key={n.id} onClick={()=>nav(n.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,fontFamily:C.fm,color:TC.ink3,padding:0}}>{n.label}</button>))}
        </div>
      </div>
      <div style={{maxWidth:880,margin:"16px auto 0",paddingTop:12,borderTop:"1px solid "+TC.brd}}>
        <span style={{fontSize:8,fontFamily:C.fm,color:TC.ink3}}>© 2026 CAMN</span>
      </div>
    </footer>
  </div>);
}

/* RESEARCH SECTION */
function ResearchSec({title,items,TC}){
  const[open,setOpen]=useState({});
  const toggle=(i)=>setOpen(p=>({...p,[i]:!p[i]}));
  return(<div style={{marginBottom:32}}>
    <FadeIn>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{width:4,height:20,background:TC.coral,borderRadius:2}}/>
        <span style={{fontSize:10,fontFamily:C.fm,color:TC.coral,letterSpacing:3,fontWeight:700}}>{title.toUpperCase()}</span>
      </div>
      {items.map((p,i)=>(<div key={i} style={{background:TC.card,border:"1px solid "+TC.brd,borderRadius:6,padding:"18px 22px",marginBottom:12}}>
        <div style={{fontFamily:C.fd,fontSize:15,fontWeight:700,color:TC.ink,lineHeight:1.35}}>{p.title}</div>
        {p.coauthors&&<div style={{fontFamily:C.fb,fontSize:12,color:TC.ink3,marginTop:4,fontStyle:"italic"}}>{p.coauthors}</div>}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>toggle(i)} style={{background:"none",border:"none",borderBottom:"2px solid "+TC.ink,cursor:"pointer",fontFamily:C.fm,fontSize:11,fontWeight:600,color:TC.ink,padding:"4px 0"}}>
            {open[i]?"Hide Abstract −":"Show Abstract +"}</button>
          {p.hasPaper?<a href={p.paperUrl} target="_blank" rel="noopener noreferrer" style={{borderBottom:"2px solid "+TC.coral,fontFamily:C.fm,fontSize:11,fontWeight:600,color:TC.coral,padding:"4px 0",textDecoration:"none"}}>Read Paper ↗</a>
          :<span style={{fontFamily:C.fm,fontSize:11,color:TC.ink3,padding:"4px 0",opacity:.5}}>Read Paper</span>}
        </div>
        {open[i]&&<div style={{marginTop:10,padding:"10px 14px",borderLeft:"3px solid "+TC.coral,background:TC.bg2,fontFamily:C.fb,fontSize:13,color:TC.ink2,lineHeight:1.7,borderRadius:"0 4px 4px 0"}}>{p.abstract}</div>}
      </div>))}
    </FadeIn>
  </div>)}
