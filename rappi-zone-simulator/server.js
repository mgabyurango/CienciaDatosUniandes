'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const H=4,MAX=6,CAP=4,acts=['ESPERAR','DESPACHAR'],P=[[.72,.28],[.42,.58]];
const pairs=[];for(let t=0;t<H;t++)for(let p=0;p<=MAX;p++)for(let v=0;v<2;v++)for(let c=0;c<2;c++)for(let a of (p&&v?acts:['ESPERAR']))pairs.push({s:[t,p,v,c],a,key:[t,p,v,c,a].join('|')});
const key=(s,a)=>[...s,a].join('|'),valid=s=>s[1]&&s[2]?acts:['ESPERAR'];
const DB=process.env.DATA_FILE||path.join(__dirname,'data','state.json');let db={rooms:{},users:{},sessions:{}};try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch{}
const save=()=>{fs.mkdirSync(path.dirname(DB),{recursive:true});fs.writeFileSync(DB+'.tmp',JSON.stringify(db));fs.renameSync(DB+'.tmp',DB)};
const pick=a=>a[crypto.randomInt(a.length)];
const poisson=l=>{let p=1,n=0;do{n++;p*=Math.random()}while(p>Math.exp(-l));return n-1};
function step(s,a){if(!valid(s).includes(a))throw Error('Acción inválida');let [t,p,v,c]=s,d=a==='DESPACHAR'?Math.min(CAP,p):0,left=p-d,r=30*d-(d?35+15*c:0)-6*left;
if(t===H-1)return{next:null,reward:r-20*left,delivered:d,arrivals:0};
let arrivals=poisson(c?2.3:1.7),rejected=Math.max(0,left+arrivals-MAX);r-=20*rejected;
return{next:[t+1,Math.min(MAX,left+arrivals),a==='DESPACHAR'?0:1,Math.random()<P[c][1]?1:0],reward:r,delivered:d,arrivals}}
function finish(u,ss){let g=0,returns=[];for(let i=ss.trail.length-1;i>=0;i--){g+=ss.trail[i].reward;returns[i]=g}
let seen=new Set();ss.trail.forEach((z,i)=>{let k=key(z.state,z.action);if(seen.has(k))return;seen.add(k);let n=(u.N[k]||0)+1;u.Q[k]=(u.Q[k]||0)+(returns[i]-(u.Q[k]||0))/n;u.N[k]=n});u.scores.push(g);u.episodes++;ss.done=true}
function start(u){let room=db.rooms[u.room],minimum=Math.min(...pairs.map(x=>room.starts[x.key]||0)),z=pick(pairs.filter(x=>(room.starts[x.key]||0)===minimum));room.starts[z.key]=(room.starts[z.key]||0)+1;u.starts[z.key]=(u.starts[z.key]||0)+1;return z}
function view(u){let ss=db.sessions[u.id],s=ss&&!ss.done?ss.state:null;return{alias:u.alias,room:u.room,episodes:u.episodes,coverage:Object.keys(u.starts).length,total:pairs.length,session:ss?{state:s,done:ss.done,first:ss.first,forced:ss.forced,trail:ss.trail}:null,q:s?Object.fromEntries(valid(s).map(a=>[a,{value:u.Q[key(s,a)]??null,n:u.N[key(s,a)]||0}])):{},leaders:Object.values(db.users).filter(x=>x.room===u.room&&x.episodes).map(x=>({alias:x.alias,episodes:x.episodes,average:x.scores.reduce((a,b)=>a+b,0)/x.scores.length})).sort((a,b)=>b.average-a.average).slice(0,20)}}
function api(url,b){if(url==='/api/join'){let room=String(b.room||'CLASE').trim().toUpperCase().slice(0,20),alias=String(b.alias||'').trim().slice(0,32);if(!/^[A-Z0-9-]{3,20}$/.test(room)||alias.length<2)throw Error('Sala o alias inválido');let id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('hex');db.rooms[room]??={starts:{}};let u=db.users[id]={id,token,room,alias,Q:{},N:{},starts:{},scores:[],episodes:0};save();return{userId:id,token,...view(u)}}
let u=db.users[b.userId];if(!u||u.token!==b.token||u.room!==b.room)throw Error('Sesión inválida');
if(url==='/api/state')return view(u);
if(url==='/api/start'){if(db.sessions[u.id]&&!db.sessions[u.id].done)throw Error('Termina primero la partida');let z=start(u);db.sessions[u.id]={state:z.s,forced:z.a,first:true,done:false,trail:[]};save();return view(u)}
if(url==='/api/act'){let ss=db.sessions[u.id];if(!ss||ss.done)throw Error('No hay episodio');if(ss.first&&b.action!==ss.forced)throw Error('Debes realizar la acción del inicio exploratorio');let s=ss.state,o=step(s,b.action);ss.trail.push({state:s,action:b.action,reward:o.reward,delivered:o.delivered,arrivals:o.arrivals});ss.state=o.next;ss.first=false;if(!o.next)finish(u,ss);save();return view(u)}
if(url==='/api/train'){if(db.sessions[u.id]&&!db.sessions[u.id].done)throw Error('Termina el episodio manual');let count=Math.max(1,Math.min(100,Math.floor(Number(b.count)||1)));for(let i=0;i<count;i++){let z=start(u),s=z.s,a=z.a,ss={trail:[],done:false};while(s){let o=step(s,a);ss.trail.push({state:s,action:a,reward:o.reward,delivered:o.delivered,arrivals:o.arrivals});s=o.next;if(s){let candidates=valid(s),m=Math.max(...candidates.map(x=>u.Q[key(s,x)]||0));a=pick(candidates.filter(x=>(u.Q[key(s,x)]||0)>=m-1e-10))}}finish(u,ss);db.sessions[u.id]={state:null,first:false,forced:z.a,done:true,trail:ss.trail}}save();return view(u)}
throw Error('Ruta inválida')}
http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200);return res.end('ok')}
if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(__dirname,'public','index.html')).pipe(res)}
if(req.method==='POST'&&req.url.startsWith('/api/')){let raw='';req.on('data',x=>{raw+=x;if(raw.length>10000)req.destroy()});return req.on('end',()=>{try{let obj=api(req.url,JSON.parse(raw||'{}'));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(obj))}catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}))}})}
res.writeHead(404);res.end('Not found')}).listen(Number(process.env.PORT||3000));