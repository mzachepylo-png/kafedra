// Анатомія рослин: тканини — процедурні SVG-рисунки.
"use strict";
(function(){
const $=id=>document.getElementById(id);
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const F=n=>Math.round(n*10)/10;
const PT=p=>F(p[0])+' '+F(p[1]);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
function hx(c){return[1,3,5].map(i=>parseInt(c.slice(i,i+2),16))}
function mix(a,b,t){const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>Math.round(lerp(v,B[i],clamp(t,0,1))).toString(16).padStart(2,'0')).join('')}
function clip(poly,nx,ny,c){const o=[],n=poly.length;for(let i=0;i<n;i++){const a=poly[i],b=poly[(i+1)%n],da=nx*a[0]+ny*a[1]-c,db=nx*b[0]+ny*b[1]-c;if(da<=0)o.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);o.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}}return o}
function area(p){let s=0;for(let i=0,n=p.length;i<n;i++){const a=p[i],b=p[(i+1)%n];s+=a[0]*b[1]-b[0]*a[1]}return s/2}
function cen(p){let A=0,x=0,y=0;for(let i=0,n=p.length;i<n;i++){const a=p[i],b=p[(i+1)%n],c=a[0]*b[1]-b[0]*a[1];A+=c;x+=(a[0]+b[0])*c;y+=(a[1]+b[1])*c}if(Math.abs(A)<1e-6){let sx=0,sy=0;p.forEach(v=>{sx+=v[0];sy+=v[1]});return[sx/p.length,sy/p.length]}return[x/(3*A),y/(3*A)]}
function inset(p,d){if(!p||p.length<3)return null;const c=cen(p);let o=p;const n=p.length;for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%n];let nx=b[1]-a[1],ny=a[0]-b[0];const L=Math.hypot(nx,ny);if(L<1e-6)continue;nx/=L;ny/=L;if(nx*(c[0]-a[0])+ny*(c[1]-a[1])>0){nx=-nx;ny=-ny}o=clip(o,nx,ny,nx*a[0]+ny*a[1]-d);if(o.length<3)return null}return o}
function shrink(p,d){const c=cen(p);return p.map(v=>{const dx=v[0]-c[0],dy=v[1]-c[1],L=Math.hypot(dx,dy)||1,k=Math.max(.1,(L-d)/L);return[c[0]+dx*k,c[1]+dy*k]})}
function scl(p,k,c){c=c||cen(p);return p.map(v=>[c[0]+(v[0]-c[0])*k,c[1]+(v[1]-c[1])*k])}
function clean(p,m){m=m||.7;const o=[];for(const v of p){const l=o[o.length-1];if(!l||Math.hypot(v[0]-l[0],v[1]-l[1])>m)o.push(v)}while(o.length>2){const f=o[0],l=o[o.length-1];if(Math.hypot(f[0]-l[0],f[1]-l[1])<=m)o.pop();else break}return o}
function smooth(p,t){if(t==null)t=.5;const n=p.length;if(n<3)return'';let d='';for(let i=0;i<=n;i++){const v=p[i%n],a=p[(i-1+n)%n],b=p[(i+1)%n],q=[v[0]+(b[0]-v[0])*t,v[1]+(b[1]-v[1])*t];if(!i)d+='M'+PT(q);else{const s=[v[0]+(a[0]-v[0])*t,v[1]+(a[1]-v[1])*t];d+='L'+PT(s)+'Q'+PT(v)+' '+PT(q)}}return d+'Z'}
function P(p){return'M'+p.map(PT).join('L')+'Z'}
function pip(pt,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function segD(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
function pol(c,r,a){return[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]}
function sector(c,r0,r1,a0,a1,n){n=n||3;const o=[];for(let i=0;i<=n;i++)o.push(pol(c,r1,lerp(a0,a1,i/n)));for(let i=n;i>=0;i--)o.push(pol(c,r0,lerp(a0,a1,i/n)));return o}

/* Пуассонівський розподіл зі змінною густиною: rf(x,y) -> бажана відстань між клітинами (0 = заборонено) */
function poisson(R,x0,y0,w,h,rf,rmin,rmax,tries,seeds){const g=rmin,cols=Math.ceil(w/g)+1,rows=Math.ceil(h/g)+1,grid=new Array(cols*rows),pts=[];
 const gi=(x,y)=>[clamp(Math.floor((x-x0)/g),0,cols-1),clamp(Math.floor((y-y0)/g),0,rows-1)];
 const add=p=>{const[i,j]=gi(p[0],p[1]);(grid[j*cols+i]||(grid[j*cols+i]=[])).push(p);pts.push(p)};
 const ok=(x,y,r)=>{const[gx,gy]=gi(x,y),k=Math.ceil((r+rmax)/2/g);for(let j=Math.max(0,gy-k);j<=Math.min(rows-1,gy+k);j++)for(let i=Math.max(0,gx-k);i<=Math.min(cols-1,gx+k);i++){const L=grid[j*cols+i];if(L)for(const q of L){const rr=(r+q[2])/2,dx=q[0]-x,dy=q[1]-y;if(dx*dx+dy*dy<rr*rr)return false}}return true};
 (seeds||[]).forEach(add);
 for(let t=0;t<tries;t++){const x=x0+R()*w,y=y0+R()*h,r=rf(x,y);if(!r)continue;if(ok(x,y,r))add([x,y,r])}
 return pts}

/* Зважена діаграма Вороного (power diagram): вага = (r/2)^2 */
function power(pts,x0,y0,x1,y1){let rmin=1e9,rmax=0;pts.forEach(p=>{rmin=Math.min(rmin,p[2]);rmax=Math.max(rmax,p[2])});
 const g=Math.max(3,rmin*1.4),cols=Math.ceil((x1-x0)/g)+1,rows=Math.ceil((y1-y0)/g)+1,grid=new Array(cols*rows);
 const gi=(x,y)=>[clamp(Math.floor((x-x0)/g),0,cols-1),clamp(Math.floor((y-y0)/g),0,rows-1)];
 pts.forEach((p,i)=>{const[a,b]=gi(p[0],p[1]);(grid[b*cols+a]||(grid[b*cols+a]=[])).push(i)});
 return pts.map((p,i)=>{const B=Math.max(5,1.7*p[2]);let poly=[[Math.max(x0,p[0]-B),Math.max(y0,p[1]-B)],[Math.min(x1,p[0]+B),Math.max(y0,p[1]-B)],[Math.min(x1,p[0]+B),Math.min(y1,p[1]+B)],[Math.max(x0,p[0]-B),Math.min(y1,p[1]+B)]];
  const sr=2.9*B+rmax*rmax/(11*B),k=Math.ceil(sr/g),[gx,gy]=gi(p[0],p[1]),wp=p[2]*p[2]/4,pp=p[0]*p[0]+p[1]*p[1];
  for(let j=Math.max(0,gy-k);j<=Math.min(rows-1,gy+k);j++)for(let a=Math.max(0,gx-k);a<=Math.min(cols-1,gx+k);a++){const L=grid[j*cols+a];if(!L)continue;for(const idx of L){if(idx===i)continue;const q=pts[idx],nx=q[0]-p[0],ny=q[1]-p[1];if(nx*nx+ny*ny>sr*sr||(nx===0&&ny===0))continue;poly=clip(poly,nx,ny,(q[0]*q[0]+q[1]*q[1]-pp-q[2]*q[2]/4+wp)/2);if(poly.length<3)return null}}
  return poly})}

function edgeKey(a,b){const k1=Math.round(a[0]*2)+','+Math.round(a[1]*2),k2=Math.round(b[0]*2)+','+Math.round(b[1]*2);return k1<k2?k1+'|'+k2:k2+'|'+k1}
function edges(cells,fn){const seen=new Set();cells.forEach((c,ci)=>{if(!c)return;for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<.6)continue;const k=edgeKey(a,b);if(seen.has(k))continue;seen.add(k);fn(a,b,ci,k)}})}
function wavy(a,b,amp){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;const n=Math.max(2,Math.round(L/7.5)),nx=-dy/L,ny=dx/L,A=Math.min(amp||3,L*.12),N=Math.max(8,Math.round(L/1.6));let d='M'+PT(a);for(let i=1;i<=N;i++){const t=i/N,o=A*Math.sin(n*Math.PI*t);d+='L'+PT([a[0]+dx*t+nx*o,a[1]+dy*t+ny*o])}return d}

function mtext(x,y,t,anc,cls){const L=t.split('\n');let s=`<text class="${cls||'lb'}" x="${F(x)}" y="${F(y+4-(L.length-1)*7.5)}" text-anchor="${anc||'start'}">`;L.forEach((l,i)=>s+=`<tspan x="${F(x)}" dy="${i?15:0}">${l}</tspan>`);return s+'</text>'}
function lab(x,y,tx,ty,t,anc){anc=anc||'start';const dx=anc==='start'?5:anc==='end'?-5:0;return`<path class="ld" d="M${F(x)} ${F(y)}L${F(tx)} ${F(ty)}"/><circle class="ldd" cx="${F(x)}" cy="${F(y)}" r="2.4"/>`+mtext(tx+dx,ty,t,anc)}
function ttl(x,y,t){return`<text class="ttl" x="${x}" y="${y}" text-anchor="middle">${t}</text>`}
function nuc(x,y,rx,ry,rot){return`<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(rx)}" ry="${F(ry)}" transform="rotate(${F(rot||0)} ${F(x)} ${F(y)})" fill="url(#gNuc)"/><circle cx="${F(x+rx*.22)}" cy="${F(y-ry*.18)}" r="${F(Math.max(.6,Math.min(rx,ry)*.3))}" fill="#2a0e4c" opacity=".8"/>`}
function chl(x,y,a,s){s=s||1;return`<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(3.3*s)}" ry="${F(1.9*s)}" transform="rotate(${F(a*57.2958)} ${F(x)} ${F(y)})" fill="url(#gChl)"/>`}
function along(p,step,R,fn){const n=p.length;let acc=R()*step;for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);let s=acc;while(s<L){const t=s/L;fn(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,ang);s+=step}acc=s-L}}
/* клітина: стінка (весь многокутник) + протопласт (внутрішній відступ d) */
function cellPair(c,wall,fill,d,t){const q=inset(c,d);let s=`<path d="${P(c)}" fill="${wall}" stroke="${wall}" stroke-width=".6"/>`;if(q&&q.length>2){const qq=clean(q);if(qq.length>2){s+=`<path d="${smooth(qq,t==null?.35:t)}" fill="${fill}"/>`;return[s,qq]}}return[s,null]}
function ring(c,r0,r1,arc,R,wall,fill,d,extra){const N=Math.max(6,Math.round(TAU*(r0+r1)/2/arc)),off=R()*TAU,b=[];let s='';for(let i=0;i<N;i++)b.push(off+TAU*i/N+(i?(R()-.5)*.35*TAU/N:0));b.push(b[0]+TAU);for(let i=0;i<N;i++){const p=sector(c,r0,r1,b[i],b[i+1],2);s+=`<path d="${P(p)}" fill="${wall}" stroke="${wall}" stroke-width=".5"/>`;const q=shrink(p,d);s+=`<path d="${smooth(q,.3)}" fill="${fill}"/>`;if(extra)s+=extra(q,cen(q),i)}return s}
function blob(x,y,r,R,k){k=k||.12;const ph=R()*TAU,ph2=R()*TAU,pp=[];for(let i=0;i<14;i++){const a=i/14*TAU,rr=r*(1+k*Math.sin(3*a+ph)+k*.5*Math.sin(5*a+ph2));pp.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr])}return smooth(pp,.5)}
function brace(x,y1,y2,t){const m=(y1+y2)/2;return`<path d="M${x} ${y1}q7 0 7 7V${F(m-6)}q0 6 6 6q-6 0 -6 6V${F(y2-7)}q0 7 -7 7" fill="none" stroke="#5f5b50" stroke-width="1.2"/>`+mtext(x+20,m,t)}
function fig(id,fn){const el=$(id);if(!el)return;try{el.innerHTML=fn()}catch(e){console.error(id,e)}}

