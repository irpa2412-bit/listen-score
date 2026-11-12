function pianoParts(raw,o){
 const g=60/o.bpm/4,rs=raw.slice().sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds),t0=rs[0].startTimeSeconds,mx=Math.max(...rs.map(n=>n.amplitude||0))||1;
 let gs=-9;const ns=[];
 rs.forEach(n=>{if(n.startTimeSeconds-gs>0.06)gs=n.startTimeSeconds;if((n.amplitude||0)>=0.2*mx)ns.push({m:Math.round(n.pitchMidi),a:n.amplitude||0,s:Math.round((gs-t0)/g),d:Math.max(1,Math.round(n.durationSeconds/g))})});
 const mk=(arr,name,clef)=>{const by={};arr.forEach(n=>(by[n.s]=by[n.s]||[]).push(n));
  const gl=Object.keys(by).map(Number).sort((a,b)=>a-b).map(s=>{const c=by[s].sort((a,b)=>b.a-a.a).slice(0,4);return{s,d:Math.max(...c.map(n=>n.d)),c}});
  gl.forEach((x,k)=>{const nx=gl[k+1];if(nx){const gap=nx.s-(x.s+x.d);if(gap>0&&gap<=2)x.d=nx.s-x.s}x.d=snapD(x.d)});
  return{name,clef,notes:gl.flatMap(x=>x.c.map(n=>({m:n.m,s:x.s,d:x.d})))}};
 return[mk(ns.filter(n=>n.m>=o.ph),o.names[3],'S'),mk(ns.filter(n=>n.m<o.ph),o.names[0],'B')].filter(p=>p.notes.length)}
function autoParts(raw,o){
 const g=60/o.bpm/4,rs=raw.slice().sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds),t0=rs[0].startTimeSeconds,mx=Math.max(...rs.map(n=>n.amplitude||0))||1;
 const ns=rs.filter(n=>(n.amplitude||0)>=0.12*mx).map(n=>({m:Math.round(n.pitchMidi),a:n.amplitude||0,s:Math.round((n.startTimeSeconds-t0)/g),d:Math.max(1,Math.round(n.durationSeconds/g))}));
 const by={};ns.forEach(n=>(by[n.s]=by[n.s]||[]).push(n));
 const G=Object.keys(by).map(Number).sort((a,b)=>a-b).map(s=>({s,c:by[s]}));
 if(!G.length)return[];
 G.forEach(x=>{const seen=new Set();x.c=x.c.filter(n=>!seen.has(n.m)&&seen.add(n.m)).sort((a,b)=>b.a-a.a)});
 const sz=G.map(x=>x.c.length).sort((a,b)=>a-b),N=o.maxp>0?o.maxp:Math.max(1,sz[Math.floor(sz.length*0.8)]);
 G.forEach(x=>{x.c=x.c.slice(0,N).sort((a,b)=>b.m-a.m)});
 const sd=(G.find(x=>x.c.length>=N)||G[0]).c,T=Array.from({length:N},(_,j)=>({reg:j<sd.length?sd[j].m:sd[sd.length-1].m-5*(j-sd.length+1),last:null,end:-9,notes:[]}));
 G.forEach(x=>{const k=x.c.length,cost=(i,j)=>{const t=T[j],ref=t.last==null?t.reg:t.last,gap=t.last==null?0:Math.min(32,Math.max(0,x.s-t.end));return Math.abs(x.c[i].m-ref)+0.2*gap+(t.end-1>x.s?4:0)};
  const dp=Array.from({length:k+1},()=>Array(N+1).fill(1e9)),bk=Array.from({length:k+1},()=>Array(N+1).fill(0));
  for(let j=0;j<=N;j++)dp[0][j]=0;
  for(let i=1;i<=k;i++)for(let j=1;j<=N;j++){const a=dp[i][j-1],b=dp[i-1][j-1]+cost(i-1,j-1);if(b<=a){dp[i][j]=b;bk[i][j]=1}else dp[i][j]=a}
  let j=N;for(let i=k;i>0&&j>0;){if(bk[i][j]){const t=T[j-1],n=x.c[i-1];t.notes.push(n);t.last=n.m;t.end=n.s+n.d;i--;j--}else j--}});
 const ps=T.filter(t=>t.notes.length>=3).map(t=>({t,mean:t.notes.reduce((a,n)=>a+n.m,0)/t.notes.length})).sort((a,b)=>b.mean-a.mean);
 return ps.map((p,i)=>{const nt=p.t.notes;nt.forEach((n,k)=>{const nx=nt[k+1];if(nx){const gap=nx.s-(n.s+n.d);if(gap>0&&gap<=2)n.d=nx.s-n.s}n.d=snapD(n.d)});
  return{name:o.an[i]||'Voice '+(i+1),clef:p.mean>=60?'S':p.mean>=50?'T':'B',notes:nt}})}
