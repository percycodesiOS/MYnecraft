import http from 'node:http';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync,realpathSync,statSync } from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL,fileURLToPath } from 'node:url';
import path from 'node:path';

export const BLOCKS=Object.freeze(['grass','dirt','stone','sand','wood','leaves','planks','brick','snow','glow','glass','water','orange','blue','cherrywood','sprucewood','pinewood','concrete','copperore','ironore','cherryplanks','spruceplanks','pineplanks','cherryleaves','whiteconcrete','redconcrete','yellowconcrete','blueconcrete']);
const BOUNDS=Object.freeze({minX:-96,maxX:128,minY:-39,maxY:60,minZ:-96,maxZ:96});
const key=(x,y,z)=>`${x},${y},${z}`;
const digest=value=>createHash('sha256').update(value).digest();
const token=()=>randomBytes(32).toString('base64url');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,fields)=>plain(value)&&Object.keys(value).every(k=>fields.includes(k));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const inside=(x,y,z)=>x>=BOUNDS.minX&&x<=BOUNDS.maxX&&y>=BOUNDS.minY&&y<=BOUNDS.maxY&&z>=BOUNDS.minZ&&z<=BOUNDS.maxZ;
const fail=(status,message)=>Object.assign(new Error(message),{status});
let sharedBase;
function baseWorld(){
  if(sharedBase)return sharedBase;
  const context=vm.createContext({});
  vm.runInContext(readFileSync(new URL('../game/hardcore-world.js',import.meta.url),'utf8'),context,{timeout:1000});
  const blocks=new Map();
  context.MYNE_HARDCORE_WORLD.build((x,y,z,block)=>blocks.set(key(x,y,z),block),BOUNDS);
  sharedBase=(x,y,z)=>{
    const id=key(x,y,z);if(blocks.has(id))return blocks.get(id);
    if(y>=-40&&y<-8&&x>=-96&&x<=128&&z>=-96&&z<=96){
      if(y===-40)return 'stone';
      const ore=Math.abs(Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791));
      return y<-18&&ore%23===0?'ironore':ore%13===0?'copperore':'stone';
    }
    return null;
  };
  return sharedBase;
}