/* ===== ГОЛОВНА МОДЕЛЬ: стебло соняшнику ===== */
function heroFig(){const R=mul(2024),C=[300,300],RE=272,RC=264,NB=10,a0=-Math.PI/2,st=TAU/NB;
 const ducts=[];for(let i=0;i<NB;i++)ducts.push(pol(C,231,a0+i*st));
 const hw=r=>r<170?12+(r-120)*.36:r<200?30:Math.max(4,30-(r-200)*.95);
 function zone(x,y){const dx=x-C[0],dy=y-C[1],r=Math.hypot(dx,dy);if(r>RC+8)return null;
  for(const d of ducts)if(Math.hypot(x-d[0],y-d[1])<15)return'duct';
  if(r<116)return'pith';
  let a=Math.atan2(dy,dx)-a0;a=((a%st)+st)%st;if(a>st/2)a-=st;const arc=Math.abs(a)*r;
  if(r<218&&arc<hw(r)){if(r<166)return'xylem';if(r<173)return'camb';if(r<199)return'phloem';return'scl'}
  if(r<166)return'ray';if(r<173)return'camb';if(r<243)return'cortex';return'coll'}
 const SP={ray:13,xylem:7.4,camb:5.2,phloem:6.8,scl:6.4,cortex:15,coll:9.5};
 const seeds=[];
 for(let i=0;i<NB;i++){const ac=a0+i*st;[[136,[-13,0,13]],[150,[-16,0,16]],[162,[-9,9]]].forEach(([r,offs])=>offs.forEach(o=>{if(R()<.18)return;const p=pol(C,r+(R()-.5)*3,ac+o/r);seeds.push([p[0],p[1],14+R()*5,'vessel'])}))}
 const pts=poisson(R,C[0]-RC-10,C[1]-RC-10,2*RC+20,2*RC+20,(x,y)=>{const z=zone(x,y);if(!z||z==='duct')return 0;const s=z==='pith'?lerp(30,18,Math.hypot(x-C[0],y-C[1])/116):SP[z];return s*(.92+R()*.16)},4.7,30,140000,seeds);
 const cells=power(pts,C[0]-RC-12,C[1]-RC-12,C[0]+RC+12,C[1]+RC+12);
 const ST={pith:['#c4af82','#f7efd9',1.1],ray:['#bba87c','#f3ebd3',1],xylem:['#a8232f','#fbebe6',1.6],vessel:['#9c1d29','#fff8f4',2.3],camb:['#6c4797','#dccaf0',.65],phloem:['#3d6aa8','#dbe8f7',.8],scl:['#a11d2a','#f2c0b9',2.4],cortex:['#7d9d59','#e7f0d3',1],coll:['#dde5ec','#d3e6be',2.1]};
 const G={};const add=(k,s)=>{(G[k]=G[k]||[]).push(s)};
 cells.forEach((c,i)=>{if(!c)return;const p=pts[i],t=p[3]||zone(p[0],p[1]);if(!t||t==='duct')return;const sty=ST[t];
  let fill=sty[1];if(t==='phloem'&&Math.abs(area(c))<26)fill='#9cb9e0';
  const[s0,q]=cellPair(c,sty[0],fill,sty[2],t==='coll'?.5:.35);let s=s0;
  if(q){const cc=cen(q),rr=Math.sqrt(Math.abs(area(q))/Math.PI);
   if(t==='cortex')along(shrink(q,1.6),6.5,R,(x,y)=>{s+=`<circle cx="${F(x)}" cy="${F(y)}" r="1.15" fill="#5f9c3f"/>`});
   if((t==='camb'||fill==='#9cb9e0'||t==='cortex'&&R()<.45||t==='coll'&&R()<.5||(t==='pith'||t==='ray')&&R()<.4)&&rr>1.8)s+=`<circle cx="${F(cc[0]+(R()-.5)*rr*.4)}" cy="${F(cc[1]+(R()-.5)*rr*.4)}" r="${F(clamp(rr*.32,1,3.4))}" fill="#6a3d98" opacity=".75"/>`}
  add(t==='vessel'?'xylem':t==='ray'?'pith':t,s)});
 let du='';ducts.forEach(d=>{du+=`<circle cx="${F(d[0])}" cy="${F(d[1])}" r="15" fill="#93ad72"/>`+ring(d,6.2,12.8,6.5,R,'#b0862a','#f6e6b6',.7,(q,cc)=>`<circle cx="${F(cc[0])}" cy="${F(cc[1])}" r="1.2" fill="#6a3d98" opacity=".7"/>`)+`<circle cx="${F(d[0])}" cy="${F(d[1])}" r="6.2" fill="url(#gResin)"/>`});
 let ep=ring(C,RC,RE,10.5,R,'#6d8a48','#f2f6e6',.9)+`<circle cx="${C[0]}" cy="${C[1]}" r="${RE+.9}" fill="none" stroke="#d9a93d" stroke-width="2"/>`;
 for(let k=0;k<16;k++){const a=a0+k*TAU/16+(R()-.5)*.25,L=26+R()*20,n=4,bend=(R()-.5)*.25,ctr=[];for(let j=0;j<=n;j++){const u=j/n;ctr.push(pol(C,RE+L*u,a+bend*u*u))}
  const left=[],right=[];ctr.forEach((p,j)=>{const q=ctr[Math.min(n,j+1)],pr=ctr[Math.max(0,j-1)],dx=q[0]-pr[0],dy=q[1]-pr[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,w=lerp(4.4,1.2,j/n);left.push([p[0]+nx*w,p[1]+ny*w]);right.push([p[0]-nx*w,p[1]-ny*w])});
  const tip=pol(C,RE+L+3,a+bend);let walls='';for(let j=1;j<n;j++)walls+=`M${PT(left[j])}L${PT(right[j])}`;
  ep+=`<path d="M${left.map(PT).join('L')}L${PT(tip)}L${[...right].reverse().map(PT).join('L')}Z" fill="#f4f7ea" stroke="#6d8a48" stroke-width="1"/><path d="${walls}" stroke="#6d8a48" stroke-width=".9"/>`}
 const order=['pith','xylem','camb','phloem','scl','cortex','coll'];
 return`<defs><clipPath id="hClip"><circle cx="${C[0]}" cy="${C[1]}" r="${RC+.5}"/></clipPath></defs><circle cx="${C[0]}" cy="${C[1]}" r="${RE+3}" fill="#d9cfb4" opacity=".4"/><g clip-path="url(#hClip)">${order.map(k=>`<g class="tz" data-t="${k}">${(G[k]||[]).join('')}</g>`).join('')}<g class="tz" data-t="duct">${du}</g></g><g class="tz" data-t="epid">${ep}</g>`}

const HN={epid:'Епідерма з волосками — покривна',coll:'Коленхіма — механічна',cortex:'Паренхіма кори (хлоренхіма) — основна',duct:'Секреторний канал — видільна',scl:"Склеренхіма (луб'яні волокна) — механічна",phloem:'Флоема — провідна',camb:'Камбій — латеральна меристема',xylem:'Ксилема (судини) — провідна',pith:'Серцевина і промені — основна'};
function heroInit(){const hs=$('heroSvg'),tip=$('heroTip'),fg=hs.parentNode;let pinned=null;
 let hcur;const hl=t=>{if(t===hcur)return;hcur=t;hs.classList.toggle('hl',!!t);hs.querySelectorAll('.tz').forEach(g=>g.classList.toggle('on',g.dataset.t===t));document.querySelectorAll('#heroLegend button').forEach(b=>b.classList.toggle('on',b.dataset.t===t))};
 document.querySelectorAll('#heroLegend button').forEach(b=>{b.addEventListener('mouseenter',()=>hl(b.dataset.t));b.addEventListener('mouseleave',()=>hl(pinned));b.addEventListener('focus',()=>hl(b.dataset.t));b.addEventListener('blur',()=>hl(pinned));b.addEventListener('click',()=>{pinned=pinned===b.dataset.t?null:b.dataset.t;hl(pinned)})});
 hs.addEventListener('mousemove',e=>{const g=e.target.closest&&e.target.closest('.tz');if(!g){tip.style.opacity=0;hl(pinned);return}hl(g.dataset.t);const r=fg.getBoundingClientRect();tip.textContent=HN[g.dataset.t];tip.style.left=(e.clientX-r.left)+'px';tip.style.top=(e.clientY-r.top)+'px';tip.style.opacity=1});
 hs.addEventListener('mouseleave',()=>{tip.style.opacity=0;hl(pinned)})}

/* ===== 1. МЕРИСТЕМИ ===== */
function mitosis(st,c,r,a,R){const u=[Math.cos(a),Math.sin(a)],v=[-u[1],u[0]],Q=(s,t)=>[c[0]+u[0]*s+v[0]*t,c[1]+u[1]*s+v[1]*t];let o='';
 const spindle=()=>{let z='';for(let k=0;k<7;k++){const t=(k/6-.5)*r;z+=`<path d="M${PT(Q(-r*.72,0))}Q${PT(Q(-r*.3,t*1.1))} ${PT(Q(0,t))}Q${PT(Q(r*.3,t*1.1))} ${PT(Q(r*.72,0))}" fill="none" stroke="#9b7cc4" stroke-width=".55" opacity=".85"/>`}return z};
 if(st==='pro'){o+=`<circle cx="${F(c[0])}" cy="${F(c[1])}" r="${F(r*.5)}" fill="#e9dbf6" stroke="#6b3fa0" stroke-width=".9" stroke-dasharray="2.2 1.6"/>`;for(let k=0;k<6;k++){const p0=Q((R()-.5)*r*.55,(R()-.5)*r*.55),p1=Q((R()-.5)*r*.6,(R()-.5)*r*.6),p2=Q((R()-.5)*r*.55,(R()-.5)*r*.55);o+=`<path d="M${PT(p0)}Q${PT(p1)} ${PT(p2)}" fill="none" stroke="#3a1266" stroke-width="1.7" stroke-linecap="round"/>`}}
 else if(st==='meta'){o+=spindle();for(let k=-3;k<=3;k++){const p=Q(0,k*r*.13),d=[u[0]*r*.12,u[1]*r*.12];o+=`<path d="M${PT([p[0]-d[0],p[1]-d[1]])}L${PT([p[0]+d[0],p[1]+d[1]])}" stroke="#3a1266" stroke-width="2.5" stroke-linecap="round"/>`}}
 else if(st==='ana'){o+=spindle();[-1,1].forEach(sg=>{for(let k=-2;k<=2;k++){const cp=Q(sg*r*.42,k*r*.12),e1=Q(sg*r*.2,k*r*.12-r*.06),e2=Q(sg*r*.2,k*r*.12+r*.06);o+=`<path d="M${PT(e1)}L${PT(cp)}L${PT(e2)}" fill="none" stroke="#3a1266" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`}})}
 else{[-1,1].forEach(sg=>{const p=Q(sg*r*.45,0);o+=nuc(p[0],p[1],r*.22,r*.28,a*57.3)});o+=`<path d="M${PT(Q(0,-r*.78))}L${PT(Q(0,r*.78))}" stroke="#fbf6ff" stroke-width="2.4" stroke-dasharray="3 1.6"/>`;for(let k=-3;k<=3;k++){const t=k*r*.18;o+=`<path d="M${PT(Q(-r*.2,t))}L${PT(Q(r*.2,t))}" stroke="#9b7cc4" stroke-width=".6"/>`}}
 return o}

function figMer(){const R=mul(5),W=560,H=300;
 const pts=poisson(R,-30,-30,W+60,H+60,()=>31*(.9+R()*.2),27,35,9000);
 const cells=power(pts,-30,-30,W+30,H+30);
 const tg={pro:[95,80],meta:[270,150],ana:[460,95],telo:[425,228]},sp={};
 for(const k in tg){let b=-1,bd=1e9;pts.forEach((p,i)=>{const d=Math.hypot(p[0]-tg[k][0],p[1]-tg[k][1]);if(d<bd){bd=d;b=i}});sp[b]=k;tg[k]=b}
 let nc=-1,bd=1e9;pts.forEach((p,i)=>{if(sp[i])return;const d=Math.hypot(p[0]-150,p[1]-225);if(d<bd){bd=d;nc=i}});
 let s=`<defs><clipPath id="cMer"><rect width="${W}" height="${H}" rx="16"/></clipPath><radialGradient id="gMerC" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#f4ecfb"/><stop offset="1" stop-color="#d4bde9"/></radialGradient></defs><g clip-path="url(#cMer)"><rect width="${W}" height="${H}" fill="#7f60a8"/>`;
 const info={};
 cells.forEach((c,i)=>{if(!c)return;const q=inset(c,1.1);if(!q)return;const p=clean(q);if(p.length<3)return;const rr=Math.sqrt(Math.abs(area(p))/Math.PI),cc=cen(p);info[i]=[cc,rr,c];
  s+=`<path d="${smooth(p,.32)}" fill="url(#gMerC)"/>`;
  for(let k=0;k<3;k++){const a=R()*TAU,d=rr*(.55+R()*.18);s+=`<circle cx="${F(cc[0]+Math.cos(a)*d)}" cy="${F(cc[1]+Math.sin(a)*d)}" r="${F(1.2+R()*1.5)}" fill="#fbf8fe" opacity=".85"/>`}
  for(let k=0;k<7;k++){const a=R()*TAU,d=rr*(.25+R()*.55);s+=`<circle cx="${F(cc[0]+Math.cos(a)*d)}" cy="${F(cc[1]+Math.sin(a)*d)}" r=".7" fill="#9d7fc2" opacity=".7"/>`}
  let stg=sp[i];if(!stg&&R()<.06)stg=['pro','meta','ana','telo'][Math.floor(R()*4)];
  s+=stg?mitosis(stg,cc,rr,R()*Math.PI,R):nuc(cc[0]+(R()-.5)*rr*.15,cc[1]+(R()-.5)*rr*.15,rr*.42,rr*.37,R()*180)});
 s+='</g>';
 const L=(k,t)=>{const v=info[tg[k]];return v?mtext(v[0][0],v[0][1]+v[1]+12,t,'middle','lb sm'):''};
 s+=L('pro','профаза')+L('meta','метафаза')+L('ana','анафаза')+L('telo','телофаза:\nклітинна пластинка');
 if(info[nc]){const[c0,r0,poly]=info[nc];s+=lab(c0[0]+r0*.15,c0[1]-r0*.1,c0[0]+r0+36,H-14,'велике ядро з ядерцем');const v=poly[0];s+=lab(v[0],v[1],v[0]-30,v[1]-34,'тонка стінка','end')}
 return s}

function figApical(){const R=mul(31);
 const sp="M110 370L114 265C80 240 50 170 62 92C82 140 102 195 120 230L124 196C110 180 100 160 104 144C116 148 126 160 131 172C131 118 189 118 189 172C194 160 204 148 216 144C220 160 210 180 196 196L200 230C218 195 238 140 258 92C270 170 240 240 206 265L210 370Z";
 const A=[160,142];
 const pts=poisson(R,40,70,240,310,(x,y)=>{const d=Math.hypot(x-A[0],y-A[1]);return(8.2+clamp((d-38)*.06,0,8.5))*(.92+R()*.16)},7.5,18,24000);
 const cells=power(pts,40,70,280,380);
 // корінь
 const X0=480,YB=318,CC=[480,274];
 const Dm=u=>u<=100?u:u<=140?100+(u-100)+1.5*(u-100)*(u-100)/40:200+4*(u-140);
 const hwf=D=>40*Math.sqrt(Math.max(0,1-Math.pow(1-clamp((D+3)/46,0,1),2)));
 const ol=[];for(let D=-3;D<=306;D+=3)ol.push([X0+hwf(D),YB-D]);for(let D=306;D>=-3;D-=3)ol.push([X0-hwf(D),YB-D]);
 const rootO=P(ol);
 let s=`<defs><clipPath id="cSh"><path d="${sp}"/></clipPath><clipPath id="cRt"><path d="${rootO}"/></clipPath></defs>`;
 s+=`<g clip-path="url(#cSh)"><rect x="40" y="70" width="240" height="310" fill="#8aa56a"/>`;
 cells.forEach((c,i)=>{if(!c)return;const p=pts[i],d=Math.hypot(p[0]-A[0],p[1]-A[1]),t=clamp((d-36)/140,0,1);
  const[s0,q]=cellPair(c,mix('#7652a0','#82a05f',t),mix('#e0cdf1','#e8f1d8',t),1,.35);s+=s0;
  if(q){const cc=cen(q),rr=Math.sqrt(Math.abs(area(q))/Math.PI);if(t>.3)s+=`<circle cx="${F(cc[0])}" cy="${F(cc[1])}" r="${F(rr*.55*t)}" fill="#fbfdf5" opacity=".8"/>`;s+=nuc(cc[0]+(R()-.5)*rr*.3,cc[1]+(R()-.5)*rr*.3,rr*lerp(.42,.24,t),rr*lerp(.38,.2,t),R()*180)}});
 s+=`</g><path d="${sp}" fill="none" stroke="#557538" stroke-width="1.8"/>`;
 s+=lab(166,142,292,118,'конус\nнаростання')+lab(208,158,292,172,'листковий\nзачаток')+lab(238,172,292,70,'молодий\nлисток')+ttl(160,398,'Верхівка пагона');
 // кореневі волоски
 for(let D=212;D<=300;D+=5.5)[-1,1].forEach(sg=>{if(R()<.15)return;const y0=YB-D,x0=X0+sg*hwf(D),L=14+(D-212)*.55+R()*12,d=`M${F(x0)} ${F(y0)}Q${F(x0+sg*L*.5)} ${F(y0-5+(R()-.5)*8)} ${F(x0+sg*L)} ${F(y0+(R()-.5)*14)}`;s+=`<path d="${d}" fill="none" stroke="#b5a273" stroke-width="3.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fbf7e8" stroke-width="1.7" stroke-linecap="round"/>`});
 // чохлик
 for(let k=0;k<4;k++){const r0=42+k*9.6,r1=r0+9.6,a0=-.28,a1=Math.PI+.28,N=Math.round((a1-a0)*(r0+r1)/2/13);for(let j=0;j<N;j++){const b0=a0+(a1-a0)*j/N,b1=a0+(a1-a0)*(j+1)/N;let p=sector(CC,r0,r1,b0,b1,3);if(k===3)p=p.map(v=>[v[0]+(v[0]-CC[0])*.03,v[1]+(v[1]-CC[1])*.03]);s+=`<path d="${P(p)}" fill="#b69a62" stroke="#b69a62" stroke-width=".5"/><path d="${smooth(shrink(p,1.1),k===3?.5:.3)}" fill="${k===3?'#f3ead3':'#efe2c3'}"/>`;
  if(k<3&&Math.abs((b0+b1)/2-Math.PI/2)<.5)for(let z=0;z<4;z++){const pp=pol(CC,r1-2.6-R()*1.6,lerp(b0,b1,.2+R()*.6));s+=`<circle cx="${F(pp[0])}" cy="${F(pp[1])}" r="1.35" fill="#6b5a3a"/>`}}}
 for(let z=0;z<5;z++){const pp=pol(CC,93+R()*8,Math.PI/2+(R()-.5)*1.9),a=R()*180;s+=`<ellipse cx="${F(pp[0])}" cy="${F(pp[1])}" rx="${F(6+R()*2)}" ry="${F(4.5+R()*1.5)}" transform="rotate(${F(a)} ${F(pp[0])} ${F(pp[1])})" fill="#f3ead3" stroke="#b69a62" stroke-width="1"/>`}
 // клітини тіла кореня
 const rp=[];for(let i=0;i<10;i++)for(let j=0;j<22;j++)rp.push([-37.8+i*8.4+(R()-.5)*2.6,-3+j*8.4+(R()-.5)*2.6,8.4]);
 const rc=power(rp,-44,-8,44,180);
 const mp=v=>{const D=Dm(v[1]);return[X0+v[0]/40*hwf(D),YB-D]};
 const sub=p=>{const o=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];for(let k=0;k<3;k++)o.push([lerp(a[0],b[0],k/3),lerp(a[1],b[1],k/3)])}return o};
 s+=`<g clip-path="url(#cRt)"><path d="${rootO}" fill="#8f8aa8"/>`;
 rc.forEach((c,i)=>{if(!c)return;const p=rp[i],D=Dm(p[1]),ax=Math.abs(p[0]);const m=clean(sub(c).map(mp),.4);if(m.length<3)return;
  let wall,fill,vac=0;if(D<100){wall='#7652a0';fill='#dcc6ef'}else if(D<200){const t=(D-100)/100;wall=mix('#7f6aa0','#8b9d6a',t);fill=mix('#e9e0f3','#f1f4e6',t);vac=1}else{wall='#8a9e66';fill='#f1f4e3';vac=1}
  if(ax<13&&D>=100)fill=mix(fill,'#f2e6bf',clamp((D-100)/100,0,1));
  const xy=ax<4.6&&D>205;if(xy){wall='#a8232f';fill='#fbece6'}
  if(ax>34&&D>=200)fill='#eef5dc';
  s+=`<path d="${P(m)}" fill="${wall}" stroke="${wall}" stroke-width=".5"/>`;const q=shrink(m,1.05);s+=`<path d="${smooth(q,.3)}" fill="${fill}"/>`;
  if(!xy){const cc=cen(q);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;q.forEach(v=>{x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1])});const cw=x1-x0;
   if(vac)s+=`<ellipse cx="${F(cc[0])}" cy="${F(cc[1])}" rx="${F(cw*.28)}" ry="${F((y1-y0)*.36)}" fill="#fdfefb" opacity=".75"/>`;
   const nr=cw*(D<100?.34:.24);if(nr>.8)s+=nuc(cc[0],vac?y0+(y1-y0)*.25+nr:cc[1],nr,nr*.9,0)}});
 s+=`</g><path d="${rootO}" fill="none" stroke="#6f7f50" stroke-width="1.4"/>`;
 s+=brace(592,12,116,'зона всмоктування\n(кореневі волоски)')+brace(592,120,216,'зона розтягування')+brace(592,220,316,'зона поділу —\nапікальна\nмеристема')+brace(592,320,354,'кореневий\nчохлик')+ttl(480,398,'Кінчик кореня');
 return s}

