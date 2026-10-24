// Вплив фітогормонів (ауксини й цитокініни): модель морфогенезу in vitro.
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
if(!$('amc'))return;
var PAL={ink:'#1b261c',muted:'#5a665a',line:'#d5dccd',paper:'#fbfcf8',bg:'#f2f4ee',auxin:'#7d3b8c',cyto:'#1c6886',root:'#a2622a',shoot:'#3b8a2c',callus:'#c4a125'};
var REDUCE=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utils ---------- */
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function sstep(a,b,x){var t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(a,b){var s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s)}
function hex(h){h=h.replace('#','');var v=parseInt(h,16);return[v>>16&255,v>>8&255,v&255]}
function mix(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}
function css(c,al){var s=Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2]);return al==null?'rgb('+s+')':'rgba('+s+','+al+')'}
function rgba(h,a){return css(hex(h),a)}
function fit(cv){var r=cv.getBoundingClientRect(),d=Math.min(2.5,window.devicePixelRatio||1);var w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}var ctx=cv.getContext('2d');ctx.setTransform(d,0,0,d,0,0);return{ctx:ctx,w:r.width,h:r.height}}
function num(x,d){return x.toLocaleString('uk-UA',{minimumFractionDigits:d,maximumFractionDigits:d})}
function conc(x){return Number(x.toPrecision(2)).toLocaleString('uk-UA',{maximumFractionDigits:3})}
function ratioStr(A,C){var r=A/C;if(r>=1)return Number(r.toPrecision(2)).toLocaleString('uk-UA')+' : 1';return '1 : '+Number((1/r).toPrecision(2)).toLocaleString('uk-UA')}

/* ---------- model ---------- */
var DEF={muR:.35,muS:.30,muX:.22,n:2,KAr:.3,KCr:.15,KT:4,KCs:.3,KAs:.3,KAx:1,KCx:.3};
var P=Object.assign({},DEF);
var st={A:1,C:.01,day:28,playing:false};
var LMIN=-2,LMAX=1,TMAX=42,DT=.1,SEED=.01,MW_NAA=186.21,MW_BAP=225.25;
function hill(x,K,n){var xn=Math.pow(x,n);return xn/(Math.pow(K,n)+xn)}
function inh(x,K,n){return 1-hill(x,K,n)}
function rates(A,C){var n=P.n;return{fR:hill(A,P.KAr,n)*inh(C,P.KCr,n)*inh(A,P.KT,3),fS:hill(C,P.KCs,n)*inh(A,P.KAs,n),fX:hill(A,P.KAx,n)*hill(C,P.KCx,n)}}
var traj;
function simulate(){var f=rates(st.A,st.C),R=SEED,S=SEED,X=SEED,o={R:[R],S:[S],X:[X],f:f},N=Math.round(TMAX/DT);
  for(var i=0;i<N;i++){var free=Math.max(0,1-(R+S+X));R+=P.muR*f.fR*R*free*DT;S+=P.muS*f.fS*S*free*DT;X+=P.muX*f.fX*X*free*DT;o.R.push(R);o.S.push(S);o.X.push(X)}
  traj=o}
function at(d){var x=clamp(d/DT,0,traj.R.length-1),i=Math.floor(x),j=Math.min(i+1,traj.R.length-1),t=x-i;return{R:traj.R[i]*(1-t)+traj.R[j]*t,S:traj.S[i]*(1-t)+traj.S[j]*t,X:traj.X[i]*(1-t)+traj.X[j]*t}}

/* ---------- templates (deterministic) ---------- */
var RT=[];(function(){for(var i=0;i<12;i++){var r=rng(100+i*7),lats=[],k,noise=[];for(k=0;k<200;k++)noise.push(r()-.5);
  for(k=0;k<8;k++){var ln=[];for(var q=0;q<80;q++)ln.push(r()-.5);lats.push({s:2.6+k*3.3+r()*1.5,side:(k+i)%2?1:-1,ang:.85+.45*r(),max:.4+.6*r(),noise:ln})}
  RT.push({x:(r()-.5)*11,a0:(i===0?0:(r()-.5)*1.5),z:r()*2-1,len:.6+.4*r(),th:.03+i*.055,w:.8+.4*r(),noise:noise,lats:lats})}})();
var SH=[];(function(){for(var i=0;i<8;i++){var r=rng(500+i*13),noise=[];for(var k=0;k<200;k++)noise.push(r()-.5);
  SH.push({x:(r()-.5)*10,a0:(i===0?0:(r()-.5)*.9),z:r()*2-1,az0:r()*6.28,inter:2.5+r()*1.3,leaf:.8+.4*r(),th:.03+i*.07,len:.6+.4*r(),noise:noise,tone:r()})}})();
var BLS=[];(function(){var r=rng(77);for(var i=0;i<6;i++)BLS.push([r()*6.28,r()*6.28,r()*6.28,r()*6.28])})();
var BUB=[];(function(){var r=rng(42);for(var i=0;i<16;i++)BUB.push({u:r()*2-1,v:r(),r:.6+r()*r()*2.4})})();
var DROP=[];(function(){var r=rng(91);for(var i=0;i<110;i++){var u=r();u=u<.5?Math.pow(u*2,1.6)/2:1-Math.pow((1-u)*2,1.6)/2;DROP.push({u:u,v:Math.pow(r(),1.7),r:.5+r()*r()*3.2})}})();
var GSP=[];(function(){var r=rng(5);for(var i=0;i<34;i++)GSP.push({a:r()*6.28,d:Math.sqrt(r())*.85,r:.5+r(),k:r()<.5?0:1})})();

/* ---------- textures ---------- */
function makeAgarNoise(){var c=document.createElement('canvas');c.width=c.height=128;var x=c.getContext('2d'),im=x.createImageData(128,128),r=rng(9);
  for(var i=0;i<im.data.length;i+=4){var v=r()>.5?255:110;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=Math.round(r()*20)}x.putImageData(im,0,0);return c}
function makeCallusTex(){var S=200,c=document.createElement('canvas');c.width=c.height=S;var x=c.getContext('2d'),r=rng(31);
  for(var i=0;i<950;i++){var px=r()*S,py=r()*S,rad=1.3+r()*r()*4.2;
    for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){var X=px+dx*S,Y=py+dy*S;if(X<-10||X>S+10||Y<-10||Y>S+10)continue;
      var g=x.createRadialGradient(X+rad*.35,Y+rad*.45,0,X+rad*.35,Y+rad*.45,rad*1.3);g.addColorStop(0,'rgba(85,60,15,.26)');g.addColorStop(1,'rgba(85,60,15,0)');x.fillStyle=g;x.beginPath();x.arc(X+rad*.35,Y+rad*.45,rad*1.3,0,7);x.fill();
      g=x.createRadialGradient(X-rad*.32,Y-rad*.38,0,X,Y,rad);g.addColorStop(0,'rgba(255,253,236,.8)');g.addColorStop(.45,'rgba(255,250,222,.28)');g.addColorStop(1,'rgba(255,250,222,0)');x.fillStyle=g;x.beginPath();x.arc(X,Y,rad,0,7);x.fill()}}
  return c}
var TEX_A=makeAgarNoise(),TEX_C=makeCallusTex(),patA=null,patC=null;

/* ---------- vessel geometry ---------- */
var G={};
function setGeom(w,h){G.w=w;G.h=h;G.x0=w*.12;G.x1=w*.88;G.JW=G.x1-G.x0;G.cx=w/2;G.er=G.JW*.075;G.top=h*.105;G.bot=h*.9;G.surf=h*.565;G.px=G.JW/62}

function growLine(x,y,a,L,step,noise,gStr,aSet,o){
  var pts=[{x:x,y:y,a:a,s:0}],s=0,k=0,px=G.px,ylim=G.bot+G.er*.25-7;
  while(s<L-1e-6){var ds=Math.min(step,L-s);
    a+=noise[k%noise.length]*o.wig*ds/step;
    a+=(aSet-a)*gStr*ds;
    if(x<G.x0+16&&Math.sin(a)*o.sx<.35)a+=.18*ds;
    if(x>G.x1-16&&Math.sin(a)*o.sx>-.35)a-=.18*ds;
    if(o.down&&y>ylim-18){var sg=Math.sin(a)>=0?1:-1;a+=(sg*1.45-a)*.4*ds}
    x+=Math.sin(a)*ds*px*o.sx;y+=Math.cos(a)*ds*px*o.sy;s+=ds;k++;
    x=clamp(x,G.x0+5,G.x1-5);if(o.down&&y>ylim)y=ylim;if(!o.down&&y<G.top+8)y=G.top+8;
    pts.push({x:x,y:y,a:a,s:s})}
  return pts}

