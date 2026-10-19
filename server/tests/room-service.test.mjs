import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRoomService,BLOCKS } from '../room-service.mjs';
const password='test-only-secret-more-than-16';
async function start(options={}){
  const server=createRoomService({password,...options});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  return {server,async call(path,{method='POST',token,body={},headers={}}={}){const res=await fetch(base+path,{method,headers:{...(method==='POST'?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});return {status:res.status,data:res.status===204?null:await res.json()};},close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
async function setup(app){
  const login=await app.call('/api/teacher/login',{body:{password}});assert.equal(login.status,200);const teacher=login.data.token;
  const room=await app.call('/api/rooms',{token:teacher});assert.equal(room.data.status,'closed');
  const path=`/api/rooms/${room.data.id}`;
  await app.call(path+'/open',{token:teacher,body:{manualReview:true}});
  const join=await app.call('/api/join',{body:{code:room.data.code}});assert.equal(join.status,200);
  const pending=await app.call(path+'/state',{method:'GET',token:join.data.token});assert.equal(pending.data.self.locked,true,'all joins require teacher admission');
  assert.equal((await app.call(path+'/edit',{token:join.data.token,body:{x:1,y:4,z:12,block:'planks'}})).status,403);
  await app.call(path+'/players/'+join.data.studentId+'/unlock',{token:teacher});
  return {teacher,room:room.data,student:join.data};
}
test('no weak/default teacher password and block allowlist matches the game additions',()=>{assert.throws(()=>createRoomService({password:''}),/16 to 256/);assert.throws(()=>createRoomService({password:'short'}));assert.equal(BLOCKS.length,28);});
test('teacher auth, room isolation, closed/locked/removed students, and authoritative edits',async()=>{
  let time=100000;const app=await start({now:()=>time});try{
    assert.equal((await app.call('/api/teacher/login',{body:{password:'incorrect'}})).status,401);
    assert.equal((await app.call('/api/rooms')).status,401);
    const {teacher,room,student}=await setup(app),path=`/api/rooms/${room.id}`,s={token:student.token};
    assert.match(room.code,/^\d{8}$/);assert.equal(student.number,1);
    assert.equal((await app.call('/api/rooms',{...s})).status,403);
    assert.equal((await app.call(path+'/close',s)).status,403);
    const other=await app.call('/api/rooms',{token:teacher});
    assert.equal((await app.call(`/api/rooms/${other.data.id}/state`,{...s,method:'GET'})).status,403);
    assert.equal((await app.call(path+'/edit',{...s,body:{x:1,y:4,z:12,block:'planks'}})).status,200);
    assert.equal((await app.call(path+'/edit',{...s,body:{x:1,y:4,z:12,block:'stone'}})).status,409,'cannot overwrite existing block');
    assert.equal((await app.call(path+'/edit',{...s,body:{x:90,y:4,z:80,block:'planks'}})).status,403,'cannot edit from across the map');
    for(const body of [{x:1,y:-40,z:12,block:null},{x:1.2,y:4,z:12,block:null},{x:1,y:4,z:12,block:'script'},{x:1,y:4,z:12,block:null,name:'unapproved text'}])assert.equal((await app.call(path+'/edit',{...s,body})).status,400);
    const state=await app.call(path+'/state',{...s,method:'GET'});assert.equal(state.data.edits['1,4,12'],'planks');assert(!('events'in state.data));assert(!JSON.stringify(state.data).includes(student.token));assert(!JSON.stringify(state.data).includes(room.code));
    await app.call(path+'/close',{token:teacher});assert.equal((await app.call('/api/join',{body:{code:room.code}})).status,404);assert.equal((await app.call(path+'/edit',{...s,body:{x:1,y:4,z:12,block:null}})).status,409);
    assert.equal((await app.call(path+'/reopen',{token:teacher})).status,409,'manual review must be explicitly acknowledged');
    await app.call(path+'/reopen',{token:teacher,body:{manualReview:true}});const target=path+'/players/'+student.studentId;
    await app.call(target+'/lock',{token:teacher});assert.equal((await app.call(path+'/edit',{...s,body:{x:1,y:4,z:12,block:null}})).status,403);assert.equal((await app.call(path+'/move',{...s,body:{x:.5,y:6.7,z:12.5,yaw:0}})).status,403);
    await app.call(target+'/unlock',{token:teacher});assert.equal((await app.call(path+'/edit',{...s,body:{x:1,y:4,z:12,block:null}})).status,200);
    await app.call(target+'/remove',{token:teacher});assert.equal((await app.call(path+'/state',{...s,method:'GET'})).status,403);
    assert.equal((await app.call('/api/join',{body:{code:room.code}})).status,404,'removal rotates the invitation code');
    await app.call(target+'/restore',{token:teacher});assert.equal((await app.call(path+'/state',{...s,method:'GET'})).data.self.locked,true);
    await app.call(target+'/unlock',{token:teacher});time+=1000;
    assert.equal((await app.call(path+'/move',{...s,body:{x:2,y:6.7,z:12.5,yaw:1}})).status,200);
    assert.equal((await app.call(path+'/move',{...s,body:{x:60,y:6.7,z:12.5,yaw:1}})).status,409);
    const teacherState=await app.call(path+'/state',{token:teacher,method:'GET'});assert(teacherState.data.events.some(e=>e.type==='remove'));assert(teacherState.data.events.some(e=>e.type==='restored')===false);assert(teacherState.data.events.some(e=>e.type==='restore'));
  }finally{await app.close();}
});
test('body, player/edit/room/session bounds and expiration',async()=>{
  let time=0;const app=await start({now:()=>time,limits:{rooms:1,players:1,edits:1,ttl:1000,roomTtl:2000}});try{
    const {teacher,room,student}=await setup(app),path=`/api/rooms/${room.id}`;
    assert.equal((await app.call('/api/rooms',{token:teacher})).status,409);assert.equal((await app.call('/api/join',{body:{code:room.code}})).status,409);
    assert.equal((await app.call(path+'/edit',{token:student.token,body:{x:1,y:4,z:12,block:'planks'}})).status,200);
    assert.equal((await app.call(path+'/edit',{token:student.token,body:{x:2,y:4,z:12,block:'planks'}})).status,409);
    assert.equal((await app.call('/api/join',{body:{code:'1'.repeat(3000)}})).status,413);
    time=1001;assert.equal((await app.call(path+'/state',{token:student.token,method:'GET'})).status,401);
    time=2001;const login=await app.call('/api/teacher/login',{body:{password}});const list=await app.call('/api/rooms',{token:login.data.token,method:'GET'});assert.equal(list.data.rooms.length,0);
  }finally{await app.close();}
});
test('origins, login throttling, and optional authoritative moderation hook',async()=>{
  let sawGrid=false;const app=await start({allowedOrigins:['https://school.example'],moderationHook:({edits,getBlock,edit})=>{sawGrid=edits.get('1,4,12')==='planks'&&getBlock(1,4,12)==='planks'&&edit.block==='planks';edits.clear();return {lock:true,reason:'text-review',x:1,y:4,z:12};}});try{
    assert.equal((await app.call('/api/health',{method:'GET',headers:{Origin:'https://other.example'}})).status,403);
    assert.equal((await app.call('/api/health',{method:'GET',headers:{Origin:'https://school.example'}})).status,200);
    const {teacher,room,student}=await setup(app),path=`/api/rooms/${room.id}`;
    const edit=await app.call(path+'/edit',{token:student.token,body:{x:1,y:4,z:12,block:'planks'}});assert.equal(edit.status,200);assert(edit.data.locked);assert(sawGrid);
    const state=await app.call(path+'/state',{token:teacher,method:'GET'});assert.equal(state.data.edits['1,4,12'],'planks','hook copy cannot mutate authoritative edits');const review=state.data.events.find(e=>e.type==='moderation_review');assert(review);assert.equal(review.evidence.reason,'text-review');assert.deepEqual(review.evidence.blocks,[{x:1,y:4,z:12,block:'planks'}]);
    assert.equal((await app.call(path+'/edit',{token:student.token,body:{x:1,y:4,z:12,block:null}})).status,403);
    for(let i=0;i<9;i++)await app.call('/api/teacher/login',{body:{password:'wrong'}});
    assert.equal((await app.call('/api/teacher/login',{body:{password}})).status,429);
  }finally{await app.close();}
});
test('a classroom sharing one source address can poll and move without bypassing individual limits',async()=>{
  let time=100000;const app=await start({now:()=>time});try{
    const {teacher,room,student}=await setup(app),path=`/api/rooms/${room.id}`,students=[student];
    for(let i=1;i<10;i++){
      const joined=await app.call('/api/join',{body:{code:room.code}});assert.equal(joined.status,200);
      const admitted=await app.call(path+'/players/'+joined.data.studentId+'/unlock',{token:teacher});assert.equal(admitted.status,200);students.push(joined.data);
    }
    // Ten browsers on this same loopback address use the shipped 250ms move
    // and 750ms poll cadence. The former 3,000/address limit failed this case.
    let requests=0;
    for(let tick=0;tick<240;tick++){
      time=100000+tick*250;
      const moves=await Promise.all(students.map(s=>app.call(path+'/move',{token:s.token,body:{x:.5,y:5.7,z:12.5,yaw:0}})));
      for(const reply of moves){assert.equal(reply.status,200,`same-address movement tick ${tick}`);requests++;}
      if(tick%3===0){
        const states=await Promise.all(students.map(s=>app.call(path+'/state',{method:'GET',token:s.token})));
        for(const reply of states){assert.equal(reply.status,200,`same-address state tick ${tick}`);requests++;}
      }
    }
    assert.equal(requests,3200);
    let throttled=false;
    for(let i=0;i<60;i++){
      const reply=await app.call(path+'/state',{method:'GET',token:students[0].token});
      if(reply.status===429){throttled=true;break;}assert.equal(reply.status,200);
    }
    assert(throttled,'one student cannot bypass the per-student poll limit');
    assert.equal((await app.call(path+'/state',{method:'GET',token:students[1].token})).status,200,'throttling one student does not stop classmates');
    assert.equal((await app.call(path+'/close',{token:teacher})).status,200,'teacher controls remain available after classroom traffic');
  }finally{await app.close();}
});