/** In-memory reference service. No external requests, files, chat, or student names. */
export function createRoomService({password=process.env.MYNE_TEACHER_PASSWORD,allowedOrigins=(process.env.MYNE_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean),moderationHook=null,automaticTextDetection=false,serveStatic=true,now=Date.now,limits={}}={}){
  if(typeof password!=='string'||password.length<16||password.length>256)throw Error('Set MYNE_TEACHER_PASSWORD to a private password of 16 to 256 characters.');
  if(moderationHook!==null&&typeof moderationHook!=='function')throw Error('moderationHook must be a server-side function.');
  if(automaticTextDetection&&!moderationHook)throw Error('Automatic text detection requires a configured server-side moderation hook.');
  const cap={rooms:16,players:40,edits:20000,events:500,body:2048,sessions:1000,ttl:8*60*60*1000,roomTtl:12*60*60*1000,...limits};
  // A whole classroom commonly shares one public address. Let one full room
  // use its token allowances, with headroom for teacher controls and joining.
  // Per-token/action limits still prevent one student consuming that budget.
  const tokenRequestsPerMinute=600;
  const sourceRequestsPerMinute=Math.min(30000,Math.max(3000,cap.players*tokenRequestsPerMinute+1200));
  const rooms=new Map(),sessions=new Map(),rates=new Map(),origins=new Set(allowedOrigins),passwordHash=digest(password),base=baseWorld();
  let requests=0;
  const staticRoot=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
  const moderationStatus=()=>({moderation:moderationHook?'server-hook':'teacher-review-only',automaticTextDetection:!!automaticTextDetection,moderationNotice:automaticTextDetection?'Server-side text review is configured.':'Automatic text detection is not configured. Teacher review is required.'});
  function joinCode(){let code;do{code=String(randomBytes(4).readUInt32BE()%100000000).padStart(8,'0');}while([...rooms.values()].some(r=>r.code===code));return code;}
  function clean(){
    const time=now();
    for(const [id,s]of sessions)if(s.expires<=time)sessions.delete(id);
    for(const [id,r]of rooms)if(r.expires<=time){rooms.delete(id);for(const[t,s]of sessions)if(s.roomId===id)sessions.delete(t);}
    for(const[id,r]of rates)if(r.until<=time)rates.delete(id);
  }
  function rate(id,max,window=60000){
    const time=now();let r=rates.get(id);
    if(!r||r.until<=time){if(rates.size>=4096)throw fail(503,'Server is busy. Try again shortly.');r={count:0,until:time+window};rates.set(id,r);}
    if(++r.count>max)throw fail(429,'Slow down and try again shortly.');
  }
  function issue(role,extra={}){
    if(sessions.size>=cap.sessions)throw fail(503,'Session limit reached.');
    const value=token();sessions.set(digest(value).toString('hex'),{role,...extra,expires:now()+cap.ttl});return value;
  }
  function auth(req){
    const header=req.headers.authorization||'';
    if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(header))throw fail(401,'Sign in or join a room first.');
    const id=digest(header.slice(7)).toString('hex'),s=sessions.get(id);
    if(!s||s.expires<=now())throw fail(401,'Session expired. Sign in or join again.');
    rate('token:'+id,tokenRequestsPerMinute);return s;
  }
  function teacher(s){if(s.role!=='teacher')throw fail(403,'Teacher access required.');}
  function member(s,room){
    if(s.role==='teacher')return null;
    if(s.roomId!==room.id)throw fail(403,'This session belongs to another room.');
    const p=room.players.get(s.studentId);
    if(!p||p.removed)throw fail(403,'The teacher removed this student from the room.');
    return p;
  }
  function event(room,type,studentId=null,evidence=null){
    room.sequence++;
    room.events.push({sequence:room.sequence,type,studentId,at:now(),...(evidence?{evidence}:{})});
    if(room.events.length>cap.events)room.events.shift();
  }
  const publicRoom=r=>({id:r.id,code:r.code,status:r.status,world:'resource-v1',mode:'creative',sequence:r.sequence,expires:r.expires,players:r.players.size,...moderationStatus()});
  const publicPlayer=p=>({id:p.id,number:p.number,locked:p.locked,removed:p.removed,x:p.x,y:p.y,z:p.z,yaw:p.yaw});
  const readBlock=(room,x,y,z)=>room.edits.has(key(x,y,z))?room.edits.get(key(x,y,z)):base(x,y,z);
  function writable(s,room){
    const p=member(s,room);if(!p)throw fail(403,'Join as a student to build.');
    if(room.status!=='open')throw fail(409,'The room is closed.');
    if(p.locked)throw fail(403,'The teacher paused this student for review.');
    return p;
  }
  async function body(req){
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw fail(415,'Use application/json.');
    let bytes=0;const chunks=[];
    for await(const chunk of req){bytes+=chunk.length;if(bytes>cap.body)throw fail(413,'Request is too large.');chunks.push(chunk);}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail(400,'Invalid JSON.');}
    if(!plain(data))throw fail(400,'Expected a JSON object.');return data;
  }
  async function moderate(room,p,edit){
    if(!moderationHook)return;
    let timer;
    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>moderationHook(Object.freeze({roomId:room.id,studentId:p.id,sequence:room.sequence,edit:Object.freeze({...edit}),edits:new Map(room.edits),getBlock:(x,y,z)=>readBlock(room,x,y,z)}))),
        new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Moderation timeout')),2000);})
      ]);
      if(result?.lock===true){p.locked=true;event(room,'moderation_review',p.id,evidence(room,edit,result));}
    }catch{p.locked=true;event(room,'moderation_unavailable',p.id,evidence(room,edit,{reason:'service-unavailable'}));}
    finally{clearTimeout(timer);}
  }
  function evidence(room,edit,result){
    const reasons=['text-review','symbol-review','manual-review','service-unavailable'];
    const center=[result.x,result.y,result.z].every(Number.isInteger)&&inside(result.x,result.y,result.z)?{x:result.x,y:result.y,z:result.z}:{x:edit.x,y:edit.y,z:edit.z};
    const blocks=[];let truncated=false;
    for(const[id,block]of room.edits){const[x,y,z]=id.split(',').map(Number);if(Math.abs(x-center.x)>8||Math.abs(y-center.y)>8||Math.abs(z-center.z)>8)continue;if(blocks.length<512)blocks.push({x,y,z,block});else truncated=true;}
    return {reason:reasons.includes(result.reason)?result.reason:'manual-review',center,radius:8,blocks,truncated};
  }
  function staticFile(req,res){
    if(!serveStatic||!['GET','HEAD'].includes(req.method))return false;
    let raw;try{raw=decodeURIComponent(req.url.split('?')[0]);}catch{throw fail(400,'Invalid path.');}
    if(raw.includes('\\')||raw.includes('\0')||raw.split('/').some(segment=>segment==='..'||segment.startsWith('.')))throw fail(404,'File not found.');
    const resource=raw==='/'?'index.html':raw.slice(1);
    if(resource!=='index.html'&&!resource.startsWith('game/'))return false;
    if(resource.split('/').includes('tests'))throw fail(404,'File not found.');
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
    const type=types[path.extname(resource).toLowerCase()];if(!type)throw fail(404,'File not found.');
    let file;try{file=realpathSync(path.join(staticRoot,resource));if(!file.startsWith(staticRoot+path.sep)||!statSync(file).isFile())throw Error('outside');}catch{throw fail(404,'File not found.');}
    const bytes=readFileSync(file);if(bytes.length>20*1024*1024)throw fail(413,'File is too large.');
    res.setHeader('Content-Type',type);res.writeHead(200);res.end(req.method==='HEAD'?undefined:bytes);return true;
  }
  async function route(req){
    clean();const method=req.method,url=new URL(req.url,'http://room.local'),parts=url.pathname.split('/').filter(Boolean);
    if(url.search)throw fail(400,'Query parameters are not supported.');
    const ip=req.socket.remoteAddress||'local';rate('request:'+ip,sourceRequestsPerMinute);
    if(method==='GET'&&url.pathname==='/api/health')return {ok:true,service:'mynecraft-rooms',version:1};
    if(method==='POST'&&url.pathname==='/api/teacher/login'){
      rate('login:'+ip,10,600000);const data=await body(req);
      if(!exact(data,['password'])||typeof data.password!=='string'||data.password.length>256)throw fail(400,'Invalid sign-in request.');
      if(!timingSafeEqual(digest(data.password),passwordHash))throw fail(401,'Incorrect teacher password.');
      return {token:issue('teacher'),expiresInSeconds:cap.ttl/1000};
    }
    if(method==='POST'&&url.pathname==='/api/join'){
      rate('join:'+ip,120);const data=await body(req);
      if(!exact(data,['code'])||typeof data.code!=='string'||!/^\d{8}$/.test(data.code))throw fail(400,'Enter the eight-digit room code.');
      const room=[...rooms.values()].find(r=>r.code===data.code);
      if(!room||room.status!=='open')throw fail(404,'Room code is unavailable. Ask your teacher.');
      if(room.players.size>=cap.players)throw fail(409,'This room is full.');
      const id=randomUUID(),p={id,number:room.players.size+1,locked:true,removed:false,x:.5,y:5.7,z:12.5,yaw:0,movedAt:now()};
      const value=issue('student',{roomId:room.id,studentId:id});room.players.set(id,p);event(room,'joined',id);
      return {token:value,roomId:room.id,studentId:id,number:p.number,world:'resource-v1',mode:'creative',bounds:BOUNDS,expiresInSeconds:cap.ttl/1000};
    }
    const s=auth(req);
    if(url.pathname==='/api/rooms'){
      teacher(s);
      if(method==='GET')return {rooms:[...rooms.values()].map(publicRoom)};
      if(method==='POST'){
        const data=await body(req);if(!exact(data,[]))throw fail(400,'Room creation does not accept names or settings.');
        if(rooms.size>=cap.rooms)throw fail(409,'Room limit reached.');
        const code=joinCode();
        const id=randomUUID(),room={id,code,status:'closed',expires:now()+cap.roomTtl,sequence:0,players:new Map(),edits:new Map(),events:[],queue:Promise.resolve()};
        rooms.set(id,room);event(room,'created');return publicRoom(room);
      }
    }
    if(parts[0]!=='api'||parts[1]!=='rooms'||!parts[2])throw fail(404,'Endpoint not found.');
    const room=rooms.get(parts[2]);if(!room)throw fail(404,'Room not found.');
    const p=member(s,room);
    if(method==='GET'&&parts.length===4&&parts[3]==='state'){
      rate('poll:'+(p?.id||'teacher'),120);
      return {roomId:room.id,status:room.status,world:'resource-v1',mode:'creative',sequence:room.sequence,bounds:BOUNDS,edits:Object.fromEntries(room.edits),players:[...room.players.values()].filter(v=>s.role==='teacher'||!v.removed).map(publicPlayer),self:p?publicPlayer(p):null,...(s.role==='teacher'?{code:room.code,events:room.events.slice()}:{}),...moderationStatus()};
    }
    if(method!=='POST')throw fail(404,'Endpoint not found.');
    const data=await body(req);
    const apply=async()=>{
      if(parts.length===4&&['open','close','reopen'].includes(parts[3])){
        teacher(s);if(!exact(data,['manualReview'])||(data.manualReview!==undefined&&typeof data.manualReview!=='boolean'))throw fail(400,'Invalid review acknowledgment.');
        if(parts[3]!=='close'&&!automaticTextDetection&&data.manualReview!==true)throw fail(409,'Automatic text detection is not configured. Explicitly acknowledge teacher review to open this room.');
        room.status=parts[3]==='close'?'closed':'open';event(room,parts[3]==='close'?'closed':'opened');return publicRoom(room);
      }
      if(parts.length===6&&parts[3]==='players'&&['lock','unlock','remove','restore'].includes(parts[5])){
        teacher(s);if(!exact(data,[]))throw fail(400,'No extra fields allowed.');
        const target=room.players.get(parts[4]);if(!target)throw fail(404,'Student not found.');
        if(parts[5]==='lock')target.locked=true;if(parts[5]==='unlock')target.locked=false;
        if(parts[5]==='remove'){target.removed=true;room.code=joinCode();}
        // Restoring a removed student leaves them paused until the teacher unlocks.
        if(parts[5]==='restore'){target.removed=false;target.locked=true;}
        event(room,parts[5],target.id);return publicPlayer(target);
      }
      const current=writable(s,room);
      if(parts.length===4&&parts[3]==='move'){
        rate('move:'+current.id,300);
        if(!exact(data,['x','y','z','yaw'])||![data.x,data.y,data.z,data.yaw].every(finite)||!inside(data.x,data.y,data.z)||Math.abs(data.yaw)>Math.PI*8)throw fail(400,'Invalid avatar position.');
        const distance=Math.hypot(data.x-current.x,data.y-current.y,data.z-current.z),elapsed=Math.min(2,Math.max(0,(now()-current.movedAt)/1000));
        if(distance>2+18*elapsed)throw fail(409,'Movement is too fast.');
        Object.assign(current,data,{movedAt:now()});room.sequence++;return {sequence:room.sequence,player:publicPlayer(current)};
      }
      if(parts.length===4&&parts[3]==='edit'){
        rate('edit:'+current.id,180);
        if(!exact(data,['x','y','z','block'])||![data.x,data.y,data.z].every(Number.isInteger)||!inside(data.x,data.y,data.z)||!(data.block===null||BLOCKS.includes(data.block)))throw fail(400,'Invalid block edit.');
        if(Math.hypot(data.x+.5-current.x,data.y+.5-current.y,data.z+.5-current.z)>8)throw fail(403,'Move closer before editing.');
        const id=key(data.x,data.y,data.z),before=readBlock(room,data.x,data.y,data.z);
        if(data.block!==null&&before!==null&&before!==undefined)throw fail(409,'That space already has a block.');
        if(data.block===null&&(before===null||before===undefined))throw fail(409,'That space is already empty.');
        if(data.block!==null&&[...room.players.values()].some(v=>!v.removed&&data.x+1>v.x-.3&&data.x<v.x+.3&&data.z+1>v.z-.3&&data.z<v.z+.3&&data.y+1>v.y-1.7&&data.y<v.y+.2))throw fail(409,'A student is standing there.');
        if(!room.edits.has(id)&&room.edits.size>=cap.edits)throw fail(409,'Room building limit reached.');
        room.edits.set(id,data.block);room.sequence++;
        await moderate(room,current,data);return {sequence:room.sequence,edit:{...data},locked:current.locked};
      }
      throw fail(404,'Endpoint not found.');
    };
    // Serialize room mutations so a close/lock cannot race a queued edit.
    const result=room.queue.then(apply);room.queue=result.catch(()=>{});return result;
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const origin=req.headers.origin;
    if(origin){
      const ownOrigin=(req.socket.encrypted?'https://':'http://')+req.headers.host;
      if(origin!==ownOrigin&&!origins.has(origin)){res.writeHead(403);res.end(JSON.stringify({error:'Origin not allowed.'}));return;}
      res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    }
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(++requests>64){requests--;res.writeHead(503);res.end(JSON.stringify({error:'Server is busy.'}));return;}
    try{if(staticFile(req,res))return;const result=await route(req);res.writeHead(200);res.end(JSON.stringify(result));}
    catch(error){res.writeHead(error.status||500);res.end(JSON.stringify({error:error.status?error.message:'Room service error.'}));}
    finally{requests--;}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;
  return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const server=createRoomService();const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';
    if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer from 1 to 65535.');
    server.listen(port,host,()=>console.log(`MYnecraft room service listening on ${host}:${port}. Rooms are held in memory.`));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