function figLateral(){const R=mul(77),C=[300,1112],A=.205,pl=(r,t)=>[C[0]+r*Math.sin(t),C[1]-r*Math.cos(t)];
 const NF=34,th=[];for(let i=0;i<=NF;i++)th.push(-A+2*A*i/NF+(i>0&&i<NF?(R()-.5)*.0035:0));
 const rays=[];for(let i=3;i<NF-1;i+=6+Math.floor(R()*4))rays.push(i);
 const Z=[[828,'xy',11,15],[845,'xyL',4,5.5],[919,'xy',11,16],[933,'xyY',6,8],[948,'cb',5,6],[973,'ph',8,12],[981,'phF',4,4],[1000,'ph',8,12],[1030,'co',11,15],[1039,'pd',9,9],[1046,'pg',7,7],[1087,'ck',5.4,6.6]];
 const ves=[];let tr=0;while(ves.length<15&&tr<600){tr++;const e=R()<.5,r=e?lerp(778,822,R()):lerp(852,912,R()),t=lerp(-A+.014,A-.014,R()),rv=(e?(r<800?12:9.5):(r<880?12:9.5))+R()*3.5,p=pl(r,t);if(ves.every(v=>Math.hypot(v[0]-p[0],v[1]-p[1])>v[2]+rv+6))ves.push([p[0],p[1],rv])}
 const ST={xy:['#a8232f','#fdf1ec',1.4],xyL:['#9c1d29','#f6d3cc',1.6],xyY:['#c46a70','#fcf1ed',.8],ray:['#b8763f','#f7e2c8',.9],cb:['#6c4797','#dccaf0',.65],ph:['#3d6aa8','#dbe8f7',.8],phF:['#a11d2a','#f2c0b9',2],co:['#7d9d59','#e7f0d3',1],pd:['#7d9d59','#dfeac8',.9],pg:['#6c4797','#e2d3f3',.7],ck:['#6e4424','url(#gCork)',1.1]};
 const wedge=(r0,r1)=>`M${PT(pl(r1,-A))}A${r1} ${r1} 0 0 1 ${PT(pl(r1,A))}L${PT(pl(r0,A))}A${r0} ${r0} 0 0 0 ${PT(pl(r0,-A))}Z`;
 let s=`<defs><clipPath id="cLat"><path d="${wedge(768,1087)}"/></clipPath></defs><g clip-path="url(#cLat)"><path d="${wedge(760,1095)}" fill="#b5434a"/>`;
 for(let f=0;f<NF;f++){const isR=rays.includes(f);let r=766;for(const z of Z){const end=z[0]+(R()-.5)*(z[1]==='cb'||z[1]==='pg'?1:3);
  while(r<end-.5){let L=lerp(z[2],z[3],R()),typ=z[1];if(typ==='phF'&&R()<.3)typ='ph';if(isR&&/^(xy|ph)/.test(typ)){typ='ray';L=lerp(16,24,R())}if(r+L>end-L*.45)L=end-r;if(L<2.5)break;
   const mid=pl(r+L/2,(th[f]+th[f+1])/2);if(typ.startsWith('xy')&&ves.some(v=>Math.hypot(v[0]-mid[0],v[1]-mid[1])<v[2]+3)){r+=L;continue}
   const p=[pl(r,th[f]),pl(r,th[f+1]),pl(r+L,th[f+1]),pl(r+L,th[f])],sty=ST[typ];let fill=sty[1];if(typ==='ph'&&R()<.28)fill='#a3bfe6';
   const[s0,q]=cellPair(p,sty[0],fill,sty[2],.3);s+=s0;
   if(q){const cc=cen(q);if(typ==='cb'||typ==='pg'||typ==='ray'||((typ==='co'||typ==='pd')&&R()<.5)||fill==='#a3bfe6')s+=`<ellipse cx="${F(cc[0])}" cy="${F(cc[1])}" rx="${typ==='ray'?2:2.3}" ry="${typ==='cb'||typ==='pg'?1.4:2}" fill="#5e3590" opacity=".75"/>`;if(typ==='co')along(shrink(q,1.4),5.5,R,(x,y)=>{s+=`<circle cx="${F(x)}" cy="${F(y)}" r="1.1" fill="#5f9c3f"/>`})}
   r+=L}r=Math.max(r,end)}}
 ves.forEach(v=>{s+=`<circle cx="${F(v[0])}" cy="${F(v[1])}" r="${F(v[2]+1.6)}" fill="#a8232f"/><circle cx="${F(v[0])}" cy="${F(v[1])}" r="${F(v[2]-1.1)}" fill="#fff8f4"/>`});
 s+=`</g><path d="${wedge(768,1087)}" fill="none" stroke="#5f5b50" stroke-width=".8"/>`;
 const LB=(r,ty,t)=>{const p=pl(r,A*.82);return lab(p[0],p[1],590,ty,t)};
 s+=LB(1066,38,'корок (фелема)')+LB(1042,78,'фелоген\n(корковий камбій)')+LB(1015,118,'паренхіма кори')+LB(988,152,'вторинна флоема (луб)')+LB(940,192,'КАМБІЙ')+LB(880,240,'вторинна ксилема\n(деревина)')+LB(836,294,'межа річного кільця\n(пізня деревина)');
 const rf=rays.find(f=>(th[f]+th[f+1])/2<-.06)||rays[0];if(rf!=null){const p=pl(890,(th[rf]+th[rf+1])/2);s+=lab(p[0],p[1],14,328,'серцевинний\nпромінь')}
 const cb=pl(940,-A);s+=`<path d="M${F(cb[0]-4)} ${F(cb[1])}H52" stroke="#6c4797" stroke-width="1.2" stroke-dasharray="3 2"/><path d="M44 ${F(cb[1]-8)}V${F(cb[1]-58)}" stroke="#3d6aa8" stroke-width="2.2" marker-end="url(#mBl)"/><path d="M44 ${F(cb[1]+8)}V${F(cb[1]+58)}" stroke="#a8232f" stroke-width="2.2" marker-end="url(#mR)"/>`+mtext(14,cb[1]-82,'назовні:\nфлоема')+mtext(14,cb[1]+82,'всередину:\nксилема');
 return s}

function figInter(){const R=mul(41),cx=140,nodes=[300,195,90];let s='';
 const blade=(n,sg)=>{const y=n-72,x=cx+sg*15;return`<path d="M${x} ${y}C${cx+sg*45} ${y-34} ${cx+sg*85} ${y-44} ${cx+sg*125} ${y-26}C${cx+sg*85} ${y-34} ${cx+sg*45} ${y-20} ${cx+sg*13} ${y+10}Z" fill="url(#gBlade)" stroke="#4f7a2c" stroke-width="1"/><path d="M${x} ${y}C${cx+sg*45} ${y-31} ${cx+sg*85} ${y-40} ${cx+sg*122} ${y-26}" fill="none" stroke="#5f8c35" stroke-width=".8"/>`};
 s+=blade(300,1)+blade(195,-1)+blade(90,1);
 [[300,352],[195,300],[90,195],[6,90]].forEach(([a,b])=>{s+=`<rect x="${cx-13}" y="${a}" width="26" height="${b-a}" fill="url(#gStem)"/>`});
 nodes.forEach(n=>{s+=`<rect x="${cx-13}" y="${n-34}" width="26" height="29" fill="url(#gMeriV)"/>`;for(let y=n-33;y<n-6;y+=3.2)s+=`<path d="M${cx-12} ${F(y)}H${cx+12}" stroke="#4b2a78" stroke-width=".5" opacity="${F(.55*(1-(n-6-y)/28))}"/>`});
 nodes.forEach(n=>{s+=`<rect x="${cx-16}" y="${n-5}" width="32" height="11" rx="5" fill="#5f8838"/><rect x="${cx-13}" y="${n-4}" width="10" height="3" rx="1.5" fill="#a5cc74" opacity=".6"/>`});
 nodes.forEach((n,k)=>{const sg=k%2?-1:1;s+=`<path d="M${cx-17} ${n}L${cx-16} ${n-72}Q${cx} ${n-80} ${cx+16} ${n-72}L${cx+17} ${n}Z" fill="url(#gSheath)" opacity=".6" stroke="#4f7a2c" stroke-width=".9"/><path d="M${cx+sg*3} ${n-2}L${cx+sg*5} ${n-74}" stroke="#4f7a2c" stroke-width=".8" opacity=".7"/>`});
 s+=`<path d="M${cx-30} 296V236" stroke="#7a4fa3" stroke-width="2.2" marker-end="url(#mV)"/>`+mtext(cx-36,268,'ріст','end');
 s+=lab(cx-12,282,98,334,'інтеркалярна\nмеристема','end')+lab(cx-16,195,98,214,'вузол','end')+lab(cx-17,160,98,160,'листкова\nпіхва','end');
 const ix=330,iy=20,iw=220,ih=310;
 s+=`<rect x="${cx-19}" y="${195-38}" width="38" height="46" rx="6" fill="none" stroke="#7a4fa3" stroke-width="1.4" stroke-dasharray="4 3"/><path d="M${cx+19} ${195-38}L${ix} ${iy}M${cx+19} ${195+8}L${ix} ${iy+ih}" stroke="#7a4fa3" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`;
 const Dm=u=>u<=50?u:u<=120?50+.75*(u-50):102.5+.75*(u-120)+.035*(u-120)*(u-120);
 const gp=[];for(let i=0;i<21;i++)for(let j=0;j<19;j++)gp.push([5+i*10.5+(R()-.5)*2.4,j*10.5+(R()-.5)*2.4,10.5]);
 const gc=power(gp,-6,-6,iw+6,200);
 s+=`<defs><clipPath id="cIns"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="12"/></clipPath></defs><g clip-path="url(#cIns)"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="#8a9e66"/>`;
 gc.forEach((c,i)=>{if(!c)return;const D=Dm(gp[i][1]);const m=clean(c.map(v=>[ix+v[0],iy+ih-Dm(v[1])]),.4);if(m.length<3)return;let wall,fill,nr=2;if(D<50){wall='#7f9a5c';fill='#dfe9c8'}else if(D<104){wall='#7652a0';fill='#dcc6ef';nr=2.8}else{const t=clamp((D-104)/150,0,1);wall=mix('#86789f','#8a9e66',t);fill=mix('#ece4f4','#f1f4e4',t)}
  const[s0,q]=cellPair(m,wall,fill,1,.3);s+=s0;if(q){const cc=cen(q);let y0=1e9,y1=-1e9;q.forEach(v=>{y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1])});if(D>=104)s+=`<ellipse cx="${F(cc[0])}" cy="${F(cc[1])}" rx="2.6" ry="${F((y1-y0)*.35)}" fill="#fdfefb" opacity=".75"/>`;s+=nuc(cc[0],D>=104?y0+nr+2:cc[1],nr,nr*.9,0)}});
 s+=`</g><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="12" fill="none" stroke="#7a4fa3" stroke-width="1.2"/>`;
 s+=brace(556,iy+4,iy+ih-110,'клітини\nміжвузля\nрозтягуються')+brace(556,iy+ih-104,iy+ih-52,'зона поділу')+brace(556,iy+ih-48,iy+ih-2,'вузол');
 return s}

