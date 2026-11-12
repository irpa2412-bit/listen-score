function buildNames(){const d=$('names');d.innerHTML='';if($('mode').value!=='a'&&!midi)return;
 parts.forEach((p,i)=>{const l=document.createElement('label');l.textContent='Part '+(i+1)+' name';const x=document.createElement('input');x.className='pn';x.value=p.name;l.appendChild(x);d.appendChild(l)})}
const $=id=>document.getElementById(id),msg=s=>$('msg').textContent=s;
let BP,midi=null,lastF,lastO,autoT=false,clipBlob,raw=[],parts=[],xmlStr='',bp,osmd,ctx,rec,chunks=[],playing=[];
const opts=()=>({bpm:+$('bpm').value||90,beats:+$('ts').value,title:'Transcription',mode:$('mode').value,ph:+$('ph').value||60,maxp:Math.max(0,+$('maxp').value||0),an:[...document.querySelectorAll('.pn')].map(x=>x.value),cuts:[+$('c0').value,+$('c1').value,+$('c2').value],names:[$('n0').value,$('n1').value,$('n2').value,$('n3').value]});

async function loadBP(){msg('Loading the transcription engine (first time only)…');for(const u of['https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/+esm','https://esm.sh/@spotify/basic-pitch@1.0.1']){try{return await import(u)}catch(e){}}throw new Error('engine did not load. Check your internet connection')}
async function transcribe(arrayBuf){
 try{
  midi=null;msg('Reading audio…');
  const ac=new(window.AudioContext||window.webkitAudioContext)({sampleRate:22050});
  const buf=await ac.decodeAudioData(arrayBuf);ac.close();
  let data=buf.getChannelData(0);let pk=0;for(let i=0;i<data.length;i++){const v=Math.abs(data[i]);if(v>pk)pk=v}if(pk>0.001&&pk<0.9){const k=Math.min(8,0.9/pk);data=data.map(v=>v*k)}
  BP=BP||await loadBP();bp=bp||new BP.BasicPitch('https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json');
  const F=[],O=[],C=[];$('pg').style.display='block';$('pg').value=0;
  msg('Listening to every part… keep this page open.');
  await bp.evaluateModel(data,(f,o,c)=>{F.push(...f);O.push(...o);C.push(...c)},p=>$('pg').value=Math.round(p*100));
  lastF=F;lastO=O;autoT=true;$('pg').style.display='none';
  await render();
 }catch(e){$('pg').style.display='none';msg('Could not process this audio: '+e.message)}}

async function render(){
 if(!midi&&lastF){const th=[[.5,.3],[.35,.25],[.25,.2],[.18,.15]][+$('sens').value];raw=BP.noteFramesToTime(BP.outputToNotesPoly(lastF,lastO,th[0],th[1],6)).filter(n=>n.durationSeconds>=0.06)}
 if(!midi&&!raw.length){msg('No clear notes found. Try Maximum sensitivity, or a louder, closer recording.');return}
 if(autoT){$('bpm').value=estimateBpm(raw);autoT=false}
 const o=opts();parts=midi?midiParts(midi,o):makeParts(raw,o);if(!parts.length){msg(midi?'No pitched notes found in this MIDI file.':'No stable parts found. Try Maximum sensitivity or Piano mode.');return}
 const r=buildXML(parts,o);xmlStr=r.xml;
 try{
  osmd=osmd||new opensheetmusicdisplay.OpenSheetMusicDisplay('score',{autoResize:true,drawTitle:true,drawPartNames:true});
  await osmd.load(xmlStr);osmd.render();
 }catch(e){msg('Score drawing failed: '+e.message+'. You can still save the MusicXML.')}
 msg(parts.length+' part(s) · key '+['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'][r.key.t]+(r.key.minor?' minor':' major')+' · '+(midi?parts.reduce((a,p)=>a+p.notes.length,0):raw.length)+' notes · tempo '+o.bpm+'. Edit tempo or sensitivity, then tap Update score.');
 buildNames();['play','mid','xml','prt','upd'].forEach(i=>$(i).disabled=false)}
$('upd').onclick=()=>render();

$('file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const ab=await f.arrayBuffer();
 if(/\.midi?$/i.test(f.name)||/midi/i.test(f.type)){try{midi=parseMidi(ab);lastF=null;raw=[];autoT=false;$('names').innerHTML='';if(midi.bpm)$('bpm').value=midi.bpm;
  const b=midi.den===8?Math.round(midi.num/2):midi.num;$('ts').value=[2,3,4].includes(b)?String(b):'4';await render()}catch(x){midi=null;msg('Could not read this MIDI file: '+x.message)}}
 else transcribe(ab)};
$('rec').onclick=async()=>{
 if(rec&&rec.state==='recording'){rec.stop();return}
 try{const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  chunks=[];rec=new MediaRecorder(s,{audioBitsPerSecond:128000});rec.ondataavailable=e=>chunks.push(e.data);
  rec.onstop=async()=>{s.getTracks().forEach(t=>t.stop());$('rec').classList.remove('on');$('rec').textContent='Record';clearInterval(tm);clipBlob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});$('clip').disabled=false;transcribe(await clipBlob.arrayBuffer())};
  rec.start();$('rec').classList.add('on');const t0=Date.now();
  var tm=setInterval(()=>{$('rec').textContent='Stop '+Math.floor((Date.now()-t0)/1000)+'s';msg('Recording…')},500);$('rec').textContent='Stop 0s';
 }catch(e){msg('Microphone blocked. Allow it in Chrome: Site settings > Microphone.')}};

function stopPlay(){playing.forEach(o=>{try{o.stop()}catch(e){}});playing=[];$('play').textContent='Play'}
$('play').onclick=async()=>{
 if(playing.length)return stopPlay();
 ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();
 const g=60/opts().bpm/4,t=ctx.currentTime+.1;let end=0;
 parts.forEach(p=>p.notes.forEach(n=>{const o=ctx.createOscillator(),a=ctx.createGain(),s=t+n.s*g,d=n.d*g;
  o.type='triangle';o.frequency.value=440*2**((n.m-69)/12);a.gain.setValueAtTime(0,s);a.gain.linearRampToValueAtTime(.12,s+.02);a.gain.setValueAtTime(.12,s+Math.max(.03,d-.05));a.gain.linearRampToValueAtTime(0,s+d);
  o.connect(a);a.connect(ctx.destination);o.start(s);o.stop(s+d+.05);playing.push(o);end=Math.max(end,s+d)}));
 $('play').textContent='Stop';setTimeout(()=>{if(ctx.currentTime>=end-.1)stopPlay()},(end-ctx.currentTime+.3)*1000)};
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},5000)};
$('clip').onclick=()=>{const t=clipBlob.type,x=/mp4/.test(t)?'m4a':/ogg/.test(t)?'ogg':'webm';save(clipBlob,'recording-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.'+x)};
$('mid').onclick=()=>save(midiBlob(parts,opts().bpm,opts().mode==='p'?0:52),'transcription.mid');
$('xml').onclick=()=>save(new Blob([xmlStr],{type:'application/vnd.recordare.musicxml+xml'}),'transcription.musicxml');
$('prt').onclick=()=>print();
$('mode').onchange=()=>{const p=$('mode').value==='p';$('n3').value=p?'Piano (right hand)':'Soprano';$('n0').value=p?'Piano (left hand)':'Bass'};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');