function ribbon(pts,wf){
  var n=pts.length,L=[],R=[],i;
  for(i=0;i<n;i++){var p=pts[i],q=pts[Math.min(i+1,n-1)],o=pts[Math.max(i-1,0)],dx=q.x-o.x,dy=q.y-o.y,d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
    p.nx=-dy;p.ny=dx;p.w=wf(i);L.push([p.x+p.nx*p.w,p.y+p.ny*p.w]);R.push([p.x-p.nx*p.w,p.y-p.ny*p.w])}
  var P2=new Path2D();P2.moveTo(L[0][0],L[0][1]);for(i=1;i<n;i++)P2.lineTo(L[i][0],L[i][1]);
  var e=pts[n-1],an=Math.atan2(e.ny,e.nx);P2.arc(e.x,e.y,Math.max(.3,e.w),an,an-Math.PI,true);
  for(i=n-1;i>=0;i--)P2.lineTo(R[i][0],R[i][1]);P2.closePath();return P2}

/* ---------- roots ---------- */
var RC={base:hex('#cdb47c'),mid:hex('#f6efd9'),tip:hex('#fffdf4'),cap:hex('#f1df9e'),fog:hex('#c9b88c')};
function drawRoot(ctx,pts,wB,tone,seed,zone){
  var n=pts.length;if(n<2)return;var L=pts[n-1].s,wT=wB*.55;
  var path=ribbon(pts,function(i){var d=L-pts[i].s;return wT+(wB-wT)*Math.min(1,Math.sqrt(Math.max(0,d)/5))});
  var a=pts[0],b=pts[n-1],g=ctx.createLinearGradient(a.x,a.y,b.x,b.y),f=function(mm){return clamp(1-mm/L,0,1)};
  var t=function(c){return css(mix(c,RC.fog,tone))};
  g.addColorStop(0,t(RC.base));if(L>8)g.addColorStop(f(8),t(RC.mid));if(L>1.6)g.addColorStop(f(1.6),t(RC.tip));g.addColorStop(1,t(RC.cap));
  ctx.fillStyle=g;ctx.fill(path);
  ctx.beginPath();for(var i=0;i<n;i++){var p=pts[i],x=p.x-p.nx*p.w*.35,y=p.y-p.ny*p.w*.35;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.strokeStyle='rgba(255,253,244,'+(.6-tone*.35)+')';ctx.lineWidth=Math.max(.6,wB*.5);ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  ctx.strokeStyle='rgba(118,90,44,'+(.48-tone*.2)+')';ctx.lineWidth=.75;ctx.stroke(path);
  if(L>1.6){var hs=.2,j0=Math.max(1,Math.ceil((L-zone)/hs)),j1=Math.floor((L-1.3)/hs);ctx.beginPath();
    for(var j=j0;j<=j1;j++){var sj=j*hs,d=L-sj,ramp=sstep(1.3,2.7,d)*(1-.75*sstep(zone*.55,zone,d));if(ramp<.03)continue;
      var pp=pts[Math.min(n-1,Math.round(sj/.6))];
      for(var sd=-1;sd<=1;sd+=2){var h1=hash(seed,j*2+(sd>0?1:0)),h2=hash(seed+.37,j*2+(sd>0?1:0));if(hash(seed+.71,j*2+(sd>0?1:0))<.45)continue;
        var hl=(.18+.5*h1*h1)*G.px*ramp,ang=Math.atan2(pp.ny*sd,pp.nx*sd)+(h2-.5)*1.7;
        var sx=pp.x+pp.nx*sd*pp.w*.85,sy=pp.y+pp.ny*sd*pp.w*.85;
        ctx.moveTo(sx,sy);ctx.quadraticCurveTo(sx+Math.cos(ang+.3)*hl*.55,sy+Math.sin(ang+.3)*hl*.55,sx+Math.cos(ang)*hl,sy+Math.sin(ang)*hl)}}
    ctx.strokeStyle='rgba(255,252,242,'+(.42-tone*.22)+')';ctx.lineWidth=.45;ctx.stroke()}
}
function drawRoots(ctx,s,o,front){
  var thick=1+.75*sstep(1.5,7,s.A),shorten=1-.45*sstep(1.5,7,s.A);
  var latN=Math.round(8*(.3+.7*hill(s.A,.4,2))*(1-.6*hill(s.C,.15,2)));
  for(var i=0;i<RT.length;i++){var t=RT[i];if((t.z>=0)!==front)continue;var r=o.roots[i];if(r.g<=.002)continue;
    var L=r.L*shorten;if(L<.12)continue;
    var ox=G.cx+t.x*G.px,oy=G.surf+G.px*.35;
    var pts=growLine(ox,oy,t.a0,L,.6,t.noise,.045,0,{wig:.1,down:true,sx:1,sy:1});
    var wB=.36*G.px*t.w*thick*(.6+.4*r.g),tone=front?0:.4+.2*(-t.z);
    for(var k=0;k<Math.min(latN,t.lats.length);k++){var l=t.lats[k],age=L-l.s-4.2;if(age<=0)continue;
      var lL=Math.min(l.max*15,age*.6)*o.latF;if(lL<.25)continue;
      var p=pts[Math.min(pts.length-1,Math.round(l.s/.6))];
      var lp=growLine(p.x,p.y,p.a+l.side*l.ang,lL,.6,l.noise,.022,l.side*.6,{wig:.12,down:true,sx:1,sy:1});
      drawRoot(ctx,lp,wB*.55,tone,i*50+k+7,5.5)}
    drawRoot(ctx,pts,wB,tone,i+1,9)}
}

/* ---------- explant ---------- */
function drawExplant(ctx){
  var px=G.px,xa=G.cx-7*px,xb=G.cx+7*px,r=1.25*px,yc=G.surf-.85*px;
  ctx.save();ctx.translate(G.cx,G.surf+.3*px);ctx.scale(1,.2);var sg=ctx.createRadialGradient(0,0,0,0,0,9.5*px);sg.addColorStop(0,'rgba(70,55,20,.38)');sg.addColorStop(1,'rgba(70,55,20,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(0,0,9.5*px,0,7);ctx.fill();ctx.restore();
  var body=new Path2D();body.moveTo(xa,yc-r);body.lineTo(xb,yc-r);body.ellipse(xb,yc,r*.36,r,0,-Math.PI/2,Math.PI/2);body.lineTo(xa,yc+r);body.ellipse(xa,yc,r*.36,r,0,Math.PI/2,Math.PI*1.5);body.closePath();
  var g=ctx.createLinearGradient(0,yc-r,0,yc+r);g.addColorStop(0,'#bcd98a');g.addColorStop(.25,'#94bc5e');g.addColorStop(.68,'#638e38');g.addColorStop(1,'#45692a');
  ctx.fillStyle=g;ctx.fill(body);
  ctx.save();ctx.clip(body);ctx.strokeStyle='rgba(236,248,206,.22)';ctx.lineWidth=.6;
  for(var k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(xa,yc+k*r*.33);ctx.lineTo(xb,yc+k*r*.33+.6);ctx.stroke()}
  var xn=G.cx+.9*px;ctx.strokeStyle='rgba(48,78,24,.42)';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(xn,yc,r*.28,r,0,-Math.PI/2,Math.PI/2);ctx.stroke();
  var hg=ctx.createLinearGradient(0,yc-r,0,yc);hg.addColorStop(0,'rgba(255,255,240,.35)');hg.addColorStop(1,'rgba(255,255,240,0)');ctx.fillStyle=hg;ctx.fillRect(xa-r,yc-r,xb-xa+2*r,r*.6);
  ctx.restore();
  ctx.fillStyle='#86a54d';ctx.beginPath();ctx.ellipse(xn+1,yc-r+.5,1.1*px,.38*px,0,Math.PI,0);ctx.fill();
  ctx.strokeStyle='rgba(40,65,22,.5)';ctx.lineWidth=.8;ctx.stroke(body);
  ctx.fillStyle='#e3ecc7';ctx.beginPath();ctx.ellipse(xb,yc,r*.36,r,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(150,112,52,.75)';ctx.lineWidth=1.3;ctx.stroke();
  ctx.fillStyle='rgba(118,150,66,.85)';for(k=0;k<10;k++){var a=k/10*Math.PI*2;ctx.beginPath();ctx.ellipse(xb+Math.cos(a)*r*.2,yc+Math.sin(a)*r*.6,.45,.85,0,0,7);ctx.fill()}
  ctx.strokeStyle='rgba(140,104,48,.6)';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(xa,yc,r*.36,r,0,Math.PI/2,Math.PI*1.5);ctx.stroke();
}

/* ---------- callus ---------- */
function callusBlobs(mm){if(mm<=0)return[];var rc=mm/2*G.px,half=7*G.px,out=[];
  for(var k=0;k<2;k++){var ex=G.cx+(k?half:-half),bx=ex+(k?-1:1)*Math.min(rc*.55,half*.95),rx=rc*(k?1:.92),ry=rc*.7;out.push({bx:bx,cy:G.surf-ry*.5,rx:rx,ry:ry,seed:k*2+1})}
  return out}
function blobPath(b,P2){var N=96,L=BLS[b.seed],yb=G.surf+G.px*.3;
  for(var i=0;i<=N;i++){var th=i/N*Math.PI*2,rr=1+.065*Math.sin(5*th+L[0])+.045*Math.sin(9*th+L[1])+.028*Math.sin(15*th+L[2])+.014*Math.sin(24*th+L[3]);
    var x=b.bx+Math.cos(th)*b.rx*rr,y=b.cy+Math.sin(th)*b.ry*rr;if(y>yb)y=yb+(y-yb)*.15;i?P2.lineTo(x,y):P2.moveTo(x,y)}P2.closePath()}
function drawCallus(ctx,s,blobs){
  if(!blobs.length)return;
  var gf=sstep(.4,3,s.C)*.7,br=sstep(2.5,8,s.A)*.75;
  var light=hex('#f8f0cc'),mid=hex('#e6d18c'),dark=hex('#b0964f');
  light=mix(light,hex('#e0ebb2'),gf*.5);mid=mix(mid,hex('#bdd17c'),gf*.55);dark=mix(dark,hex('#7f9a45'),gf*.5);
  light=mix(light,hex('#ead2a4'),br*.6);mid=mix(mid,hex('#bb945c'),br);dark=mix(dark,hex('#7a5630'),br);
  var all=new Path2D(),minx=1e9,maxx=-1e9,miny=1e9;
  blobs.forEach(function(b){blobPath(b,all);minx=Math.min(minx,b.bx-b.rx*1.3);maxx=Math.max(maxx,b.bx+b.rx*1.3);miny=Math.min(miny,b.cy-b.ry*1.3)});
  ctx.save();ctx.shadowColor='rgba(70,50,15,.35)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;ctx.fillStyle=css(mid);ctx.fill(all);ctx.restore();
  var gcx=(minx+maxx)/2,grx=(maxx-minx)/2/1.3,gtop=Math.min(blobs[0].cy-blobs[0].ry,blobs[1].cy-blobs[1].ry);
  var g=ctx.createRadialGradient(gcx-grx*.3,gtop+(G.surf-gtop)*.25,grx*.04,gcx,G.surf-(G.surf-gtop)*.35,grx*1.15);g.addColorStop(0,css(light));g.addColorStop(.5,css(mid));g.addColorStop(1,css(dark));ctx.fillStyle=g;ctx.fill(all);
  ctx.save();ctx.clip(all);
  ctx.fillStyle=patC;ctx.fillRect(minx,miny,maxx-minx,G.surf-miny+6);
  var rc=blobs[1].rx;
  if(gf>.02){var cnt=Math.round(GSP.length*gf);for(var i=0;i<cnt;i++){var q=GSP[i],b=blobs[q.k],x=b.bx+Math.cos(q.a)*q.d*b.rx,y=b.cy+Math.sin(q.a)*q.d*b.ry*.8,big=i%4===0,rr=(big?2.2+q.r*1.6:.35+q.r*.3)*G.px;
    var gg=ctx.createRadialGradient(x,y,0,x,y,rr);gg.addColorStop(0,'rgba(120,170,70,'+(big?.32:.38)*gf+')');gg.addColorStop(1,'rgba(120,170,70,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.arc(x,y,rr,0,7);ctx.fill()}}
  if(br>.02){for(i=0;i<5;i++){var b2=blobs[i%2],x2=b2.bx+Math.cos(i*2.1)*b2.rx*.55,y2=b2.cy+Math.sin(i*2.1)*b2.ry*.4,r2=b2.rx*.45;var bg=ctx.createRadialGradient(x2,y2,0,x2,y2,r2);bg.addColorStop(0,'rgba(110,70,30,'+(br*.55)+')');bg.addColorStop(1,'rgba(110,70,30,0)');ctx.fillStyle=bg;ctx.beginPath();ctx.arc(x2,y2,r2,0,7);ctx.fill()}}
  function outer(fn){blobs.forEach(function(bb,k){var other=blobs[1-k],cp=new Path2D(),own=new Path2D();cp.rect(0,0,G.w,G.h);blobPath(other,cp);blobPath(bb,own);ctx.save();ctx.clip(cp,'evenodd');fn(own);ctx.restore()})}
  ctx.lineJoin='round';
  outer(function(pp){ctx.strokeStyle=css(dark,.16);ctx.lineWidth=Math.max(3,rc*.22);ctx.stroke(pp);ctx.strokeStyle=css(dark,.2);ctx.lineWidth=Math.max(2,rc*.09);ctx.stroke(pp)});
  ctx.restore();
  outer(function(pp){ctx.strokeStyle='rgba(105,80,35,.38)';ctx.lineWidth=.8;ctx.stroke(pp)});
}
function originY(x,blobs){var y=Math.abs(x-G.cx)<7*G.px?G.surf-2.1*G.px:G.surf;
  blobs.forEach(function(b){var u=(x-b.bx)/(b.rx*.9);if(Math.abs(u)<1){var yt=b.cy-b.ry*Math.sqrt(1-u*u);y=Math.min(y,yt+1.5)}});return y}

/* ---------- shoots & leaves ---------- */
var LC={light:hex('#a9d26a'),mid:hex('#79ae40'),mdark:hex('#5c9431'),dark:hex('#3d6d22'),yl:hex('#d3e690'),ym:hex('#abcd5e'),ymd:hex('#94bb4c'),yd:hex('#6f9a36'),gl:hex('#cfe7bd'),gm:hex('#a9d391'),shade:hex('#2b4a1a')};
function leafCols(young,depth,vit,tone){
  var sh=Math.max(0,-depth)*.32+tone*.08;
  function c(m,y,g){var v=mix(m,y,young);v=mix(v,g,vit*.55);return mix(v,LC.shade,sh)}
  return{light:c(LC.light,LC.yl,LC.gl),mid:c(LC.mid,LC.ym,LC.gm),mdark:c(LC.mdark,LC.ymd,LC.gm),dark:c(LC.dark,LC.yd,LC.gm)}}
function drawLeaf(ctx,x,y,th,len,hw,low,bend,cols,vit,veins){
  if(len<1)return;
  ctx.save();ctx.translate(x,y);ctx.rotate(th);
  var bs=Math.cos(th)>=0?1:-1,pet=len*.2,b=len-pet,N=24,up=[],dn=[],mid=[],i;
  for(i=0;i<=N;i++){var t=i/N,X=pet+b*t,Y=bs*bend*len*t*t,h=hw*2.74*Math.pow(t,.55)*(1-t)*(1+vit*.25);mid.push([X,Y]);up.push([X,Y-h]);dn.push([X,Y+h*low])}
  ctx.strokeStyle=css(cols.mdark);ctx.lineWidth=Math.max(.9,hw*.16);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(pet+1,0);ctx.stroke();
  var P2=new Path2D();P2.moveTo(up[0][0],up[0][1]);for(i=1;i<=N;i++)P2.lineTo(up[i][0],up[i][1]);for(i=N;i>=0;i--)P2.lineTo(dn[i][0],dn[i][1]);P2.closePath();
  var g=ctx.createLinearGradient(0,-hw,0,hw*low);g.addColorStop(0,css(cols.mid));g.addColorStop(.4,css(cols.light));g.addColorStop(.52,css(mix(cols.light,cols.mid,.6)));g.addColorStop(.8,css(cols.mdark));g.addColorStop(1,css(cols.dark));
  ctx.save();ctx.shadowColor='rgba(25,45,12,.25)';ctx.shadowBlur=4;ctx.shadowOffsetY=1.5;ctx.globalAlpha=1-vit*.15;ctx.fillStyle=g;ctx.fill(P2);ctx.restore();
  var sg=ctx.createRadialGradient(pet+b*.35,-hw*.35,0,pet+b*.35,-hw*.35,b*.55);sg.addColorStop(0,'rgba(255,255,236,'+(.2+vit*.3)+')');sg.addColorStop(1,'rgba(255,255,236,0)');ctx.fillStyle=sg;ctx.fill(P2);
  if(veins&&len>14){ctx.beginPath();ctx.moveTo(mid[0][0],mid[0][1]);for(i=1;i<N;i++)ctx.lineTo(mid[i][0],mid[i][1]);
    ctx.strokeStyle='rgba(222,238,188,.6)';ctx.lineWidth=Math.max(.55,hw*.06);ctx.stroke();
    ctx.beginPath();[.16,.3,.44,.58,.72].forEach(function(t1){var i1=Math.round(t1*N),i2=Math.min(N,Math.round((t1+.15)*N)),m=mid[i1];
      var u=up[i2],d=dn[i2],uy=mid[i2][1]+(u[1]-mid[i2][1])*.82,dy=mid[i2][1]+(d[1]-mid[i2][1])*.82;
      ctx.moveTo(m[0],m[1]);ctx.quadraticCurveTo(m[0]+(u[0]-m[0])*.25,(m[1]+uy)/2,u[0],uy);
      ctx.moveTo(m[0],m[1]);ctx.quadraticCurveTo(m[0]+(d[0]-m[0])*.25,(m[1]+dy)/2,d[0],dy)});
    ctx.strokeStyle='rgba(222,238,188,.28)';ctx.lineWidth=.5;ctx.stroke()}
  ctx.strokeStyle='rgba(35,62,18,'+(.5-vit*.2)+')';ctx.lineWidth=.7;ctx.stroke(P2);
  ctx.restore()}
function drawShoots(ctx,s,o,blobs){
  var el=1-.5*hill(s.C,1.2,2),lsc=1-.35*hill(s.C,2,2),vit=sstep(2.5,9,s.C);
  var order=SH.map(function(t,i){return i}).sort(function(a,b){return SH[a].z-SH[b].z});
  order.forEach(function(i){var t=SH[i],sh=o.shoots[i];if(sh.g<=.002)return;var H=sh.H*el;if(H<.15)return;
    var ox=G.cx+t.x*G.px,oy=originY(ox,blobs);
    var pts=growLine(ox,oy,t.a0,H,.5,t.noise,.04,0,{wig:.05,down:false,sx:1,sy:-1});
    var leaves=[];
    for(var k=0;k<11;k++){var sN=.45+k*t.inter*el;if(sN>H-.2)break;var age=H-sN,p=pts[Math.min(pts.length-1,Math.round(sN/.5))];
      var az=t.az0+k*2.4,sa=Math.sin(az),ca=Math.cos(az),mat=sstep(0,7,age),unf=sstep(.1,2.6,age);
      var len=(2.4+9.6*Math.pow(mat,.85))*t.leaf*lsc*G.px*(1+vit*.15),side=sa>=0?1:-1,div=.22+.9*unf+.28*mat;
      leaves.push({hv:hash(i*13+k,3),x:p.x,y:p.y,th:(p.a-Math.PI/2)+side*div,len:len*(.5+.5*Math.abs(sa)),hw:len*.3*(.2+.8*unf),low:.55+.45*Math.abs(ca),depth:ca,young:1-mat,bend:.04+.2*mat})}
    var tone=(1-t.z)/2;
    function dl(l){drawLeaf(ctx,l.x,l.y,l.th,l.len,l.hw,l.low,l.bend,leafCols(Math.min(1,l.young+(l.hv-.5)*.35),l.depth,vit,tone+(l.hv-.5)*.6),vit,true)}
    leaves.filter(function(l){return l.depth<0}).forEach(dl);
    var n=pts.length,stem=ribbon(pts,function(j){var d=H-pts[j].s;return(.16+.34*Math.min(1,d/9))*G.px*(.75+.25*sh.g)*(1+vit*.35)});
    var a=pts[0],e=pts[n-1],g=ctx.createLinearGradient(a.x,a.y,e.x,e.y);g.addColorStop(0,css(mix(hex('#5a8433'),LC.shade,tone*.2)));g.addColorStop(1,css(mix(hex('#a8cb66'),LC.gl,vit*.5)));
    ctx.fillStyle=g;ctx.fill(stem);
    ctx.beginPath();for(var j=0;j<n;j++){var q=pts[j],x=q.x-q.nx*q.w*.38,y=q.y-q.ny*q.w*.38;j?ctx.lineTo(x,y):ctx.moveTo(x,y)}
    ctx.strokeStyle='rgba(236,248,200,.5)';ctx.lineWidth=Math.max(.6,pts[0].w*.45);ctx.lineCap='round';ctx.stroke();
    ctx.strokeStyle='rgba(35,62,18,.45)';ctx.lineWidth=.7;ctx.stroke(stem);
    leaves.filter(function(l){return l.depth>=0}).forEach(dl);
    var phi=e.a-Math.PI/2,bl=Math.min(3.4,1+H*.5)*G.px,bc=leafCols(1,0,vit,tone);
    drawLeaf(ctx,e.x,e.y,phi-.26,bl,bl*.18,.8,0,bc,vit,false);drawLeaf(ctx,e.x,e.y,phi+.24,bl*.92,bl*.17,.8,0,bc,vit,false);
  })}

/* ---------- vessel ---------- */
var cvV=$('amc-vessel');
function organs(s){
  var roots=RT.map(function(t){var g=sstep(t.th,t.th+.3,s.R);return{g:g,L:40*t.len*g}});
  var shoots=SH.map(function(t){var g=sstep(t.th,t.th+.35,s.S);return{g:g,H:38*t.len*g}});
  var xf=Math.pow(Math.max(0,s.X-.012),.7);
  return{roots:roots,shoots:shoots,callusMM:s.X>.02?1.5+20*xf:0,latF:sstep(.3,.85,s.R)}}
function jarInterior(inset){var P2=new Path2D(),rx=G.JW/2-inset;P2.moveTo(G.cx-rx,G.top);P2.lineTo(G.cx-rx,G.bot);P2.ellipse(G.cx,G.bot,rx,G.er,0,Math.PI,0,true);P2.lineTo(G.cx+rx,G.top);P2.closePath();return P2}
function drawVessel(s){
  var fr=fit(cvV),ctx=fr.ctx,w=fr.w,h=fr.h;setGeom(w,h);
  if(!patA){patA=ctx.createPattern(TEX_A,'repeat');patC=ctx.createPattern(TEX_C,'repeat')}
  var o=organs(s),px=G.px,rx=G.JW/2-2;
  // bench
  var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#f9faf6');bg.addColorStop(.75,'#eef1e8');bg.addColorStop(1,'#e3e7dc');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(G.cx+8,G.bot+G.er*.7);ctx.scale(1,.17);var sg=ctx.createRadialGradient(0,0,0,0,0,G.JW*.64);sg.addColorStop(0,'rgba(30,40,25,.3)');sg.addColorStop(1,'rgba(30,40,25,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(0,0,G.JW*.64,0,7);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(G.cx+G.JW*.24,G.bot+G.er*1.05);ctx.scale(1,.14);sg=ctx.createRadialGradient(0,0,0,0,0,G.JW*.42);sg.addColorStop(0,'rgba(232,196,96,.28)');sg.addColorStop(1,'rgba(232,196,96,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(0,0,G.JW*.42,0,7);ctx.fill();ctx.restore();
  // back glass
  ctx.fillStyle='rgba(222,234,228,.35)';ctx.fill(jarInterior(0));
  // agar body
  var agar=new Path2D();agar.moveTo(G.cx-rx,G.surf);agar.lineTo(G.cx-rx,G.bot);agar.ellipse(G.cx,G.bot,rx,G.er,0,Math.PI,0,true);agar.lineTo(G.cx+rx,G.surf);agar.ellipse(G.cx,G.surf,rx,G.er,0,0,Math.PI,true);agar.closePath();
  var ag=ctx.createLinearGradient(G.cx-rx,0,G.cx+rx,0);ag.addColorStop(0,'#c7af72');ag.addColorStop(.1,'#dcc68d');ag.addColorStop(.42,'#ecdcaa');ag.addColorStop(.85,'#dac48a');ag.addColorStop(1,'#c2a96a');
  ctx.fillStyle=ag;ctx.fill(agar);
  var av=ctx.createLinearGradient(0,G.surf,0,G.bot+G.er);av.addColorStop(0,'rgba(255,248,220,.25)');av.addColorStop(.25,'rgba(255,248,220,0)');av.addColorStop(1,'rgba(140,110,50,.2)');ctx.fillStyle=av;ctx.fill(agar);
  ctx.fillStyle=patA;ctx.fill(agar);
  // roots inside agar
  ctx.save();ctx.clip(agar);
  drawRoots(ctx,s,o,false);
  ctx.fillStyle='rgba(234,218,168,.32)';ctx.fill(agar);
  drawRoots(ctx,s,o,true);
  ctx.fillStyle='rgba(236,222,172,.08)';ctx.fill(agar);
  BUB.forEach(function(b){var x=G.cx+b.u*(rx-12),y=G.surf+G.er+8+b.v*(G.bot-G.surf-G.er-8),r=b.r*px*.4;
    ctx.fillStyle='rgba(255,255,250,.12)';ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.strokeStyle='rgba(255,255,250,.55)';ctx.lineWidth=.7;ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(x-r*.35,y-r*.35,Math.max(.5,r*.25),0,7);ctx.fill()});
  ctx.restore();
  // agar surface
  var sf=ctx.createLinearGradient(0,G.surf-G.er,0,G.surf+G.er);sf.addColorStop(0,'rgba(248,238,204,.55)');sf.addColorStop(1,'rgba(240,226,180,.25)');
  ctx.fillStyle=sf;ctx.beginPath();ctx.ellipse(G.cx,G.surf,rx,G.er,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(150,125,70,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(G.cx,G.surf,rx,G.er,0,Math.PI,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(255,252,236,.85)';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(G.cx,G.surf,rx-1,G.er,0,0,Math.PI);ctx.stroke();
  ctx.strokeStyle='rgba(140,112,58,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(G.cx,G.surf+2.5,rx-1,G.er,0,.15,Math.PI-.15);ctx.stroke();
  // explant, callus, shoots
  var blobs=callusBlobs(o.callusMM);
  ctx.save();ctx.clip(jarInterior(2));
  drawExplant(ctx);drawCallus(ctx,s,blobs);drawShoots(ctx,s,o,blobs);
  ctx.restore();
  // front glass
  ctx.save();var jin=jarInterior(0);ctx.clip(jin);
  var gl=ctx.createLinearGradient(G.x0,0,G.x1,0);gl.addColorStop(0,'rgba(70,95,85,.32)');gl.addColorStop(.045,'rgba(70,95,85,.1)');gl.addColorStop(.11,'rgba(255,255,255,0)');gl.addColorStop(.87,'rgba(255,255,255,0)');gl.addColorStop(.95,'rgba(70,95,85,.12)');gl.addColorStop(1,'rgba(70,95,85,.34)');
  ctx.fillStyle=gl;ctx.fillRect(G.x0,G.top,G.JW,G.bot+G.er-G.top);
  var hx=G.x0+G.JW*.065,hw=G.JW*.045,hl=ctx.createLinearGradient(hx,0,hx+hw,0);hl.addColorStop(0,'rgba(255,255,255,0)');hl.addColorStop(.45,'rgba(255,255,255,.42)');hl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hl;ctx.fillRect(hx,G.top+12,hw,G.bot-G.top-4);
  ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(G.x1-G.JW*.085,G.top+20,2.2,G.bot-G.top-30);
  DROP.forEach(function(d){var x=G.x0+5+d.u*(G.JW-10),y=G.top+6+d.v*(G.surf-G.top-G.er-16),r=d.r*(.6+.6*Math.abs(d.u-.5));
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.ellipse(x,y,r,r*1.12,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(110,135,122,.28)';ctx.lineWidth=.5;ctx.beginPath();ctx.ellipse(x,y,r,r*1.12,0,.2,Math.PI-.2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(x-r*.35,y-r*.4,Math.max(.4,r*.28),0,7);ctx.fill()});
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(G.cx,G.bot,rx-1,G.er,0,.1,Math.PI-.1);ctx.stroke();
  ctx.restore();
  ctx.strokeStyle='rgba(95,122,108,.35)';ctx.lineWidth=3.5;ctx.beginPath();ctx.ellipse(G.cx,G.bot+3,G.JW/2-1,G.er,0,0,Math.PI);ctx.stroke();
  ctx.strokeStyle='rgba(92,120,106,.6)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(G.x0,G.top);ctx.lineTo(G.x0,G.bot);ctx.ellipse(G.cx,G.bot,G.JW/2,G.er,0,Math.PI,0,true);ctx.lineTo(G.x1,G.top);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(G.x0+3,G.top+8);ctx.lineTo(G.x0+3,G.bot-2);ctx.stroke();
  // lid
  var capH=Math.max(24,h*.06),lx0=G.x0-4,lx1=G.x1+4,lrx=(lx1-lx0)/2,ly0=G.top-capH,ly1=G.top+3;
  var lid=new Path2D();lid.moveTo(lx0,ly0);lid.lineTo(lx0,ly1);lid.ellipse(G.cx,ly1,lrx,G.er*.9,0,Math.PI,0,true);lid.lineTo(lx1,ly0);lid.ellipse(G.cx,ly0,lrx,G.er*.9,0,0,Math.PI,true);lid.closePath();
  var lg=ctx.createLinearGradient(lx0,0,lx1,0);lg.addColorStop(0,'#bfc7bb');lg.addColorStop(.16,'#eaeee6');lg.addColorStop(.32,'#f8f9f5');lg.addColorStop(.72,'#dfe4da');lg.addColorStop(1,'#b6beb1');
  ctx.save();ctx.shadowColor='rgba(30,40,25,.2)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;ctx.fillStyle=lg;ctx.fill(lid);ctx.restore();
  ctx.save();ctx.clip(lid);ctx.strokeStyle='rgba(60,70,55,.06)';ctx.lineWidth=1;for(var xx=lx0+3;xx<lx1;xx+=4.5){ctx.beginPath();ctx.moveTo(xx,ly0);ctx.lineTo(xx,ly1+G.er);ctx.stroke()}ctx.restore();
  ctx.fillStyle='#f4f6f1';ctx.beginPath();ctx.ellipse(G.cx,ly0,lrx,G.er*.9,0,0,7);ctx.fill();ctx.strokeStyle='rgba(60,70,55,.18)';ctx.lineWidth=1;ctx.stroke();
  ctx.strokeStyle='rgba(60,70,55,.22)';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(G.cx,ly1,lrx,G.er*.9,0,0,Math.PI);ctx.stroke();
  // label tape
  var tw=Math.min(G.JW*.7,250),th=Math.min(capH*.62,22);ctx.save();ctx.translate(G.cx,(ly0+ly1)/2+G.er*.45);ctx.rotate(-.018);
  ctx.shadowColor='rgba(0,0,0,.12)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;ctx.fillStyle='#fbf7e4';ctx.fillRect(-tw/2,-th/2,tw,th);ctx.shadowColor='transparent';
  ctx.fillStyle='#2b3d78';ctx.font='500 '+Math.round(th*.78)+'px Caveat, "Segoe Print", cursive';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('НОК '+conc(st.A)+' · БАП '+conc(st.C)+' мг/л',0,1);ctx.restore();
  // scale bar & medium note
  var sbx=G.x0+16,sby=G.top+30;ctx.strokeStyle=PAL.ink;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(sbx,sby);ctx.lineTo(sbx+10*px,sby);ctx.moveTo(sbx,sby-3);ctx.lineTo(sbx,sby+3);ctx.moveTo(sbx+10*px,sby-3);ctx.lineTo(sbx+10*px,sby+3);ctx.stroke();
  ctx.fillStyle=PAL.ink;ctx.font='11px "IBM Plex Mono", monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText('10 мм',sbx+5*px,sby-7);
  ctx.textAlign='left';ctx.fillStyle='rgba(105,82,36,.7)';ctx.font='10.5px "IBM Plex Mono", monospace';ctx.fillText('МС · 3 % сахарози · 0,7 % агару',G.x0+12,G.bot-6);
}

/* ---------- readouts ---------- */
var NAMES={R:['Ризогенез','утворення коренів','root'],S:['Каулогенез','утворення пагонів','shoot'],X:['Калусогенез','неорганізований поділ клітин','callus']};
function readouts(){
  var s=at(st.day),o=organs({R:s.R,S:s.S,X:s.X}),f=traj.f;
  [['R','fR'],['S','fS'],['X','fX']].forEach(function(p){$('amc-b'+p[0]).style.width=(f[p[1]]*100).toFixed(1)+'%';$('amc-t'+p[0]).textContent=num(f[p[1]],2)});
  var shorten=1-.45*sstep(1.5,7,st.A),el=1-.5*hill(st.C,1.2,2);
  var rr=o.roots.filter(function(r){return r.g>.1}),ss=o.shoots.filter(function(r){return r.g>.1});
  var rl=Math.max.apply(null,[0].concat(rr.map(function(r){return r.L*shorten}))),sh=Math.max.apply(null,[0].concat(ss.map(function(r){return r.H*el})));
  $('amc-oRn').textContent=rr.length;$('amc-oRl').textContent=rr.length?num(rl,0)+' мм':'—';
  $('amc-oSn').textContent=ss.length;$('amc-oSh').textContent=ss.length?num(sh,0)+' мм':'—';
  $('amc-oXd').textContent=o.callusMM?num(o.callusMM,0)+' мм':'—';
  $('amc-oM').textContent=num(Math.round((s.R+s.S+s.X)*1500),0);
  var v={R:s.R-SEED,S:s.S-SEED,X:s.X-SEED},ord=Object.keys(v).sort(function(a,b){return v[b]-v[a]}),el2=$('amc-verdict');
  var head='<span class="lbl">Прогноз на '+num(st.day,0)+' добу</span>';
  if(v[ord[0]]<.03){el2.innerHTML=head+'<b>Спокій експланта</b><span class="small muted">'+(st.day<5?'Триває індукція: клітини ще не почали ділитися.':'Гормонального сигналу замало, щоб запустити органогенез.')+'</span>'}
  else{var d=NAMES[ord[0]],sec=(v[ord[1]]>.12*v[ord[0]]&&v[ord[1]]>.03)?' Також помітний '+NAMES[ord[1]][0].toLowerCase()+'.':'';
    el2.innerHTML=head+'<b><span class="sw" style="background:var(--'+d[2]+')"></span>'+d[0]+'</b><span class="small muted">Переважає '+d[1]+'.'+sec+'</span>'}
  var notes=[];
  if(st.A>2.5&&rr.length)notes.push('Ауксин вище ≈ 2,5 мг/л: корені короткі й потовщені (дія етилену, розділ 6).');
  if(st.C>2.5&&ss.length)notes.push('БАП вище ≈ 2,5 мг/л: дрібні склоподібні листки, ознаки гіпергідричності.');
  if(st.C>.05&&st.A>.2&&f.fR<.3&&f.fX<.3&&f.fS<.3)notes.push('Цитокінін гальмує ризогенез навіть у малих концентраціях (K_C^R = '+num(P.KCr,2)+' мг/л).');
  $('amc-notes').textContent=notes.join(' ');
}

/* ---------- heat map ---------- */
var cvH=$('amc-heat'),heatImg=null,HN=120,HM={l:50,r:12,t:12,b:40};
function buildHeat(){var off=document.createElement('canvas');off.width=off.height=HN;var c2=off.getContext('2d'),img=c2.createImageData(HN,HN);
  var bg=hex(PAL.paper),cR=hex(PAL.root),cS=hex(PAL.shoot),cX=hex(PAL.callus);
  for(var j=0;j<HN;j++){var C=Math.pow(10,LMAX-(j+.5)/HN*(LMAX-LMIN));
    for(var i=0;i<HN;i++){var A=Math.pow(10,LMIN+(i+.5)/HN*(LMAX-LMIN)),f=rates(A,C),wR=f.fR*f.fR,wS=f.fS*f.fS,wX=f.fX*f.fX,sum=wR+wS+wX+1e-12,k=Math.pow(Math.min(1,Math.max(f.fR,f.fS,f.fX)),.75)*.92,p=(j*HN+i)*4;
      for(var c=0;c<3;c++){var m=(wR*cR[c]+wS*cS[c]+wX*cX[c])/sum;img.data[p+c]=bg[c]*(1-k)+m*k}img.data[p+3]=255}}
  c2.putImageData(img,0,0);heatImg=off}
function drawHeat(){var fr=fit(cvH),ctx=fr.ctx,w=fr.w,h=fr.h;ctx.clearRect(0,0,w,h);var pw=w-HM.l-HM.r,ph=h-HM.t-HM.b;
  function X(la){return HM.l+(la-LMIN)/(LMAX-LMIN)*pw}function Y(lc){return HM.t+(LMAX-lc)/(LMAX-LMIN)*ph}
  ctx.imageSmoothingEnabled=true;ctx.drawImage(heatImg,HM.l,HM.t,pw,ph);
  ctx.font='11px "IBM Plex Mono", monospace';ctx.fillStyle=PAL.muted;ctx.strokeStyle='rgba(27,38,28,.12)';ctx.lineWidth=1;
  [-2,-1,0,1].forEach(function(l){var lab=Number(Math.pow(10,l).toPrecision(1)).toLocaleString('uk-UA');
    ctx.beginPath();ctx.moveTo(X(l),HM.t);ctx.lineTo(X(l),HM.t+ph);ctx.moveTo(HM.l,Y(l));ctx.lineTo(HM.l+pw,Y(l));ctx.stroke();
    ctx.textAlign=l===1?'right':l===-2?'left':'center';ctx.fillText(lab,X(l),HM.t+ph+15);
    ctx.textAlign='right';ctx.fillText(lab,HM.l-6,Y(l)+(l===1?9:l===-2?-2:4))});
  ctx.textAlign='center';ctx.fillStyle=PAL.auxin;ctx.font='12px "IBM Plex Sans", sans-serif';ctx.fillText('Ауксин (НОК), мг/л',HM.l+pw/2,h-6);
  ctx.save();ctx.translate(13,HM.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillStyle=PAL.cyto;ctx.fillText('Цитокінін (БАП), мг/л',0,0);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(HM.l,HM.t,pw,ph);ctx.clip();ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(27,38,28,.35)';
  [1,0,-1].forEach(function(lr){ctx.beginPath();ctx.moveTo(X(LMIN),Y(LMIN-lr));ctx.lineTo(X(LMAX),Y(LMAX-lr));ctx.stroke()});
  ctx.setLineDash([]);ctx.fillStyle='rgba(27,38,28,.62)';ctx.font='10px "IBM Plex Mono", monospace';ctx.textAlign='left';
  [[1,'10:1'],[0,'1:1'],[-1,'1:10']].forEach(function(p){var lr=p[0],ea=lr>=0?LMAX:LMAX+lr,a=ea-.34,c=a-lr;ctx.fillText(p[1],X(a)+6,Y(c)+4)});
  ctx.restore();
  ctx.font='600 13px Literata, Georgia, serif';ctx.fillStyle='rgba(27,38,28,.78)';
  [['Корені',.6,-1.6,'right'],['Пагони',-1.75,.7,'left'],['Калус',.85,.45,'right'],['Спокій',-1.75,-1.75,'left']].forEach(function(p){ctx.textAlign=p[3];ctx.fillText(p[0],X(p[1]),Y(p[2]))});
  ctx.strokeStyle=PAL.line;ctx.strokeRect(HM.l+.5,HM.t+.5,pw-1,ph-1);
  var mx=X(Math.log10(st.A)),my=Y(Math.log10(st.C));
  ctx.lineWidth=3;ctx.strokeStyle=PAL.paper;ctx.beginPath();ctx.arc(mx,my,8,0,7);ctx.stroke();
  ctx.lineWidth=1.6;ctx.strokeStyle=PAL.ink;ctx.beginPath();ctx.arc(mx,my,8,0,7);ctx.stroke();ctx.fillStyle=PAL.ink;ctx.beginPath();ctx.arc(mx,my,2,0,7);ctx.fill()}
function heatPick(e){var r=cvH.getBoundingClientRect(),pw=r.width-HM.l-HM.r,ph=r.height-HM.t-HM.b;
  var la=LMIN+clamp((e.clientX-r.left-HM.l)/pw,0,1)*(LMAX-LMIN),lc=LMAX-clamp((e.clientY-r.top-HM.t)/ph,0,1)*(LMAX-LMIN);setConc(Math.pow(10,la),Math.pow(10,lc))}
var dragging=false;
cvH.addEventListener('pointerdown',function(e){dragging=true;try{cvH.setPointerCapture(e.pointerId)}catch(_){}heatPick(e)});
cvH.addEventListener('pointermove',function(e){if(dragging)heatPick(e)});
cvH.addEventListener('pointerup',function(){dragging=false});cvH.addEventListener('pointercancel',function(){dragging=false});
cvH.addEventListener('keydown',function(e){var k={ArrowRight:[.05,0],ArrowLeft:[-.05,0],ArrowUp:[0,.05],ArrowDown:[0,-.05]}[e.key];if(!k)return;e.preventDefault();setConc(Math.pow(10,Math.log10(st.A)+k[0]),Math.pow(10,Math.log10(st.C)+k[1]))});

/* ---------- time series ---------- */
var cvT=$('amc-ts'),TM={l:46,r:14,t:12,b:40};
function drawTS(){var fr=fit(cvT),ctx=fr.ctx,w=fr.w,h=fr.h;ctx.clearRect(0,0,w,h);var pw=w-TM.l-TM.r,ph=h-TM.t-TM.b;
  function X(d){return TM.l+d/TMAX*pw}function Y(v){return TM.t+(1-v)*ph}
  ctx.font='11px "IBM Plex Mono", monospace';ctx.lineWidth=1;
  [0,.25,.5,.75,1].forEach(function(v){ctx.strokeStyle='rgba(27,38,28,.1)';ctx.beginPath();ctx.moveTo(TM.l,Y(v));ctx.lineTo(TM.l+pw,Y(v));ctx.stroke();ctx.fillStyle=PAL.muted;ctx.textAlign='right';ctx.fillText(Math.round(v*100)+' %',TM.l-6,Y(v)+4)});
  for(var d=0;d<=TMAX;d+=7){ctx.fillStyle=PAL.muted;ctx.textAlign='center';ctx.fillText(d,X(d),TM.t+ph+15)}
  ctx.font='12px "IBM Plex Sans", sans-serif';ctx.fillText('Доба культивування',TM.l+pw/2,h-6);
  ctx.strokeStyle=PAL.line;ctx.beginPath();ctx.moveTo(TM.l,TM.t+ph+.5);ctx.lineTo(TM.l+pw,TM.t+ph+.5);ctx.stroke();
  var step=5;
  [['X','callus'],['S','shoot'],['R','root']].forEach(function(p){var arr=traj[p[0]],c=PAL[p[1]],i;
    ctx.fillStyle=rgba(c,.1);ctx.beginPath();ctx.moveTo(X(0),Y(0));for(i=0;i<arr.length;i+=step)ctx.lineTo(X(i*DT),Y(arr[i]));ctx.lineTo(X(TMAX),Y(arr[arr.length-1]));ctx.lineTo(X(TMAX),Y(0));ctx.closePath();ctx.fill();
    ctx.strokeStyle=c;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.beginPath();for(i=0;i<arr.length;i+=step){var x=X(i*DT),y=Y(arr[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.lineTo(X(TMAX),Y(arr[arr.length-1]));ctx.stroke()});
  var xd=X(st.day);ctx.strokeStyle='rgba(27,38,28,.5)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(xd,TM.t);ctx.lineTo(xd,TM.t+ph);ctx.stroke();ctx.setLineDash([]);
  var s=at(st.day);[['R','root'],['S','shoot'],['X','callus']].forEach(function(p){ctx.fillStyle=PAL[p[1]];ctx.strokeStyle=PAL.paper;ctx.lineWidth=2;ctx.beginPath();ctx.arc(xd,Y(s[p[0]]),4.5,0,7);ctx.fill();ctx.stroke()})}

/* ---------- Hill figure ---------- */
var cvHill=$('amc-hill'),hn=$('amc-hn'),hk=$('amc-hk');
function drawHill(){if(!cvHill)return;var n=+hn.value,K=Math.pow(10,+hk.value),fr=fit(cvHill),ctx=fr.ctx,w=fr.w,h=fr.h,m={l:40,r:12,t:12,b:36},pw=w-m.l-m.r,ph=h-m.t-m.b;
  ctx.clearRect(0,0,w,h);function X(l){return m.l+(l-LMIN)/(LMAX-LMIN)*pw}function Y(v){return m.t+(1-v)*ph}
  ctx.font='11px "IBM Plex Mono", monospace';ctx.lineWidth=1;
  [0,.5,1].forEach(function(v){ctx.strokeStyle=v===.5?'rgba(27,38,28,.22)':'rgba(27,38,28,.1)';ctx.setLineDash(v===.5?[3,3]:[]);ctx.beginPath();ctx.moveTo(m.l,Y(v));ctx.lineTo(m.l+pw,Y(v));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=PAL.muted;ctx.textAlign='right';ctx.fillText(num(v,v===.5?1:0),m.l-6,Y(v)+4)});
  [-2,-1,0,1].forEach(function(l){ctx.fillStyle=PAL.muted;ctx.textAlign=l===1?'right':l===-2?'left':'center';ctx.fillText(Number(Math.pow(10,l).toPrecision(1)).toLocaleString('uk-UA'),X(l),m.t+ph+15)});
  ctx.textAlign='center';ctx.font='12px "IBM Plex Sans", sans-serif';ctx.fillText('Концентрація x, мг/л',m.l+pw/2,h-4);
  function curve(nn,inv,col,lw,dash){ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.setLineDash(dash||[]);ctx.beginPath();for(var i=0;i<=200;i++){var l=LMIN+i/200*(LMAX-LMIN),v=hill(Math.pow(10,l),K,nn);if(inv)v=1-v;var x=X(l),y=Y(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.setLineDash([])}
  curve(1,false,'#c7cec1',1.4);curve(6,false,'#c7cec1',1.4);curve(n,true,PAL.auxin,2,[6,4]);curve(n,false,PAL.cyto,2.6);
  var xk=X(Math.log10(K));ctx.strokeStyle='rgba(27,38,28,.45)';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(xk,m.t);ctx.lineTo(xk,m.t+ph);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=PAL.ink;ctx.beginPath();ctx.arc(xk,Y(.5),4,0,7);ctx.fill();
  ctx.font='italic 13px Literata, Georgia, serif';ctx.textAlign=xk>m.l+pw-40?'right':'left';ctx.fillText('K',xk+(xk>m.l+pw-40?-6:6),m.t+12);
  $('amc-hnv').textContent=num(n,1);$('amc-hkv').textContent=conc(K)+' мг/л';
  var r=Math.pow(81,1/n);$('amc-hread').innerHTML='Щоб відповідь зросла з 10 % до 90 %, концентрацію треба збільшити у <b>'+num(r,r<10?1:0)+' раз'+(r<4.5?'и':'ів')+'</b>: від '+conc(K/Math.pow(9,1/n))+' до '+conc(K*Math.pow(9,1/n))+' мг/л.'}
if(hn&&hk){hn.addEventListener('input',drawHill);hk.addEventListener('input',drawHill);}

/* ---------- Thimann figure (SVG) ---------- */
function buildThimann(){var svg=$('amc-thimann'),W=520,H=320,m={l:40,r:14,t:26,b:42},pw=W-m.l-m.r,ph=H-m.t-m.b,x0=-12,x1=-2;
  function X(l){return m.l+(l-x0)/(x1-x0)*pw}function Y(v){return m.t+(1-(v+1)/2)*ph}
  function f(x,mu){return Math.exp(-Math.pow((x-mu)/1.0,2))-.9/(1+Math.exp(-(x-(mu+1.9))*2.4))}
  var out='';var lo=Math.log10(.01/MW_NAA*1e-3),hi=Math.log10(10/MW_NAA*1e-3);
  out+='<rect x="'+X(lo)+'" y="'+m.t+'" width="'+(X(hi)-X(lo))+'" height="'+ph+'" fill="#7d3b8c" fill-opacity=".07"/>';
  out+='<text x="'+((X(lo)+X(hi))/2)+'" y="'+(m.t+ph-8)+'" text-anchor="middle" style="fill:#7d3b8c">in vitro: 0,01–10 мг/л</text>';
  out+='<line x1="'+m.l+'" x2="'+(m.l+pw)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="#1b261c" stroke-opacity=".45"/>';
  var sup={'-12':'⁻¹²','-10':'⁻¹⁰','-8':'⁻⁸','-6':'⁻⁶','-4':'⁻⁴','-2':'⁻²'};
  for(var l=-12;l<=-2;l+=2){out+='<line x1="'+X(l)+'" x2="'+X(l)+'" y1="'+m.t+'" y2="'+(m.t+ph)+'" stroke="#1b261c" stroke-opacity=".08"/>';out+='<text x="'+X(l)+'" y="'+(m.t+ph+16)+'" text-anchor="'+(l===-12?'start':l===-2?'end':'middle')+'">10'+sup[l]+'</text>'}
  out+='<text x="'+(m.l+pw/2)+'" y="'+(H-6)+'" text-anchor="middle">концентрація ауксину, моль/л</text>';
  out+='<text x="'+(m.l+4)+'" y="'+(m.t+12)+'">стимуляція</text><text x="'+(m.l+4)+'" y="'+(m.t+ph-6)+'">гальмування</text>';
  [['корінь',-10,'#a2622a'],['брунька',-8,'#8a6f10'],['стебло',-5.4,'#3b8a2c']].forEach(function(c){var d='';for(var i=0;i<=160;i++){var x=x0+i/160*(x1-x0);d+=(i?'L':'M')+X(x).toFixed(1)+' '+Y(f(x,c[1])*.92).toFixed(1)}
    out+='<path d="'+d+'" fill="none" stroke="'+c[2]+'" stroke-width="2.4" stroke-linejoin="round"/>';
    out+='<text class="cl" x="'+X(c[1])+'" y="'+(Y(.92)-8)+'" text-anchor="middle" style="fill:'+c[2]+'">'+c[0]+'</text>'});
  svg.innerHTML=out}

/* ---------- controls & loop ---------- */
var sA=$('amc-sA'),sC=$('amc-sC'),sD=$('amc-sD'),playBtn=$('amc-play');
function setConc(A,C){st.A=clamp(A,.01,10);st.C=clamp(C,.01,10);sA.value=Math.log10(st.A);sC.value=Math.log10(st.C);simulate();render()}
sA.addEventListener('input',function(){st.A=Math.pow(10,+sA.value);simulate();render()});
sC.addEventListener('input',function(){st.C=Math.pow(10,+sC.value);simulate();render()});
sD.addEventListener('input',function(){stop();st.day=+sD.value;render()});
Array.prototype.forEach.call(document.querySelectorAll('#amc .presets button'),function(b){b.addEventListener('click',function(){setConc(+b.dataset.a,+b.dataset.c);if(st.day<1){st.day=28;sD.value=28;render()}})});

var disp=null,raf=0,last=0;
function kick(){if(!raf)raf=requestAnimationFrame(frame)}
function target(){var s=at(st.day);return{R:s.R,S:s.S,X:s.X,lA:Math.log10(st.A),lC:Math.log10(st.C)}}
function frame(ts){raf=0;
  if(st.playing){var dt=last?Math.min(.1,(ts-last)/1000):0;last=ts;st.day=Math.min(TMAX,st.day+dt*7);sD.value=st.day;texts();readouts();drawTS();if(st.day>=TMAX)stop()}
  var t=target();if(!disp||REDUCE)disp=Object.assign({},t);
  var mv=false,k=st.playing?.45:.14;for(var key in t){var d=t[key]-disp[key];if(Math.abs(d)>2e-4){disp[key]+=d*k;mv=true}else disp[key]=t[key]}
  drawVessel({R:disp.R,S:disp.S,X:disp.X,A:Math.pow(10,disp.lA),C:Math.pow(10,disp.lC)});
  if(mv||st.playing)kick()}
function stop(){st.playing=false;last=0;playBtn.textContent='▶ Пуск'}
playBtn.addEventListener('click',function(){if(st.playing){stop();return}if(st.day>=TMAX-.01){st.day=0;disp=null}st.playing=true;last=0;playBtn.textContent='❚❚ Пауза';kick()});

var PDEF=[
  ['muR','μ<sub>R</sub> · швидкість росту коренів',.1,.8,.01,'доба⁻¹'],
  ['muS','μ<sub>S</sub> · швидкість росту пагонів',.1,.8,.01,'доба⁻¹'],
  ['muX','μ<sub>X</sub> · швидкість росту калусу',.05,.8,.01,'доба⁻¹'],
  ['n','n · коефіцієнт Гілла',.5,5,.1,''],
  ['KAr','K<sub>A</sub><sup>R</sup> · поріг ауксину для коренів',.05,2,.01,'мг/л'],
  ['KCr','K<sub>C</sub><sup>R</sup> · гальмування коренів цитокініном',.02,2,.01,'мг/л'],
  ['KT','K<sub>T</sub> · поріг токсичності ауксину',.5,10,.1,'мг/л'],
  ['KCs','K<sub>C</sub><sup>S</sup> · поріг цитокініну для пагонів',.05,2,.01,'мг/л'],
  ['KAs','K<sub>A</sub><sup>S</sup> · гальмування пагонів ауксином',.02,2,.01,'мг/л'],
  ['KAx','K<sub>A</sub><sup>X</sup> · поріг ауксину для калусу',.1,5,.05,'мг/л'],
  ['KCx','K<sub>C</sub><sup>X</sup> · поріг цитокініну для калусу',.05,2,.01,'мг/л']];
var pBox=$('amc-params');
function showParam(k){var d=PDEF.filter(function(p){return p[0]===k})[0];$('amc-pv-'+k).textContent=num(P[k],d[4]<.1?2:1)+(d[5]?' '+d[5]:'')}
PDEF.forEach(function(d){var k=d[0],el=document.createElement('div');el.className='slider';
  el.innerHTML='<div class="hd"><label for="amc-p-'+k+'">'+d[1]+'</label><span class="val sub" id="amc-pv-'+k+'"></span></div><input id="amc-p-'+k+'" type="range" min="'+d[2]+'" max="'+d[3]+'" step="'+d[4]+'">';
  pBox.appendChild(el);var inp=el.querySelector('input');inp.value=P[k];
  inp.addEventListener('input',function(){P[k]=+inp.value;showParam(k);simulate();buildHeat();render()});showParam(k)});
$('amc-reset').addEventListener('click',function(){Object.assign(P,DEF);PDEF.forEach(function(d){$('amc-p-'+d[0]).value=P[d[0]];showParam(d[0])});simulate();buildHeat();render()});

function texts(){
  $('amc-vA').textContent=conc(st.A)+' мг/л';$('amc-vC').textContent=conc(st.C)+' мг/л';
  $('amc-uA').textContent='≈ '+conc(st.A/MW_NAA*1000)+' мкМ · M = 186,2 г/моль';
  $('amc-uC').textContent='≈ '+conc(st.C/MW_BAP*1000)+' мкМ · M = 225,3 г/моль';
  $('amc-vR').textContent=ratioStr(st.A,st.C);
  $('amc-vD').textContent=num(st.day,0)+' діб';$('amc-vDay').textContent='доба '+num(st.day,0)+' з 42'}
function render(){texts();if(!$('amc').getClientRects().length)return;readouts();drawHeat();drawTS();kick()}

sA.value=Math.log10(st.A);sC.value=Math.log10(st.C);sD.value=st.day;
simulate();buildHeat();buildThimann();render();drawHill();
var rto=0;function onResize(){clearTimeout(rto);rto=setTimeout(function(){render();drawHill()},60)}
if(window.ResizeObserver)new ResizeObserver(onResize).observe($('amc'));else window.addEventListener('resize',onResize);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){render();drawHill()});
})();
