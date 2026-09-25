import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=mkdtempSync(path.join(os.tmpdir(),'nautilus-test-'));
const port=33000+Math.floor(Math.random()*10000);
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(''),env:{...process.env,DATA_DIR:dir,PORT:String(port),ADMIN_PASSWORD:'test-secret',SESSION_SECRET:'test-signature-secret'},stdio:'ignore'});
async function call(route,body,cookie=''){
  const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',cookie},body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
}
async function ready(){
  for(let i=0;i<60;i++){try{const r=await call('/api/health');if(r.status===200)return}catch{} await new Promise(resolve=>setTimeout(resolve,50))}
  throw Error('Server did not start');
}

test('Nautilus-only catalog books a private room once and supports owner inventory',async()=>{
  try{
    await ready();
    const page=await fetch(base+'/');
    assert.equal(page.status,200);
    const html=await page.text();
    assert.match(html,/NAUTILUS/);
    assert.match(html,/SAFETY · SERVICE · TRUST/);
    assert.match(html,/No money is collected/);
    const catalog=await call('/api/catalog');
    assert.equal(catalog.data.boats.length,1);
    const boat=catalog.data.boats[0];
    assert.equal(boat.name,'Nautilus');
    assert.equal(boat.source_url,'https://www.bdcruise.com/nautilus/');
    assert.deepEqual(boat.rooms.map(r=>r.capacity).sort((a,b)=>a-b),[4,5,6,8,12]);
    const date=boat.departures[0],room=boat.rooms.find(r=>r.capacity===4);
    const key={departure_id:date.id,room_id:room.id,guest_count:2};
    const parallel=await Promise.all([call('/api/holds',key),call('/api/holds',key)]);
    assert.deepEqual(parallel.map(r=>r.status).sort(),[201,409]);
    const hold=parallel.find(r=>r.status===201).data;
    assert.equal(hold.amount,room.price_per_person*room.capacity);
    const confirmed=await call('/api/checkout',{hold_id:hold.id,guest_name:'Test Guest',guest_phone:'01700000000'});
    assert.equal(confirmed.status,201);
    assert.equal((await call('/api/holds',key)).status,409);
    const booking=await call('/api/bookings/'+confirmed.data.booking_id);
    assert.equal(booking.data.boat_name,'Nautilus');
    assert.match(booking.data.terms_snapshot,/Concept reservation only/);

    const login=await call('/api/login',{password:'test-secret'});
    assert.equal(login.status,200);
    const owner=login.cookie.split(';')[0];
    const overview=await call('/api/owner/overview',undefined,owner);
    assert.equal(overview.data.bookings.length,1);

    const next=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
    const departure=await call('/api/owner/departures',{boat_id:boat.id,departure_date:next},owner);
    assert.equal(departure.status,201);
    const price=await call('/api/owner/prices',{departure_id:departure.data.id,room_id:room.id,price_per_person:12000},owner);
    assert.equal(price.status,200);
    const updated=await call('/api/catalog');
    assert.equal(updated.data.boats.length,1);
    const specific=updated.data.boats[0].departures.find(d=>d.id===departure.data.id);
    assert.equal(specific.prices[room.id],12000);
    assert.equal((await call('/api/owner/catalog')).status,401);
  }finally{
    child.kill();
    rmSync(dir,{recursive:true,force:true});
  }
});