function figWound(){const R=mul(9),W=450,H=320,N=[[120,-10],[225,205],[330,-10]];
 const inN=(x,y)=>pip([x,y],N),dN=p=>Math.min(segD(p,N[0],N[1]),segD(p,N[1],N[2]));
 const pts=poisson(R,-25,-25,W+50,H+50,(x,y)=>inN(x,y)?0:27*(.9+R()*.2),24,30,7000);
 const cells=power(pts,-25,-25,W+25,H+25);
 let s=`<defs><clipPath id="cWd"><path clip-rule="evenodd" d="M0 0H${W}V${H}H0Z M120 -10L225 205L330 -10Z"/></clipPath><clipPath id="cWf"><rect width="${W}" height="${H}" rx="14"/></clipPath></defs><g clip-path="url(#cWf)"><rect width="${W}" height="${H}" fill="#fbf8ef"/><g clip-path="url(#cWd)"><rect width="${W}" height="${H}" fill="#7d9d59"/>`;
 cells.forEach((c,i)=>{if(!c)return;const d=dN(pts[i]);
  if(d<13){const w=shrink(c,2.5).map(v=>[v[0]+(R()-.5)*3,v[1]+(R()-.5)*3]);s+=`<path d="${P(c)}" fill="#cdb48e"/><path d="${smooth(scl(w,.8),.4)}" fill="#8b5e3c" stroke="#5a3a22" stroke-width="1"/>`;return}
  const sub=d<27;const[s0,q]=cellPair(c,sub?'#a0703f':'#7d9d59',sub?'#ecd7ae':'#e5efcf',sub?1.6:1.2,.38);s+=s0;
  if(q){const cc=cen(q),rr=Math.sqrt(Math.abs(area(q))/Math.PI);if(!sub)along(shrink(q,1.6),7,R,(x,y,a)=>{s+=chl(x,y,a,.6)});s+=`<circle cx="${F(cc[0]+(R()-.5)*rr*.5)}" cy="${F(cc[1]+(R()-.5)*rr*.5)}" r="${F(rr*.2)}" fill="#6a3d98" opacity=".7"/>`}});
 s+='</g>';
 const cal=[];for(let t=0;t<4000;t++){const x=120+R()*210,y=40+R()*165;if(!inN(x,y))continue;const d=dN([x,y]),r=8+R()*6;if(d>72||d<r*.55)continue;if(cal.every(q=>Math.hypot(q[0]-x,q[1]-y)>q[2]+r-1.5))cal.push([x,y,r])}
 cal.forEach(([x,y,r])=>{s+=`<path d="${blob(x,y,r,R)}" fill="url(#gCal)" stroke="#b89a5c" stroke-width="1.1"/><circle cx="${F(x+(R()-.5)*r*.4)}" cy="${F(y+(R()-.5)*r*.4)}" r="${F(r*.22)}" fill="#7a4fa3" opacity=".75"/>`;if(R()<.15){const a=R()*Math.PI;s+=`<path d="M${F(x-Math.cos(a)*r*.85)} ${F(y-Math.sin(a)*r*.85)}L${F(x+Math.cos(a)*r*.85)} ${F(y+Math.sin(a)*r*.85)}" stroke="#b89a5c" stroke-width="1"/>`}});
 s+='</g>';
 s+=lab(225,26,462,30,'місце поранення')+lab(293,80,462,80,'відмерлі клітини')+lab(312,100,462,132,'раньова перидерма\n(опробковіння)')+lab(225,168,462,196,'калюс — продукт\nраньової меристеми')+lab(400,270,462,270,'здорова паренхіма');
 return s}

/* ===== 2. ПОКРИВНІ ===== */
function figEpi(){const R=mul(13);
 const st=[[95,85,.5],[245,125,-.35],[125,245,.2],[282,262,-.6]];
 const pts=poisson(R,-30,-30,400,390,(x,y)=>st.some(q=>Math.hypot(q[0]-x,q[1]-y)<31)?0:48*(.88+R()*.24),24,54,5000,st.map(q=>[q[0],q[1],34,'st',q[2]]));
 const cells=power(pts,-30,-30,370,360);
 const sK=new Set();cells.forEach((c,i)=>{if(c&&pts[i][3]==='st')for(let j=0;j<c.length;j++)sK.add(edgeKey(c[j],c[(j+1)%c.length]))});
 let s=`<defs><clipPath id="cEpS"><rect x="10" y="10" width="330" height="320" rx="14"/></clipPath><clipPath id="cEpX"><rect x="360" y="10" width="350" height="320" rx="14"/></clipPath></defs><g clip-path="url(#cEpS)"><rect x="10" y="10" width="330" height="320" fill="#f2f6e6"/>`;
 cells.forEach((c,i)=>{if(c&&pts[i][3]!=='st')s+=`<path d="${P(c)}" fill="${mix('#f5f8ec','#e8efd6',R())}"/>`});
 let wd='';edges(cells,(a,b,ci,k)=>{if(!sK.has(k))wd+=wavy(a,b,3)});s+=`<path d="${wd}" fill="none" stroke="#5c7d3c" stroke-width="1.5" stroke-linejoin="round"/>`;
 let stc=null;
 cells.forEach((c,i)=>{if(!c||pts[i][3]!=='st')return;const p=clean(c),cc=cen(p),rr=Math.sqrt(Math.abs(area(p))/Math.PI),an=pts[i][4],u=[Math.cos(an),Math.sin(an)],v=[-u[1],u[0]],Q=(a,b)=>[cc[0]+u[0]*a+v[0]*b,cc[1]+u[1]*a+v[1]*b];if(i===1)stc=[cc,rr];
  const pl=rr*.62,pw=rr*.2;
  s+=`<path d="${smooth(p,.5)}" fill="#a7cf78" stroke="#47702c" stroke-width="1.5"/>`;
  s+=`<path d="M${PT(Q(-pl*1.12,0))}Q${PT(Q(0,-pw*3.2))} ${PT(Q(pl*1.12,0))}Q${PT(Q(0,pw*3.2))} ${PT(Q(-pl*1.12,0))}Z" fill="#6e9c45"/><path d="M${PT(Q(-pl,0))}Q${PT(Q(0,-pw*2))} ${PT(Q(pl,0))}Q${PT(Q(0,pw*2))} ${PT(Q(-pl,0))}Z" fill="#26331d"/><path d="M${PT(Q(-pl*1.1,0))}L${PT(Q(-rr*1.02,0))}M${PT(Q(pl*1.1,0))}L${PT(Q(rr*1.02,0))}" stroke="#47702c" stroke-width="1.2"/>`;
  for(let k=0;k<10;k++){const q=Q((R()-.5)*1.4*rr,(k%2?1:-1)*rr*(.42+R()*.18));s+=`<circle cx="${F(q[0])}" cy="${F(q[1])}" r="1.6" fill="#3f7d2a"/>`}});
 s+='</g>';
 if(stc)s+=lab(stc[0][0]+stc[1]*.3,stc[0][1]-stc[1]*.2,300,40,'продих');
 s+=lab(196,196,190,300,'клітини епідерми\n(звивисті стінки)');
 // поперечний зріз
 const xs=540,top=60;s+=`<g clip-path="url(#cEpX)"><rect x="360" y="10" width="350" height="320" fill="#fafcf3"/>`;
 const mp=poisson(R,350,108,370,240,(x,y)=>Math.hypot(x-xs,y-128)<36?0:30*(.9+R()*.2),27,33,5000);
 power(mp,350,104,720,345).forEach(c=>{if(!c)return;const q=inset(c,4.2);if(!q)return;const qq=clean(q);if(qq.length<3)return;s+=`<path d="${smooth(qq,.5)}" fill="#e3eecf" stroke="#6f9150" stroke-width="1.1"/>`;along(shrink(qq,3),8.5,R,(x,y,a)=>{s+=chl(x,y,a,.85)})});
 let x=360-R()*20;const ep=[];while(x<715){const w=34+R()*16;if(x+w>xs-27&&x<xs+27){if(xs-27-x>8)ep.push([x,xs-27-x]);x=xs+27;continue}ep.push([x,w]);x+=w}
 ep.forEach(([x0,w])=>{s+=`<rect x="${F(x0)}" y="${top}" width="${F(w)}" height="44" rx="4" fill="#6f8f4f"/><rect x="${F(x0+1.2)}" y="${top+4.5}" width="${F(w-2.4)}" height="37.5" rx="5" fill="#f3f6e6"/>`+nuc(x0+w*(.3+R()*.4),top+33,4,2.8,0)});
 [-1,1].forEach(sg=>{const gx=xs+sg*13.5,gy=top+14;s+=`<ellipse cx="${gx}" cy="${gy}" rx="12.5" ry="11.5" fill="#47702c"/><ellipse cx="${F(gx+sg*2.6)}" cy="${F(gy+.5)}" rx="8.6" ry="8.4" fill="#bfe08f"/>`;for(let k=0;k<5;k++)s+=`<circle cx="${F(gx+sg*2.6+(R()-.5)*9)}" cy="${F(gy+(R()-.5)*9)}" r="1.7" fill="#3f7d2a"/>`});
 s+=`<rect x="360" y="${top-5}" width="${xs-5-360}" height="6" fill="#e2b54a"/><rect x="${xs+5}" y="${top-5}" width="${710-xs-5}" height="6" fill="#e2b54a"/><path d="M${xs-5} ${top-5}L${xs-1} ${top+3}L${xs-7} ${top+1}ZM${xs+5} ${top-5}L${xs+1} ${top+3}L${xs+7} ${top+1}Z" fill="#e2b54a"/><path d="M360 ${top-5}H${xs-5}M${xs+5} ${top-5}H710" stroke="#b8861f" stroke-width="1"/></g>`;
 s+=`<path d="M${xs-34} 16Q${xs-8} 28 ${xs-3} ${top-9}" stroke="#2b2a26" stroke-width="1.6" fill="none" marker-end="url(#mK)"/><path d="M${xs+3} ${top-9}Q${xs+8} 28 ${xs+34} 16" stroke="#2f86d0" stroke-width="1.6" fill="none" marker-end="url(#mK)"/>`+mtext(xs-38,20,'CO₂','end')+mtext(xs+38,20,'H₂O, O₂');
 s+=lab(700,top-2,722,30,'кутикула')+lab(682,top+22,722,72,'клітина\nепідерми')+lab(xs+18,top+12,722,118,'замикаючі\nклітини')+lab(xs+8,128,722,172,'підпродихова\nпорожнина')+lab(655,250,722,250,'мезофіл')+ttl(175,352,'Вигляд з поверхні')+ttl(535,352,'Поперечний зріз');
 return s}

