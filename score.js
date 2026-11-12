const SH=[['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['A',1],['B',0]],
 FL=[['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];
const FIFTHS=[0,-5,2,-3,4,-1,6,1,-4,3,-2,5],MAJ=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],MIN=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const DUR=[[16,'whole',0],[12,'half',1],[8,'half',0],[6,'quarter',1],[4,'quarter',0],[3,'eighth',1],[2,'eighth',0],[1,'16th',0]];
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
function detectKey(notes){
 const h=Array(12).fill(0);notes.forEach(n=>h[n.m%12]+=n.d);
 const cor=(p,t)=>{const mp=p.reduce((x,y)=>x+y)/12,mh=h.reduce((x,y)=>x+y)/12;let a=0,b=0,c=0;
  for(let k=0;k<12;k++){const x=p[(k-t+12)%12]-mp,y=h[k]-mh;a+=x*y;b+=x*x;c+=y*y}return a/Math.sqrt(b*c||1)};
 let best={t:0,minor:false,s:-9};
 for(let t=0;t<12;t++)for(const mi of[false,true]){const s=cor(mi?MIN:MAJ,t);if(s>best.s)best={t,minor:mi,s}}
 return best}
function splitDur(d){const o=[];while(d>0){const x=DUR.find(z=>z[0]<=d);o.push(x);d-=x[0]}return o}
function noteXml(m,piece,fifths,chord,tie){
 const sp=(fifths<0?FL:SH)[m%12];
 return '<note>'+(chord?'<chord/>':'')+'<pitch><step>'+sp[0]+'</step>'+(sp[1]?'<alter>'+sp[1]+'</alter>':'')+'<octave>'+(Math.floor(m/12)-1)+'</octave></pitch><duration>'+piece[0]+'</duration>'
 +(tie.stop?'<tie type="stop"/>':'')+(tie.start?'<tie type="start"/>':'')+'<type>'+piece[1]+'</type>'+(piece[2]?'<dot/>':'')
 +((tie.stop||tie.start)?'<notations>'+(tie.stop?'<tied type="stop"/>':'')+(tie.start?'<tied type="start"/>':'')+'</notations>':'')+'</note>'}
function partMeasures(notes,M,nMeas,fifths){
 const ns=notes.slice().sort((a,b)=>a.s-b.s||a.m-b.m),groups=[];
 ns.forEach(n=>{const g=groups[groups.length-1];if(g&&g.s===n.s){g.ms.push(n.m);g.d=Math.min(g.d,n.d)}else groups.push({s:n.s,d:n.d,ms:[n.m]})});
 groups.forEach((g,i)=>{if(i<groups.length-1)g.d=Math.min(g.d,groups[i+1].s-g.s);g.d=Math.max(1,g.d)});
 const items=[];let pos=0;
 groups.forEach(g=>{if(g.s>pos)items.push({rest:1,s:pos,d:g.s-pos});items.push({rest:0,s:g.s,d:g.d,ms:g.ms});pos=g.s+g.d});
 if(pos<nMeas*M)items.push({rest:1,s:pos,d:nMeas*M-pos});
 const out=Array.from({length:nMeas},()=>[]);
 items.forEach(it=>{let s=it.s,left=it.d,first=true;
  while(left>0){const mi=Math.floor(s/M),chunk=Math.min(left,(mi+1)*M-s),ps=splitDur(chunk);
   ps.forEach((p,k)=>{const lastPiece=left-chunk<=0&&k===ps.length-1,tie={stop:!first,start:!lastPiece};
    if(it.rest){out[mi].push(chunk===M&&s%M===0?'<note><rest measure="yes"/><duration>'+M+'</duration></note>':'<note><rest/><duration>'+p[0]+'</duration><type>'+p[1]+'</type>'+(p[2]?'<dot/>':'')+'</note>')}
    else it.ms.forEach((m,j)=>out[mi].push(noteXml(m,p,fifths,j>0,tie)));
    first=false});
   s+=chunk;left-=chunk}});
 return out.map(a=>a.join(''))}
function buildXML(parts,o){
 const M=o.beats*4,end=Math.max(1,...parts.flatMap(p=>p.notes.map(n=>n.s+n.d))),nMeas=Math.ceil(end/M),key=detectKey(parts.flatMap(p=>p.notes));
 const fifths=FIFTHS[key.minor?(key.t+3)%12:key.t],clefs={S:'<sign>G</sign><line>2</line>',T:'<sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change>',B:'<sign>F</sign><line>4</line>'};
 let x='<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>'+esc(o.title)+'</work-title></work><part-list>'
 +parts.map((p,i)=>'<score-part id="P'+(i+1)+'"><part-name>'+esc(p.name)+'</part-name></score-part>').join('')+'</part-list>';
 parts.forEach((p,i)=>{const ms=partMeasures(p.notes,M,nMeas,fifths);
  x+='<part id="P'+(i+1)+'">'+ms.map((c,k)=>'<measure number="'+(k+1)+'">'+(k===0?'<attributes><divisions>4</divisions><key><fifths>'+fifths+'</fifths></key><time><beats>'+o.beats+'</beats><beat-type>4</beat-type></time><clef>'+clefs[p.clef]+'</clef></attributes>'
   +(i===0?'<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>'+o.bpm+'</per-minute></metronome></direction-type><sound tempo="'+o.bpm+'"/></direction>':''):'')+c+'</measure>').join('')+'</part>'});
 return{xml:x+'</score-partwise>',key:key,fifths:fifths}}
function snapD(d){if(d>16)return d;let b=1;[1,2,3,4,6,8,12,16].forEach(v=>{if(Math.abs(v-d)<Math.abs(b-d))b=v});return b}
function estimateBpm(raw){let best=90,bs=-1;
 for(let b=50;b<=180;b++){const gr=30/b;let c=0,s=0;
  raw.forEach(n=>{const w=n.amplitude||.5,a=2*Math.PI*n.startTimeSeconds/gr;c+=w*Math.cos(a);s+=w*Math.sin(a)});
  const sc=Math.hypot(c,s)/raw.length*Math.exp(-Math.pow(Math.log2(b/100),2)/.245);if(sc>bs){bs=sc;best=b}}
 return best}