function parseMidi(buf){
 const d=new DataView(buf),u=new Uint8Array(buf);let p=0;
 const r32=()=>{const v=d.getUint32(p);p+=4;return v},r16=()=>{const v=d.getUint16(p);p+=2;return v};
 if(r32()!==0x4d546864)throw new Error('this is not a MIDI file');r32();r16();const nt=r16(),div=r16();
 if(div&0x8000)throw new Error('this MIDI timing type is not supported');
 const out={ppq:div,bpm:0,num:0,den:4,chs:{}};
 for(let t=0;t<nt&&p<u.length;t++){
  if(r32()!==0x4d54726b)break;const len=r32(),end=p+len;let tick=0,run=0,name='';const on={};
  const rv=()=>{let v=0,b;do{b=u[p++];v=(v<<7)|(b&127)}while(b&128);return v};
  while(p<end){tick+=rv();let st=u[p];if(st<128)st=run;else p++;
   if(st===0xFF){const ty=u[p++],l=rv(),q=p;p+=l;
    if(ty===3&&!name)name=new TextDecoder().decode(u.subarray(q,q+l));
    if(ty===0x51&&!out.bpm)out.bpm=Math.round(6e7/((u[q]<<16)|(u[q+1]<<8)|u[q+2]));
    if(ty===0x58&&!out.num){out.num=u[q];out.den=1<<u[q+1]}
    if(ty===0x2F)break}
   else if(st===0xF0||st===0xF7){p+=rv()}
   else{run=st;const k=st&0xF0,c=st&15,a=u[p++],v=(k===0xC0||k===0xD0)?0:u[p++],key=t+'-'+c,x=out.chs[key]=out.chs[key]||{name,prog:-1,notes:[],t,c};
    if(k===0xC0&&x.prog<0)x.prog=a;
    if(k===0x90&&v>0){(on[key+'-'+a]=on[key+'-'+a]||[]).push(tick)}
    else if(k===0x80||(k===0x90&&v===0)){const q=on[key+'-'+a];if(q&&q.length)x.notes.push({m:a,s:q.shift(),e:tick})}}}
  p=end}
 return out}
function midiParts(m,o){
 const g=m.ppq/4,FAM=['Piano','Chromatic percussion','Organ','Guitar','Bass','Strings','Ensemble','Brass','Reed','Pipe','Synth lead','Synth pad','Synth effects','Ethnic','Percussive','Sound effects'];
 const ps=Object.values(m.chs).filter(x=>x.c!==9&&x.notes.length).map(x=>{
  const nt=x.notes.map(n=>({m:n.m,s:Math.round(n.s/g),d:Math.max(1,Math.round((n.e-n.s)/g))})),mean=nt.reduce((a,n)=>a+n.m,0)/nt.length;
  return{name:x.name||(x.prog>=52&&x.prog<=54?'Choir':x.prog>=0?FAM[x.prog>>3]:'Part'),clef:mean>=60?'S':mean>=50?'T':'B',notes:nt,mean}}).sort((a,b)=>b.mean-a.mean);
 return ps.map((p,i)=>({name:o.an[i]||p.name,clef:p.clef,notes:p.notes}))}
function makeParts(raw,o){
 if(o.mode==='a')return autoParts(raw,o);
 if(o.mode==='p')return pianoParts(raw,o);
 const g=60/o.bpm/4,t0=Math.min(...raw.map(n=>n.startTimeSeconds)),P=[{clef:'B'},{clef:'T'},{clef:'S'},{clef:'S'}].map((p,i)=>({name:o.names[i],clef:p.clef,notes:[]}));
 raw.forEach(n=>{const m=Math.round(n.pitchMidi),i=m<o.cuts[0]?0:m<o.cuts[1]?1:m<o.cuts[2]?2:3;
  P[i].notes.push({m,a:n.amplitude||0,s:Math.round((n.startTimeSeconds-t0)/g),d:Math.max(1,Math.round(n.durationSeconds/g))})});
 P.forEach(p=>{p.notes.sort((a,b)=>a.s-b.s||b.a-a.a);const one=[];
  p.notes.forEach(n=>{if(!one.length||one[one.length-1].s!==n.s)one.push(n)});
  one.forEach((n,k)=>{const nx=one[k+1];if(nx){const gap=nx.s-(n.s+n.d);if(gap>0&&gap<=2)n.d=nx.s-n.s}n.d=snapD(n.d)});
  p.notes=one});
 return P.filter(p=>p.notes.length).reverse()}
function midiBlob(parts,bpm,pr=52){
 const ppq=480,e=ppq/4,vl=d=>{const v=[d&127];while(d>>=7)v.unshift((d&127)|128);return v};
 const trk=a=>{const L=a.length;return[0x4d,0x54,0x72,0x6b,L>>24&255,L>>16&255,L>>8&255,L&255,...a]};
 const mpq=Math.round(6e7/bpm),T=[trk([0,0xFF,0x51,3,mpq>>16&255,mpq>>8&255,mpq&255,0,0xFF,0x2F,0])];
 parts.forEach((p,i)=>{const ch=i%15,c=ch<9?ch:ch+1,ev=[];
  p.notes.forEach(n=>{ev.push({t:n.s*e,b:[0x90|c,n.m,90],o:1});ev.push({t:(n.s+n.d)*e,b:[0x80|c,n.m,0],o:0})});
  ev.sort((a,b)=>a.t-b.t||a.o-b.o);
  const nm=[...new TextEncoder().encode(String(p.name||'Part').slice(0,40))],a=[0,0xFF,3,nm.length,...nm,0,0xC0|c,pr];
  let q=0;ev.forEach(x=>{a.push(...vl(x.t-q),...x.b);q=x.t});a.push(0,0xFF,0x2F,0);T.push(trk(a))});
 return new Blob([new Uint8Array([0x4d,0x54,0x68,0x64,0,0,0,6,0,1,T.length>>8,T.length&255,ppq>>8,ppq&255,...T.flat()])],{type:'audio/midi'})}