function figPeri(){const R=mul(17),W=520,H=380,yS=70,x0=265,hw=78;
 const b=x=>Math.abs(x-x0)<hw?.5*(1+Math.cos(Math.PI*(x-x0)/hw)):0,yPg=x=>200+44*b(x);
 const top=[];for(let x=-5;x<=W+5;x+=4)top.push([x,yPg(x)+30]);
 let s=`<defs><clipPath id="cPe"><rect width="${W}" height="${H}" rx="14"/></clipPath><clipPath id="cPeC"><path d="${P([...top,[W+5,H+5],[-5,H+5]])}"/></clipPath></defs><g clip-path="url(#cPe)"><rect width="${W}" height="${H}" fill="#f8f4ea"/>`;
 const cp=poisson(R,-20,200,W+40,H-180,(x,y)=>y<yPg(x)+36?0:30*(.88+R()*.24),26,34,5000);
 let co='';power(cp,-20,190,W+20,H+20).forEach(c=>{if(!c)return;const[s0,q]=cellPair(c,'#7d9d59','#e5efcf',1.2,.38);co+=s0;if(q){along(shrink(q,1.6),7.5,R,(x,y,a)=>{co+=chl(x,y,a,.62)});if(R()<.5){const m=cen(q);co+=`<circle cx="${F(m[0])}" cy="${F(m[1])}" r="2.6" fill="#6a3d98" opacity=".7"/>`}}});
 s+=`<g clip-path="url(#cPeC)"><rect x="0" y="200" width="${W}" height="${H}" fill="#7d9d59"/>${co}</g>`;
 const cols=[];let x=-8;while(x<W+8){const w=17+R()*6;cols.push([x,x+w]);x+=w}
 cols.forEach(([xa,xb])=>{const bm=b((xa+xb)/2);
  for(let k=0;k<2;k++){const p=[[xa,yPg(xa)+8+k*11],[xb,yPg(xb)+8+k*11],[xb,yPg(xb)+19+k*11],[xa,yPg(xa)+19+k*11]];const[s0,q]=cellPair(p,'#7d9d59','#dfeac6',1,.35);s+=s0;if(q)along(shrink(q,1.5),6,R,(x,y,a)=>{s+=chl(x,y,a,.55)})}
  {const p=[[xa,yPg(xa)],[xb,yPg(xb)],[xb,yPg(xb)+8],[xa,yPg(xa)+8]];const[s0,q]=cellPair(p,'#6c4797','#dfcff2',.7,.3);s+=s0;if(q){const m=cen(q);s+=`<ellipse cx="${F(m[0])}" cy="${F(m[1])}" rx="3" ry="1.6" fill="#5e3590" opacity=".8"/>`}}
  if(bm<.07){const tY=yS+(bm>0?bm*420:0)+(R()-.5)*2;let yl=yPg(xa),yr=yPg(xb),first=true;let y=Math.min(yl,yr);while(y>tY+3){let h=8.5+R()*3.5;if(y-h<tY+4)h=y-tY;const yt=y-h;const p=[[xa,yt],[xb,yt],[xb,first?yr:y],[xa,first?yl:y]];const[s0]=cellPair(p,'#6b4223',mix('#ecd3ae','#c99d6c',R()),1.15,.25);s+=s0;y=yt;first=false}}});
 s+=`<path d="${wavy([-8,yS-1],[x0-hw-4,yS-1],1.2)}" stroke="#7a5535" stroke-width="3.4" fill="none"/><path d="${wavy([x0+hw+4,yS-1],[W+8,yS-1],1.2)}" stroke="#7a5535" stroke-width="3.4" fill="none"/><path d="M${x0-hw-4} ${yS-1}q6 -8 2 -16M${x0+hw+4} ${yS-1}q-6 -8 -2 -16" stroke="#7a5535" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
 const fl=[];for(let t=0;t<5000;t++){const x=x0-hw+R()*2*hw,bb=b(x);if(bb<.04)continue;const yt=yS-34*bb+6,yb=yPg(x)-2,y=yt+R()*(yb-yt),r=5.5+R()*3;if(y-r<yt-4||y+r>yb+2)continue;if(fl.every(q=>Math.hypot(q[0]-x,q[1]-y)>q[2]+r+1.2))fl.push([x,y,r])}
 fl.forEach(([x,y,r])=>{s+=`<path d="${blob(x,y,r,R)}" fill="#ecdcb9" stroke="#a07a4a" stroke-width="1"/>`});
 s+=`</g><path d="M${x0-30} 6Q${x0-26} 30 ${x0-16} 62" stroke="#2f86d0" stroke-width="1.8" fill="none" marker-end="url(#mK)"/><path d="M${x0+16} 62Q${x0+26} 30 ${x0+30} 6" stroke="#2b2a26" stroke-width="1.8" fill="none" marker-end="url(#mK)"/>`+mtext(x0-36,18,'O₂','end')+mtext(x0+36,18,'CO₂, H₂O');
 s+=lab(470,135,532,112,'корок (фелема):\nмертві клітини,\nстінки із суберином')+lab(470,yPg(470)+4,532,196,'фелоген\n(корковий камбій)')+lab(470,yPg(470)+19,532,238,'фелодерма')+lab(470,310,532,300,'паренхіма кори')+lab(x0+30,yS+22,532,48,'сочевичка:\nвиповнювальна тканина');
 return s}

function figBark(){const R=mul(23),cx=240,cy=100,rx=195,ry=58,yb=318;
 const gaps=[];let ph=-Math.PI/2+.03+R()*.05;while(ph<Math.PI/2-.04){gaps.push(ph);ph+=.13+R()*.13}
 const back=[];for(let k=0;k<26;k++)back.push(Math.PI/2+R()*Math.PI);
 const fx=(p,f)=>cx+rx*(f||1)*Math.sin(p),tY=p=>cy+ry*Math.cos(p),bY=p=>yb+ry*Math.cos(p);
 const side=[];for(let p=-Math.PI/2;p<=Math.PI/2+1e-9;p+=.02)side.push([fx(p),tY(p)]);for(let p=Math.PI/2;p>=-Math.PI/2-1e-9;p-=.02)side.push([fx(p),bY(p)]);
 let s=`<defs><clipPath id="cBk"><path d="${P(side)}"/></clipPath><linearGradient id="gCyl" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".28" stop-color="#000" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".78" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient></defs>`;
 s+=`<g clip-path="url(#cBk)"><path d="${P(side)}" fill="#2a1d15"/>`;
 const pal=['#7d6450','#866c56','#6f5846','#937a62','#7a604b'],all=[-Math.PI/2-.2,...gaps,Math.PI/2+.2];
 for(let i=0;i<all.length-1;i++){const pa=all[i]+.018,pb=all[i+1]-.018,Ls=[],Rs=[];for(let k=0;k<=14;k++){const u=k/14,ja=pa+(R()-.5)*.016,jb=pb+(R()-.5)*.016;Ls.push([fx(ja),lerp(tY(ja),bY(ja),u)]);Rs.push([fx(jb),lerp(tY(jb),bY(jb),u)])}
  s+=`<path d="${P([...Ls,...Rs.reverse()])}" fill="${pal[Math.floor(R()*pal.length)]}"/>`;
  for(let k=0;k<3;k++){const pm=lerp(pa,pb,.2+R()*.6);s+=`<path d="M${F(fx(pm))} ${F(tY(pm)+R()*40)}V${F(bY(pm)-R()*40)}" stroke="#a48a70" stroke-width=".7" opacity=".5"/>`}
  const nc=1+Math.floor(R()*3);for(let k=0;k<nc;k++){const u=.1+R()*.8;s+=`<path d="M${F(fx(pa+.01))} ${F(lerp(tY(pa),bY(pa),u))}L${F(fx(pb-.01))} ${F(lerp(tY(pb),bY(pb),u)+(R()-.5)*6)}" stroke="#3a2a1f" stroke-width="1.6"/>`}}
 s+=`<rect x="${cx-rx}" y="0" width="${2*rx}" height="400" fill="url(#gCyl)"/></g>`;
 const allG=[...gaps,...back],w1=R()*TAU,w2=R()*TAU;
 const notch=t=>{let n=0;for(const g of allG){let d=Math.abs(((t-g)%TAU+TAU)%TAU);d=Math.min(d,TAU-d);n+=Math.exp(-Math.pow(d/.032,2))}return Math.min(1,n)*.075};
 const ell=(f,wob,nk,ph0)=>{const o=[];for(let t=0;t<TAU;t+=.02){const k=f*(1+wob*(.012*Math.sin(3*t+w1+(ph0||0))+.008*Math.sin(7*t+w2)))-nk*notch(t);o.push([cx+rx*k*Math.sin(t),cy+ry*k*Math.cos(t)])}return P(o)};
 s+=`<path d="${ell(1,1,1)}" fill="#5a4232"/>`;
 [[.975,'#6f533f'],[.945,'#5f4735'],[.915,'#735742'],[.885,'#604836']].forEach(([f,c],i)=>{s+=`<path d="${ell(f,1.6,.7,i)}" fill="${c}" stroke="#3a2a1f" stroke-width=".8"/>`});
 s+=`<path d="${ell(.862,1,.15)}" fill="#b8875e"/><path d="${ell(.843,1,0)}" fill="#86b25a"/><path d="${ell(.836,1,0)}" fill="url(#gWood)"/><path d="${ell(.47,1.4,0,1)}" fill="#c99a5f" opacity=".85"/>`;
 let rg='';for(let f=.06;f<.83;f+=.052+R()*.012)rg+=`<path d="${ell(f,1.5,0,f*9)}" fill="none" stroke="${f<.47?'#8f6638':'#b98f55'}" stroke-width="1" opacity=".75"/>`;s+=rg;
 for(let k=0;k<36;k++){const t=k/36*TAU+R()*.05;s+=`<path d="M${F(cx+rx*.05*Math.sin(t))} ${F(cy+ry*.05*Math.cos(t))}L${F(cx+rx*.83*Math.sin(t))} ${F(cy+ry*.83*Math.cos(t))}" stroke="#e6cc9c" stroke-width=".6" opacity=".7"/>`}
 s+=`<ellipse cx="${cx}" cy="${cy}" rx="5" ry="2" fill="#7a5530"/>`;
 const pt=(f,t)=>[cx+rx*f*Math.sin(t),cy+ry*f*Math.cos(t)];
 const a=pt(.93,1.05),b=pt(.852,1.3),c=pt(.84,1.48),d=pt(.62,1.57),e=[fx(1.12),250];
 s+=lab(a[0],a[1],470,46,'шари перидерми')+lab(b[0],b[1],470,84,'живий луб')+lab(c[0],c[1],470,118,'камбій')+lab(d[0],d[1],470,154,'деревина\n(річні кільця)')+lab(e[0],e[1],470,262,'кірка (ритидом):\nвідмерлі шари\nперидерми та лубу');
 return s}

/* ===== 3. ОСНОВНІ ===== */
function figLeaf(){const R=mul(29),W=540;let s=`<defs><clipPath id="cLf"><rect x="0" y="20" width="${W}" height="314" rx="12"/></clipPath></defs>`;
 for(let k=0;k<4;k++){const x=70+k*120;s+=`<path d="M${x} 0L${x+8} 16" stroke="#e8b923" stroke-width="2.4" marker-end="url(#mG)"/>`}s+=mtext(560,10,'світло');
 s+=`<g clip-path="url(#cLf)"><rect x="0" y="20" width="${W}" height="314" fill="#fbfcf4"/>`;
 const sp=poisson(R,-20,172,W+40,124,(x,y)=>Math.hypot(x-175,y-232)<44||Math.hypot(x-420,y-284)<24?0:29*(.88+R()*.24),25,33,6000);
 const sc=power(sp,-20,166,W+20,300);let gap=null;
 sc.forEach(c=>{if(!c)return;if(!gap){const v=c.find(v=>Math.abs(v[0]-462)<16&&Math.abs(v[1]-255)<14);if(v)gap=v}const q=inset(c,5.5);if(!q)return;const qq=clean(q);if(qq.length<3)return;s+=`<path d="${smooth(qq,.5)}" fill="#e3eecf" stroke="#6f9150" stroke-width="1.1"/>`;along(shrink(qq,3),10,R,(x,y,a)=>{s+=chl(x,y,a,.9)});if(R()<.4){const m=cen(qq);s+=`<circle cx="${F(m[0])}" cy="${F(m[1])}" r="2.4" fill="#6a3d98" opacity=".6"/>`}});
 let x=-6;while(x<W){const w=20+R()*5,y0=58+R()*3,y1=166-R()*3,p=[[x+1.3,y0],[x+w-1.3,y0],[x+w-1.3,y1],[x+1.3,y1]];s+=`<rect x="${F(x+1.3)}" y="${F(y0)}" width="${F(w-2.6)}" height="${F(y1-y0)}" rx="9" fill="#e2eecb" stroke="#6f9150" stroke-width="1.2"/>`;along(shrink(p,4.2),8.2,R,(px,py,a)=>{s+=chl(px,py,a,.95)});s+=`<ellipse cx="${F(x+w/2)}" cy="${F(lerp(y0+14,y1-14,R()))}" rx="3.2" ry="4" fill="url(#gNuc)"/>`;x+=w+2.4}
 const ep=(y0,h,skip)=>{let x=-10,o='';while(x<W+10){const w=28+R()*16;if(skip&&x+w>skip-24&&x<skip+24){if(skip-24-x>8)o+=`<rect x="${F(x)}" y="${y0}" width="${F(skip-24-x)}" height="${h}" rx="4" fill="#6f8f4f"/><rect x="${F(x+1.2)}" y="${y0+1.6}" width="${F(skip-24-x-2.4)}" height="${h-3.2}" rx="4" fill="#f3f6e6"/>`;x=skip+24;continue}o+=`<rect x="${F(x)}" y="${y0}" width="${F(w)}" height="${h}" rx="4" fill="#6f8f4f"/><rect x="${F(x+1.2)}" y="${y0+(y0<100?3:1.6)}" width="${F(w-2.4)}" height="${h-4.6}" rx="4" fill="#f3f6e6"/>`;x+=w}return o};
 s+=ep(28,28)+ep(300,26,420);
 [-1,1].forEach(sg=>{s+=`<ellipse cx="${420+sg*11}" cy="312" rx="10.5" ry="9.5" fill="#47702c"/><ellipse cx="${420+sg*12.5}" cy="312" rx="7" ry="7" fill="#bfe08f"/><circle cx="${420+sg*12}" cy="310" r="1.6" fill="#3f7d2a"/><circle cx="${420+sg*13}" cy="315" r="1.6" fill="#3f7d2a"/>`});
 s+=`<rect x="0" y="23" width="${W}" height="5" fill="#e2b54a"/><rect x="0" y="326" width="${W}" height="4" fill="#e2b54a"/>`;
 const vc=[175,232];s+=ring(vc,30,42,10,R,'#6f9150','#edf3dc',1,(q,cc)=>chl(cc[0],cc[1],R()*3,.8))+`<circle cx="175" cy="232" r="30" fill="#f6ece7"/>`;
 [[163,220,5.5],[175,214,6],[187,220,5.5],[169,230,4],[181,230,4]].forEach(([a,b,r])=>{s+=`<circle cx="${a}" cy="${b}" r="${r}" fill="#fff7f3" stroke="#a8232f" stroke-width="2"/>`});
 for(let k=0;k<9;k++){const a=Math.PI*.15+k/8*Math.PI*.7,p=pol(vc,12+(k%2)*7,a);s+=`<circle cx="${F(p[0])}" cy="${F(p[1])}" r="${k%3?3.4:2}" fill="${k%3?'#dbe8f7':'#8eaedb'}" stroke="#3d6aa8" stroke-width="1"/>`}
 s+='</g>';
 s+=`<path d="M420 362V322" stroke="#2b2a26" stroke-width="1.6" marker-end="url(#mK)"/>`+mtext(428,356,'CO₂');
 s+=lab(520,25,552,30,'кутикула')+lab(505,44,552,58,'верхня епідерма')+lab(510,112,552,104,'стовпчаста\n(палісадна) хлоренхіма')+lab(505,198,552,186,'губчаста хлоренхіма')+(gap?lab(gap[0],gap[1],552,262,'міжклітинники'):'')+lab(217,226,552,226,'провідний пучок (жилка)')+lab(432,312,552,296,'продих')+lab(500,318,552,330,'нижня епідерма');
 return s}

function figStarch(){const R=mul(33),W=560,H=320;
 const pts=poisson(R,-40,-40,W+80,H+80,()=>92*(.88+R()*.24),80,104,3000);
 const cells=power(pts,-40,-40,W+40,H+40);let s=`<defs><clipPath id="cSt"><rect width="${W}" height="${H}" rx="14"/></clipPath></defs><g clip-path="url(#cSt)"><rect width="${W}" height="${H}" fill="#bda679"/>`;let g1=null,n1=null,w1=null;
 cells.forEach((c,ci)=>{if(!c)return;const q=inset(c,1.3);if(!q)return;const qq=clean(q);s+=`<path class="cyt" d="${smooth(qq,.3)}" fill="#fbf5e4"/>`;
  const inner=inset(c,6)||qq;const A=Math.abs(area(inner)),n=Math.round(A/620);const gr=[];{const v=inner[Math.floor(R()*inner.length)],m=cen(inner);gr.push([lerp(v[0],m[0],.3),lerp(v[1],m[1],.3),7,1])}let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;inner.forEach(v=>{x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1])});
  for(let t=0;t<300&&gr.length<n+1;t++){const r=5+R()*8,x=lerp(x0,x1,R()),y=lerp(y0,y1,R());if(!pip([x,y],inner))continue;if(inner.some((v,k)=>segD([x,y],v,inner[(k+1)%inner.length])<r))continue;if(gr.every(g=>Math.hypot(g[0]-x,g[1]-y)>g[2]+r+1.5))gr.push([x,y,r])}
  gr.forEach(([x,y,r,isN])=>{if(isN){s+=nuc(x,y,5.5,4.4,R()*180);if(!n1&&x>60&&x<220&&y>60&&y<220)n1=[x,y];return}const a=R()*180,ry=r*.8,h=r*.45;let o=`<g transform="translate(${F(x)} ${F(y)}) rotate(${F(a)})"><ellipse class="sg sgr" rx="${F(r)}" ry="${F(ry)}" stroke-width="1"/>`;for(let k=1;k<=4;k++){const f=1-k*.2;o+=`<ellipse class="sgr" cx="${F(h*(1-f))}" rx="${F(r*f)}" ry="${F(ry*f)}" fill="none" stroke-width=".6"/>`}o+=`<circle class="hil" cx="${F(h*.92)}" r="1.1"/></g>`;s+=o;if(!g1&&x>200&&x<330&&y>110&&y<210)g1=[x,y,r]});
  if(!w1){const v=c.find(v=>v[0]>400&&v[0]<530&&v[1]>200&&v[1]<290);if(v)w1=v}});
 s+='</g>';
 if(g1)s+=lab(g1[0]+g1[2]*.5,g1[1],548,30,'крохмальне зерно: шари\nнавколо утворювального центру','end');
 if(n1)s+=lab(n1[0],n1[1],n1[0]+34,n1[1]-34,'ядро');
 if(w1)s+=lab(w1[0],w1[1],w1[0]-50,302,'тонка целюлозна стінка','end');
 return s}

function figAer(){const R=mul(37);let s=`<defs><clipPath id="cWa"><rect x="10" y="10" width="320" height="310" rx="14"/></clipPath><clipPath id="cAn"><path clip-rule="evenodd" d="${P(sector([530,165],0,131,0,TAU,120).slice(0,121))}${P(sector([530,165],0,49,0,TAU,120).slice(0,121))}"/></clipPath></defs>`;
 s+=`<g clip-path="url(#cWa)"><rect x="10" y="10" width="320" height="310" fill="#86a07a"/>`;
 const wp=poisson(R,-40,-40,420,400,()=>95*(.88+R()*.24),83,108,3000);let vl=null,cy=null;
 power(wp,-40,-40,380,370).forEach(c=>{if(!c)return;const q1=inset(c,1.3);if(!q1)return;const a=clean(q1);s+=`<path d="${smooth(a,.3)}" fill="#d7e8c2"/>`;const q2=inset(c,5.5);if(q2){const b=clean(q2);s+=`<path d="${smooth(b,.35)}" fill="url(#gVac)" stroke="#9dc0d6" stroke-width=".8"/>`;const m=cen(b);if(!vl&&m[0]>110&&m[0]<240&&m[1]>90&&m[1]<230)vl=m}along(shrink(a,2.2),24,R,(x,y,an)=>{s+=chl(x,y,an,.8)});const v=a[Math.floor(R()*a.length)],m=cen(a),np=[lerp(v[0],m[0],.12),lerp(v[1],m[1],.12)];s+=nuc(np[0],np[1],4,2.6,R()*180);if(!cy&&m[0]>150&&m[0]<300&&m[1]>190&&m[1]<300){const pv=[lerp(m[0],a[0][0],.9),lerp(m[1],a[0][1],.9)];if(pv[0]>20&&pv[0]<320&&pv[1]>20&&pv[1]<300)cy=pv}});
 s+='</g>';
 if(vl)s+=lab(vl[0],vl[1],vl[0]+10,40,'велика вакуоля\n(вода, слиз)');
 if(cy)s+=lab(cy[0],cy[1],cy[0]-40,292,'тонкий постінний\nшар цитоплазми','end');
 const C=[530,165];
 s+=`<circle cx="${C[0]}" cy="${C[1]}" r="149" fill="#6f9150"/>`;
 s+=ring(C,140,148,9,R,'#6d8a48','#f2f6e6',.9)+ring(C,131,140,9,R,'#6f9150','#e3eecf',.9);
 const lp=poisson(R,C[0]-140,C[1]-140,280,280,(x,y)=>{const r=Math.hypot(x-C[0],y-C[1]);return r>58&&r<122?38*(.9+R()*.2):0},34,42,4000);
 const lc=power(lp,C[0]-150,C[1]-150,C[0]+150,C[1]+150);let la=null,be=null;
 let a=`<g clip-path="url(#cAn)"><circle cx="${C[0]}" cy="${C[1]}" r="132" fill="#d4e5bd"/>`;
 lc.forEach(c=>{if(!c)return;const q=inset(c,4.6);if(!q)return;const qq=clean(q);a+=`<path d="${smooth(qq,.35)}" fill="#f6fafc"/>`;const m=cen(qq);if(!la&&m[0]>C[0]+30&&Math.abs(m[1]-C[1])<50)la=m});
 let beads='';const bead=(a1,b1)=>{const L=Math.hypot(b1[0]-a1[0],b1[1]-a1[1]),n=Math.max(1,Math.round(L/11)),an=Math.atan2(b1[1]-a1[1],b1[0]-a1[0])*57.2958;for(let j=0;j<n;j++){const t=(j+.5)/n,x=lerp(a1[0],b1[0],t),y=lerp(a1[1],b1[1],t);beads+=`<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(Math.max(2.5,L/n/2-.4))}" ry="4.5" transform="rotate(${F(an)} ${F(x)} ${F(y)})" fill="#e4eed2" stroke="#6f9150" stroke-width=".9"/>`}};
 edges(lc,(p,q)=>{const r1=Math.hypot(p[0]-C[0],p[1]-C[1]),r2=Math.hypot(q[0]-C[0],q[1]-C[1]);if(Math.max(r1,r2)<46||Math.min(r1,r2)>134)return;bead(p,q);if(!be&&(p[0]+q[0])/2<C[0]-40)be=[(p[0]+q[0])/2,(p[1]+q[1])/2]});
 for(const rr of[52,127]){const N=Math.round(TAU*rr/11);for(let k=0;k<N;k++)bead(pol(C,rr,k/N*TAU),pol(C,rr,(k+1)/N*TAU))}
 a+=beads+'</g>';s+=a;
 s+=ring(C,44,50,8,R,'#a88b4a','#f4e9c8',.8);
 const sp=poisson(R,C[0]-46,C[1]-46,92,92,(x,y)=>Math.hypot(x-C[0],y-C[1])<44?8.5*(.9+R()*.2):0,7.5,10,2500);
 let st='';power(sp,C[0]-46,C[1]-46,C[0]+46,C[1]+46).forEach((c,i)=>{if(!c)return;const xy=Math.hypot(sp[i][0]-C[0],sp[i][1]-C[1])<11;const[s0]=cellPair(c,xy?'#a8232f':'#b9a67a',xy?'#fff7f3':'#f1ead2',xy?1.5:.9,.35);st+=s0});
 s+=`<defs><clipPath id="cSte"><circle cx="${C[0]}" cy="${C[1]}" r="44"/></clipPath></defs><g clip-path="url(#cSte)">${st}</g>`;
 if(la)s+=lab(la[0],la[1],692,92,'повітроносні\nпорожнини');
 s+=lab(C[0]+125*Math.cos(.55),C[1]+125*Math.sin(.55),692,190,'перегородки\nз 1 шару клітин')+lab(C[0]+22,C[1]+10,692,262,'центральний\nциліндр')+ttl(170,342,'Водоносна паренхіма')+ttl(530,342,'Аеренхіма (стебло водної рослини)');
 return s}

