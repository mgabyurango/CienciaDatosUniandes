'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const H=4, MAX=6, CAP=4, BENCHMARK_SIZE=80, MIN_TRAIN=20;
const ACTIONS=['ESPERAR','DESPACHAR'];
// The simulation lives on the server, not in the browser.
const CONGESTION_TRANSITION=[[.72,.28],[.42,.58]];
const PAIRS=[];
for(let t=0;t<H;t++)for(let p=0;p<=MAX;p++)for(let v=0;v<2;v++)for(let c=0;c<2;c++)
  for(const a of (p&&v?ACTIONS:['ESPERAR']))PAIRS.push({s:[t,p,v,c],a,key:[t,p,v,c,a].join('|')});

const qKey=(s,a)=>s.concat(a).join('|');
const valid=s=>s[1]&&s[2]?ACTIONS:['ESPERAR'];
const DB=process.env.DATA_FILE||path.join(__dirname,'data','state.json');
let db={rooms:{},users:{},sessions:{}};
try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch{}
db.rooms=db.rooms||{};db.users=db.users||{};db.sessions=db.sessions||{};
for(const room of Object.values(db.rooms))room.starts=room.starts||{};
for(const user of Object.values(db.users)){
  user.Q=user.Q||{};user.N=user.N||{};user.starts=user.starts||{};
  user.episodes=user.episodes||0;user.scores=user.scores||[];
}
const save=()=>{
  fs.mkdirSync(path.dirname(DB),{recursive:true});
  fs.writeFileSync(DB+'.tmp',JSON.stringify(db));
  fs.renameSync(DB+'.tmp',DB);
};
const pick=items=>items[crypto.randomInt(items.length)];
const poisson=(lambda,random)=>{let product=1,n=0;do{n++;product*=random()}while(product>Math.exp(-lambda));return n-1};
const seedRandom=initial=>{let seed=initial>>>0;return ()=>{
  seed=(seed+0x6D2B79F5)>>>0;
  let x=Math.imul(seed^(seed>>>15),seed|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return((x^(x>>>14))>>>0)/4294967296;
}};
function step(s,a,random=Math.random){
  if(!valid(s).includes(a))throw Error('Acción inválida');
  const [t,p,v,c]=s;
  const delivered=a==='DESPACHAR'?Math.min(CAP,p):0;
  const remaining=p-delivered, final=t===H-1;
  const arrivals=final?0:poisson(c?2.3:1.7,random);
  const rejected=final?0:Math.max(0,remaining+arrivals-MAX);
  const breakdown={
    income:30*delivered,
    dispatch:delivered?35:0,
    congestion:delivered&&c?15:0,
    waiting:6*remaining,
    rejected:20*rejected,
    unfinished:final?20*remaining:0
  };
  const reward=breakdown.income-breakdown.dispatch-breakdown.congestion-breakdown.waiting-breakdown.rejected-breakdown.unfinished;
  const next=final?null:[t+1,Math.min(MAX,remaining+arrivals),a==='DESPACHAR'?0:1,random()<CONGESTION_TRANSITION[c][1]?1:0];
  return {next,reward,delivered,arrivals,rejected,unfinished:final?remaining:0,breakdown};
}
function updateQ(user,trail){
  let ret=0;const returns=[];
  for(let i=trail.length-1;i>=0;i--){ret+=trail[i].reward;returns[i]=ret}
  const visited=new Set();
  trail.forEach((entry,i)=>{
    const k=qKey(entry.state,entry.action);
    if(visited.has(k))return;
    visited.add(k);
    const n=(user.N[k]||0)+1;
    user.Q[k]=(user.Q[k]||0)+(returns[i]-(user.Q[k]||0))/n;
    user.N[k]=n;
  });
  user.scores.push(ret);
  // Prevent unbounded JSON growth in large classroom sessions.
  if(user.scores.length>500)user.scores=user.scores.slice(-500);
  user.episodes++;
  return ret;
}
function startPair(user){
  const room=db.rooms[user.room];
  const minimum=Math.min(...PAIRS.map(x=>room.starts[x.key]||0));
  const candidate=pick(PAIRS.filter(x=>(room.starts[x.key]||0)===minimum));
  room.starts[candidate.key]=(room.starts[candidate.key]||0)+1;
  user.starts[candidate.key]=(user.starts[candidate.key]||0)+1;
  return candidate;
}
function greedy(user,state,randomTie=false){
  const choices=valid(state);
  if(choices.length===1)return choices[0];
  const estimates=choices.map(a=>user.Q[qKey(state,a)]||0);
  const highest=Math.max(...estimates);
  const best=choices.filter((a,i)=>Math.abs(estimates[i]-highest)<1e-9);
  return randomTie?pick(best):best[0];
}
function policyMap(user){
  const result=[];
  for(let t=0;t<H;t++)for(let c=0;c<2;c++)for(let p=0;p<=MAX;p++){
    const s=[t,p,1,c],w=qKey(s,'ESPERAR'),d=qKey(s,'DESPACHAR');
    const nWait=user.N[w]||0,nDispatch=user.N[d]||0;
    result.push({t,c,p,action:p?greedy(user,s):'ESPERAR',nWait,nDispatch,qWait:nWait?user.Q[w]:null,qDispatch:nDispatch?user.Q[d]:null});
  }
  return result;
}
function benchmark(user){
  let sum=0,missed=0,delivered=0;
  for(let i=0;i<BENCHMARK_SIZE;i++){
    const initial=seedRandom((0x51F15EED+Math.imul(i+1,7919))>>>0);
    const state=[i%H,Math.floor(initial()*7),Math.floor(initial()*2),Math.floor(initial()*2)];
    const random=seedRandom((0xC1A55EED+Math.imul(i+1,9973))>>>0);
    let s=state;
    while(s){
      const o=step(s,greedy(user,s),random);
      sum+=o.reward;missed+=o.rejected+o.unfinished;delivered+=o.delivered;
      s=o.next;
    }
  }
  return {average:sum/BENCHMARK_SIZE,missed,delivered,episodes:user.episodes,at:Date.now(),size:BENCHMARK_SIZE,version:1};
}
function leaderboard(room){
  const users=Object.values(db.users).filter(u=>u.room===room&&u.eval&&u.eval.version===1);
  users.sort((a,b)=>b.eval.average-a.eval.average||a.eval.missed-b.eval.missed||a.alias.localeCompare(b.alias));
  let last=null,rank=0;
  return users.slice(0,40).map((u,i)=>{
    const same=last&&Math.abs(last.average-u.eval.average)<1e-9&&last.missed===u.eval.missed;
    if(!same)rank=i+1;
    last=u.eval;
    return {rank,alias:u.alias,average:u.eval.average,missed:u.eval.missed,delivered:u.eval.delivered,evaluatedAt:u.eval.episodes,episodes:u.episodes,stale:u.episodes!==u.eval.episodes};
  });
}
function view(user){
  const ss=db.sessions[user.id];
  const s=ss&&!ss.done?ss.state:null;
  const learned=Object.keys(user.N).filter(k=>user.N[k]>0).length;
  return {
    alias:user.alias,room:user.room,episodes:user.episodes,coverage:Object.keys(user.starts).length,
    learned,total:PAIRS.length,minimum:MIN_TRAIN,benchmarkSize:BENCHMARK_SIZE,
    evaluation:user.eval||null,
    session:ss?{state:s,done:ss.done,first:ss.first,forced:ss.forced,trail:ss.trail,total:Math.round(ss.trail.reduce((v,z)=>v+z.reward,0)*100)/100}:null,
    q:s?Object.fromEntries(valid(s).map(a=>[a,{value:user.Q[qKey(s,a)]??null,n:user.N[qKey(s,a)]||0}])):{},
    policy:policyMap(user),leaders:leaderboard(user.room)
  };
}
function api(url,b){
  if(url==='/api/join'){
    const room=String(b.room||'CLASE').trim().toUpperCase();
    const alias=String(b.alias||'').trim().slice(0,32);
    if(!/^[A-Z0-9-]{3,20}$/.test(room)||alias.length<2)throw Error('Sala (3–20 letras/números) o alias inválido');
    const id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('hex');
    db.rooms[room]??={starts:{}};
    const user=db.users[id]={id,token,room,alias,Q:{},N:{},starts:{},scores:[],episodes:0};
    save();
    return {userId:id,token,...view(user)};
  }
  const user=db.users[b.userId];
  if(!user||user.token!==b.token||user.room!==b.room)throw Error('Sesión inválida. Vuelve a entrar.');
  if(url==='/api/state')return view(user);
  if(url==='/api/start'){
    if(db.sessions[user.id]&&!db.sessions[user.id].done)throw Error('Termina primero la partida actual');
    const z=startPair(user);
    db.sessions[user.id]={state:z.s,forced:z.a,first:true,done:false,trail:[]};
    save();return view(user);
  }
  if(url==='/api/act'){
    const ss=db.sessions[user.id];
    if(!ss||ss.done)throw Error('No hay partida activa');
    if(ss.first&&b.action!==ss.forced)throw Error('El inicio exploratorio exige la acción marcada');
    const state=ss.state,o=step(state,b.action);
    ss.trail.push({state,action:b.action,reward:o.reward,delivered:o.delivered,arrivals:o.arrivals,rejected:o.rejected,unfinished:o.unfinished,breakdown:o.breakdown,next:o.next});
    ss.state=o.next;ss.first=false;
    if(!o.next){updateQ(user,ss.trail);ss.done=true}
    save();return view(user);
  }
  if(url==='/api/train'){
    if(db.sessions[user.id]&&!db.sessions[user.id].done)throw Error('Termina la partida manual antes de entrenar');
    const count=Math.max(1,Math.min(100,Math.floor(Number(b.count)||1)));
    for(let i=0;i<count;i++){
      const z=startPair(user);
      const ss={state:z.s,forced:z.a,first:true,done:false,trail:[]};
      let state=z.s,action=z.a;
      while(state){
        const o=step(state,action);
        ss.trail.push({state,action,reward:o.reward,delivered:o.delivered,arrivals:o.arrivals,rejected:o.rejected,unfinished:o.unfinished,breakdown:o.breakdown,next:o.next});
        state=o.next;
        if(state)action=greedy(user,state,true);
      }
      updateQ(user,ss.trail);ss.state=null;ss.first=false;ss.done=true;
      db.sessions[user.id]=ss;
    }
    save();return view(user);
  }
  if(url==='/api/evaluate'){
    if(user.episodes<MIN_TRAIN)throw Error('Necesitas al menos '+MIN_TRAIN+' episodios de entrenamiento para competir');
    user.eval=benchmark(user);
    save();return view(user);
  }
  throw Error('Ruta inválida');
}
http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200);return res.end('ok')}
  if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'});
    return fs.createReadStream(path.join(__dirname,'public','index.html')).pipe(res);
  }
  if(req.method==='POST'&&req.url&&req.url.startsWith('/api/')){
    let raw='';
    req.on('data',chunk=>{raw+=chunk;if(raw.length>10000)req.destroy()});
    return req.on('end',()=>{
      try{const out=api(req.url,JSON.parse(raw||'{}'));res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(out))}
      catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}))}
    });
  }
  res.writeHead(404);res.end('Not found');
}).listen(Number(process.env.PORT||3000));