/* ===== 4. ПРОВІДНІ ===== */
function figBundle(){const R=mul(43),E=[250,200],ex=135,ey=168,W=560,H=400;
 const inE=(x,y)=>Math.pow((x-E[0])/ex,2)+Math.pow((y-E[1])/ey,2)<1;
 const seeds=[];for(let k=-2;k<=2;k++){let y=205;while(y<350){const t=(y-205)/145,rv=lerp(16,6.5,t)+R()*2;if(R()>.2){const x=250+k*lerp(42,14,t)+(R()-.5)*4;if(inE(x,y))seeds.push([x,y,2*rv+5,'v'])}y+=2*rv+10}}
 const zone=(x,y)=>!inE(x,y)?'par':y<88?'scl':y<164?'ph':y<186?'cb':'xy';
 const pts=poisson(R,-20,-20,W+40,H+40,(x,y)=>{const z=zone(x,y);if(z==='cb')return 0;return(z==='par'?34:z==='scl'?11:z==='ph'?lerp(7,13,R()):9)*(.9+R()*.2)},6,42,26000,seeds);
 const cells=power(pts,-20,-20,W+20,H+20);
 const ST={par:['#b9a67a','#f4ecd4',1.1],scl:['#a11d2a','#f2c0b9',2.4],ph:['#3d6aa8','#dbe8f7',.9],xy:['#a8232f','#fbebe6',1.6],v:['#9c1d29','#fff8f4',2.6]};
 let s=`<defs><clipPath id="cBu"><rect width="${W}" height="${H}" rx="14"/></clipPath></defs><g clip-path="url(#cBu)"><rect width="${W}" height="${H}" fill="#b9a67a"/>`;let vlab=null;
 cells.forEach((c,i)=>{if(!c)return;const p=pts[i],z=p[3]||zone(p[0],p[1]);if(z==='cb')return;const sty=ST[z];let f=sty[1];if(z==='ph'&&Math.abs(area(c))<42)f='#9cb9e0';const[s0,q]=cellPair(c,sty[0],f,sty[2],.35);s+=s0;if(q&&(z==='par'&&R()<.4||f==='#9cb9e0')){const m=cen(q);s+=`<circle cx="${F(m[0])}" cy="${F(m[1])}" r="${z==='par'?3:2}" fill="#6a3d98" opacity=".7"/>`}if(z==='v'&&!vlab&&p[1]<240&&p[0]>260)vlab=[p[0],p[1]]});
 for(let r=0;r<3;r++){const y0=164+r*7.3;let x=100;while(x<400){const w=10+R()*4,ym=y0+3.6;if(inE(x+w/2,ym)){const[s0,q]=cellPair([[x,y0],[x+w,y0],[x+w,y0+7.3],[x,y0+7.3]],'#6c4797','#dccaf0',.7,.3);s+=s0;if(q){const m=cen(q);s+=`<ellipse cx="${F(m[0])}" cy="${F(m[1])}" rx="2.4" ry="1.4" fill="#5e3590" opacity=".8"/>`}}x+=w}}
 s+=`<ellipse cx="${E[0]}" cy="${E[1]}" rx="${ex}" ry="${ey}" fill="none" stroke="#5f5b50" stroke-width=".8" stroke-dasharray="4 3" opacity=".6"/></g>`;
 s+=lab(300,62,408,40,'склеренхіма\n(механічна обкладка)')+lab(330,128,408,112,'флоема (луб)')+lab(370,176,408,176,'камбій')+(vlab?lab(vlab[0],vlab[1],408,236,'ксилема: судини'):'')+lab(255,338,408,330,'протоксилема')+lab(470,330,470,370,'основна паренхіма','middle');
 return s}

function figXylem(){const R=mul(47),T=24,B=318;let s='';
 const tube=(cx,w)=>`<rect x="${cx-w/2}" y="${T}" width="${w}" height="${B-T}" fill="url(#gTubeR)"/><path d="M${cx-w/2} ${T}V${B}M${cx+w/2} ${T}V${B}" stroke="#b8323a" stroke-width="1.6"/><ellipse cx="${cx}" cy="${T}" rx="${w/2}" ry="5" fill="#f7dcd6" stroke="#b8323a" stroke-width="1.2"/>`;
 const arcs=(cx,w,y,front,back,sw)=>`<path d="M${cx-w/2} ${F(y)}A${w/2} 5 0 0 1 ${cx+w/2} ${F(y)}" fill="none" stroke="${back}" stroke-width="${sw*.75}"/><path d="M${cx-w/2} ${F(y)}A${w/2} 5 0 0 0 ${cx+w/2} ${F(y)}" fill="none" stroke="${front}" stroke-width="${sw}"/>`;
 // кільчаста
 s+=tube(60,40);for(let y=36;y<B;y+=22)s+=arcs(60,38,y,'#a3202c','#dc9a9e',3.6);
 // спіральна
 s+=tube(150,40);{let fr='',bk='',prev=null;for(let t=0;t<=TAU*19;t+=.12){const x=150+18.5*Math.cos(t),y=32+15*t/TAU+4.5*Math.sin(t);if(y>B-2)break;if(prev){const seg=`M${PT(prev)}L${F(x)} ${F(y)}`;if(Math.sin(t)>0)fr+=seg;else bk+=seg}prev=[x,y]}s+=`<path d="${bk}" stroke="#dc9a9e" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="${fr}" stroke="#a3202c" stroke-width="3.2" stroke-linecap="round" fill="none"/>`}
 // сітчаста
 s+=tube(243,44);{const rp=poisson(R,221,T/2.2,44,(B-T)/2.2+20,()=>11,10,12,2000),rc=power(rp,215,0,271,160);let d='';edges(rc,(a,b)=>{d+=`M${F(a[0])} ${F(a[1]*2.2)}L${F(b[0])} ${F(b[1]*2.2)}`});s+=`<defs><clipPath id="cRet"><rect x="223" y="${T}" width="40" height="${B-T}"/></clipPath></defs><path d="${d}" clip-path="url(#cRet)" stroke="#a3202c" stroke-width="3" stroke-linecap="round" fill="none"/>`}
 // пориста судина
 const pc=345,pw=60;s+=tube(pc,pw);
 for(let y=T+8,r=0;y<B-4;y+=8.5,r++){if(Math.abs(y-118)<7||Math.abs(y-222)<7)continue;for(let k=-3;k<=3;k++){const ph=(k+(r%2?.5:0))/3.6*Math.PI/2;if(Math.abs(ph)>1.45)continue;const x=pc+(pw/2-4)*Math.sin(ph),c=Math.cos(ph);s+=`<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(3.3*c+.4)}" ry="2.3" fill="#fff6f3" stroke="#a3202c" stroke-width="1"/><ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(.9*c+.2)}" ry="1.5" fill="#a3202c"/>`}}
 [118,222].forEach(y=>{s+=arcs(pc,pw,y,'#8e1a25','#d9898f',3.4)+`<path d="M${pc-pw/2-3} ${y-4}q3 4 0 8M${pc+pw/2+3} ${y-4}q-3 4 0 8" stroke="#a3202c" stroke-width="1.5" fill="none"/>`});
 s+=`<path class="flowUp" d="M${pc} ${B-4}V${T+8}" stroke="#2f86d0" stroke-width="3.6" stroke-dasharray="1 13" stroke-linecap="round"/>`;
 s+=lab(pc+pw/2-2,116,392,-16,'перфорація —\nотвір між члениками');
 // трахеїди
 const spin=(cx,y0,y1,w)=>{const h=y1-y0;let o=`<path d="M${cx} ${y0}C${cx+w/2} ${F(y0+h*.12)} ${cx+w/2} ${F(y0+h*.2)} ${cx+w/2} ${F(y0+h*.3)}L${cx+w/2} ${F(y1-h*.3)}C${cx+w/2} ${F(y1-h*.2)} ${cx+w/2} ${F(y1-h*.12)} ${cx} ${y1}C${cx-w/2} ${F(y1-h*.12)} ${cx-w/2} ${F(y1-h*.2)} ${cx-w/2} ${F(y1-h*.3)}L${cx-w/2} ${F(y0+h*.3)}C${cx-w/2} ${F(y0+h*.2)} ${cx-w/2} ${F(y0+h*.12)} ${cx} ${y0}Z" fill="url(#gTubeR)" stroke="#a3202c" stroke-width="1.6"/>`;for(let y=y0+h*.18;y<y1-h*.18;y+=13)o+=`<circle cx="${cx}" cy="${F(y)}" r="4.2" fill="#fbe6e2" stroke="#a3202c" stroke-width="1"/><circle cx="${cx}" cy="${F(y)}" r="1.5" fill="#a3202c"/>`;return o};
 s+=spin(452,T,250,26)+spin(506,T+20,B-30,26)+spin(479,96,B,26)+spin(533,110,B,26);
 s+=`<path class="flowUp" d="M612 ${B}V${T+14}" stroke="#2f86d0" stroke-width="6" stroke-dasharray="1 13" stroke-linecap="round"/><path d="M612 ${B}V${T+6}" stroke="#2f86d0" stroke-width="2" opacity=".35" marker-end="url(#mB)"/>`+ttl(612,T-8,'до листків')+ttl(612,B+18,'від коренів');
 s+=`<text class="lb" transform="rotate(-90 646 ${(T+B)/2})" x="646" y="${(T+B)/2}" text-anchor="middle">висхідний потік: вода + мінеральні солі</text>`;
 s+=ttl(60,340,'кільчаста')+ttl(150,340,'спіральна')+ttl(243,340,'сітчаста')+ttl(345,340,'пориста судина')+ttl(492,340,'трахеїди')+mtext(345,357,'(членики з перфораціями)','middle','lb sm')+mtext(492,357,'(облямовані пори)','middle','lb sm');
 return s}

function figPhloem(){const R=mul(53);let s='';
 const elem=(x,w,y0,y1)=>{let o=`<rect x="${x}" y="${y0}" width="${w}" height="${y1-y0}" rx="3" fill="url(#gTubeB)" stroke="#3d6aa8" stroke-width="1.6"/><rect x="${x+3}" y="${y0+3}" width="${w-6}" height="${y1-y0-6}" rx="2" fill="none" stroke="#a9c6e8" stroke-width="2.2"/>`;for(let k=0;k<5;k++)o+=`<circle cx="${F(x+4.5+R()*(w-9)*(k%2))}" cy="${F(lerp(y0+8,y1-8,R()))}" r="1.8" fill="#c9b6e6"/>`;return o};
 const plate=(x,w,y)=>{let o=`<rect x="${x}" y="${y-2.5}" width="${w}" height="5" fill="#3d6aa8"/>`;for(let k=1;k<7;k++){const px=x+k*w/7;o+=`<rect x="${F(px-2)}" y="${y-2.5}" width="4" height="5" fill="#eaf3fc"/><path d="M${F(px-2.6)} ${y-3}v6M${F(px+2.6)} ${y-3}v6" stroke="#e3d98f" stroke-width="1"/><path d="M${F(px)} ${y-14}V${y+14}" stroke="#9db9df" stroke-width=".8" stroke-dasharray="2 2"/>`}return o};
 const comp=(x,w,y0,y1)=>{let o=`<rect x="${x}" y="${y0}" width="${w}" height="${y1-y0}" rx="6" fill="#a9c3e6" stroke="#3d6aa8" stroke-width="1.4"/>`+nuc(x+w/2,(y0+y1)/2,5.5,12,0);for(let k=0;k<8;k++)o+=`<circle cx="${F(x+3+R()*(w-6))}" cy="${F(lerp(y0+5,y1-5,R()))}" r="1.1" fill="#4f74ad"/>`;return o};
 const par=(x,w,y0,y1)=>{let o='',y=y0;while(y<y1-10){const h=Math.min(y1-y,40+R()*16);o+=`<rect x="${x}" y="${F(y)}" width="${w}" height="${F(h-2)}" rx="7" fill="#e9f1dc" stroke="#7d9d59" stroke-width="1.2"/>`+nuc(x+w/2,y+h/2,3.5,3,0);y+=h}return o};
 const pd=(x,ys)=>ys.map(y=>`<path d="M${x-3} ${y}h6M${x-3} ${y+3}h6" stroke="#24467a" stroke-width="1"/>`).join('');
 s+=par(36,46,20,340);
 const t1=[[20,128],[128,236],[236,340]],t2=[[20,90],[90,205],[205,318],[318,340]];
 t1.forEach(([a,b])=>{s+=elem(90,54,a,b)+comp(148,20,a+3,b-3)+pd(146,[a+25,a+60,a+90])});[128,236].forEach(y=>s+=plate(90,54,y));
 t2.forEach(([a,b])=>{s+=elem(230,54,a,b);if(b-a>40)s+=comp(206,20,a+3,b-3)+pd(228,[a+22,a+55,a+85])});[90,205,318].forEach(y=>s+=plate(230,54,y));
 s+=par(288,42,20,340);
 s+=`<path class="flowDn" d="M117 24V336" stroke="#e0a21a" stroke-width="4" stroke-dasharray="1 16" stroke-linecap="round"/><path class="flowDn" d="M257 24V336" stroke="#e0a21a" stroke-width="4" stroke-dasharray="1 16" stroke-linecap="round"/>`;
 const C=[620,100];s+=`<circle cx="${C[0]}" cy="${C[1]}" r="62" fill="#3d6aa8" stroke="#24467a" stroke-width="2"/>`;for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){const x=C[0]+i*9.6+(j%2?4.8:0),y=C[1]+j*8.3;if(Math.hypot(x-C[0],y-C[1])>54)continue;s+=`<circle cx="${F(x)}" cy="${F(y)}" r="3.4" fill="#eaf3fc" stroke="#e3d98f" stroke-width="1.4"/>`}
 s+=ttl(620,182,'ситоподібна пластинка')+mtext(620,198,'(вигляд зверху)','middle','lb sm');
 s+=`<path d="M560 236V330" stroke="#e0a21a" stroke-width="6" marker-end="url(#mG)"/>`+mtext(578,268,'потік асимілятів\n(сахароза) — від\nлистків до місць\nвикористання');
 s+=lab(257,290,350,300,'ситоподібна трубка\n(членики без ядра)')+lab(284,205,350,226,'ситоподібна пластинка')+lab(216,150,350,156,'клітина-супутниця\n(ядро, густа цитоплазма)')+lab(228,110,350,104,'плазмодесми')+lab(310,46,350,46,'флоемна паренхіма');
 return s}

/* ===== 5. МЕХАНІЧНІ ===== */
function figColl(){const R=mul(59),W=560,H=320;
 const pts=poisson(R,-30,-30,W+60,H+60,()=>44*(.85+R()*.3),37,51,5000),cells=power(pts,-30,-30,W+30,H+30);
 let s=`<defs><clipPath id="cCo"><rect width="${W}" height="${H}" rx="14"/></clipPath><linearGradient id="gPearl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset="1" stop-color="#dbe3ea"/></linearGradient></defs><g clip-path="url(#cCo)"><rect width="${W}" height="${H}" fill="#c3ced8"/>`;let cc1=null,cr=null;
 cells.forEach(c=>{if(!c)return;const q=inset(c,1.6);if(!q)return;const qq=clean(q);if(qq.length<3)return;s+=`<path d="${smooth(qq,.5)}" fill="#d6e7c1"/>`;const m=cen(qq),rr=Math.sqrt(Math.abs(area(qq))/Math.PI);s+=`<path d="${smooth(scl(qq,.6),.5)}" fill="#e8f2db" opacity=".8"/>`+nuc(m[0]+(R()-.5)*rr*.5,m[1]+(R()-.5)*rr*.5,rr*.2,rr*.16,R()*180);along(shrink(qq,2.4),13,R,(x,y,a)=>{s+=chl(x,y,a,.75)});if(!cc1&&m[0]>200&&m[0]<330&&m[1]>110&&m[1]<210)cc1=[m[0],m[1]]});
 cells.forEach(c=>{if(!c)return;c.forEach(v=>{if(v[0]<-5||v[0]>W+5||v[1]<-5||v[1]>H+5)return;s+=`<circle cx="${F(v[0])}" cy="${F(v[1])}" r="8.5" fill="url(#gPearl)" stroke="#b9c5d0" stroke-width=".6"/><circle cx="${F(v[0]-2.4)}" cy="${F(v[1]-2.4)}" r="2.6" fill="#fff" opacity=".85"/>`;if(!cr&&v[0]>380&&v[1]>200&&v[1]<300)cr=v})});
 let d='';edges(cells,(a,b)=>{d+=`M${PT(a)}L${PT(b)}`});s+=`<path d="${d}" stroke="#9aa7b4" stroke-width=".7" fill="none"/></g>`;
 if(cr)s+=lab(cr[0],cr[1],cr[0]-60,300,'потовщення стінок у кутах','end');
 if(cc1)s+=lab(cc1[0],cc1[1],cc1[0]+60,30,'живий протопласт\nз хлоропластами');
 return s}

function rayHit(poly,c,d){let best=1e9;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],den=d[0]*ey-d[1]*ex;if(Math.abs(den)<1e-9)continue;const t=((a[0]-c[0])*ey-(a[1]-c[1])*ex)/den,u=((a[0]-c[0])*d[1]-(a[1]-c[1])*d[0])/den;if(t>0&&u>=0&&u<=1)best=Math.min(best,t)}return best}
function figScl(){const R=mul(61);let s=`<defs><clipPath id="cSf"><rect x="10" y="10" width="240" height="290" rx="14"/></clipPath><clipPath id="cSs"><rect x="400" y="10" width="350" height="290" rx="14"/></clipPath></defs>`;
 const fp=poisson(R,-10,-10,280,330,()=>23*(.85+R()*.3),19,27,5000),fc=power(fp,-10,-10,270,320);
 s+=`<g clip-path="url(#cSf)"><rect x="10" y="10" width="240" height="290" fill="#5e0f15"/>`;let lu=null;
 fc.forEach(c=>{if(!c)return;const p=clean(shrink(c,.5));s+=`<path d="${smooth(p,.2)}" fill="#c4473e"/>`;const a=inset(c,2.4),b=inset(c,4.6);if(a)s+=`<path d="${smooth(clean(a),.3)}" fill="none" stroke="#a3302c" stroke-width=".7"/>`;if(b)s+=`<path d="${smooth(clean(b),.35)}" fill="none" stroke="#a3302c" stroke-width=".7"/>`;const l=scl(p,.18);s+=`<path d="${smooth(l,.5)}" fill="#fdf1e8" stroke="#8f2420" stroke-width=".6"/>`;const m=cen(p);if(!lu&&m[0]>100&&m[0]<160&&m[1]>130&&m[1]<180)lu=m});
 s+='</g>';if(lu)s+=lab(lu[0],lu[1],22,36,'вузька порожнина,\nтовсті шаруваті стінки');
 const sp=(cx,y0,y1,w)=>{const h=y1-y0;let o=`<path d="M${cx} ${y0}C${cx+w/2} ${F(y0+h*.25)} ${cx+w/2} ${F(y1-h*.25)} ${cx} ${y1}C${cx-w/2} ${F(y1-h*.25)} ${cx-w/2} ${F(y0+h*.25)} ${cx} ${y0}Z" fill="#c4473e" stroke="#7e1b1a" stroke-width="1.2"/><path d="M${cx} ${y0+12}C${cx+1.6} ${F(y0+h*.3)} ${cx+1.6} ${F(y1-h*.3)} ${cx} ${y1-12}C${cx-1.6} ${F(y1-h*.3)} ${cx-1.6} ${F(y0+h*.3)} ${cx} ${y0+12}Z" fill="#fdf1e8"/>`;for(let y=y0+30;y<y1-30;y+=22)o+=`<path d="M${cx-4} ${F(y+2)}L${cx+4} ${F(y-2)}" stroke="#fdf1e8" stroke-width="1"/>`;return o};
 s+=sp(286,14,250,15)+sp(306,60,300,15)+sp(326,20,270,15)+sp(346,50,296,15)+sp(366,12,240,15);
 const sp2=poisson(R,390,0,370,310,()=>64*(.85+R()*.3),54,74,3000),sc=power(sp2,380,-10,770,320);
 s+=`<g clip-path="url(#cSs)"><rect x="400" y="10" width="350" height="290" fill="#7a3a22"/>`;let pc=null;
 sc.forEach(c=>{if(!c)return;const p=clean(inset(c,1.5)||c);if(p.length<3)return;const m=cen(p),rr=Math.sqrt(Math.abs(area(p))/Math.PI);for(let k=0;k<6;k++)s+=`<path d="${smooth(scl(p,1-k*.13,m),.5)}" fill="${k%2?'#c45a3a':'#d26d48'}"/>`;
  const lum=[];for(let k=0;k<7;k++){const a=k/7*TAU,r=rr*.15*(1+.35*Math.sin(k*2.3+R()*3));lum.push([m[0]+Math.cos(a)*r,m[1]+Math.sin(a)*r])}
  let d='';const nC=10+Math.floor(R()*4);for(let k=0;k<nC;k++){const a=k/nC*TAU+R()*.3,dir=[Math.cos(a),Math.sin(a)],L=rayHit(p,m,dir)*.9,r0=rr*.16,br=r0+(L-r0)*.55,e=[m[0]+dir[0]*L,m[1]+dir[1]*L],bp=[m[0]+dir[0]*br,m[1]+dir[1]*br];d+=`M${PT([m[0]+dir[0]*r0,m[1]+dir[1]*r0])}L${PT(e)}`;if(R()<.6){const a2=a+(R()<.5?.35:-.35),L2=rayHit(p,m,[Math.cos(a2),Math.sin(a2)])*.88;d+=`M${PT(bp)}L${PT([m[0]+Math.cos(a2)*L2,m[1]+Math.sin(a2)*L2])}`}if(!pc&&m[0]>520&&m[0]<640&&m[1]>100&&m[1]<220)pc=e}
  s+=`<path d="${d}" stroke="#fbe8d6" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="${smooth(lum,.5)}" fill="#fbe8d6"/>`});
 s+='</g>';if(pc)s+=lab(pc[0],pc[1],560,296,'розгалужені порові канали','middle');
 s+=ttl(130,322,'Волокна (поперечний зріз)')+ttl(326,322,'Волокна')+ttl(575,322,"Склереїди (кам'янисті клітини)");
 return s}

/* ===== 6. ВИДІЛЬНІ ===== */
function figExt(){const R=mul(67),W=760,H=340,EY=240;let s=`<defs><clipPath id="cEx"><rect width="${W}" height="${H}" rx="14"/></clipPath></defs><g clip-path="url(#cEx)"><rect width="${W}" height="${H}" fill="#fbfaf3"/>`;
 const np=(x,y)=>x>515&&x<715&&y<330;
 const mp=poisson(R,-20,EY+26,W+40,100,(x,y)=>(np(x,y)?13:30)*(.88+R()*.24),11,34,7000);
 power(mp,-20,EY+24,W+20,H+20).forEach((c,i)=>{if(!c)return;const n=np(mp[i][0],mp[i][1]),blue=Math.hypot(mp[i][0]-615,mp[i][1]-322)<20;const[s0,q]=cellPair(c,blue?'#3d6aa8':n?'#b08a3a':'#7d9d59',blue?'#dbe8f7':n?'#f5e6c2':'#e6efd3',n?1:1.2,.4);s+=s0;if(q){const m=cen(q);if(n&&!blue)s+=`<circle cx="${F(m[0])}" cy="${F(m[1])}" r="2.4" fill="#6a3d98" opacity=".75"/>`;else if(!n)along(shrink(q,1.6),9,R,(x,y,a)=>{s+=chl(x,y,a,.7)})}});
 let x=-6;while(x<W){const nec=x>515&&x<715,w=nec?13:28+R()*14;const[s0]=cellPair([[x,EY],[x+w,EY],[x+w,EY+26],[x,EY+26]],nec?'#b08a3a':'#6f8f4f',nec?'#f3dfb2':'#f3f6e6',1.3,.3);s+=s0;if(nec)s+=`<circle cx="${F(x+w/2)}" cy="${EY+17}" r="2.6" fill="#6a3d98" opacity=".75"/>`;x+=w}
 s+=`<rect x="0" y="${EY-2.5}" width="${W}" height="3.2" fill="#e2b54a"/>`;
 // головчастий волосок
 [[113,214,14,26],[114,188,12,26],[115,170,10,18]].forEach(([a,b,w,h])=>{s+=`<rect x="${a}" y="${b}" width="${w}" height="${h}" rx="4" fill="#eef3e2" stroke="#6f8f4f" stroke-width="1.2"/>`});
 s+=`<ellipse cx="120" cy="134" rx="27" ry="27" fill="url(#gOil)"/><path d="M93 134A27 27 0 0 1 147 134" fill="none" stroke="#c08a1a" stroke-width="1.6"/><circle cx="120" cy="148" r="22" fill="#f2d78c" stroke="#a8862e" stroke-width="1.4"/><path d="M98 148H142M120 126V170" stroke="#a8862e" stroke-width="1.1"/>`;[[110,139],[130,139],[110,158],[130,158]].forEach(([a,b])=>s+=nuc(a,b,3.4,3,0));
 // маленький волосок
 s+=`<rect x="203" y="214" width="10" height="26" rx="3" fill="#eef3e2" stroke="#6f8f4f" stroke-width="1.1"/><rect x="204" y="196" width="8" height="18" rx="3" fill="#eef3e2" stroke="#6f8f4f" stroke-width="1.1"/><circle cx="208" cy="186" r="11" fill="#f2d78c" stroke="#a8862e" stroke-width="1.2"/><ellipse cx="208" cy="173" rx="7" ry="4.5" fill="url(#gOil)"/>`;
 // пельтатна залозка
 s+=`<path d="M298 218C298 166 362 166 362 218Z" fill="url(#gOil)" stroke="#c08a1a" stroke-width="1.6"/><ellipse cx="318" cy="186" rx="8" ry="4" fill="#fff" opacity=".45"/><rect x="322" y="224" width="16" height="16" rx="3" fill="#eef3e2" stroke="#6f8f4f" stroke-width="1.2"/>`;for(let k=0;k<4;k++)s+=`<rect x="${300+k*15}" y="208" width="15" height="17" rx="4" fill="#f2d78c" stroke="#a8862e" stroke-width="1.2"/>`+nuc(307.5+k*15,217,2.8,2.4,0);
 // нектар
 [[560,15],[612,18],[672,13]].forEach(([x,r])=>{s+=`<path d="M${x-r} ${EY-2}C${x-r} ${EY-2-r*1.5} ${x+r} ${EY-2-r*1.5} ${x+r} ${EY-2}Z" fill="url(#gDrop)" stroke="#7aa7c7" stroke-width=".9"/><ellipse cx="${x-r*.35}" cy="${F(EY-2-r*.7)}" rx="${F(r*.25)}" ry="${F(r*.15)}" fill="#fff"/>`});
 s+='</g>';
 s+=lab(140,128,180,52,'головчастий залозистий\nволосок: секрет під кутикулою')+lab(345,186,390,98,'пельтатна залозка:\nефірна олія під кутикулою')+lab(612,214,700,120,'нектарник:\nкраплі нектару','end')+lab(612,322,500,322,'флоема живить нектарник','end')+lab(60,253,40,300,'епідерма');
 return s}

function figInt(){const R=mul(71),C=[175,165];let s=`<defs><clipPath id="cIr"><rect x="10" y="10" width="330" height="310" rx="14"/></clipPath><clipPath id="cIl"><rect x="360" y="10" width="390" height="310" rx="14"/></clipPath></defs>`;
 s+=`<g clip-path="url(#cIr)"><rect x="10" y="10" width="330" height="310" fill="#8aa46a"/>`;
 const pp=poisson(R,-20,-20,390,370,(x,y)=>Math.hypot(x-C[0],y-C[1])<70?0:32*(.88+R()*.24),28,36,5000);
 power(pp,-20,-20,370,350).forEach(c=>{if(!c)return;const[s0,q]=cellPair(c,'#8aa46a','#eef2df',1.2,.38);s+=s0;if(q&&R()<.5){const m=cen(q);s+=`<circle cx="${F(m[0])}" cy="${F(m[1])}" r="2.8" fill="#6a3d98" opacity=".65"/>`}});
 s+=`<circle cx="${C[0]}" cy="${C[1]}" r="70" fill="#8aa46a"/>`+ring(C,52,69,10,R,'#6f8f4f','#e5ecd2',1.5)+ring(C,31,52,14,R,'#b38b2c','#f5e4b5',1,(q,m)=>{let o=nuc(m[0],m[1],3.4,2.8,0);for(let k=0;k<3;k++){const v=q[Math.floor(R()*q.length)];o+=`<circle cx="${F(lerp(m[0],v[0],.6))}" cy="${F(lerp(m[1],v[1],.6))}" r="${F(1.4+R())}" fill="#e3a91f"/>`}return o})+`<circle cx="${C[0]}" cy="${C[1]}" r="31" fill="url(#gResin)"/><ellipse cx="${C[0]-10}" cy="${C[1]-12}" rx="10" ry="5" fill="#fff" opacity=".35"/></g>`;
 s+=lab(C[0]+6,C[1]+6,20,300,'смоляний хід (канал зі смолою)')+lab(C[0]-42,C[1]-6,30,40,'епітелій — виділяє смолу','start')+lab(C[0]+58,C[1]-20,250,40,'обкладка');
 s+=`<g clip-path="url(#cIl)"><rect x="360" y="10" width="390" height="310" fill="#7d9d59"/>`;
 for(let y=10,r=0;y<320;y+=26,r++){let x=360-(r%2?22:0)-R()*10;while(x<750){const w=40+R()*20;const[s0,q]=cellPair([[x,y],[x+w,y],[x+w,y+26],[x,y+26]],'#7d9d59','#edf2de',1.1,.3);s+=s0;if(q&&R()<.4){const m=cen(q);s+=`<circle cx="${F(m[0])}" cy="${F(m[1])}" r="2.6" fill="#6a3d98" opacity=".6"/>`}x+=w}}
 const lines=[[[372,300],[430,262],[500,240],[560,190],[620,150],[700,112],[752,96]],[[500,240],[522,290],[560,322]],[[560,190],[580,112],[608,42],[626,6]],[[620,150],[680,192],[752,232]]];
 const crd=pts=>{let d='M'+PT(pts[0]);for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];d+='C'+PT([p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6])+' '+PT([p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6])+' '+PT(p2)}return d};
 let o1='',o2='',dots='',nucs='';lines.forEach(L=>{const d=crd(L);o1+=`<path d="${d}" stroke="#9b7f4c" stroke-width="14" fill="none" stroke-linecap="round"/>`;o2+=`<path d="${d}" stroke="#fbf8ef" stroke-width="10.5" fill="none" stroke-linecap="round"/>`;for(let i=0;i<L.length-1;i++){const a=L[i],b=L[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),an=Math.atan2(b[1]-a[1],b[0]-a[0]);for(let t=0;t<len;t+=4){const u=t/len,off=(R()-.5)*6;dots+=`<circle cx="${F(lerp(a[0],b[0],u)-Math.sin(an)*off)}" cy="${F(lerp(a[1],b[1],u)+Math.cos(an)*off)}" r="${F(.7+R()*.9)}" fill="${R()<.5?'#d9cfb3':'#efe8d4'}"/>`}const mm=[(a[0]+b[0])/2,(a[1]+b[1])/2];nucs+=`<ellipse cx="${F(mm[0])}" cy="${F(mm[1])}" rx="3.6" ry="2" transform="rotate(${F(an*57.3)} ${F(mm[0])} ${F(mm[1])})" fill="#7a4fa3"/>`}});
 s+=o1+o2+dots+nucs+'</g>';
 s+=lab(590,170,392,40,'молочник (нечленистий,\nрозгалужений)')+lab(530,215,372,300,'латекс (молочний сік)')+lab(660,131,690,300,'багато ядер','middle');
 s+=ttl(175,336,'Смоляний хід (поперечний зріз)')+ttl(555,336,'Молочники в паренхімі');
 return s}

function lazyFigs(list){const todo=new Map(list);const build=id=>{const fn=todo.get(id);if(!fn)return;todo.delete(id);fig(id,fn)};
 if(!('IntersectionObserver' in window)){list.forEach(([id])=>build(id));return}
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);build(e.target.id)}}),{rootMargin:'900px 0px'});
 list.forEach(([id])=>{const el=$(id);if(el)io.observe(el)});
 const idle=window.requestIdleCallback||(cb=>setTimeout(()=>cb({timeRemaining:()=>8}),200));
 const next=d=>{for(const id of todo.keys()){if(d.timeRemaining()<6)break;const el=$(id);if(el)io.unobserve(el);build(id);break}if(todo.size)idle(next)};
 setTimeout(()=>idle(next),1500)}

/* ===== ЗАПУСК ===== */
function init(){fig('heroSvg',heroFig);heroInit();
 /* рисунки будуються, коли наближаються до екрана, решта — у вільний час */
 lazyFigs([['figMer',figMer],['figApical',figApical],['figLateral',figLateral],['figInter',figInter],['figWound',figWound],['figEpi',figEpi],['figPeri',figPeri],['figBark',figBark],['figLeaf',figLeaf],['figStarch',figStarch],['figAer',figAer],['figBundle',figBundle],['figXylem',figXylem],['figPhloem',figPhloem],['figColl',figColl],['figScl',figScl],['figExt',figExt],['figInt',figInt]]);
 document.querySelectorAll('.tog').forEach(b=>b.addEventListener('click',()=>{const sv=$(b.dataset.svg);const on=sv.classList.toggle('iod');b.textContent=on?'Змити йод':'Нанести розчин йоду'}))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
